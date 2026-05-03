// ─── Cliente para /api/fundamentos ───────────────────────────────────────────
// Busca dados fundamentalistas via proxy local (que chama bolsai.com).
// Cache local de 1h reduz round-trips ao Vercel (que tem cache de 24h).

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h client-side
const cache = new Map(); // ticker → { data, timestamp }

/**
 * Busca dados fundamentalistas de múltiplos tickers.
 * @param {string[]} tickers
 * @returns {Promise<Object>} Mapa ticker → fundamentos
 */
export async function buscarFundamentos(tickers) {
  if (!tickers || tickers.length === 0) return {};

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
    const tickersStr = naoCacheados.join(",");
    const response = await fetch(`/api/fundamentos?tickers=${tickersStr}`, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      console.warn(`/api/fundamentos: HTTP ${response.status}`);
      return resultado;
    }

    const data = await response.json();
    if (!data.results) return resultado;

    for (const ticker of Object.keys(data.results)) {
      const item = data.results[ticker];
      if (item.erro) {
        console.warn(`Fundamentos ${ticker}: ${item.erro}`);
        continue;
      }
      resultado[ticker] = item;
      cache.set(ticker, { data: item, timestamp: agora });
    }
  } catch (e) {
    console.error("Erro buscando fundamentos:", e.message);
  }

  return resultado;
}

/**
 * Busca fundamentos de UM ticker.
 */
export async function buscarFundamento(ticker) {
  const r = await buscarFundamentos([ticker]);
  return r[ticker] || null;
}

/**
 * Limpa o cache local.
 */
export function limparCacheFundamentos() {
  cache.clear();
}
