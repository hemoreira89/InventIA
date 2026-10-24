import { describe, it, expect } from 'vitest';
import {
  parseMoney, matchCandidate, benchFor, dailyNet, decide, observeWorker, plausible, unitFactor, ema, formatReport,
} from '../../scripts/hive-autoswitch/lib.mjs';

const candidates = [
  { coin: 'PRL', aliases: ['Pearl', 'pearlhash'], unit: 'Th/s', hashrate: 207, watts: 190 },
  { coin: 'QTC', aliases: ['Quantus'], unit: 'Mh/s', hashrate: null, watts: null },
];

describe('parseMoney', () => {
  it('aceita formatos do WhatToMine', () => {
    expect(parseMoney('$6.43')).toBe(6.43);
    expect(parseMoney('$1,234.50')).toBe(1234.5);
    expect(parseMoney(3)).toBe(3);
    expect(parseMoney(null)).toBe(0);
    expect(parseMoney('abc')).toBe(0);
  });
});

describe('matchCandidate', () => {
  it('casa por coin ou alias, sem case', () => {
    expect(matchCandidate('Kryptex PRL', candidates).coin).toBe('PRL');
    expect(matchCandidate('pearl - srbminer', candidates).coin).toBe('PRL');
    expect(matchCandidate('QUANTUS lolminer', candidates).coin).toBe('QTC');
    expect(matchCandidate('Ravencoin', candidates)).toBeNull();
    expect(matchCandidate('', candidates)).toBeNull();
  });
});

describe('benchFor', () => {
  it('observado vence config; sem nada → null', () => {
    expect(benchFor(candidates[0], { bench: {} })).toEqual({ hashrate: 207, watts: 190, fonte: 'config' });
    expect(benchFor(candidates[0], { bench: { PRL: { hashrate: 210.5, watts: 195 } } }))
      .toEqual({ hashrate: 210.5, watts: 195, fonte: 'observado' });
    expect(benchFor(candidates[1], { bench: {} })).toBeNull();
  });
});

describe('dailyNet', () => {
  it('converte e desconta energia com overhead', () => {
    const r = dailyNet({ revenueUsd: 6, watts: 190, overheadW: 40, kwhBrl: 1, usdBrl: 5.5, poolFeePct: 1 });
    expect(r.kwhDia).toBeCloseTo(5.52, 2);
    expect(r.brutoBrl).toBeCloseTo(32.67, 2);
    expect(r.energiaBrl).toBeCloseTo(5.52, 2);
    expect(r.liquidoBrl).toBeCloseTo(27.15, 2);
  });
});

describe('decide', () => {
  const rk = (prl, qtc) => [
    { coin: 'PRL', liquidoBrl: prl },
    { coin: 'QTC', liquidoBrl: qtc },
  ];

  it('mantém quando já está na melhor', () => {
    const state = {};
    const d = decide({ currentCoin: 'PRL', ranking: rk(27, 20), state });
    expect(d.action).toBe('keep');
    expect(state.streak.count).toBe(0);
  });

  it('não age quando a flight sheet atual não é conhecida', () => {
    const d = decide({ currentCoin: null, ranking: rk(27, 20), state: {} });
    expect(d.action).toBe('none');
  });

  it('ignora vantagem abaixo do limiar', () => {
    const d = decide({ currentCoin: 'PRL', ranking: rk(27, 28), state: {}, thresholdPct: 10 });
    expect(d.action).toBe('keep');
    expect(d.vantagemPct).toBeCloseTo(3.7, 1);
  });

  it('exige streak antes de trocar e zera se a vantagem some', () => {
    const state = {};
    for (let i = 1; i <= 5; i++) {
      const d = decide({ currentCoin: 'PRL', ranking: rk(20, 30), state, thresholdPct: 10, minStreak: 6 });
      expect(d.action).toBe('keep');
      expect(state.streak).toEqual({ coin: 'QTC', count: i });
    }
    // vantagem some uma vez → streak zera
    decide({ currentCoin: 'PRL', ranking: rk(30, 30), state, thresholdPct: 10, minStreak: 6 });
    expect(state.streak.count).toBe(0);
  });

  it('troca na sexta verificação consecutiva', () => {
    const state = {};
    let d;
    for (let i = 0; i < 6; i++) d = decide({ currentCoin: 'PRL', ranking: rk(20, 30), state, thresholdPct: 10, minStreak: 6 });
    expect(d.action).toBe('switch');
    expect(d.target).toBe('QTC');
    expect(state.streak.count).toBe(0);
  });

  it('atual com lucro negativo: qualquer positivo conta como vantagem', () => {
    const d = decide({ currentCoin: 'PRL', ranking: rk(-2, 1), state: {}, thresholdPct: 10, minStreak: 1 });
    expect(d.action).toBe('switch');
  });

  it('sem candidatos → none', () => {
    expect(decide({ currentCoin: 'PRL', ranking: [], state: {} }).action).toBe('none');
  });
});

