import { describe, it, expect } from "vitest";
import {
  calcularHHI,
  classificarHHI,
  calcularConcentracao,
  calcularConcentracaoSetorial,
  calcularScoreSaude,
  gerarAlertasRisco,
  analisarRisco
} from "../../src/lib/risco";

describe("calcularHHI", () => {
  it("retorna 0 para lista vazia", () => {
    expect(calcularHHI([])).toBe(0);
    expect(calcularHHI(null)).toBe(0);
    expect(calcularHHI(undefined)).toBe(0);
  });

  it("calcula HHI correto para concentração máxima", () => {
    // 1 ativo com 100% → 100² = 10000
    expect(calcularHHI([{ peso: 100 }])).toBe(10000);
  });

  it("calcula HHI correto para diversificação perfeita", () => {
    // 10 ativos com 10% cada → 10 × 10² = 1000
    const pos = Array.from({ length: 10 }, () => ({ peso: 10 }));
    expect(calcularHHI(pos)).toBe(1000);
  });

  it("calcula HHI correto para 4 ativos iguais (limite moderado)", () => {
    // 4 × 25² = 2500
    const pos = Array.from({ length: 4 }, () => ({ peso: 25 }));
    expect(calcularHHI(pos)).toBe(2500);
  });

  it("trata pesos undefined como 0", () => {
    expect(calcularHHI([{ peso: 50 }, {}])).toBe(2500);
  });
});

describe("classificarHHI", () => {
  it("classifica corretamente cada faixa", () => {
    expect(classificarHHI(500).nivel).toBe("Diversificado");
    expect(classificarHHI(2000).nivel).toBe("Moderado");
    expect(classificarHHI(3500).nivel).toBe("Concentrado");
    expect(classificarHHI(7000).nivel).toBe("Muito concentrado");
  });

  it("retorna cor semântica adequada", () => {
    expect(classificarHHI(500).cor).toBe("success");
    expect(classificarHHI(2000).cor).toBe("warning");
    expect(classificarHHI(7000).cor).toBe("danger");
  });
});

describe("calcularConcentracao", () => {
  const carteiraExemplo = [
    { ticker: "PETR4", peso: 30 },
    { ticker: "VALE3", peso: 20 },
    { ticker: "ITUB4", peso: 15 },
    { ticker: "BBAS3", peso: 10 },
    { ticker: "TAEE11", peso: 8 },
    { ticker: "HGLG11", peso: 7 },
    { ticker: "MXRF11", peso: 5 },
    { ticker: "EGIE3", peso: 5 }
  ];

  it("retorna estrutura vazia para carteira vazia", () => {
    const r = calcularConcentracao([]);
    expect(r.qtdAtivos).toBe(0);
    expect(r.maiorPosicao).toBeNull();
    expect(r.acima10Pct).toEqual([]);
  });

  it("identifica corretamente a maior posição", () => {
    const r = calcularConcentracao(carteiraExemplo);
    expect(r.maiorPosicao.ticker).toBe("PETR4");
    expect(r.maiorPosicao.peso).toBe(30);
  });

  it("calcula top3 corretamente", () => {
    const r = calcularConcentracao(carteiraExemplo);
    expect(r.top3Pct).toBe(65); // 30 + 20 + 15
  });

  it("calcula top5 corretamente", () => {
    const r = calcularConcentracao(carteiraExemplo);
    expect(r.top5Pct).toBe(83); // 30 + 20 + 15 + 10 + 8
  });

  it("identifica posições acima de 10%", () => {
    const r = calcularConcentracao(carteiraExemplo);
    expect(r.acima10Pct).toHaveLength(3);
    expect(r.acima10Pct.map(p => p.ticker)).toEqual(["PETR4", "VALE3", "ITUB4"]);
  });

  it("não inclui posições com exatamente 10%", () => {
    const pos = [{ ticker: "X", peso: 10 }, { ticker: "Y", peso: 90 }];
    const r = calcularConcentracao(pos);
    expect(r.acima10Pct.map(p => p.ticker)).toEqual(["Y"]);
  });
});

