// Funções puras do autoswitch do Hive OS. Sem rede, sem efeitos colaterais —
// tudo o que decide "qual moeda minerar" fica aqui para ser testável.

/** "$6.43" | "6,43" | 6.43 → 6.43 (NaN vira 0) */
export function parseMoney(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Casa uma flight sheet do Hive OS com um candidato do coins.json.
 * O match é por substring (case-insensitive) de qualquer alias do candidato
 * no nome da flight sheet. Retorna o candidato ou null.
 */
export function matchCandidate(fsName, candidates) {
  const nome = String(fsName || '').toLowerCase();
  if (!nome) return null;
  return candidates.find(c =>
    [c.coin, ...(c.aliases || [])].some(a => a && nome.includes(String(a).toLowerCase()))
  ) || null;
}

/**
 * Hashrate e consumo efetivos de um candidato: o que foi OBSERVADO no rig
 * (state.bench[coin]) vence o que está no coins.json. Se não há nenhum dos
 * dois, o candidato não é elegível (não dá para estimar).
 */
export function benchFor(cand, state) {
  const obs = state?.bench?.[cand.coin];
  const hashrate = obs?.hashrate ?? cand.hashrate ?? null;
  const watts = obs?.watts ?? cand.watts ?? null;
  if (!hashrate || hashrate <= 0) return null;
  return { hashrate, watts: watts && watts > 0 ? watts : null, fonte: obs ? 'observado' : 'config' };
}

/**
 * Lucro líquido diário em BRL.
 *  revenueUsd: receita bruta/dia em USD (WhatToMine para o hashrate informado)
 *  watts: consumo da GPU; overheadW é o resto do rig (CPU, placa-mãe, fonte)
 */
export function dailyNet({ revenueUsd, watts, overheadW = 40, kwhBrl, usdBrl, poolFeePct = 0 }) {
  const bruto = revenueUsd * usdBrl * (1 - poolFeePct / 100);
  const kwh = ((watts || 0) + overheadW) * 24 / 1000;
  const energia = kwh * kwhBrl;
  return { brutoBrl: bruto, energiaBrl: energia, liquidoBrl: bruto - energia, kwhDia: kwh };
}

/**
 * Decide se troca de flight sheet.
 *
 * Regra: o melhor candidato precisa superar o atual em `thresholdPct` por
 * `minStreak` execuções consecutivas (histerese — evita ping-pong). O estado
 * carrega `streak: { coin, count }`.
 *
 * @param {object} p
 * @param {string|null} p.currentCoin  moeda da flight sheet ativa (null = nenhuma casada)
 * @param {Array<{coin:string, liquidoBrl:number}>} p.ranking  candidatos avaliados
 * @param {object} p.state  estado persistido (mutado: streak)
 * @returns {{ action:'keep'|'switch'|'none', target?:string, reason:string, best?:object, current?:object }}
 */
export function decide({ currentCoin, ranking, state, thresholdPct = 10, minStreak = 6 }) {
  if (!ranking.length) return { action: 'none', reason: 'nenhum candidato avaliável' };

  const sorted = [...ranking].sort((a, b) => b.liquidoBrl - a.liquidoBrl);
  const best = sorted[0];
  const current = ranking.find(r => r.coin === currentCoin) || null;

  // Sem flight sheet reconhecida: não mexe sozinho (pode ser manutenção manual).
  if (!current) {
    state.streak = { coin: null, count: 0 };
    return { action: 'none', reason: `flight sheet atual (${currentCoin ?? 'nenhuma'}) não está no coins.json`, best };
  }

  if (best.coin === current.coin) {
    state.streak = { coin: current.coin, count: 0 };
    return { action: 'keep', reason: 'já está na mais rentável', best, current };
  }

  // Vantagem relativa sobre o atual. Se o atual é ≤ 0, qualquer positivo vence.
  const base = Math.max(current.liquidoBrl, 0.01);
  const vantagemPct = ((best.liquidoBrl - current.liquidoBrl) / base) * 100;

  if (vantagemPct < thresholdPct) {
    state.streak = { coin: current.coin, count: 0 };
    return { action: 'keep', reason: `vantagem de ${vantagemPct.toFixed(1)}% < ${thresholdPct}%`, best, current, vantagemPct };
  }

  const streak = state.streak?.coin === best.coin ? state.streak.count + 1 : 1;
  state.streak = { coin: best.coin, count: streak };

  if (streak < minStreak) {
    return { action: 'keep', reason: `vantagem de ${vantagemPct.toFixed(1)}% há ${streak}/${minStreak} verificações`, best, current, vantagemPct };
  }

  state.streak = { coin: best.coin, count: 0 };
  return { action: 'switch', target: best.coin, reason: `vantagem de ${vantagemPct.toFixed(1)}% sustentada por ${minStreak} verificações`, best, current, vantagemPct };
}

/**
 * Extrai hashrate (na unidade do candidato) e watts do worker do Hive OS.
 * Tolerante a campos ausentes — retorna null quando não dá para medir.
 * Hive devolve hashrate em kH/s em miners_summary.hashrates[].hash.
 */
export function observeWorker(worker, cand) {
  const hs = worker?.miners_summary?.hashrates?.[0];
  // Logo após uma troca o Hive ainda reporta o algoritmo antigo por alguns
  // minutos. Se o candidato declara `algos`, o algo reportado precisa bater.
  if (cand?.algos?.length && hs?.algo) {
    const a = String(hs.algo).toLowerCase();
    if (!cand.algos.some(x => a.includes(String(x).toLowerCase()))) return null;
  }
  const khs = Number(hs?.hash);
  const gpus = Array.isArray(worker?.gpu_stats) ? worker.gpu_stats : [];
  const wattsGpu = gpus.reduce((s, g) => s + (Number(g?.power) || 0), 0);
  const watts = wattsGpu > 0 ? wattsGpu : (Number(worker?.stats?.power_draw) || null);
  if (!Number.isFinite(khs) || khs <= 0) return null;
  const hashrate = khs * 1000 / unitFactor(cand.unit);
  return { hashrate, watts, algo: hs?.algo || null, miner: hs?.miner || null };
}

/** Fator da unidade do candidato em H/s. */
export function unitFactor(unit) {
  const u = String(unit || 'h').toLowerCase().replace('/s', '');
  return { h: 1, kh: 1e3, mh: 1e6, gh: 1e9, th: 1e12, ph: 1e15 }[u] ?? 1;
}

/**
 * Uma amostra nova é plausível se, havendo histórico suficiente, não destoa
 * mais que 2x do benchmark anterior (protege contra leitura em unidade errada
 * ou minerador no meio de um restart).
 */
export function plausible(prev, next, { minSamples = 3, band = 2 } = {}) {
  if (!prev?.hashrate || (prev.samples || 0) < minSamples) return true;
  const r = next / prev.hashrate;
  return r >= 1 / band && r <= band;
}

/** Média móvel exponencial simples para suavizar as observações. */
export function ema(prev, next, alpha = 0.3) {
  if (prev == null || !Number.isFinite(prev)) return next;
  return prev + alpha * (next - prev);
}

export function fmtBrl(v) {
  return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',');
}

