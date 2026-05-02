#!/usr/bin/env node
// Popula o usuário de teste com uma carteira realista
// Uso: node scripts/seed-test-user.js

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bjghaqtyijvlnwlesrst.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZ2hhcXR5aWp2bG53bGVzcnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTQwOTUsImV4cCI6MjA5MzMzMDA5NX0.wugciBsGln_K5kkWi479M6KpFV32e8Vyd51bjkhc2vE';
const EMAIL = process.env.E2E_USER || 'e2e-test@inventia.app';
const PASSWORD = process.env.E2E_PASSWORD || 'TesteE2E_2026!';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Carteira realista para popular ─────────────────────────────────────────

const ATIVOS = [
  // Bancos
  { ticker: 'ITUB4', qtd: 100, pm: 28.50 },
  { ticker: 'BBAS3', qtd: 80, pm: 24.30 },
  { ticker: 'BBDC4', qtd: 120, pm: 13.20 },

  // Energia
  { ticker: 'TAEE11', qtd: 50, pm: 33.00 },
  { ticker: 'EGIE3', qtd: 40, pm: 38.50 },

  // Petróleo & Mineração
  { ticker: 'PETR4', qtd: 100, pm: 36.40 },
  { ticker: 'VALE3', qtd: 30, pm: 65.10 },

  // FIIs
  { ticker: 'MXRF11', qtd: 200, pm: 10.20 },
  { ticker: 'HGLG11', qtd: 25, pm: 158.00 },
  { ticker: 'BTLG11', qtd: 15, pm: 99.50 },

  // Saneamento
  { ticker: 'SAPR11', qtd: 60, pm: 26.80 },
];

const COMPRAS_HISTORICO = [
  { ticker: 'PETR4', qtd: 100, preco: 36.40, data: '2025-08-15', taxas: 4.50 },
  { ticker: 'ITUB4', qtd: 50, preco: 27.20, data: '2025-09-03', taxas: 4.50 },
  { ticker: 'ITUB4', qtd: 50, preco: 29.80, data: '2025-11-12', taxas: 4.50 },
  { ticker: 'VALE3', qtd: 30, preco: 65.10, data: '2025-09-22', taxas: 4.50 },
  { ticker: 'BBAS3', qtd: 50, preco: 23.90, data: '2025-10-10', taxas: 4.50 },
  { ticker: 'BBAS3', qtd: 30, preco: 24.97, data: '2026-01-15', taxas: 4.50 },
  { ticker: 'TAEE11', qtd: 50, preco: 33.00, data: '2025-08-20', taxas: 4.50 },
  { ticker: 'MXRF11', qtd: 100, preco: 10.05, data: '2025-09-15', taxas: 4.50 },
  { ticker: 'MXRF11', qtd: 100, preco: 10.35, data: '2025-12-15', taxas: 4.50 },
  { ticker: 'HGLG11', qtd: 25, preco: 158.00, data: '2025-10-20', taxas: 4.50 },
  { ticker: 'BTLG11', qtd: 15, preco: 99.50, data: '2025-11-05', taxas: 4.50 },
  { ticker: 'SAPR11', qtd: 60, preco: 26.80, data: '2025-09-30', taxas: 4.50 },
  { ticker: 'BBDC4', qtd: 120, preco: 13.20, data: '2025-10-05', taxas: 4.50 },
  { ticker: 'EGIE3', qtd: 40, preco: 38.50, data: '2025-11-18', taxas: 4.50 },
];

