#!/usr/bin/env node
// Autoswitch de flight sheet do Hive OS por rentabilidade.
//
// A cada execução (GitHub Actions, de hora em hora):
//   1. Lê o worker no Hive OS (flight sheet ativa, hashrate e consumo reais).
//   2. Consulta no WhatToMine a receita/dia de cada moeda do coins.json para
//      o hashrate desta placa, converte para BRL e desconta a energia.
//   3. Se outra moeda rende `thresholdPct` a mais por `minStreak` execuções
//      seguidas, troca a flight sheet pela API do Hive OS.
//   4. Opcional: manda resumo no Telegram (sempre que troca; diário no
//      horário configurado; ou sempre, com REPORT_ALWAYS=1).
//
// Env obrigatória:  HIVE_TOKEN
// Env opcional:     HIVE_FARM_ID, HIVE_WORKER_NAME (default rtx5080),
//                   KWH_BRL (default 1.00), USD_BRL (fallback se a cotação falhar),
//                   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, REPORT_HOUR_UTC (default 23),
//                   REPORT_ALWAYS=1, DRY_RUN=1, STATE_FILE (default .hive-state/state.json)
//
// Sem dependências: usa fetch nativo do Node 20+.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseMoney, matchCandidate, benchFor, dailyNet, decide,
  observeWorker, plausible, ema, formatReport, fmtBrl,
} from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UA = 'cauril-hive-autoswitch/1.0';

const env = (k, d) => (process.env[k] != null && process.env[k] !== '' ? process.env[k] : d);
// Bases sobrescrevíveis só para teste local com servidor fake.
const HIVE_API = env('HIVE_API_BASE', 'https://api2.hiveos.farm/api/v2');
const WTM_BASE = env('WTM_BASE', 'https://whattomine.com');
const FX_URL = env('FX_URL', 'https://economia.awesomeapi.com.br/last/USD-BRL');
const DRY_RUN = ['1', 'true', 'yes'].includes(String(env('DRY_RUN', '')).toLowerCase());
// Depois de trocar, o minerador novo leva minutos para estabilizar e o Hive
// ainda mostra o algo antigo. Nesse período não observa nem decide.
const COOLDOWN_MIN = parseInt(env('COOLDOWN_MIN', '90'), 10);

function log(...a) { console.log(new Date().toISOString(), ...a); }
function die(msg) { console.error('::error::' + msg); process.exit(1); }

async function http(url, { method = 'GET', headers = {}, body, timeoutMs = 20000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method,
      headers: { 'User-Agent': UA, Accept: 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    const text = await r.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* não-JSON */ }
    if (!r.ok) throw new Error(`${method} ${url} → HTTP ${r.status}: ${text.slice(0, 300)}`);
    return json;
  } finally { clearTimeout(t); }
}

// ── Hive OS ────────────────────────────────────────────────────────────────
function hive(token) {
  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  return {
    farms: () => http(`${HIVE_API}/farms`, { headers: h }),
    workers: (farmId) => http(`${HIVE_API}/farms/${farmId}/workers`, { headers: h }),
    worker: (farmId, wid) => http(`${HIVE_API}/farms/${farmId}/workers/${wid}`, { headers: h }),
    flightSheets: (farmId) => http(`${HIVE_API}/farms/${farmId}/fs`, { headers: h }),
    setFlightSheet: (farmId, wid, fsId) =>
      http(`${HIVE_API}/farms/${farmId}/workers/${wid}`, { method: 'PATCH', headers: h, body: { fs_id: fsId } }),
  };
}

// ── WhatToMine: receita/dia em USD para o hashrate informado ───────────────
async function wtmRevenueUsd(wtmId, hashrate, watts) {
  const q = new URLSearchParams({ hr: String(hashrate), p: String(watts || 0), cost: '0', fee: '0' });
  const j = await http(`${WTM_BASE}/coins/${wtmId}.json?${q}`, { headers: { Accept: 'application/json' } });
  const rev = parseMoney(j?.revenue);
  if (!rev) throw new Error(`WhatToMine ${wtmId}: resposta sem revenue (${JSON.stringify(j).slice(0, 200)})`);
  return { revenueUsd: rev, tag: j?.tag, name: j?.name, algo: j?.algorithm, lagging: !!j?.lagging };
}

