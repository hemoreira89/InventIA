import { describe, it, expect } from "vitest";
import { projetarCalendario, resumoCalendario, SAZONALIDADE_ACOES } from "../../src/lib/calc.js";

// Datas fixas para testes determinísticos
const HOJE_JAN = new Date("2025-01-15"); // Janeiro 2025 (mes=0)
const HOJE_MAR = new Date("2025-03-15"); // Março 2025 (mes=2) — pico de sazonalidade
const HOJE_DEZ = new Date("2025-12-01"); // Dezembro 2025 — virada de ano

describe("projetarCalendario", () => {
  it("retorna exatamente 12 meses", () => {
    const cal = projetarCalendario([], {}, {}, [], HOJE_JAN);
    expect(cal.length).toBe(12);
  });

  it("primeiro mês é o mês atual", () => {
    const cal = projetarCalendario([], {}, {}, [], HOJE_JAN);
    expect(cal[0].mes).toBe(0);
    expect(cal[0].ano).toBe(2025);
    expect(cal[0].isAtual).toBe(true);
    expect(cal[0].isFuturo).toBe(false);
  });

  it("meses seguintes são futuros", () => {
    const cal = projetarCalendario([], {}, {}, [], HOJE_JAN);
    expect(cal[1].isFuturo).toBe(true);
    expect(cal[11].isFuturo).toBe(true);
    expect(cal[1].isAtual).toBe(false);
  });

  it("FII distribui uniformemente (fator 1.0 todo mês)", () => {
    const carteira = [{ ticker: "MXRF11", qtd: 100, pm: 10 }];
    const precos = { MXRF11: 10 };
    const dys = { MXRF11: 12 }; // 12% ao ano → R$1000 * 12% / 12 = R$10/mês
    const cal = projetarCalendario(carteira, precos, dys, [], HOJE_JAN);
    cal.forEach(m => {
      expect(m.projetado).toBe(10);
    });
  });

  it("ação aplica sazonalidade correta no mês pico (Março)", () => {
    const carteira = [{ ticker: "PETR4", qtd: 100, pm: 120 }];
    const precos = { PETR4: 120 };
    const dys = { PETR4: 12 }; // 12% → base mensal = 12000*12%/12 = 120
    const cal = projetarCalendario(carteira, precos, dys, [], HOJE_MAR);
    // Março (mes=2): fator = SAZONALIDADE_ACOES[2] = 1.8
    expect(cal[0].mes).toBe(2);
    expect(cal[0].projetado).toBe(Math.round(120 * SAZONALIDADE_ACOES[2]));
  });

  it("usa DY padrão 8% para FII quando não fornecido", () => {
    const carteira = [{ ticker: "HGLG11", qtd: 100, pm: 100 }];
    const precos = { HGLG11: 100 };
    const cal = projetarCalendario(carteira, precos, {}, [], HOJE_JAN);
    // R$10000 * 8% / 12 = ~66.67 → Math.round = 67
    expect(cal[0].projetado).toBe(Math.round(10000 * 8 / 100 / 12));
  });

  it("usa DY padrão 5% para ação quando não fornecido", () => {
    const carteira = [{ ticker: "VALE3", qtd: 100, pm: 100 }];
    const precos = { VALE3: 100 };
    const cal = projetarCalendario(carteira, precos, {}, [], HOJE_JAN);
    // R$10000 * 5% / 12 * sazon[0=Jan] = Math.round(41.67 * 0.3)
    const esperado = Math.round(10000 * 5 / 100 / 12 * SAZONALIDADE_ACOES[0]);
    expect(cal[0].projetado).toBe(esperado);
  });

  it("preenche real com dados históricos do mês correspondente", () => {
    const historico = [
      { ticker: "MXRF11", valor: 250, data_pagamento: "2025-01-10" },
      { ticker: "HGLG11", valor: 150, data_pagamento: "2025-01-20" },
    ];
    const cal = projetarCalendario([], {}, {}, historico, HOJE_JAN);
    expect(cal[0].real).toBe(400); // soma Jan/2025
  });

  it("real é null para meses sem histórico", () => {
    const cal = projetarCalendario([], {}, {}, [], HOJE_JAN);
    expect(cal[0].real).toBeNull();
    expect(cal[1].real).toBeNull();
  });

  it("carteira vazia resulta em projetado 0 todo mês", () => {
    const cal = projetarCalendario([], {}, {}, [], HOJE_JAN);
    cal.forEach(m => expect(m.projetado).toBe(0));
  });

  it("lida com carteira null sem explodir", () => {
    expect(() => projetarCalendario(null, {}, {}, [], HOJE_JAN)).not.toThrow();
  });

  it("meses viram de ano corretamente", () => {
    const cal = projetarCalendario([], {}, {}, [], HOJE_DEZ);
    expect(cal[0].ano).toBe(2025);
    expect(cal[0].mes).toBe(11); // Dezembro
    expect(cal[1].ano).toBe(2026);
    expect(cal[1].mes).toBe(0); // Janeiro do próximo ano
  });

  it("mesLabel e mesAno têm formato correto", () => {
    const cal = projetarCalendario([], {}, {}, [], HOJE_JAN);
    expect(cal[0].mesLabel).toBe("Jan");
    expect(cal[0].mesAno).toBe("Jan/25");
  });

  it("ativos são ordenados por valor decrescente", () => {
    const carteira = [
      { ticker: "PETR4", qtd: 10, pm: 10 },
      { ticker: "MXRF11", qtd: 1000, pm: 10 }, // muito maior
    ];
    const precos = { PETR4: 10, MXRF11: 10 };
    const dys = { PETR4: 10, MXRF11: 10 };
    const cal = projetarCalendario(carteira, precos, dys, [], HOJE_MAR);
    const ativos = cal[0].ativos;
    if (ativos.length > 1) {
      expect(ativos[0].valor).toBeGreaterThanOrEqual(ativos[1].valor);
    }
  });
});

