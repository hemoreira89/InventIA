// ─── Integração com brapi.dev ────────────────────────────────────────────────
// API gratuita de cotações da B3. Sem auth necessário no plano free.
// Docs: https://brapi.dev/

const BRAPI_BASE = "https://brapi.dev/api";
const CACHE_TTL_MS = 60 * 1000; // cache local de 1min para evitar rate limit
const cache = new Map(); // ticker → { data, timestamp }

/**
 * Busca cotações de múltiplos tickers em uma única chamada.
 * @param {string[]} tickers - Array de tickers (ex: ['PETR4', 'VALE3'])
 * @returns {Promise<Object>} Mapa ticker → cotação
 */
export async function buscarCotacoes(tickers) {
  if (!tickers || tickers.length === 0) return {};

  // Filtra os que já estão no cache (e ainda válidos)
  const agora = Date.now();
  const naoCacheados = [];
  const resultado = {};

  for (const t of tickers) {
    const cached = cache.get(t);
    if (cached && (agora - cached.timestamp) < CACHE_TTL_MS) {
      resultado[t] = cached.data;
    } else {
      naoCacheados.push(t);
    }
  }

  if (naoCacheados.length === 0) return resultado;

  try {
    // brapi aceita múltiplos tickers separados por vírgula
    const tickersStr = naoCacheados.join(",");
    const response = await fetch(`${BRAPI_BASE}/quote/${tickersStr}`);

    if (!response.ok) {
      console.warn(`brapi: HTTP ${response.status}`);
      return resultado; // retorna o que tinha em cache
    }

    const data = await response.json();
    if (!data.results || !Array.isArray(data.results)) {
      console.warn("brapi: formato inesperado", data);
      return resultado;
    }

    for (const r of data.results) {
      const cotacao = {
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
      resultado[r.symbol] = cotacao;
      cache.set(r.symbol, { data: cotacao, timestamp: agora });
    }
  } catch (e) {
    console.error("Erro brapi:", e.message);
  }

  return resultado;
}

/**
 * Busca a cotação de UM ticker.
 * @param {string} ticker
 * @returns {Promise<Object|null>}
 */
export async function buscarCotacao(ticker) {
  const r = await buscarCotacoes([ticker]);
  return r[ticker] || null;
}

/**
 * Limpa o cache (útil para forçar refresh).
 */
export function limparCacheCotacoes() {
  cache.clear();
}

/**
 * Retorna a quantidade de tickers em cache.
 */
export function tamanhoCacheCotacoes() {
  return cache.size;
}
