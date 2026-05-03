// ─── Cliente: fundamentos pré-cacheados no Supabase ────────────────────────
// Lê fundamentos da tabela `screening_fundamentos`, populada diariamente
// pelo cron `/api/cron-fundamentos`. Usado pela Tab Oportunidades pra
// fazer screening sem hit na bolsai em runtime.
//
// Diferenças de buscarFundamentos (lib/fundamentos.js):
// - Aquele bate na bolsai em runtime (1 req/ticker, sujeito a rate limit)
// - Este lê do Supabase (1 query pra N tickers, instantâneo)
//
// Se o ticker não está no cache, retorna undefined (Tab Oportunidades
// vai descartar). Pra Ticker individual / Análise IA, continua usando
// buscarFundamentos que tem fallback.

import { supabase } from "../supabase.js";

const CACHE_TTL_MS = 30 * 60 * 1000;
let cacheLista = null;
let cacheTs = 0;

/**
 * Busca fundamentos pré-cacheados de múltiplos tickers (1 query só).
 * Retorna mapa ticker → objeto compatível com formato bolsai.
 *
 * @param {string[]} tickers
 * @returns {Promise<Object>} mapa ticker → fundamentos
 */
export async function buscarFundamentosCached(tickers) {
  if (!tickers || tickers.length === 0) return {};

  const tickersUpper = tickers.map(t => t.toUpperCase());

  const { data, error } = await supabase
    .from("screening_fundamentos")
    .select("*")
    .in("ticker", tickersUpper);

  if (error) {
    console.warn("[fundamentos-cached] Supabase erro:", error.message);
    return {};
  }

  // Converte schema do Supabase (snake_case) → schema esperado pela UI (camelCase)
  // Compatível com o que buscarFundamentos retornaria
  const mapa = {};
  for (const row of data || []) {
    mapa[row.ticker] = {
      tipo: row.tipo,
      nome: row.nome,
      setorCVM: row.setor_cvm,
      pl: row.pl,
      pvp: row.pvp,
      roe: row.roe,
      roic: row.roic,
      margemLiquida: row.margem_liquida,
      divEbitda: row.div_ebitda,
      cagrLucro5y: row.cagr_lucro_5y,
      cagrReceita5y: row.cagr_receita_5y,
      evEbitda: row.ev_ebitda,
      vpa: row.vpa,
      lpa: row.lpa,
      dy: row.dy,
      nav: row.nav,
      segmento: row.segmento,
      lucrosConsistentes: row.lucros_consistentes,
      atualizadoEm: row.atualizado_em,
    };
  }

  return mapa;
}

/**
 * Estatísticas do cache (útil pra monitoramento e tela de admin).
 */
export async function statsCacheFundamentos() {
  const { data, error } = await supabase
    .from("screening_fundamentos")
    .select("tipo, atualizado_em");

  if (error || !data) return null;

  const total = data.length;
  const acoes = data.filter(d => d.tipo === "Ação").length;
  const fiis = data.filter(d => d.tipo === "FII").length;
  const datas = data.map(d => new Date(d.atualizado_em).getTime());
  const maisRecente = datas.length ? new Date(Math.max(...datas)) : null;
  const maisAntigo = datas.length ? new Date(Math.min(...datas)) : null;

  return { total, acoes, fiis, maisRecente, maisAntigo };
}
