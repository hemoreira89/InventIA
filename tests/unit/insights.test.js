import { describe, it, expect } from "vitest";
import {
  notaParaEstrelas,
  corDaNota,
  calcularPilares,
  valuationEducacional,
  calcularMediasSetor,
  compararComSetor,
  sanitizarIndicadores,
  suprimirMetricasNaoAplicaveis,
  ehSetorFinanceiro,
  classificarPorte,
  EXPLICACOES_INDICADORES,
} from "../../src/lib/insights.js";

describe("suprimirMetricasNaoAplicaveis", () => {
  it("zera EV/EBITDA, Dív/EBITDA e ROIC para banco/holding", () => {
    const r = suprimirMetricasNaoAplicaveis({ ticker: "ITSA4", setorCVM: "Bancos", evEbitda: 200, divEbitda: 6, roic: 0.3, roe: 17 });
    expect(r.evEbitda).toBeNull();
    expect(r.divEbitda).toBeNull();
    expect(r.roic).toBeNull();
    expect(r.roe).toBe(17); // ROE permanece
  });
  it("não altera setores não-financeiros", () => {
    const r = suprimirMetricasNaoAplicaveis({ ticker: "WEGE3", setorCVM: "Bens de Capital", evEbitda: 20, divEbitda: 1, roic: 30 });
    expect(r.evEbitda).toBe(20);
    expect(r.divEbitda).toBe(1);
    expect(r.roic).toBe(30);
  });
  it("ehSetorFinanceiro detecta variações", () => {
    expect(ehSetorFinanceiro({ setorCVM: "Bancos" })).toBe(true);
    expect(ehSetorFinanceiro({ setor: "Serviços Financeiros" })).toBe(true);
    expect(ehSetorFinanceiro({ setor: "Seguros" })).toBe(true);
    expect(ehSetorFinanceiro({ setor: "Petróleo" })).toBe(false);
  });
});

describe("sanitizarIndicadores", () => {
  it("zera DY absurdo (bug real bolsai: -2071%)", () => {
    const r = sanitizarIndicadores({ ticker: "XPML11", dy: -2071.2, pvp: 1 });
    expect(r.dy).toBeNull();
    expect(r.pvp).toBe(1);
  });

  it("mantém valores plausíveis", () => {
    const r = sanitizarIndicadores({ dy: 8, pl: 10, pvp: 1.2, roe: 18, margemLiquida: 20, divEbitda: 2 });
    expect(r).toMatchObject({ dy: 8, pl: 10, pvp: 1.2, roe: 18, margemLiquida: 20, divEbitda: 2 });
  });

  it("preserva P/L negativo (prejuízo) mas corta absurdos", () => {
    expect(sanitizarIndicadores({ pl: -5 }).pl).toBe(-5);
    expect(sanitizarIndicadores({ pl: 99999 }).pl).toBeNull();
  });

  it("trata P/VP zero como ausente (bug real bolsai: XPML11 P/VP 0.00)", () => {
    expect(sanitizarIndicadores({ pvp: 0 }).pvp).toBeNull();
    expect(sanitizarIndicadores({ pvp: 1 }).pvp).toBe(1);
  });

  it("corta EV/EBITDA estourado de holding/banco (ITSA4 ~209)", () => {
    expect(sanitizarIndicadores({ evEbitda: 209.4 }).evEbitda).toBeNull();
    expect(sanitizarIndicadores({ evEbitda: 12 }).evEbitda).toBe(12);
  });

  it("não quebra com entrada nula", () => {
    expect(sanitizarIndicadores(null)).toBeNull();
  });

  it("não altera campos não-indicadores", () => {
    const r = sanitizarIndicadores({ ticker: "ABCD3", nome: "Teste", dy: 200 });
    expect(r.ticker).toBe("ABCD3");
    expect(r.nome).toBe("Teste");
    expect(r.dy).toBeNull();
  });
});

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

  it("calcula pilar de crescimento por CAGR de lucro e receita", () => {
    const p = calcularPilares({ ticker: "WEGE3", tipo: "Ação", cagrLucro5y: 20, cagrReceita5y: 20 });
    expect(p.crescimento.disponivel).toBe(true);
    expect(p.crescimento.nota).toBe(100); // 50 + 20*2.5 = 100
    const baixo = calcularPilares({ ticker: "XPTO3", tipo: "Ação", cagrLucro5y: -20 });
    expect(baixo.crescimento.nota).toBe(0);
    const neutro = calcularPilares({ ticker: "YPTO3", tipo: "Ação", cagrLucro5y: 0 });
    expect(neutro.crescimento.nota).toBe(50);
  });

  it("crescimento não se aplica a FIIs", () => {
    const p = calcularPilares({ ticker: "HGLG11", tipo: "FII", dy: 8, cagrLucro5y: 10 });
    expect(p.crescimento.disponivel).toBe(false);
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

describe("classificarPorte", () => {
  it("classifica por valor de mercado", () => {
    expect(classificarPorte(1e9).label).toBe("Small cap");
    expect(classificarPorte(5e9).label).toBe("Mid cap");
    expect(classificarPorte(30e9).label).toBe("Large cap");
    expect(classificarPorte(200e9).label).toBe("Mega cap");
  });
  it("retorna null para entrada inválida", () => {
    expect(classificarPorte(0)).toBeNull();
    expect(classificarPorte(null)).toBeNull();
    expect(classificarPorte(-5)).toBeNull();
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
