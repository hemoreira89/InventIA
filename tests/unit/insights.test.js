import { describe, it, expect } from "vitest";
import {
  notaParaEstrelas,
  corDaNota,
  calcularPilares,
  valuationEducacional,
  calcularMediasSetor,
  compararComSetor,
  EXPLICACOES_INDICADORES,
} from "../../src/lib/insights.js";

describe("notaParaEstrelas", () => {
  it("converte nota 0-100 em 0..5", () => {
    expect(notaParaEstrelas(0)).toBe(0);
    expect(notaParaEstrelas(100)).toBe(5);
    expect(notaParaEstrelas(50)).toBe(3); // 2.5 → arredonda p/ 3
    expect(notaParaEstrelas(40)).toBe(2);
  });
  it("trata nulo/NaN como 0 e satura em 5", () => {
    expect(notaParaEstrelas(null)).toBe(0);
    expect(notaParaEstrelas(NaN)).toBe(0);
    expect(notaParaEstrelas(999)).toBe(5);
  });
});

describe("corDaNota", () => {
  it("mapeia faixas para cores", () => {
    expect(corDaNota(80)).toBe("success");
    expect(corDaNota(50)).toBe("warning");
    expect(corDaNota(20)).toBe("danger");
    expect(corDaNota(null)).toBe("default");
  });
});

describe("calcularPilares", () => {
  it("calcula 3 pilares para uma ação saudável", () => {
    const p = calcularPilares({
      ticker: "PETR4", tipo: "Ação",
      roe: 20, margemLiquida: 20, dy: 8, divEbitda: 0, pvp: 1, lucrosConsistentes: true,
    });
    expect(p.tipo).toBe("Ação");
    expect(p.rentabilidade.disponivel).toBe(true);
    expect(p.rentabilidade.nota).toBe(100);
    expect(p.proventos.nota).toBe(100);
    expect(p.solidez.nota).toBe(100);
    expect(p.rentabilidade.estrelas).toBe(5);
  });

  it("marca pilar como indisponível quando faltam dados", () => {
    const p = calcularPilares({ ticker: "XPTO3", tipo: "Ação" });
    expect(p.rentabilidade.disponivel).toBe(false);
    expect(p.rentabilidade.estrelas).toBe(0);
  });

  it("penaliza endividamento alto na solidez", () => {
    const alto = calcularPilares({ ticker: "AAAA3", tipo: "Ação", divEbitda: 6, pvp: 1 });
    const baixo = calcularPilares({ ticker: "BBBB3", tipo: "Ação", divEbitda: 0, pvp: 1 });
    expect(baixo.solidez.nota).toBeGreaterThan(alto.solidez.nota);
  });

  it("usa DY como centro para FIIs", () => {
    const p = calcularPilares({ ticker: "HGLG11", tipo: "FII", dy: 12, pvp: 1, vacancia: 0 });
    expect(p.tipo).toBe("FII");
    expect(p.rentabilidade.nota).toBe(100);
    expect(p.solidez.nota).toBe(100);
  });

  it("detecta FII pelo sufixo 11 sem tipo explícito", () => {
    const p = calcularPilares({ ticker: "MXRF11", dy: 10 });
    expect(p.tipo).toBe("FII");
  });

  it("retorna null sem entrada", () => {
    expect(calcularPilares(null)).toBeNull();
  });
});