const PROVENTOS = [
  { ticker: 'TAEE11', tipo: 'jcp', valor: 24.50, data_pagamento: '2025-09-20' },
  { ticker: 'ITUB4', tipo: 'dividendo', valor: 12.00, data_pagamento: '2025-10-05' },
  { ticker: 'BBAS3', tipo: 'jcp', valor: 18.40, data_pagamento: '2025-10-15' },
  { ticker: 'TAEE11', tipo: 'dividendo', valor: 31.25, data_pagamento: '2025-11-30' },
  { ticker: 'MXRF11', tipo: 'rendimento', valor: 18.00, data_pagamento: '2025-11-15' },
  { ticker: 'BTLG11', tipo: 'rendimento', valor: 11.25, data_pagamento: '2025-11-15' },
  { ticker: 'HGLG11', tipo: 'rendimento', valor: 22.50, data_pagamento: '2025-11-15' },
  { ticker: 'PETR4', tipo: 'dividendo', valor: 245.00, data_pagamento: '2025-12-10' },
  { ticker: 'MXRF11', tipo: 'rendimento', valor: 19.00, data_pagamento: '2025-12-15' },
  { ticker: 'BTLG11', tipo: 'rendimento', valor: 11.25, data_pagamento: '2025-12-15' },
  { ticker: 'HGLG11', tipo: 'rendimento', valor: 22.50, data_pagamento: '2025-12-15' },
  { ticker: 'TAEE11', tipo: 'jcp', valor: 28.00, data_pagamento: '2026-01-25' },
  { ticker: 'BBAS3', tipo: 'dividendo', valor: 22.40, data_pagamento: '2026-02-10' },
  { ticker: 'MXRF11', tipo: 'rendimento', valor: 20.00, data_pagamento: '2026-01-15' },
  { ticker: 'BTLG11', tipo: 'rendimento', valor: 12.00, data_pagamento: '2026-01-15' },
  { ticker: 'HGLG11', tipo: 'rendimento', valor: 23.00, data_pagamento: '2026-01-15' },
  { ticker: 'MXRF11', tipo: 'rendimento', valor: 20.00, data_pagamento: '2026-02-15' },
  { ticker: 'BTLG11', tipo: 'rendimento', valor: 12.00, data_pagamento: '2026-02-15' },
  { ticker: 'HGLG11', tipo: 'rendimento', valor: 23.50, data_pagamento: '2026-02-15' },
  { ticker: 'MXRF11', tipo: 'rendimento', valor: 21.00, data_pagamento: '2026-03-15' },
  { ticker: 'BTLG11', tipo: 'rendimento', valor: 12.50, data_pagamento: '2026-03-15' },
  { ticker: 'HGLG11', tipo: 'rendimento', valor: 24.00, data_pagamento: '2026-03-15' },
  { ticker: 'EGIE3', tipo: 'dividendo', valor: 32.80, data_pagamento: '2026-03-20' },
  { ticker: 'SAPR11', tipo: 'jcp', valor: 21.60, data_pagamento: '2026-03-25' },
  { ticker: 'MXRF11', tipo: 'rendimento', valor: 22.00, data_pagamento: '2026-04-15' },
  { ticker: 'BTLG11', tipo: 'rendimento', valor: 13.00, data_pagamento: '2026-04-15' },
  { ticker: 'HGLG11', tipo: 'rendimento', valor: 24.50, data_pagamento: '2026-04-15' },
];

const WATCHLIST = [
  { ticker: 'BBSE3', preco_alvo: 30.00, nota: 'Pagador consistente de dividendos' },
  { ticker: 'CMIG4', preco_alvo: 11.50, nota: 'Energia barata, oportunidade' },
  { ticker: 'KLBN11', preco_alvo: 22.00, nota: 'Defensiva, USD-linked' },
  { ticker: 'ABEV3', preco_alvo: 13.00, nota: 'Cíclica, esperando ponto de entrada' },
  { ticker: 'WEGE3', preco_alvo: 50.00, nota: 'Crescimento de qualidade' },
];

// Snapshots de patrimônio simulando evolução nos últimos 90 dias
const HOJE = new Date();
const SNAPSHOTS = [];
let valorBase = 32000;
for (let i = 90; i >= 0; i -= 7) {
  const data = new Date(HOJE);
  data.setDate(data.getDate() - i);
  // Crescimento médio com volatilidade
  valorBase *= (1 + (Math.random() * 0.04 - 0.005)); // entre -0.5% e +3.5%
  SNAPSHOTS.push({
    data: data.toISOString().split('T')[0],
    valor: Math.round(valorBase * 100) / 100
  });
}

