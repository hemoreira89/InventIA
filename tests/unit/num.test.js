import { describe, it, expect } from "vitest";
import { num } from "../../api/cron-fundamentos.js";

describe("num() — sanitiza valores numéricos da bolsai", () => {
  describe("valores válidos passam direto", () => {
    it("aceita zero", () => {
      expect(num(0)).toBe(0);
    });

    it("aceita inteiro positivo", () => {
      expect(num(11)).toBe(11);
    });

    it("aceita decimal", () => {
      expect(num(11.42)).toBe(11.42);
    });

    it("aceita negativo (CAGR de prejuízo, P/L de empresa em prejuízo)", () => {
      expect(num(-15.3)).toBe(-15.3);
    });

    it("aceita números grandes mas razoáveis (NAV de FII em bilhões)", () => {
      expect(num(4316720449.78)).toBe(4316720449.78);
      expect(num(99999999999.99)).toBe(99999999999.99);
    });
  });

  describe("valores inválidos viram null", () => {
    it("null vira null", () => {
      expect(num(null)).toBe(null);
    });

    it("undefined vira null", () => {
      expect(num(undefined)).toBe(null);
    });

    it("string vira null (mesmo string numérica)", () => {
      expect(num("11.42")).toBe(null);
      expect(num("")).toBe(null);
    });

    it("NaN vira null", () => {
      expect(num(NaN)).toBe(null);
    });

    it("Infinity vira null (P/L de lucro zero, divisão por zero)", () => {
      expect(num(Infinity)).toBe(null);
      expect(num(-Infinity)).toBe(null);
    });

    it("objeto e array viram null", () => {
      expect(num({})).toBe(null);
      expect(num([])).toBe(null);
      expect(num([42])).toBe(null);
    });

    it("boolean vira null", () => {
      expect(num(true)).toBe(null);
      expect(num(false)).toBe(null);
    });
  });

  describe("teto sanitário 1e15 (1 quadrilhão)", () => {
    it("rejeita valores absurdos positivos", () => {
      expect(num(1e16)).toBe(null);
      expect(num(Number.MAX_SAFE_INTEGER)).toBe(null);
    });

    it("rejeita valores absurdos negativos", () => {
      expect(num(-1e16)).toBe(null);
    });

    it("aceita exatamente o teto", () => {
      expect(num(1e15)).toBe(1e15);
      expect(num(-1e15)).toBe(-1e15);
    });
  });
});
