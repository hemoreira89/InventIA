// ─── Proxy para bolsai (api.usebolsai.com) ──────────────────────────────────
// Fundamentos quantitativos + setor da empresa, com dados oficiais B3/CVM.
// Plano FREE: 200 req/dia.
//
// Endpoints da bolsai usados:
//   GET /fundamentals/{ticker} → ações (P/L, ROE, P/VP, DY, ...)
//   GET /fiis/{ticker}         → FIIs (P/VP, DY, NAV, ...)
//   GET /companies/{ticker}    → setor + dados cadastrais
//
// Auth: header X-API-Key
//
// Usage:
//   GET /api/fundamentos?tickers=PETR4,BBAS3,HGLG11

export const config = {
  maxDuration: 10
};

const BOLSAI_BASE = "https://api.usebolsai.com/api/v1";

// Caches em memória separados por TTL diferente:
// - Fundamentos: 24h (mudam em balanço trimestral, suficiente)
// - Setor: 7 dias (raramente muda, economiza cota da bolsai)
const FUNDAMENTOS_TTL_MS = 24 * 60 * 60 * 1000;
const SETOR_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const cacheFundamentos = new Map(); // ticker → { data, ts }
const cacheSetor = new Map();        // ticker → { setorCVM, ts }

// Heurística inicial. Tickers terminados em 11 podem ser:
// - FIIs (HGLG11, MXRF11)
// - Units (TAEE11, SAPR11, KLBN11) - combo PN+ON, são AÇÕES
// - ETFs (BOVA11, IVVB11) - não suportados, vão dar 404
// Não dá para distinguir só pelo sufixo, então tentamos action endpoint primeiro
// e caímos para FII se voltar 404. Cache evita repetir tentativas.
const cacheTipoTicker = new Map(); // ticker → 'acao' | 'fii' | 'desconhecido'

function isPossivelFII(ticker) {
  return /11$/.test(ticker || "");
}

function getFromCache(cache, key, ttlMs) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > ttlMs) {
    cache.delete(key);
    return null;
  }
  // cacheFundamentos guarda em .data, cacheSetor guarda em .setorCVM
  return item.data !== undefined ? item.data : item.setorCVM;
}

function setFundamentosCache(key, data) {
  cacheFundamentos.set(key, { data, ts: Date.now() });
}

function setSetorCache(key, setorCVM) {
  cacheSetor.set(key, { setorCVM, ts: Date.now() });
}

/**
 * Mapeia campos da bolsai (ação) pros nomes que criterios.js espera.
 */
function mapearAcao(raw, setorCVM) {
  return {
    ticker: raw.ticker,
    nome: raw.corporate_name,
    tipo: "Ação",
    referencia: raw.reference_date,

    // Setor (vem de /companies/{ticker})
    setorCVM: setorCVM ?? null,

    // Critérios em criterios.js esperam estes nomes:
    pl: raw.pl,
    pvp: raw.pvp,
    roe: raw.roe,
    dy: null,                          // bolsai não retorna DY direto pra ações
    margemLiquida: raw.net_margin,
    divEbitda: raw.net_debt_ebitda,

    // Bônus (úteis em features futuras)
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
    lucrosConsistentes: raw.cagr_earnings_5y != null && raw.cagr_earnings_5y > 0,

    fonte: "bolsai",
    atualizadoEm: new Date().toISOString()
  };
}

