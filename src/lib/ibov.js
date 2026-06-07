// ─── Histórico do IBOV (^BVSP) com cache esperto ──────────────────────────────
// Valores passados do índice nunca mudam, então cacheamos pesado no localStorage.
// Rebusca só quando o cache está velho (>7 dias) OU quando há um snapshot mais
// recente que o último dia em cache — assim a ponta do gráfico fica sempre certa
// com ~1 chamada por semana por navegador.

import { buscarHistorico } from "./historico";

const LS_KEY = "inventia_ibov_hist_v1";
const MAX_IDADE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function lerCache() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch { return null; }
}
function gravarCache(obj) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch { /* quota/modo privado: ignora */ }
}

/**
 * Retorna o histórico diário do IBOV como [{ ts(ms), close }] ordenado por data.
 * @param {number} [snapshotMaisRecenteMs] - timestamp (ms) do snapshot mais novo
 * @returns {Promise<Array<{ts:number, close:number}>>}
 */
export async function buscarIbovHistorico(snapshotMaisRecenteMs) {
  const cache = lerCache();
  const agora = Date.now();
  const velho = !cache || (agora - cache.ts) > MAX_IDADE_MS;
  const desatualizado = !!cache && !!snapshotMaisRecenteMs && snapshotMaisRecenteMs > (cache.ultimaTs || 0);

  if (cache?.series?.length && !velho && !desatualizado) return cache.series;

  try {
    const hist = await buscarHistorico("^BVSP", "1y");
    const series = (hist?.pontos || [])
      .map(p => ({ ts: (p.d || 0) * 1000, close: p.c }))
      .filter(p => p.ts > 0 && p.close > 0)
      .sort((a, b) => a.ts - b.ts);
    if (series.length) {
      gravarCache({ ts: agora, ultimaTs: series[series.length - 1].ts, series });
      return series;
    }
  } catch { /* rede/erro: cai no cache antigo abaixo */ }

  return cache?.series || [];
}

/**
 * Fechamento do IBOV na data dada (ou no pregão imediatamente anterior).
 * @param {Array<{ts:number, close:number}>} series - ordenado por ts asc
 * @param {number} dataMs
 * @returns {number|null}
 */
export function ibovNaData(series, dataMs) {
  if (!series?.length) return null;
  let achado = null;
  for (const p of series) {
    if (p.ts <= dataMs) achado = p.close;
    else break;
  }
  // Data anterior ao 1º ponto disponível → usa o 1º
  return achado ?? series[0].close;
}