describe("valuationEducacional", () => {
  it("usa Graham para ação com LPA e VPA", () => {
    // √(22.5 × 4 × 10) = √900 = 30
    const v = valuationEducacional({ ticker: "ABCD3", tipo: "Ação", precoReal: 24, lpa: 4, vpa: 10 });
    expect(v.metodo).toBe("Graham");
    expect(v.precoJusto).toBe(30);
    expect(v.margem).toBeCloseTo(25, 0); // (30-24)/24 = 25%
  });

  it("cai para Bazin quando não há LPA/VPA mas há DY", () => {
    // dividendo anual = 100 × 6% = 6 → teto Bazin 6% = 6 / 0.06 = 100
    const v = valuationEducacional({ ticker: "EFGH3", tipo: "Ação", precoReal: 100, dy: 6 });
    expect(v.metodo).toBe("Bazin");
    expect(v.precoJusto).toBe(100);
    expect(v.margem).toBeCloseTo(0, 1);
  });

  it("usa Bazin para FII com DY", () => {
    const v = valuationEducacional({ ticker: "HGLG11", tipo: "FII", precoReal: 100, dy: 12 });
    expect(v.metodo).toBe("Bazin");
    // dividendo 12 → teto = 12/0.06 = 200
    expect(v.precoJusto).toBe(200);
  });

  it("retorna null sem dados suficientes", () => {
    expect(valuationEducacional({ ticker: "ZZZZ3", tipo: "Ação", precoReal: 10 })).toBeNull();
    expect(valuationEducacional(null)).toBeNull();
  });
});

describe("calcularMediasSetor", () => {
  const pop = [
    { setorCVM: "Bancos", pl: 8, pvp: 1.5, roe: 18, dy: 6 },
    { setorCVM: "Bancos", pl: 10, pvp: 2.5, roe: 20, dy: 8 },
    { setorCVM: "Bancos", pl: 12, pvp: 0.5, roe: 16, dy: 4 },
    { setorCVM: "Energia", pl: 6, pvp: 1, roe: 12, dy: 10 },
  ];

  it("calcula medianas por setor ignorando outros setores", () => {
    const m = calcularMediasSetor(pop);
    expect(m.Bancos.n).toBe(3);
    expect(m.Bancos.pl).toBe(10); // mediana de 8,10,12
    expect(m.Bancos.pvp).toBe(1.5); // mediana de 0.5,1.5,2.5
    expect(m.Energia.n).toBe(1);
  });

  it("ignora ativos sem setor e valores ausentes", () => {
    const m = calcularMediasSetor([
      { pl: 5 }, // sem setor → ignorado
      { setorCVM: "X", pl: null, roe: 10 },
      { setorCVM: "X", pl: 20, roe: null },
    ]);
    expect(m.X.pl).toBe(20); // só um pl válido
    expect(m.X.roe).toBe(10);
  });

  it("retorna {} para população vazia", () => {
    expect(calcularMediasSetor([])).toEqual({});
  });
});

describe("compararComSetor", () => {
  const medias = { Bancos: { pl: 10, pvp: 1.5, roe: 18, dy: 6, n: 3 } };

  it("marca favorável corretamente (menor P/L é melhor, maior ROE é melhor)", () => {
    const c = compararComSetor({ setorCVM: "Bancos", pl: 8, roe: 22 }, medias);
    const pl = c.find(x => x.chave === "pl");
    const roe = c.find(x => x.chave === "roe");
    expect(pl.favoravel).toBe(true); // 8 <= 10
    expect(roe.favoravel).toBe(true); // 22 >= 18
  });

  it("marca desfavorável quando pior que a mediana", () => {
    const c = compararComSetor({ setorCVM: "Bancos", pl: 14, dy: 3 }, medias);
    expect(c.find(x => x.chave === "pl").favoravel).toBe(false);
    expect(c.find(x => x.chave === "dy").favoravel).toBe(false);
  });

  it("retorna vazio quando setor não tem médias", () => {
    expect(compararComSetor({ setorCVM: "Inexistente", pl: 8 }, medias)).toEqual([]);
    expect(compararComSetor(null, medias)).toEqual([]);
  });
});

describe("EXPLICACOES_INDICADORES", () => {
  it("tem explicações para os principais indicadores", () => {
    for (const k of ["dy", "pl", "pvp", "roe", "margemLiquida", "divEbitda"]) {
      expect(typeof EXPLICACOES_INDICADORES[k]).toBe("string");
      expect(EXPLICACOES_INDICADORES[k].length).toBeGreaterThan(10);
    }
  });
});
