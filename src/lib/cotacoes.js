// ─── Integração com proxy /api/cotacoes ─────────────────────────────────────
// Antes chamava brapi.dev diretamente. Agora chama proxy local que:
//   1. Adiciona token (não exposto no frontend)
//   2. Tem cache server-side (5min cotações, 24h fundamentos)
//   3. Permite buscar fundamentalistas com fundamentos=true

// Cache local também (reduz round-trips ao Vercel)
const CACHE_TTL_MS = 60 * 1000; // 1min - alinha com auto-refresh
const cache = new Map(); // chave: "ticker|hasFund" → { data, timestamp }

function chave(ticker, comFundamentos) {
  return `${ticker}|${comFundamentos ? "F" : "C"}`;
}

/**
 * Busca cotações de múltiplos tickers via proxy local.
 * @param {string[]} tickers - Array de tickers (ex: ['PETR4', 'VALE3'])
 * @param {Object} opts - { comFundamentos: boolean }
 * @returns {Promise<Object>} Mapa ticker → cotação (com .fundamentos se solicitado)
 */
export async function buscarCotacoes(tickers, opts = {}) {
  if (!tickers || tickers.length === 0) return {};
  const comFundamentos = opts.comFundamentos === true;

  const agora = Date.now();
  const naoCacheados = [];
  const resultado = {};

  for (const t of tickers) {
    const k = chave(t, comFundamentos);
    const cached = cache.get(k);
    if (cached && (agora - cached.timestamp) < CACHE_TTL_MS) {
      resultado[t] = cached.data;
    } else {
      naoCacheados.push(t);
    }
  }

  if (naoCacheados.length === 0) return resultado;

  try {
    const tickersStr = naoCacheados.join(",");
    const url = comFundamentos
      ? `/api/cotacoes?tickers=${tickersStr}&fundamentos=true`
      : `/api/cotacoes?tickers=${tickersStr}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.warn(`/api/cotacoes: HTTP ${response.status}`);
      return resultado;
    }

    const data = await response.json();
    if (!data.results) {
      console.warn("/api/cotacoes: sem campo results", data);
      return resultado;
    }

    for (const ticker of Object.keys(data.results)) {
      const item = data.results[ticker];
      if (item.erro) {
        console.warn(`Cotação ${ticker} falhou: ${item.erro}`);
        continue;
      }
      resultado[ticker] = item;
      cache.set(chave(ticker, comFundamentos), { data: item, timestamp: agora });
    }
  } catch (e) {
    console.error("Erro buscando cotações:", e.message);
  }

  return resultado;
}

/**
 * Busca a cotação de UM ticker.
 * @param {string} ticker
 * @param {Object} opts - { comFundamentos: boolean }
 * @returns {Promise<Object|null>}
 */
export async function buscarCotacao(ticker, opts) {
  const r = await buscarCotacoes([ticker], opts);
  return r[ticker] || null;
}

/**
 * Limpa o cache (útil para forçar refresh).
 */
export function limparCacheCotacoes() {
  cache.clear();
}

/**
 * Retorna a quantidade de itens em cache.
 */
export function tamanhoCacheCotacoes() {
  return cache.size;
}
