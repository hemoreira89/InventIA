// ─── Proxy para brapi.dev com cache em memória ──────────────────────────────
// Tokens nunca vão para o frontend (segurança).
// Cache reduz uso da cota gratuita (15k req/mês).
//
// Usage:
//   GET /api/cotacoes?tickers=PETR4,VALE3
//   GET /api/cotacoes?tickers=PETR4&fundamentos=true

export const config = {
  maxDuration: 10
};

const BRAPI_BASE = "https://brapi.dev/api";

// Caches em memória (compartilhados entre invocações warm da mesma instância)
// Cotações: 5 minutos (preço varia ao longo do dia)
// Fundamentos: 24 horas (DY/ROE/P/L só mudam quando empresa divulga balanço)
const COTACAO_TTL_MS = 5 * 60 * 1000;
const FUNDAMENTOS_TTL_MS = 24 * 60 * 60 * 1000;

const cacheCotacoes = new Map(); // ticker → { data, ts }
const cacheFundamentos = new Map(); // ticker → { data, ts }

function getFromCache(cache, key, ttlMs) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > ttlMs) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(cache, key, data) {
  cache.set(key, { data, ts: Date.now() });
}

/**
 * Extrai dados de cotação do response da brapi.
 */
function extrairCotacao(r) {
  return {
    ticker: r.symbol,
    nome: r.shortName || r.longName,
    preco: r.regularMarketPrice,
    variacao: r.regularMarketChange,
    variacaoPct: r.regularMarketChangePercent,
    max: r.regularMarketDayHigh,
    min: r.regularMarketDayLow,
    volume: r.regularMarketVolume,
    marketCap: r.marketCap,
    moeda: r.currency,
    atualizadoEm: new Date().toISOString()
  };
}

/**
 * Extrai dados fundamentalistas do response da brapi.
 * No plano Free, brapi retorna alguns indicadores básicos com fundamental=true.
 * Pode ser que nem todos venham populados — campos null indicam indisponível.
 */
function extrairFundamentos(r) {
  // brapi pode retornar fundamentos em diferentes campos dependendo do plano
  // Plano free com ?fundamental=true: P/L, LPA são os mais consistentes
  // Demais (DY, P/VP, ROE, MgL, DivLiq/EBITDA) podem vir null no free
  return {
    ticker: r.symbol,
    pl: r.priceEarnings ?? null,
    lpa: r.earningsPerShare ?? null,
    dy: r.dividendYield ?? null,
    pvp: r.priceToBookRatio ?? null,
    roe: r.returnOnEquity ?? null,
    margemLiquida: r.netMargin ?? null,
    divEbitda: r.netDebtToEbitda ?? null,
    setor: r.sector ?? r.industry ?? null,
    atualizadoEm: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.BRAPI_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'BRAPI_TOKEN não configurado no servidor' });
  }

  const tickersParam = (req.query.tickers || '').trim().toUpperCase();
  if (!tickersParam) {
    return res.status(400).json({ error: 'Parâmetro tickers é obrigatório' });
  }

  const incluirFundamentos = req.query.fundamentos === 'true';
  const tickers = tickersParam.split(',').map(t => t.trim()).filter(Boolean);
  if (tickers.length === 0) {
    return res.status(400).json({ error: 'Nenhum ticker válido' });
  }

  // Limita a 20 tickers por request (proteção)
  if (tickers.length > 20) {
    return res.status(400).json({ error: 'Máximo de 20 tickers por requisição' });
  }

  try {
    const resultado = {};
    const tickersParaBuscar = [];

    // Verifica cache de cotações
    for (const t of tickers) {
      const cot = getFromCache(cacheCotacoes, t, COTACAO_TTL_MS);
      const fund = incluirFundamentos ? getFromCache(cacheFundamentos, t, FUNDAMENTOS_TTL_MS) : null;

      if (cot && (!incluirFundamentos || fund)) {
        // Tudo o que precisa está em cache
        resultado[t] = { ...cot };
        if (incluirFundamentos && fund) resultado[t].fundamentos = fund;
      } else {
        tickersParaBuscar.push(t);
      }
    }

    // Se tudo veio do cache, retorna direto
    if (tickersParaBuscar.length === 0) {
      return res.status(200).json({ results: resultado, fromCache: true });
    }

    // Plano gratuito da brapi: 1 ticker por request.
    // Faz uma request por ticker em paralelo.
    const url = (ticker) => {
      const params = new URLSearchParams({ token });
      if (incluirFundamentos) params.append('fundamental', 'true');
      return `${BRAPI_BASE}/quote/${ticker}?${params}`;
    };

    const promessas = tickersParaBuscar.map(async (t) => {
      try {
        const r = await fetch(url(t), { signal: AbortSignal.timeout(8000) });
        if (!r.ok) {
          console.warn(`brapi ${t}: HTTP ${r.status}`);
          return { ticker: t, erro: `HTTP ${r.status}` };
        }
        const data = await r.json();
        const result = data.results?.[0];
        if (!result) return { ticker: t, erro: 'Sem resultado' };
        return { ticker: t, result };
      } catch (e) {
        console.warn(`brapi ${t} falhou:`, e.message);
        return { ticker: t, erro: e.message };
      }
    });

    const respostas = await Promise.all(promessas);

    for (const resposta of respostas) {
      if (resposta.erro || !resposta.result) {
        resultado[resposta.ticker] = { erro: resposta.erro || 'Falhou' };
        continue;
      }
      const cot = extrairCotacao(resposta.result);
      setCache(cacheCotacoes, resposta.ticker, cot);

      const item = { ...cot };
      if (incluirFundamentos) {
        const fund = extrairFundamentos(resposta.result);
        setCache(cacheFundamentos, resposta.ticker, fund);
        item.fundamentos = fund;
      }
      resultado[resposta.ticker] = item;
    }

    return res.status(200).json({
      results: resultado,
      fromCache: false,
      cached: tickers.length - tickersParaBuscar.length,
      fetched: tickersParaBuscar.length
    });

  } catch (err) {
    console.error('Erro /api/cotacoes:', err);
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
}
