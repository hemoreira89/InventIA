import { describe, it, expect } from "vitest";
import {
  dividendoMensal,
  magicNumber,
  progressoMagicNumber,
  precoTetoBazin,
  precoJustoGraham,
  margemSeguranca,
} from "../../src/lib/calc.js";

describe("dividendoMensal", () => {
  it("calcula dividendo mensal a partir do DY anual", () => {
    // R$100 a 12% a.a. → R$12/ano → R$1/mês
    expect(dividendoMensal(100, 12)).toBeCloseTo(1, 5);
  });

  it("retorna null para entradas inválidas", () => {
    expect(dividendoMensal(0, 12)).toBeNull();
    expect(dividendoMensal(100, 0)).toBeNull();
    expect(dividendoMensal(-10, 12)).toBeNull();
    expect(dividendoMensal(100, null)).toBeNull();
  });
});

describe("magicNumber", () => {
  it("nº de cotas para 1 dividendo comprar 1 cota (arredonda p/ cima)", () => {
    // Cota R$10, dividendo mensal R$0,10 → 100 cotas
    expect(magicNumber(10, 0.1)).toBe(100);
    // Cota R$100, dividendo R$0,90 → 111,1 → 112
    expect(magicNumber(100, 0.9)).toBe(112);
  });

  it("retorna null para entradas inválidas", () => {
    expect(magicNumber(0, 1)).toBeNull();
    expect(magicNumber(10, 0)).toBeNull();
    expect(magicNumber(10, -1)).toBeNull();
  });

  it("consistente com dividendoMensal (FII 9% a.a.)", () => {
    const preco = 100;
    const divM = dividendoMensal(preco, 9); // R$0,75/mês
    // 1200/9 ≈ 133,33 → 134
    expect(magicNumber(preco, divM)).toBe(134);
  });
});

describe("progressoMagicNumber", () => {
  it("calcula percentual, atingido e quanto falta", () => {
    expect(progressoMagicNumber(50, 100)).toEqual({ percentual: 50, atingido: false, faltam: 50 });
  });

  it("marca atingido e limita percentual a 100", () => {
    const r = progressoMagicNumber(150, 100);
    expect(r.atingido).toBe(true);
    expect(r.percentual).toBe(100);
    expect(r.faltam).toBe(0);
  });

  it("trata qtd ausente como zero", () => {
    expect(progressoMagicNumber(undefined, 100)).toEqual({ percentual: 0, atingido: false, faltam: 100 });
  });

  it("retorna null se magic inválido", () => {
    expect(progressoMagicNumber(10, 0)).toBeNull();
    expect(progressoMagicNumber(10, null)).toBeNull();
  });
});

describe("precoTetoBazin", () => {
  it("dividendo anual ÷ yield mínimo (default 6%)", () => {
    // R$6 de dividendo anual / 0,06 = R$100
    expect(precoTetoBazin(6)).toBeCloseTo(100, 5);
  });

  it("respeita yield mínimo customizado", () => {
    // R$8 / 0,08 = R$100
    expect(precoTetoBazin(8, 8)).toBeCloseTo(100, 5);
  });

  it("retorna null para entradas inválidas", () => {
    expect(precoTetoBazin(0)).toBeNull();
    expect(precoTetoBazin(6, 0)).toBeNull();
    expect(precoTetoBazin(-1)).toBeNull();
  });
});

describe("precoJustoGraham", () => {
  it("√(22.5 × LPA × VPA)", () => {
    // √(22.5 × 2 × 8) = √360 ≈ 18,97
    expect(precoJustoGraham(2, 8)).toBeCloseTo(Math.sqrt(360), 4);
  });

  it("retorna null se LPA ou VPA não positivos (prejuízo etc.)", () => {
    expect(precoJustoGraham(0, 8)).toBeNull();
    expect(precoJustoGraham(2, 0)).toBeNull();
    expect(precoJustoGraham(-1, 8)).toBeNull();
  });
});

describe("margemSeguranca", () => {
  it("positivo quando preço atual está abaixo do teto (desconto)", () => {
    // teto 120, atual 100 → +20%
    expect(margemSeguranca(100, 120)).toBeCloseTo(20, 5);
  });

  it("negativo quando preço atual está acima do teto (caro)", () => {
    // teto 80, atual 100 → -20%
    expect(margemSeguranca(100, 80)).toBeCloseTo(-20, 5);
  });

  it("retorna null para entradas inválidas", () => {
    expect(margemSeguranca(0, 120)).toBeNull();
    expect(margemSeguranca(100, 0)).toBeNull();
  });
});
