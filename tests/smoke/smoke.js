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

  // 5. Supabase está acessível (health check via auth settings)
  await teste('Supabase está acessível', async () => {
    // /auth/v1/settings é público e não exige autenticação
    const res = await fetchTimeout(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZ2hhcXR5aWp2bG53bGVzcnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTQwOTUsImV4cCI6MjA5MzMzMDA5NX0.wugciBsGln_K5kkWi479M6KpFV32e8Vyd51bjkhc2vE'
      }
    });
    if (!res.ok) throw new Error(`Supabase status ${res.status}`);
    const data = await res.json();
    if (!data.external) throw new Error('Resposta inesperada do Supabase');
  });

  // 6. Supabase Auth - tenta login com credenciais inválidas (deve retornar 400, não 401)
  await teste('Supabase Auth aceita requests', async () => {
    const res = await fetchTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZ2hhcXR5aWp2bG53bGVzcnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTQwOTUsImV4cCI6MjA5MzMzMDA5NX0.wugciBsGln_K5kkWi479M6KpFV32e8Vyd51bjkhc2vE',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: 'naoexiste@inventia.test', password: 'invalido123' })
    });
    // Esperamos 400 (credenciais inválidas) — confirma que Auth está funcionando
    // 401 = chave de API inválida, 500 = serviço fora
    if (res.status >= 500) throw new Error(`Auth fora do ar: ${res.status}`);
    if (res.status === 401) throw new Error('Chave API inválida (401)');
    // 400 ou 422 são esperados aqui
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
