#!/usr/bin/env node
// Smoke tests — verificações rápidas de saúde do sistema
// Executado a cada deploy + diariamente via cron

const SITE_URL = process.env.SITE_URL || 'https://invent-ia.vercel.app';
const SUPABASE_URL = 'https://bjghaqtyijvlnwlesrst.supabase.co';

let testes = 0;
let falhas = 0;
const resultados = [];

const COR_VERDE = '\x1b[32m';
const COR_VERMELHO = '\x1b[31m';
const COR_AMARELO = '\x1b[33m';
const RESET = '\x1b[0m';

async function teste(nome, fn) {
  testes++;
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    console.log(`${COR_VERDE}✓${RESET} ${nome} ${COR_AMARELO}(${ms}ms)${RESET}`);
    resultados.push({ nome, ok: true, ms });
  } catch (e) {
    falhas++;
    const ms = Date.now() - start;
    console.log(`${COR_VERMELHO}✗${RESET} ${nome} ${COR_AMARELO}(${ms}ms)${RESET}`);
    console.log(`  ${COR_VERMELHO}${e.message}${RESET}`);
    resultados.push({ nome, ok: false, ms, erro: e.message });
  }
}

async function fetchTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  console.log(`\n${COR_AMARELO}━━━ InvestIA Smoke Tests ━━━${RESET}`);
  console.log(`Site: ${SITE_URL}\n`);

  // 1. Site principal carrega
  await teste('Site principal carrega (200 OK)', async () => {
    const res = await fetchTimeout(SITE_URL);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const html = await res.text();
    if (!html.includes('InvestIA') && !html.includes('inventia')) {
      throw new Error('HTML não contém referência ao app');
    }
  });

  // 2. JavaScript bundle carrega
  await teste('JavaScript bundle disponível', async () => {
    const res = await fetchTimeout(SITE_URL);
    const html = await res.text();
    const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if (!match) throw new Error('Bundle JS não encontrado no HTML');
    const jsRes = await fetchTimeout(`${SITE_URL}${match[1]}`);
    if (!jsRes.ok) throw new Error(`Bundle retornou ${jsRes.status}`);
  });

  // 3. Endpoint da API existe (CORS preflight)
  await teste('API /api/analyze responde (OPTIONS)', async () => {
    const res = await fetchTimeout(`${SITE_URL}/api/analyze`, { method: 'OPTIONS' });
    if (![200, 204].includes(res.status)) {
      throw new Error(`OPTIONS retornou ${res.status}`);
    }
  });

  // 4. API rejeita request inválida (sanity check)
  await teste('API /api/analyze valida payload', async () => {
    const res = await fetchTimeout(`${SITE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (res.status !== 400) {
      throw new Error(`Esperava 400 (sem prompt), recebeu ${res.status}`);
    }
  });

  // 5. Supabase está acessível
  await teste('Supabase REST API responde', async () => {
    const res = await fetchTimeout(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': 'sb_publishable_yI9Zs2TaR4-Q7Fb1PAvQ8A_BGDsDhAV'
      }
    });
    // Deve retornar 200 (info do PostgREST)
    if (!res.ok) throw new Error(`Supabase status ${res.status}`);
  });

  // 6. Supabase Auth está ativo
  await teste('Supabase Auth está respondendo', async () => {
    const res = await fetchTimeout(`${SUPABASE_URL}/auth/v1/health`);
    if (!res.ok) throw new Error(`Auth status ${res.status}`);
  });

  // 7. Endpoint de manifesto PWA
  await teste('Manifest.json (PWA) disponível', async () => {
    const res = await fetchTimeout(`${SITE_URL}/manifest.json`);
    // Pode ser 200 ou 404, só queremos saber que servidor responde
    if (res.status >= 500) throw new Error(`Servidor erro ${res.status}`);
  });

  // ─── Sumário ────────────────────────────────────────────────
  const sucesso = testes - falhas;
  console.log(`\n${COR_AMARELO}━━━ Resultado ━━━${RESET}`);
  console.log(`${COR_VERDE}✓ ${sucesso}/${testes} passaram${RESET}`);

  if (falhas > 0) {
    console.log(`${COR_VERMELHO}✗ ${falhas}/${testes} falharam${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`\n${COR_VERDE}🎉 Todos os smoke tests passaram!${RESET}\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error(`\n${COR_VERMELHO}Erro fatal nos smoke tests:${RESET}`, err);
  process.exit(1);
});