// ─── Execução ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔐 Logando como', EMAIL);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD
  });

  if (authErr) {
    console.error('❌ Erro de login:', authErr.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log('✓ Logado:', userId);

  // Pega ou cria carteira principal (sem .single() que quebra se não houver)
  let carteira = null;
  const { data: carteirasExistentes, error: errCart } = await supabase
    .from('carteiras')
    .select('*')
    .eq('user_id', userId)
    .limit(1);

  if (errCart) {
    console.error('❌ Erro ao buscar carteira:', errCart.message);
    process.exit(1);
  }

  if (carteirasExistentes && carteirasExistentes.length > 0) {
    carteira = carteirasExistentes[0];
    console.log('✓ Carteira existente encontrada');
  } else {
    console.log('📦 Criando carteira nova...');
    const { data: novaCarteira, error: errNova } = await supabase
      .from('carteiras')
      .insert({ user_id: userId, nome: 'Principal', descricao: 'Carteira de teste' })
      .select()
      .single();

    if (errNova || !novaCarteira) {
      console.error('❌ Erro ao criar carteira:', errNova?.message || 'sem dados retornados');
      process.exit(1);
    }
    carteira = novaCarteira;
  }

  console.log('✓ Carteira:', carteira.id);

  // Limpa dados anteriores
  console.log('\n🧹 Limpando dados anteriores...');
  await supabase.from('ativos').delete().eq('user_id', userId);
  await supabase.from('compras').delete().eq('user_id', userId);
  await supabase.from('proventos').delete().eq('user_id', userId);
  await supabase.from('watchlist').delete().eq('user_id', userId);
  await supabase.from('patrimonio_snapshots').delete().eq('user_id', userId);

  // Insere ativos
  console.log('\n💼 Inserindo', ATIVOS.length, 'ativos...');
  for (const a of ATIVOS) {
    await supabase.from('ativos').insert({
      user_id: userId,
      carteira_id: carteira.id,
      ticker: a.ticker,
      qtd: a.qtd,
      pm: a.pm
    });
    process.stdout.write('.');
  }
  console.log(' ✓');

  // Insere histórico de compras
  console.log('\n📋 Inserindo', COMPRAS_HISTORICO.length, 'compras...');
  for (const c of COMPRAS_HISTORICO) {
    await supabase.from('compras').insert({
      user_id: userId,
      carteira_id: carteira.id,
      ...c
    });
    process.stdout.write('.');
  }
  console.log(' ✓');

  // Insere proventos
  console.log('\n💰 Inserindo', PROVENTOS.length, 'proventos...');
  for (const p of PROVENTOS) {
    await supabase.from('proventos').insert({
      user_id: userId,
      ...p
    });
    process.stdout.write('.');
  }
  console.log(' ✓');

  // Insere watchlist
  console.log('\n👁️  Inserindo', WATCHLIST.length, 'na watchlist...');
  for (const w of WATCHLIST) {
    await supabase.from('watchlist').insert({
      user_id: userId,
      ...w
    });
    process.stdout.write('.');
  }
  console.log(' ✓');

  // Insere snapshots de patrimônio
  console.log('\n📈 Inserindo', SNAPSHOTS.length, 'snapshots de patrimônio...');
  for (const s of SNAPSHOTS) {
    await supabase.from('patrimonio_snapshots').insert({
      user_id: userId,
      data: s.data,
      valor: s.valor,
      posicoes_json: ATIVOS
    });
    process.stdout.write('.');
  }
  console.log(' ✓');

  // Resumo
  const totalEstimado = ATIVOS.reduce((s, a) => s + (a.qtd * a.pm), 0);
  const totalProventos = PROVENTOS.reduce((s, p) => s + p.valor, 0);

  console.log('\n━━━ Seed Completo ━━━');
  console.log('💼 Patrimônio estimado (preço médio):', totalEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  console.log('💰 Total de proventos recebidos:', totalProventos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  console.log('📊 Snapshots:', SNAPSHOTS.length, '(últimos 90 dias)');
  console.log('👁️  Watchlist:', WATCHLIST.length, 'ativos monitorados');
  console.log('\n🌐 Acesse: https://invent-ia.vercel.app');
  console.log('📧 Login:', EMAIL);
  console.log('🔑 Senha:', PASSWORD);

  await supabase.auth.signOut();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
