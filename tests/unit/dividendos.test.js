import { describe, it, expect } from "vitest";
import { avaliarSegurancaDividendos } from "../../src/lib/dividendos.js";

describe("avaliarSegurancaDividendos — ações", () => {
  it("empresa sólida → alta segurança", () => {
    const r = avaliarSegurancaDividendos({
      lucrosConsistentes: true, divEbitda: 1.2, roe: 20, margemLiquida: 25,
    }, "Ação");
    expect(r.nivel).toBe("alta");
    expect(r.score).toBe(100);
    expect(r.fatores).toHaveLength(4);
  });

  it("empresa alavancada e instável → baixa segurança", () => {
    const r = avaliarSegurancaDividendos({
      lucrosConsistentes: false, divEbitda: 5, roe: 3, margemLiquida: 2,
    }, "Ação");
    expect(r.nivel).toBe("baixa");
    expect(r.score).toBe(0);
  });

  it("mistura de fatores → segurança média", () => {
    const r = avaliarSegurancaDividendos({
      lucrosConsistentes: true, divEbitda: 3, roe: 8, margemLiquida: 3,
    }, "Ação");
    // bom(100) + neutro(50) + neutro(50) + ruim(0) = 200/4 = 50
    expect(r.score).toBe(50);
    expect(r.nivel).toBe("media");
  });

  it("marca status correto por fator", () => {
    const r = avaliarSegurancaDividendos({
      lucrosConsistentes: true, divEbitda: 5, roe: 20, margemLiquida: 1,
    }, "Ação");
    const byLabel = Object.fromEntries(r.fatores.map(f => [f.label, f.status]));
    expect(byLabel["Lucros consistentes"]).toBe("bom");
    expect(byLabel["Dívida/EBITDA"]).toBe("ruim");
    expect(byLabel["ROE"]).toBe("bom");
    expect(byLabel["Margem líquida"]).toBe("ruim");
  });
});

describe("avaliarSegurancaDividendos — FIIs", () => {
  it("FII com P/VP justo e DY saudável → alta", () => {
    const r = avaliarSegurancaDividendos({ tipo: "FII", pvp: 0.98, dy: 9.5 });
    expect(r.nivel).toBe("alta");
  });

  it("FII com ágio alto e DY excessivo → baixa", () => {
    const r = avaliarSegurancaDividendos({ tipo: "FII", pvp: 1.4, dy: 16 });
    expect(r.nivel).toBe("baixa");
  });
});

describe("avaliarSegurancaDividendos — guardas", () => {
  it("retorna null sem fundamentos", () => {
    expect(avaliarSegurancaDividendos(null)).toBeNull();
  });

  it("retorna null com menos de 2 fatores disponíveis", () => {
    expect(avaliarSegurancaDividendos({ roe: 15 }, "Ação")).toBeNull();
  });
});
