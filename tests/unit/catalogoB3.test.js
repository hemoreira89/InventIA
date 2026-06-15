import { describe, it, expect } from "vitest";
import {
  amostrarUniversoBalanceado,
  getTickersPorCategorias,
  getDefaultUniverso,
  getAllTickers,
} from "../../src/lib/catalogoB3";

describe("amostrarUniversoBalanceado", () => {
  it("retorna a lista inteira quando é menor ou igual ao limite", () => {
    const t = ["PETR4", "VALE3", "ITUB4"];
    expect(amostrarUniversoBalanceado(t, 20)).toEqual(t);
  });

  it("respeita o limite quando o universo é maior", () => {
    const todos = getAllTickers();
    expect(todos.length).toBeGreaterThan(20);
    const amostra = amostrarUniversoBalanceado(todos, 20);
    expect(amostra).toHaveLength(20);
  });

  it("distribui entre setores em vez de pegar só os primeiros do catálogo", () => {
    // Universo com 2 setores distintos (bancos no início, FIIs no fim do catálogo)
    const bancos = getTickersPorCategorias(["bancos"]);
    const fiisPapel = getTickersPorCategorias(["fii_papel"]);
    const universo = [...bancos, ...fiisPapel];
    const amostra = amostrarUniversoBalanceado(universo, 4);
    // Deve conter ativos dos DOIS setores (round-robin), não só bancos
    expect(amostra.some(t => bancos.includes(t))).toBe(true);
    expect(amostra.some(t => fiisPapel.includes(t))).toBe(true);
  });

  it("não inventa tickers fora do universo informado", () => {
    const universo = getDefaultUniverso();
    const amostra = amostrarUniversoBalanceado(universo, 10);
    amostra.forEach(t => expect(universo).toContain(t));
  });

  it("preserva a ordem (liquidez) dentro de cada setor", () => {
    const bancos = getTickersPorCategorias(["bancos"]);
    // Só um setor → vira slice em ordem
    const amostra = amostrarUniversoBalanceado(bancos, 3);
    expect(amostra).toEqual(bancos.slice(0, 3));
  });

  it("lida com entrada vazia/indefinida sem quebrar", () => {
    expect(amostrarUniversoBalanceado([], 20)).toEqual([]);
    expect(amostrarUniversoBalanceado(undefined, 20)).toEqual([]);
  });
});
