import { describe, it, expect } from "vitest";
import { xirr, fluxosCarteira } from "../../src/lib/calc.js";

const DIA = 24 * 3600 * 1000;
const ANO = 365 * DIA;

describe("xirr", () => {
  it("retorno simples de 1 ano: -1000 → +1100 = 10% a.a.", () => {
    const t0 = new Date("2024-01-01").getTime();
    const r = xirr([
      { date: new Date(t0), amount: -1000 },
      { date: new Date(t0 + ANO), amount: 1100 },
    ]);
    expect(r).toBeCloseTo(0.10, 3);
  });

  it("2 anos: -1000 → +1210 = 10% a.a. (juros compostos)", () => {
    const t0 = new Date("2024-01-01").getTime();
    const r = xirr([
      { date: new Date(t0), amount: -1000 },
      { date: new Date(t0 + 2 * ANO), amount: 1210 },
    ]);
    expect(r).toBeCloseTo(0.10, 3);
  });

  it("retorno negativo: -1000 → +900 em 1 ano = -10% a.a.", () => {
    const t0 = new Date("2024-01-01").getTime();
    const r = xirr([
      { date: new Date(t0), amount: -1000 },
      { date: new Date(t0 + ANO), amount: 900 },
    ]);
    expect(r).toBeCloseTo(-0.10, 3);
  });

  it("múltiplos aportes: NPV na taxa encontrada é ~0", () => {
    const t0 = new Date("2023-01-01").getTime();
    const flows = [
      { date: new Date(t0), amount: -1000 },
      { date: new Date(t0 + ANO), amount: -1000 },
      { date: new Date(t0 + 2 * ANO), amount: 2300 },
    ];
    const r = xirr(flows);
    expect(r).not.toBeNull();
    // valida pela definição: NPV(r) ≈ 0
    const npv = flows.reduce((s, f) => {
      const anos = (new Date(f.date).getTime() - t0) / ANO;
      return s + f.amount / Math.pow(1 + r, anos);
    }, 0);
    expect(Math.abs(npv)).toBeLessThan(0.01);
  });

  it("aceita datas em string ISO", () => {
    const r = xirr([
      { date: "2024-01-01", amount: -1000 },
      { date: "2025-01-01", amount: 1100 },
    ]);
    expect(r).toBeCloseTo(0.10, 2);
  });

  it("retorna null sem fluxo positivo e negativo", () => {
    expect(xirr([{ date: "2024-01-01", amount: -1000 }])).toBeNull();
    expect(xirr([
      { date: "2024-01-01", amount: -1000 },
      { date: "2025-01-01", amount: -500 },
    ])).toBeNull();
  });

  it("retorna null para entrada inválida", () => {
    expect(xirr(null)).toBeNull();
    expect(xirr([])).toBeNull();
  });
});

describe("fluxosCarteira", () => {
  const hoje = new Date("2025-01-01");

  it("converte compras em aportes negativos + valor atual positivo", () => {
    const compras = [
      { qtd: 100, pm: 10, data: "2024-01-01" }, // -1000
      { qtd: 50, pm: 20, data: "2024-06-01" },  // -1000
    ];
    const fluxos = fluxosCarteira(compras, 2300, hoje);
    expect(fluxos).toHaveLength(3);
    expect(fluxos[0].amount).toBe(-1000);
    expect(fluxos[1].amount).toBe(-1000);
    expect(fluxos[2].amount).toBe(2300);
    expect(fluxos[2].date).toBe(hoje);
  });

  it("ignora compras sem data ou com valores inválidos", () => {
    const compras = [
      { qtd: 100, pm: 10, data: "2024-01-01" },
      { qtd: 0, pm: 10, data: "2024-02-01" },
      { qtd: 10, pm: 0, data: "2024-03-01" },
      { qtd: 10, pm: 5, data: null },
    ];
    const fluxos = fluxosCarteira(compras, 1500, hoje);
    expect(fluxos).toHaveLength(2); // 1 aporte válido + valor atual
  });

  it("sem valor atual positivo, não adiciona o fluxo final", () => {
    const fluxos = fluxosCarteira([{ qtd: 10, pm: 10, data: "2024-01-01" }], 0, hoje);
    expect(fluxos).toHaveLength(1);
  });

  it("integra com xirr: compras simples → ~10% a.a.", () => {
    const compras = [{ qtd: 100, pm: 10, data: "2024-01-01" }]; // -1000
    const fluxos = fluxosCarteira(compras, 1100, new Date("2025-01-01"));
    expect(xirr(fluxos)).toBeCloseTo(0.10, 2);
  });
});