function mapearFII(raw, setorCVM) {
  return {
    ticker: raw.ticker,
    nome: raw.name,
    tipo: "FII",
    referencia: raw.reference_date,

    // Setor (FIIs geralmente vem null em /companies, mas tentamos)
    setorCVM: setorCVM ?? null,

    pvp: raw.pvp,
    dy: raw.dividend_yield_ttm,
    vacancia: null,
    liquidez: null,

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

/**
 * Busca o setor de um ticker.
 * Tenta cache primeiro, senão chama /companies/{ticker}.
 * Para FIIs geralmente retorna null (e tudo bem - critérios de FII não usam setor).
 */
async function buscarSetor(ticker, apiKey) {
  // Cache 7 dias - cacheia inclusive null (significa "tentei e não tem setor")
  const item = cacheSetor.get(ticker);
  if (item && (Date.now() - item.ts) <= SETOR_TTL_MS) {
    return item.setorCVM;
  }

  try {
    const r = await fetch(`${BOLSAI_BASE}/companies/${ticker}`, {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(5000)
    });

    if (!r.ok) {
      // 404 ou outros - cacheia null por 7 dias para não tentar de novo
      setSetorCache(ticker, null);
      return null;
    }

    const data = await r.json();
    const setorCVM = data.sector || null;
    setSetorCache(ticker, setorCVM);
    return setorCVM;

  } catch (e) {
    console.warn(`Setor ${ticker} falhou:`, e.message);
    return null; // não cacheia em erro de rede - tenta de novo na próxima
  }
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

    // Verifica cache de fundamentos
    for (const t of tickers) {
      const cached = getFromCache(cacheFundamentos, t, FUNDAMENTOS_TTL_MS);
      if (cached) {
        resultado[t] = cached;
      } else {
        tickersParaBuscar.push(t);
      }
    }

    if (tickersParaBuscar.length === 0) {
      return res.status(200).json({ results: resultado, fromCache: true });
    }

    // bolsai não suporta múltiplos tickers em 1 request → paraleliza
    // Para cada ticker, busca FUNDAMENTOS + SETOR em paralelo (2 reqs por ticker)
    const promessas = tickersParaBuscar.map(async (t) => {
      try {
        // Estratégia para descobrir se é ação ou FII:
        // - Se já sabemos pelo cacheTipoTicker, usa direto
        // - Senão, para tickers *11: tenta ação primeiro (units como TAEE11/SAPR11/KLBN11),
        //   se 404 cai para FII. Cache evita repetir.
        // - Para tickers *3/*4: vai direto para ação.
        const tipoCache = cacheTipoTicker.get(t);
        const podeSerFII = isPossivelFII(t);

        // Função que busca em um path específico
        const tentar = async (path) => {
          const r = await fetch(`${BOLSAI_BASE}${path}`, {
            headers: { 'X-API-Key': apiKey },
            signal: AbortSignal.timeout(8000)
          });
          return r;
        };

        // Decide ordem de tentativa
        let pathPrincipal, pathFallback, ehFIIInicial;
        if (tipoCache === "fii") {
          pathPrincipal = `/fiis/${t}`;
          ehFIIInicial = true;
        } else if (tipoCache === "acao") {
          pathPrincipal = `/fundamentals/${t}`;
          ehFIIInicial = false;
        } else {
          // Sem cache: tenta ação primeiro
          // Se ticker *11, prepara fallback para FII
          pathPrincipal = `/fundamentals/${t}`;
          ehFIIInicial = false;
          if (podeSerFII) pathFallback = `/fiis/${t}`;
        }

        // Paraleliza fundamentos + setor
        const [respFund, setorCVM] = await Promise.all([
          tentar(pathPrincipal),
          buscarSetor(t, apiKey)
        ]);

        let respFinal = respFund;
        let ehFII = ehFIIInicial;

        // Se principal falhou com 404 e tem fallback, tenta o outro endpoint
        if (!respFund.ok && respFund.status === 404 && pathFallback) {
          const respFallback = await tentar(pathFallback);
          if (respFallback.ok) {
            respFinal = respFallback;
            ehFII = !ehFIIInicial;
          }
        }

        if (!respFinal.ok) {
          const errBody = await respFinal.json().catch(() => ({}));
          // Se 404 final, cacheia como desconhecido (evita re-tentar)
          if (respFinal.status === 404) {
            cacheTipoTicker.set(t, "desconhecido");
          }
          return {
            ticker: t,
            erro: errBody.error || errBody.detail || `HTTP ${respFinal.status}`,
            status: respFinal.status
          };
        }

        // Sucesso - cacheia o tipo descoberto
        cacheTipoTicker.set(t, ehFII ? "fii" : "acao");

        const raw = await respFinal.json();
        const mapeado = ehFII ? mapearFII(raw, setorCVM) : mapearAcao(raw, setorCVM);
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
      setFundamentosCache(resposta.ticker, resposta.data);
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