describe("calcularConcentracaoSetorial", () => {
  const carteira = [
    { ticker: "PETR4", peso: 20, setor: "Petróleo" },
    { ticker: "VALE3", peso: 15, setor: "Mineração" },
    { ticker: "ITUB4", peso: 25, setor: "Financeiro" },
    { ticker: "BBAS3", peso: 15, setor: "Bancos" },
    { ticker: "HGLG11", peso: 25, setor: "FII" }
  ];

  it("agrupa setores corretamente", () => {
    const r = calcularConcentracaoSetorial(carteira);
    expect(r.qtdSetores).toBe(5); // Sem normalização, 5 setores distintos
  });

  it("aplica normalização quando fornecida", () => {
    // Normalizar "Bancos" e "Financeiro" no mesmo setor
    const normalizar = (s) => {
      if (s === "Bancos" || s === "Financeiro") return "Financeiro";
      if (s === "Petróleo" || s === "Mineração") return "Commodities";
      return s;
    };
    const r = calcularConcentracaoSetorial(carteira, normalizar);
    expect(r.qtdSetores).toBe(3); // Financeiro, Commodities, FII
    expect(r.maiorSetor.setor).toBe("Financeiro");
    expect(r.maiorSetor.peso).toBe(40); // 25 + 15
  });

  it("ordena distribuição do maior para o menor", () => {
    const r = calcularConcentracaoSetorial(carteira);
    const pesos = r.distribuicao.map(d => d.peso);
    const ordenado = [...pesos].sort((a, b) => b - a);
    expect(pesos).toEqual(ordenado);
  });
});

describe("calcularScoreSaude", () => {
  it("retorna 0 para carteira vazia", () => {
    expect(calcularScoreSaude([])).toBe(0);
  });

  it("dá score alto para carteira diversificada", () => {
    const pos = Array.from({ length: 10 }, (_, i) => ({
      ticker: `T${i}`,
      peso: 10,
      setor: ["Bancos", "Energia", "FII", "Petróleo", "Saúde"][i % 5]
    }));
    const score = calcularScoreSaude(pos);
    expect(score).toBeGreaterThan(70);
  });

  it("dá score baixo para carteira concentrada", () => {
    const pos = [
      { ticker: "PETR4", peso: 80, setor: "Petróleo" },
      { ticker: "VALE3", peso: 20, setor: "Mineração" }
    ];
    const score = calcularScoreSaude(pos);
    expect(score).toBeLessThan(50);
  });

  it("retorna número inteiro entre 0 e 100", () => {
    const pos = [{ ticker: "X", peso: 100, setor: "Y" }];
    const score = calcularScoreSaude(pos);
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("gerarAlertasRisco", () => {
  it("retorna alerta de sucesso para carteira saudável", () => {
    const pos = Array.from({ length: 10 }, (_, i) => ({
      ticker: `T${i}`,
      peso: 10,
      setor: ["A", "B", "C", "D", "E"][i % 5]
    }));
    const alertas = gerarAlertasRisco(pos);
    expect(alertas[0].tipo).toBe("success");
  });

  it("alerta sobre posição muito concentrada (>25%)", () => {
    const pos = [
      { ticker: "PETR4", peso: 30, setor: "A" },
      { ticker: "VALE3", peso: 70, setor: "B" }
    ];
    const alertas = gerarAlertasRisco(pos);
    const alertaConc = alertas.find(a => a.mensagem.includes("VALE3"));
    expect(alertaConc).toBeDefined();
    expect(alertaConc.tipo).toBe("danger");
  });

  it("alerta sobre setor dominante (>50%)", () => {
    const pos = [
      { ticker: "ITUB4", peso: 30, setor: "Financeiro" },
      { ticker: "BBAS3", peso: 30, setor: "Financeiro" },
      { ticker: "PETR4", peso: 40, setor: "Petróleo" }
    ];
    const alertas = gerarAlertasRisco(pos);
    const alertaSetor = alertas.find(a => a.mensagem.includes("Financeiro"));
    expect(alertaSetor).toBeDefined();
  });

  it("alerta sobre carteira pequena", () => {
    const pos = [
      { ticker: "X", peso: 50, setor: "A" },
      { ticker: "Y", peso: 50, setor: "B" }
    ];
    const alertas = gerarAlertasRisco(pos);
    const alertaTamanho = alertas.find(a => a.mensagem.includes("ativos"));
    expect(alertaTamanho).toBeDefined();
  });
});

describe("analisarRisco (fachada)", () => {
  it("retorna estrutura completa", () => {
    const pos = [
      { ticker: "PETR4", peso: 50, setor: "Petróleo" },
      { ticker: "VALE3", peso: 50, setor: "Mineração" }
    ];
    const r = analisarRisco(pos);

    expect(r).toHaveProperty("score");
    expect(r).toHaveProperty("concentracao");
    expect(r).toHaveProperty("setorial");
    expect(r).toHaveProperty("alertas");
    expect(typeof r.score).toBe("number");
    expect(Array.isArray(r.alertas)).toBe(true);
  });
});
