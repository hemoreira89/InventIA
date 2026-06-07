import { describe, it, expect } from "vitest";
import { ibovNaData } from "../../src/lib/ibov.js";

const serie = [
  { ts: 1000, close: 100 },
  { ts: 2000, close: 110 },
  { ts: 3000, close: 120 },
];

describe("ibovNaData", () => {
  it("retorna o fechamento exato quando a data bate", () => {
    expect(ibovNaData(serie, 2000)).toBe(110);
  });

  it("usa o pregão imediatamente anterior quando não há ponto exato", () => {
    expect(ibovNaData(serie, 2500)).toBe(110);
  });

  it("usa o primeiro ponto quando a data é anterior ao histórico", () => {
    expect(ibovNaData(serie, 500)).toBe(100);
  });

  it("usa o último ponto quando a data é posterior ao histórico", () => {
    expect(ibovNaData(serie, 9999)).toBe(120);
  });

  it("retorna null para série vazia ou ausente", () => {
    expect(ibovNaData([], 2000)).toBeNull();
    expect(ibovNaData(null, 2000)).toBeNull();
  });
});