// ── Câmbio USD→BRL (awesomeapi, fallback env) ──────────────────────────────
async function usdBrl() {
  try {
    const j = await http(FX_URL, { timeoutMs: 10000 });
    const v = parseFloat(j?.USDBRL?.bid);
    if (v > 0) return v;
  } catch (e) { log('câmbio: falhou, usando fallback —', e.message); }
  const fb = parseFloat(env('USD_BRL', '5.5'));
  return fb > 0 ? fb : 5.5;
}

// ── Telegram ───────────────────────────────────────────────────────────────
async function telegram(text) {
  const tok = env('TELEGRAM_BOT_TOKEN'); const chat = env('TELEGRAM_CHAT_ID');
  if (!tok || !chat) { log('telegram: não configurado, pulando'); return; }
  try {
    await http(`https://api.telegram.org/bot${tok}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: { chat_id: chat, text, disable_web_page_preview: true },
    });
  } catch (e) { log('telegram: falhou —', e.message); }
}

// ── Estado persistido (actions/cache) ──────────────────────────────────────
function loadState(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { bench: {}, streak: null, history: [] }; }
}
function saveState(file, st) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(st, null, 2));
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const token = env('HIVE_TOKEN'); if (!token) die('HIVE_TOKEN não definido');
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'coins.json'), 'utf8'));
  const workerName = env('HIVE_WORKER_NAME', 'rtx5080');
  const kwhBrl = parseFloat(env('KWH_BRL', '1.0'));
  const stateFile = path.resolve(env('STATE_FILE', '.hive-state/state.json'));
  const state = loadState(stateFile);
  const api = hive(token);

  // Farm
  let farmId = env('HIVE_FARM_ID');
  if (!farmId) {
    const farms = (await api.farms())?.data || [];
    if (!farms.length) die('nenhuma farm visível com este token');
    if (farms.length > 1) log('aviso: mais de uma farm, usando a primeira:', farms.map(f => `${f.id}=${f.name}`).join(', '));
    farmId = farms[0].id;
  }

  // Worker
  const workers = (await api.workers(farmId))?.data || [];
  const w0 = workers.find(w => String(w.name).toLowerCase() === workerName.toLowerCase());
  if (!w0) die(`worker "${workerName}" não encontrado. Existem: ${workers.map(w => w.name).join(', ')}`);
  const worker = await api.worker(farmId, w0.id);
  const online = !!worker?.stats?.online;
  const fsAtual = worker?.flight_sheet || null;
  log(`worker ${worker.name} (#${worker.id}) online=${online} fs=${fsAtual?.name ?? 'nenhuma'}`);

  // Flight sheets ↔ candidatos
  const sheets = (await api.flightSheets(farmId))?.data || [];
  const porCoin = new Map();
  for (const fsh of sheets) {
    const c = matchCandidate(fsh.name, cfg.candidates);
    if (c && !porCoin.has(c.coin)) porCoin.set(c.coin, fsh);
  }
  log('flight sheets:', sheets.map(s => `"${s.name}"${porCoin.get(matchCandidate(s.name, cfg.candidates)?.coin)?.id === s.id ? ' ✓' : ''}`).join(', ') || 'nenhuma');

  const candAtual = fsAtual ? matchCandidate(fsAtual.name, cfg.candidates) : null;
  const currentCoin = candAtual?.coin ?? null;

  // Observação do rig → calibra o benchmark da moeda atual
  let obs = null;
  const minDesdeTroca = state.lastSwitchAt ? (Date.now() - Date.parse(state.lastSwitchAt)) / 60000 : Infinity;
  if (online && candAtual && minDesdeTroca < COOLDOWN_MIN) {
    log(`troca há ${Math.round(minDesdeTroca)} min — aguardando ${COOLDOWN_MIN} min antes de observar/decidir`);
  } else if (online && candAtual) {
    const o = observeWorker(worker, candAtual);
    const prev = state.bench[candAtual.coin] || {};
    if (o && !plausible(prev, o.hashrate)) {
      log(`observação descartada: ${o.hashrate.toFixed(2)} ${candAtual.unit} destoa do benchmark ${prev.hashrate?.toFixed(2)}`);
    } else if (o) {
      state.bench[candAtual.coin] = {
        hashrate: ema(prev.hashrate, o.hashrate),
        watts: o.watts ? ema(prev.watts, o.watts) : prev.watts ?? null,
        unit: candAtual.unit, updatedAt: new Date().toISOString(), samples: (prev.samples || 0) + 1,
      };
      obs = { ...o, unit: candAtual.unit };
      log(`observado ${candAtual.coin}: ${o.hashrate.toFixed(2)} ${candAtual.unit} @ ${o.watts ? Math.round(o.watts) + ' W' : '? W'} (${o.miner}/${o.algo})`);
    } else {
      log('sem hashrate (ou algo não bate com a flight sheet) — minerador reiniciando? mantendo benchmark anterior');
    }
  }
  const emCooldown = minDesdeTroca < COOLDOWN_MIN;

  // Rentabilidade de cada candidato
  const cambio = await usdBrl();
  const ranking = [];
  for (const c of cfg.candidates) {
    if (!porCoin.has(c.coin)) { log(`${c.coin}: sem flight sheet casada — ignorado`); continue; }
    const b = benchFor(c, state);
    if (!b) { log(`${c.coin}: sem hashrate conhecido — minere 1h manualmente para calibrar`); continue; }
    try {
      const r = await wtmRevenueUsd(c.wtmId, b.hashrate, b.watts);
      const net = dailyNet({ revenueUsd: r.revenueUsd, watts: b.watts, overheadW: cfg.overheadW, kwhBrl, usdBrl: cambio, poolFeePct: c.poolFeePct || 0 });
      ranking.push({ coin: c.coin, fsId: porCoin.get(c.coin).id, fsName: porCoin.get(c.coin).name, revenueUsd: r.revenueUsd, hashrate: b.hashrate, watts: b.watts, fonte: b.fonte, lagging: r.lagging, ...net });
      log(`${c.coin}: ${b.hashrate.toFixed(1)} ${c.unit} @ ${b.watts ?? '?'} W → US$ ${r.revenueUsd.toFixed(2)}/dia → líquido ${fmtBrl(net.liquidoBrl)}/dia (${b.fonte}${r.lagging ? ', WTM defasado' : ''})`);
    } catch (e) { log(`${c.coin}: falha ao cotar —`, e.message); }
  }

  const decision = emCooldown
    ? { action: 'none', reason: `cooldown pós-troca (${Math.round(minDesdeTroca)}/${COOLDOWN_MIN} min)` }
    : decide({ currentCoin, ranking, state, thresholdPct: cfg.thresholdPct, minStreak: cfg.minStreak });
  log('decisão:', decision.action, '—', decision.reason);

  // Executa a troca
  let trocou = false;
  if (decision.action === 'switch') {
    const alvo = ranking.find(r => r.coin === decision.target);
    if (!online) log('worker offline — não troco flight sheet agora');
    else if (DRY_RUN) log(`DRY_RUN: trocaria para "${alvo.fsName}" (fs ${alvo.fsId})`);
    else {
      await api.setFlightSheet(farmId, worker.id, alvo.fsId);
      trocou = true;
      state.lastSwitchAt = new Date().toISOString();
      log(`✅ flight sheet trocada para "${alvo.fsName}"`);
    }
  }

  // Histórico curto (7 dias de horas)
  state.history = [...(state.history || []), {
    t: new Date().toISOString(), coin: currentCoin, obs: obs ? { h: +obs.hashrate.toFixed(2), w: obs.watts ? Math.round(obs.watts) : null } : null,
    best: decision.best?.coin ?? null, bestBrl: decision.best ? +decision.best.liquidoBrl.toFixed(2) : null, action: decision.action,
  }].slice(-24 * 7);
  state.lastRun = new Date().toISOString();
  saveState(stateFile, state);

  // Relatório
  const texto = formatReport({ workerName: worker.name, currentCoin, ranking, decision, obs, usdBrl: cambio, kwhBrl, dryRun: DRY_RUN });
  console.log('\n' + texto + '\n');
  const hora = new Date().getUTCHours();
  const horaRelatorio = parseInt(env('REPORT_HOUR_UTC', '23'), 10);
  const sempre = ['1', 'true'].includes(String(env('REPORT_ALWAYS', '')).toLowerCase());
  if (trocou || sempre || hora === horaRelatorio || !online) {
    await telegram((!online ? '⚠️ RIG OFFLINE\n\n' : '') + texto);
  }

  // Resumo para o GitHub Actions
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) fs.appendFileSync(summary, '```\n' + texto + '\n```\n');
}

main().catch(e => die(e.stack || e.message));
