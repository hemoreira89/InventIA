import { describe, it, expect } from "vitest";
import {
  projetarRendaPassiva,
  acharIndependenciaFinanceira,
  calcularRebalanceamento,
} from "../../src/lib/calc.js";

describe("projetarRendaPassiva", () => {
  it("retorna array com ano 0 até N anos", () => {
    const pts = projetarRendaPassiva({ patrimonioInicial: 100000, aporteMensal: 0, dyAnual: 8, taxaCrescimento: 0, anos: 5 });
    expect(pts.length).toBe(6); // 0..5 anos
    expect(pts[0].ano).toBe("0a");
    expect(pts[5].ano).toBe("5a");
  });

  it("sem crescimento e sem aporte, patrimônio é constante", () => {
    const pts = projetarRendaPassiva({ patrimonioInicial: 200000, aporteMensal: 0, dyAnual: 8, taxaCrescimento: 0, anos: 3 });
    // Sem crescimento e sem aporte, juroCompostos(pv, 0, 0, n) = pv
    expect(pts[0].patrimonio).toBe(200000);
    expect(pts[3].patrimonio).toBe(200000);
  });

  it("renda mensal = patrimônio * DY / 12", () => {
    const pts = projetarRendaPassiva({ patrimonioInicial: 120000, aporteMensal: 0, dyAnual: 12, taxaCrescimento: 0, anos: 1 });
    // R$120k * 12% / 12 = R$1.200/mês
    expect(pts[0].rendaMensal).toBe(1200);
  });

  it("patrimônio cresce com aportes", () => {
    const pts = projetarRendaPassiva({ patrimonioInicial: 0, aporteMensal: 1000, dyAnual: 8, taxaCrescimento: 12, anos: 10 });
    expect(pts[10].patrimonio).toBeGreaterThan(pts[5].patrimonio);
    expect(pts[5].patrimonio).toBeGreaterThan(pts[0].patrimonio);
  });

  it("renda mensal cresce junto com o patrimônio", () => {
    const pts = projetarRendaPassiva({ patrimonioInicial: 100000, aporteMensal: 2000, dyAnual: 8, taxaCrescimento: 10, anos: 20 });
    expect(pts[20].rendaMensal).toBeGreaterThan(pts[0].rendaMensal);
  });

  it("lida com valores zerados sem explodir", () => {
    const pts = projetarRendaPassiva({ patrimonioInicial: 0, aporteMensal: 0, dyAnual: 0, taxaCrescimento: 0, anos: 5 });
    expect(pts.length).toBe(6);
    expect(pts[5].rendaMensal).toBe(0);
  });

  it("anos mínimo é 1", () => {
    const pts = projetarRendaPassiva({ patrimonioInicial: 10000, aporteMensal: 0, dyAnual: 8, taxaCrescimento: 0, anos: 0 });
    expect(pts.length).toBeGreaterThanOrEqual(2); // pelo menos ano 0 e ano 1
  });
});

describe("acharIndependenciaFinanceira", () => {
  it("retorna null se projeção vazia", () => {
    expect(acharIndependenciaFinanceira([])).toBeNull();
    expect(acharIndependenciaFinanceira(null)).toBeNull();
  });

  it("retorna null se meta não é atingida", () => {
    const projecao = [
      { ano: "0a", rendaMensal: 500 },
      { ano: "5a", rendaMensal: 2000 },
      { ano: "10a", rendaMensal: 4000 },
    ];
    expect(acharIndependenciaFinanceira(projecao, 10000)).toBeNull();
  });

  it("retorna o primeiro ponto que atinge a meta", () => {
    const projecao = [
      { ano: "0a", rendaMensal: 500 },
      { ano: "5a", rendaMensal: 5000 },
      { ano: "10a", rendaMensal: 12000 },
      { ano: "15a", rendaMensal: 20000 },
    ];
    const result = acharIndependenciaFinanceira(projecao, 10000);
    expect(result).not.toBeNull();
    expect(result.ano).toBe("10a");
    expect(result.rendaMensal).toBe(12000);
  });

  it("meta padrão é R$10.000/mês", () => {
    const projecao = [
      { ano: "0a", rendaMensal: 500 },
      { ano: "20a", rendaMensal: 15000 },
    ];
    const result = acharIndependenciaFinanceira(projecao);
    expect(result.rendaMensal).toBe(15000);
  });
});

describe("calcularRebalanceamento", () => {
  it("retorna array vazio se sem posições", () => {
    expect(calcularRebalanceamento([])).toEqual([]);
    expect(calcularRebalanceamento(null)).toEqual([]);
  });

  it("calcula delta corretamente", () => {
    const posicoes = [
      { ticker: "PETR4", pesoAtual: 30, pesoAlvo: 20, valorAtual: 30000, preco: 35 },
      { ticker: "VALE3", pesoAtual: 20, pesoAlvo: 30, valorAtual: 20000, preco: 70 },
    ];
    const result = calcularRebalanceamento(posicoes, 0);
    const petr = result.find(r => r.ticker === "PETR4");
    const vale = result.find(r => r.ticker === "VALE3");
    expect(petr.delta).toBeCloseTo(10, 1);  // 30 - 20
    expect(vale.delta).toBeCloseTo(-10, 1); // 20 - 30
  });

  it("ação é 'comprar' quando ativo está abaixo do alvo", () => {
    // Total atual: 50k (ITUB4=10k, outros=40k). Aporte=50k. Total final=100k.
    // ITUB4 alvo=20% => R$20k. Atual=R$10k. Diferença=+R$10k => comprar.
    const posicoes = [
      { ticker: "ITUB4", pesoAtual: 10, pesoAlvo: 20, valorAtual: 10000, preco: 25 },
      { ticker: "PETR4", pesoAtual: 40, pesoAlvo: 40, valorAtual: 40000, preco: 35 },
    ];
    const result = calcularRebalanceamento(posicoes, 50000);
    const itub = result.find(r => r.ticker === "ITUB4");
    expect(itub.acao).toBe("comprar");
    expect(itub.qtdSugerida).toBeGreaterThan(0);
  });

  it("acao é 'manter' quando ativo está acima do alvo", () => {
    const posicoes = [
      { ticker: "PETR4", pesoAtual: 40, pesoAlvo: 20, valorAtual: 40000, preco: 35 },
    ];
    const result = calcularRebalanceamento(posicoes, 10000);
    expect(result[0].acao).toBe("manter");
  });

  it("sem pesoAlvo, valorAlvo é null e acao é null", () => {
    const posicoes = [
      { ticker: "ABCD3", pesoAtual: 25, pesoAlvo: 0, valorAtual: 25000, preco: 10 },
    ];
    const result = calcularRebalanceamento(posicoes, 5000);
    expect(result[0].valorAlvo).toBeNull();
    expect(result[0].acao).toBeNull();
  });

  it("qtdSugerida é calculada com base no preço", () => {
    const posicoes = [
      { ticker: "MXRF11", pesoAtual: 5, pesoAlvo: 20, valorAtual: 5000, preco: 10 },
    ];
    // Total com aporte R$100k, alvo 20% = R$20k. Valor atual R$5k. Precisa R$15k -> 1500 cotas
    const result = calcularRebalanceamento(posicoes, 95000);
    expect(result[0].qtdSugerida).toBeGreaterThan(0);
    // O valor sugerido deve ser próximo de 15.000 / 10 = 1500 cotas
    expect(result[0].qtdSugerida).toBeCloseTo(1500, -2);
  });
});