describe("resumoCalendario", () => {
  it("retorna zeros para calendário vazio", () => {
    const r = resumoCalendario([]);
    expect(r.totalAnual).toBe(0);
    expect(r.mediaMensal).toBe(0);
    expect(r.melhorMes).toBeNull();
    expect(r.piorMes).toBeNull();
  });

  it("retorna zeros para null", () => {
    const r = resumoCalendario(null);
    expect(r.totalAnual).toBe(0);
    expect(r.mediaMensal).toBe(0);
  });

  it("calcula totalAnual como soma de projetados", () => {
    const cal = [
      { projetado: 100 },
      { projetado: 200 },
      { projetado: 300 },
    ];
    expect(resumoCalendario(cal).totalAnual).toBe(600);
  });

  it("calcula mediaMensal arredondado", () => {
    const cal = Array.from({ length: 12 }, () => ({ projetado: 1000 }));
    expect(resumoCalendario(cal).mediaMensal).toBe(1000);
  });

  it("identifica melhor e pior mês corretamente", () => {
    const cal = [
      { projetado: 100, mesLabel: "Jan" },
      { projetado: 500, mesLabel: "Mar" },
      { projetado: 50,  mesLabel: "Fev" },
    ];
    const r = resumoCalendario(cal);
    expect(r.melhorMes.mesLabel).toBe("Mar");
    expect(r.piorMes.mesLabel).toBe("Fev");
  });

  it("piorMes ignora meses com projetado 0", () => {
    const cal = [
      { projetado: 0,   mesLabel: "Jan" },
      { projetado: 100, mesLabel: "Fev" },
      { projetado: 200, mesLabel: "Mar" },
    ];
    const r = resumoCalendario(cal);
    expect(r.piorMes.mesLabel).toBe("Fev"); // 0 deve ser ignorado
  });

  it("mediaMensal com 12 meses distintos é arredondado corretamente", () => {
    // Soma dos 12 fatores de sazonalidade = 12 → média = total/12
    const total = 1200;
    const cal = Array.from({ length: 12 }, (_, i) => ({ projetado: i % 2 === 0 ? 150 : 50 }));
    const soma = cal.reduce((s, m) => s + m.projetado, 0);
    const r = resumoCalendario(cal);
    expect(r.totalAnual).toBe(soma);
    expect(r.mediaMensal).toBe(Math.round(soma / 12));
  });
});
