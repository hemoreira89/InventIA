// ─── Cliente: catálogo de screening B3 ───────────────────────────────────────
// Lê do Supabase a tabela `screening_catalogo` (atualizada 1x/dia via cron).
// Permite filtrar entre os ~750 ativos da B3 sem depender da IA chutar tickers.

import { supabase } from "../supabase.js";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min em memória
let cacheCatalogo = null;
let cacheTs = 0;

/**
 * Busca catálogo completo (com cache em memória de 30min).
 * O catálogo é dado público da B3, então usa anon key sem problema.
 *
 * @returns {Promise<Array<{ticker, nome, setor, tipo, preco, market_cap, volume, variacao_pct, atualizado_em}>>}
 */
export async function buscarCatalogo() {
  // Cache em memória pra evitar query repetida no mesmo session
  if (cacheCatalogo && (Date.now() - cacheTs) < CACHE_TTL_MS) {
    return cacheCatalogo;
  }

  const { data, error } = await supabase
    .from("screening_catalogo")
    .select("ticker, nome, setor, tipo, preco, market_cap, volume, variacao_pct, atualizado_em")
    .order("volume", { ascending: false });

  if (error) {
    console.warn("[catalogo-screening] erro Supabase:", error.message);
    return [];
  }

  cacheCatalogo = data || [];
  cacheTs = Date.now();
  return cacheCatalogo;
}

/**
 * Filtra o catálogo localmente por critérios.
 *
 * @param {Object} filtros
 * @param {string} [filtros.tipo]    - 'stock' | 'fund'
 * @param {string} [filtros.setor]   - nome do setor (ex: "Banks", "Energy")
 * @param {number} [filtros.minVolume]    - volume mínimo (descarta ilíquidos)
 * @param {number} [filtros.minMarketCap] - market cap mínimo
 * @param {number} [filtros.limit]   - limite de resultados (default 30)
 * @returns {Promise<Array>}
 */
export async function filtrarCatalogo({ tipo, setor, minVolume, minMarketCap, limit = 30 } = {}) {
  const tudo = await buscarCatalogo();
  let resultado = tudo;

  if (tipo) resultado = resultado.filter(t => t.tipo === tipo);
  if (setor) resultado = resultado.filter(t => t.setor === setor);
  if (minVolume != null) resultado = resultado.filter(t => (t.volume || 0) >= minVolume);
  if (minMarketCap != null) resultado = resultado.filter(t => (t.market_cap || 0) >= minMarketCap);

  // Já vem ordenado por volume DESC, então slice pega os mais líquidos
  return resultado.slice(0, limit);
}

/**
 * Lista de setores únicos no catálogo (pra montar dropdown).
 */
export async function listarSetores() {
  const tudo = await buscarCatalogo();
  const setores = [...new Set(tudo.map(t => t.setor).filter(Boolean))];
  return setores.sort();
}

/**
 * Limpa cache (útil pra testes).
 */
export function limparCacheCatalogo() {
  cacheCatalogo = null;
  cacheTs = 0;
}