describe('observeWorker / unitFactor / ema', () => {
  it('converte kH/s do Hive para a unidade do candidato e soma watts das GPUs', () => {
    const worker = {
      miners_summary: { hashrates: [{ miner: 'srbminer', algo: 'pearlhash', hash: 207_440_000_000 }] }, // kH/s
      gpu_stats: [{ power: 189 }],
    };
    const o = observeWorker(worker, candidates[0]);
    expect(o.hashrate).toBeCloseTo(207.44, 2);
    expect(o.watts).toBe(189);
    expect(o.algo).toBe('pearlhash');
  });
  it('cai para stats.power_draw e retorna null sem hashrate', () => {
    const o = observeWorker({ miners_summary: { hashrates: [{ hash: 1000 }] }, stats: { power_draw: 230 } }, { unit: 'Mh/s' });
    expect(o.hashrate).toBe(1);
    expect(o.watts).toBe(230);
    expect(observeWorker({}, candidates[0])).toBeNull();
    expect(observeWorker({ miners_summary: { hashrates: [{ hash: 0 }] } }, candidates[0])).toBeNull();
  });
  it('unidades', () => {
    expect(unitFactor('Th/s')).toBe(1e12);
    expect(unitFactor('MH')).toBe(1e6);
    expect(unitFactor(undefined)).toBe(1);
  });
  it('ema suaviza', () => {
    expect(ema(null, 10)).toBe(10);
    expect(ema(10, 20)).toBeCloseTo(13, 5);
  });
});

describe('formatReport', () => {
  it('gera texto legível com a decisão', () => {
    const txt = formatReport({
      workerName: 'rtx5080', currentCoin: 'PRL',
      ranking: [{ coin: 'PRL', liquidoBrl: 27.1, brutoBrl: 32.6, energiaBrl: 5.5, fonte: 'observado' }],
      decision: { action: 'keep', reason: 'já está na mais rentável' },
      obs: { hashrate: 207.4, watts: 189, unit: 'Th/s' }, usdBrl: 5.5, kwhBrl: 1, dryRun: true,
    });
    expect(txt).toContain('rtx5080');
    expect(txt).toContain('dry-run');
    expect(txt).toContain('▶ PRL');
    expect(txt).toContain('Decisão: manter');
  });
});

describe('observeWorker com algos / plausible', () => {
  it('rejeita observação cujo algo não bate com a flight sheet', () => {
    const cand = { coin: 'QTC', unit: 'Mh/s', algos: ['qpow', 'poseidon'] };
    const w = { miners_summary: { hashrates: [{ algo: 'pearlhash', hash: 207_440_000_000 }] } };
    expect(observeWorker(w, cand)).toBeNull();
    w.miners_summary.hashrates[0].algo = 'qPoW';
    expect(observeWorker(w, cand)).not.toBeNull();
  });
  it('plausible: só filtra com histórico e fora da banda 2x', () => {
    expect(plausible({ hashrate: 200, samples: 1 }, 1e6)).toBe(true);
    expect(plausible({ hashrate: 200, samples: 5 }, 1e6)).toBe(false);
    expect(plausible({ hashrate: 200, samples: 5 }, 150)).toBe(true);
    expect(plausible(null, 5)).toBe(true);
  });
});