/** Monta o texto do relatório (Telegram, Markdown-free para não quebrar). */
export function formatReport({ workerName, currentCoin, ranking, decision, obs, usdBrl, kwhBrl, dryRun }) {
  const linhas = [];
  linhas.push(`⛏ ${workerName} — autoswitch${dryRun ? ' (dry-run)' : ''}`);
  if (obs) {
    const w = obs.watts ? ` · ${Math.round(obs.watts)} W` : '';
    linhas.push(`Agora: ${currentCoin ?? '?'} ${obs.hashrate.toFixed(1)} ${obs.unit}${w}`);
  }
  linhas.push('');
  for (const r of [...ranking].sort((a, b) => b.liquidoBrl - a.liquidoBrl)) {
    const marca = r.coin === currentCoin ? '▶' : ' ';
    linhas.push(`${marca} ${r.coin.padEnd(5)} ${fmtBrl(r.liquidoBrl)}/dia  (bruto ${fmtBrl(r.brutoBrl)}, luz ${fmtBrl(r.energiaBrl)}, ${r.fonte})`);
  }
  linhas.push('');
  const acao = decision.action === 'switch' ? `TROCAR → ${decision.target}` : decision.action === 'keep' ? 'manter' : 'sem ação';
  linhas.push(`Decisão: ${acao} — ${decision.reason}`);
  linhas.push(`Câmbio ${usdBrl.toFixed(2)} · kWh ${fmtBrl(kwhBrl)}`);
  return linhas.join('\n');
}
