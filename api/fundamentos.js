// ─── Proxy para bolsai (api.usebolsai.com) ──────────────────────────────────
// Fundamentos quantitativos de ações e FIIs com dados oficiais B3/CVM.
// Plano FREE: 200 req/dia, mais que suficiente com cache de 24h server-side.
//
// Endpoints da bolsai:
//   GET /fundamentals/{ticker} → ações (P/L, ROE, P/VP, DY, ...)
//   GET /fiis/{ticker}         → FIIs (P/VP, DY, NAV, ...)
//
// Auth: header X-API-Key
//
// Usage:
//   GET /api/fundamentos?tickers=PETR4,BBAS3,HGLG11

export const config = {
  maxDuration: 10
};

const BOLSAI_BASE = "https://api.usebolsai.com/api/v1";

// Cache em memória (24h - fundamentos só mudam em balanço trimestral)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map(); // ticker → { data, ts }

function isFII(ticker) {
  return /11$/.test(ticker || "");
}

function getFromCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

/**
 * Mapeia campos da bolsai pros nomes que criterios.js espera.
 * Crítico: os nomes em criterios.js (CRITERIOS_ACAO/CRITERIOS_FII) precisam bater.
 */
function mapearAcao(raw) {
  return {
    ticker: raw.ticker,
    nome: raw.corporate_name,
    tipo: "Ação",
    referencia: raw.reference_date,

    // Critérios em criterios.js esperam estes nomes:
    pl: raw.pl,                        // P/L
    pvp: raw.pvp,                      // P/VP
    roe: raw.roe,                      // ROE (%)
    dy: null,                          // DY: bolsai não retorna em /fundamentals para ações
                                       // (calculado a partir de dividendos no histórico)
    margemLiquida: raw.net_margin,     // %
    divEbitda: raw.net_debt_ebitda,    // Dívida Líquida / EBITDA
    pl: raw.pl,

    // Bônus (não usados pelos critérios atuais, mas podem ser úteis)
    roic: raw.roic,
    roa: raw.roa,
    evEbitda: raw.ev_ebitda,
    margemBruta: raw.gross_margin,
    margemEbitda: raw.ebitda_margin,
    cagrLucro5y: raw.cagr_earnings_5y,
    cagrReceita5y: raw.cagr_revenue_5y,
    debtEquity: raw.debt_equity,
    marketCap: raw.market_cap,
    vpa: raw.vpa,
    lpa: raw.lpa,

    // Lucros consistentes 5 anos: derivado do CAGR positivo
    // Se cagr_earnings_5y > 0, lucros foram crescentes nos últimos 5 anos
    lucrosConsistentes: raw.cagr_earnings_5y != null && raw.cagr_earnings_5y > 0,

    fonte: "bolsai",
    atualizadoEm: new Date().toISOString()
  };
}

function mapearFII(raw) {
  return {
    ticker: raw.ticker,
    nome: raw.name,
    tipo: "FII",
    referencia: raw.reference_date,

    // Critérios em criterios.js esperam estes nomes:
    pvp: raw.pvp,                              // P/VP do FII
    dy: raw.dividend_yield_ttm,                // DY 12 meses
    vacancia: null,                            // bolsai não fornece (limitação)
    liquidez: null,                            // bolsai não fornece (limitação)

    // Bônus
    nav: raw.net_asset_value,
    vpa: raw.book_value_per_share,
    cotistas: raw.total_shareholders,
    segmento: raw.segment,
    gestao: raw.management_type,
    sharesOutstanding: raw.shares_outstanding,

    fonte: "bolsai",
    atualizadoEm: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.BOLSAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'BOLSAI_API_KEY não configurada' });
  }

  const tickersParam = (req.query.tickers || '').trim().toUpperCase();
  if (!tickersParam) {
    return res.status(400).json({ error: 'Parâmetro tickers é obrigatório' });
  }

  const tickers = tickersParam.split(',').map(t => t.trim()).filter(Boolean);
  if (tickers.length === 0 || tickers.length > 20) {
    return res.status(400).json({ error: 'Forneça 1 a 20 tickers' });
  }

  try {
    const resultado = {};
    const tickersParaBuscar = [];

    // Verifica cache
    for (const t of tickers) {
      const cached = getFromCache(t);
      if (cached) {
        resultado[t] = cached;
      } else {
        tickersParaBuscar.push(t);
      }
    }

    if (tickersParaBuscar.length === 0) {
      return res.status(200).json({ results: resultado, fromCache: true });
    }

    // bolsai não suporta múltiplos tickers em 1 request, então paraleliza
    // Direciona ações pra /fundamentals e FIIs pra /fiis
    const promessas = tickersParaBuscar.map(async (t) => {
      const ehFII = isFII(t);
      const path = ehFII ? `/fiis/${t}` : `/fundamentals/${t}`;

      try {
        const r = await fetch(`${BOLSAI_BASE}${path}`, {
          headers: { 'X-API-Key': apiKey },
          signal: AbortSignal.timeout(8000)
        });

        if (!r.ok) {
          // 404 = ticker não encontrado, 429 = rate limit, etc
          const errBody = await r.json().catch(() => ({}));
          return {
            ticker: t,
            erro: errBody.error || errBody.detail || `HTTP ${r.status}`,
            status: r.status
          };
        }

        const raw = await r.json();
        const mapeado = ehFII ? mapearFII(raw) : mapearAcao(raw);
        return { ticker: t, data: mapeado };

      } catch (e) {
        console.warn(`bolsai ${t} falhou:`, e.message);
        return { ticker: t, erro: e.message };
      }
    });

    const respostas = await Promise.all(promessas);

    for (const resposta of respostas) {
      if (resposta.erro || !resposta.data) {
        resultado[resposta.ticker] = {
          erro: resposta.erro || 'Falhou',
          status: resposta.status
        };
        continue;
      }
      resultado[resposta.ticker] = resposta.data;
      setCache(resposta.ticker, resposta.data);
    }

    return res.status(200).json({
      results: resultado,
      fromCache: false,
      cached: tickers.length - tickersParaBuscar.length,
      fetched: tickersParaBuscar.length
    });

  } catch (err) {
    console.error('Erro /api/fundamentos:', err);
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
}
