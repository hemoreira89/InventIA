import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bjghaqtyijvlnwlesrst.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZ2hhcXR5aWp2bG53bGVzcnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTQwOTUsImV4cCI6MjA5MzMzMDA5NX0.wugciBsGln_K5kkWi479M6KpFV32e8Vyd51bjkhc2vE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
});

// ─── API helpers ──────────────────────────────────────────────────────────────

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { emailRedirectTo: window.location.origin }
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ─── Carteira / Ativos ────────────────────────────────────────────────────────

export async function carregarCarteiraPrincipal(userId) {
  const { data, error } = await supabase
    .from('carteiras')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function carregarAtivos(carteiraId) {
  const { data, error } = await supabase
    .from('ativos')
    .select('*')
    .eq('carteira_id', carteiraId)
    .order('ticker');
  if (error) throw error;
  return data || [];
}

export async function salvarAtivo(userId, carteiraId, { ticker, qtd, pm, peso_alvo }) {
  const { data, error } = await supabase
    .from('ativos')
    .upsert({
      user_id: userId,
      carteira_id: carteiraId,
      ticker: ticker.toUpperCase(),
      qtd, pm, peso_alvo,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,carteira_id,ticker' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removerAtivo(ativoId) {
  const { error } = await supabase.from('ativos').delete().eq('id', ativoId);
  if (error) throw error;
}

// ─── Compras ──────────────────────────────────────────────────────────────────

export async function registrarCompra(userId, carteiraId, { ticker, qtd, preco, data, taxas }) {
  const { data: compra, error } = await supabase
    .from('compras')
    .insert({
      user_id: userId,
      carteira_id: carteiraId,
      ticker: ticker.toUpperCase(),
      qtd, preco, data,
      taxas: taxas || 0
    })
    .select()
    .single();
  if (error) throw error;

  // Atualiza ou cria o ativo recalculando preço médio
  const { data: ativoExistente } = await supabase
    .from('ativos')
    .select('*')
    .eq('user_id', userId)
    .eq('carteira_id', carteiraId)
    .eq('ticker', ticker.toUpperCase())
    .single();

  if (ativoExistente) {
    const novaQtd = ativoExistente.qtd + qtd;
    const novoPM = ativoExistente.pm
      ? (ativoExistente.pm * ativoExistente.qtd + preco * qtd) / novaQtd
      : preco;
    await salvarAtivo(userId, carteiraId, {
      ticker, qtd: novaQtd, pm: novoPM, peso_alvo: ativoExistente.peso_alvo
    });
  } else {
    await salvarAtivo(userId, carteiraId, { ticker, qtd, pm: preco });
  }
  return compra;
}

export async function carregarCompras(userId) {
  const { data, error } = await supabase
    .from('compras')
    .select('*')
    .eq('user_id', userId)
    .order('data', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

export async function carregarWatchlist(userId) {
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function salvarWatchlist(userId, { ticker, preco_alvo, nota }) {
  const { data, error } = await supabase
    .from('watchlist')
    .upsert({
      user_id: userId,
      ticker: ticker.toUpperCase(),
      preco_alvo, nota
    }, { onConflict: 'user_id,ticker' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removerWatchlist(itemId) {
  const { error } = await supabase.from('watchlist').delete().eq('id', itemId);
  if (error) throw error;
}

// ─── Análises (histórico) ─────────────────────────────────────────────────────

export async function salvarAnalise(userId, { tipo, aporte, perfil, foco, resultado, tickers_analisados }) {
  const { data, error } = await supabase
    .from('analises')
    .insert({
      user_id: userId,
      tipo, aporte, perfil, foco, resultado, tickers_analisados
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function carregarAnalises(userId, limit = 20) {
  const { data, error } = await supabase
    .from('analises')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function removerAnalise(analiseId) {
  const { error } = await supabase.from('analises').delete().eq('id', analiseId);
  if (error) throw error;
}

export async function buscarAnalisePorId(analiseId) {
  const { data, error } = await supabase
    .from('analises')
    .select('*')
    .eq('id', analiseId)
    .single();
  if (error) throw error;
  return data;
}

// ─── Proventos ────────────────────────────────────────────────────────────────

export async function registrarProvento(userId, { ticker, tipo, valor, data_pagamento, observacao }) {
  const { data, error } = await supabase
    .from('proventos')
    .insert({
      user_id: userId,
      ticker: ticker.toUpperCase(),
      tipo, valor, data_pagamento, observacao
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function carregarProventos(userId) {
  const { data, error } = await supabase
    .from('proventos')
    .select('*')
    .eq('user_id', userId)
    .order('data_pagamento', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function removerProvento(proventoId) {
  const { error } = await supabase.from('proventos').delete().eq('id', proventoId);
  if (error) throw error;
}

// ─── Vendas ───────────────────────────────────────────────────────────────────

export async function registrarVenda(userId, { ticker, qtd, preco, pm, data, taxas }) {
  const { data: venda, error } = await supabase
    .from('vendas')
    .insert({
      user_id: userId,
      ticker: ticker.toUpperCase(),
      qtd, preco, pm, data,
      taxas: taxas || 0
    })
    .select()
    .single();
  if (error) throw error;
  return venda;
}

export async function carregarVendas(userId) {
  const { data, error } = await supabase
    .from('vendas')
    .select('*')
    .eq('user_id', userId)
    .order('data', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Patrimônio (snapshots históricos) ────────────────────────────────────────

export async function salvarSnapshotPatrimonio(userId, valor, posicoes) {
  const hoje = new Date().toISOString().split("T")[0];
  // Upsert por dia (último snapshot do dia ganha)
  const { data, error } = await supabase
    .from('patrimonio_snapshots')
    .upsert({
      user_id: userId,
      data: hoje,
      valor: valor,
      posicoes_json: posicoes
    }, { onConflict: 'user_id,data' })
    .select();
  if (error) throw error;
  return data;
}

export async function carregarSnapshotsPatrimonio(userId, dias = 90) {
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - dias);
  const { data, error } = await supabase
    .from('patrimonio_snapshots')
    .select('*')
    .eq('user_id', userId)
    .gte('data', dataInicio.toISOString().split("T")[0])
    .order('data', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ─── Cache de cotações (24h) ──────────────────────────────────────────────────

const CACHE_PRECO = "precos_cache";
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 horas

export function getCachedPrice(ticker) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_PRECO) || "{}");
    const item = cache[ticker.toUpperCase()];
    if (!item) return null;
    if (Date.now() - item.ts > CACHE_TTL) return null;
    return item;
  } catch { return null; }
}

export function setCachedPrice(ticker, dados) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_PRECO) || "{}");
    cache[ticker.toUpperCase()] = { ...dados, ts: Date.now() };
    localStorage.setItem(CACHE_PRECO, JSON.stringify(cache));
  } catch {}
}

export function clearPriceCache() {
  try { localStorage.removeItem(CACHE_PRECO); } catch {}
}
