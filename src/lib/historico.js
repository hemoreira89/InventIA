// ─── Cliente para /api/historico ─────────────────────────────────────────────
// Busca histórico de preços via proxy local (que chama brapi).
// Cache local de 1h - sparklines não precisam atualizar a todo momento.

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const cache = new Map(); // chave: "ticker|range" → { data, timestamp }

/**
 * Busca histórico de preços de um ticker.
 * @param {string} ticker - ex: "PETR4"
 * @param {string} range - "1mo" | "3mo" | "6mo" | "1y" (default "1mo")
 * @returns {Promise<{pontos: Array<{d, c}>, precoAtual, min52, max52}|null>}
 */
export async function buscarHistorico(ticker, range = "1mo") {
  if (!ticker) return null;

  const key = `${ticker}|${range}`;
  const cached = cache.get(key);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const r = await fetch(`/api/historico?ticker=${ticker}&range=${range}`, {
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) {
      console.warn(`/api/historico ${ticker}: HTTP ${r.status}`);
      return null;
    }
    const data = await r.json();
    if (data.error) return null;

    cache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch (e) {
    console.warn(`buscarHistorico ${ticker} falhou:`, e.message);
    return null;
  }
}

/**
 * Busca histórico de múltiplos tickers em paralelo.
 * @param {string[]} tickers
 * @param {string} range
 * @returns {Promise<Object>} mapa ticker → resposta
 */
export async function buscarHistoricos(tickers, range = "1mo") {
  if (!tickers || tickers.length === 0) return {};

  const promessas = tickers.map(t => buscarHistorico(t, range).then(d => [t, d]));
  const resultados = await Promise.all(promessas);
  const mapa = {};
  for (const [t, d] of resultados) {
    if (d) mapa[t] = d;
  }
  return mapa;
}

export function limparCacheHistorico() {
  cache.clear();
}
