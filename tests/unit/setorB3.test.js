import { describe, it, expect } from "vitest";
import {
  normalizarSetorCVM,
  roeMinimoSetor,
  roeMinimoFromCVM,
  SETOR_CVM_PARA_GENERICO,
  ROE_MINIMO_POR_SETOR
} from "../../src/lib/setorB3";

describe("normalizarSetorCVM - tabela direta", () => {
  it("normaliza Petróleo e Gás", () => {
    expect(normalizarSetorCVM("Petróleo e Gás")).toBe("Petróleo e Gás");
  });

  it("normaliza Bancos", () => {
    expect(normalizarSetorCVM("Bancos")).toBe("Bancos");
  });

  it("normaliza Emp. Adm. Part. - Energia Elétrica", () => {
    expect(normalizarSetorCVM("Emp. Adm. Part. - Energia Elétrica")).toBe("Energia Elétrica");
  });

  it("normaliza Saneamento, Serv. Água e Gás", () => {
    expect(normalizarSetorCVM("Saneamento, Serv. Água e Gás")).toBe("Saneamento");
  });

  it("normaliza Emp. Adm. Part. - Máqs., Equip., Veíc. e Peças → Bens de Capital", () => {
    expect(normalizarSetorCVM("Emp. Adm. Part. - Máqs., Equip., Veíc. e Peças")).toBe("Bens de Capital");
  });
});

describe("normalizarSetorCVM - heurística por palavra-chave", () => {
  it("detecta banco em strings novas", () => {
    expect(normalizarSetorCVM("Banco de Investimento Especializado")).toBe("Bancos");
  });

  it("detecta intermediação financeira", () => {
    expect(normalizarSetorCVM("Intermediários Financeiros - Banco")).toBe("Bancos");
  });

  it("detecta energia elétrica em strings variadas", () => {
    expect(normalizarSetorCVM("Geração de Energia Elétrica Renovável")).toBe("Energia Elétrica");
  });

  it("detecta saneamento", () => {
    expect(normalizarSetorCVM("Empresa de Saneamento Básico")).toBe("Saneamento");
  });

  it("detecta mineração", () => {
    expect(normalizarSetorCVM("Extração e Beneficiamento de Minerais")).toBe("Mineração");
  });

  it("detecta saúde", () => {
    expect(normalizarSetorCVM("Hospitais e Clínicas Especializadas")).toBe("Saúde");
  });

  it("detecta tecnologia", () => {
    expect(normalizarSetorCVM("Software e Programas de Computador")).toBe("Tecnologia");
  });

  it("detecta varejo", () => {
    expect(normalizarSetorCVM("Comércio Varejista de Vestuário")).toBe("Varejo");
  });

  it("detecta agricultura", () => {
    expect(normalizarSetorCVM("Agropecuária e Pesca")).toBe("Agricultura");
  });
});

describe("normalizarSetorCVM - fallbacks", () => {
  it("retorna 'Outros' para input nulo", () => {
    expect(normalizarSetorCVM(null)).toBe("Outros");
    expect(normalizarSetorCVM(undefined)).toBe("Outros");
    expect(normalizarSetorCVM("")).toBe("Outros");
  });

  it("retorna o original se não encontrar nada (cai no default depois)", () => {
    const setorEstranho = "Setor Não Existente Qualquer";
    expect(normalizarSetorCVM(setorEstranho)).toBe(setorEstranho);
  });
});

describe("roeMinimoSetor - thresholds por setor", () => {
  it("Bancos exige ROE mínimo de 12%", () => {
    expect(roeMinimoSetor("Bancos")).toBe(12);
  });

  it("Saneamento exige apenas 6% (capital intensivo)", () => {
    expect(roeMinimoSetor("Saneamento")).toBe(6);
  });

  it("Energia Elétrica exige 8%", () => {
    expect(roeMinimoSetor("Energia Elétrica")).toBe(8);
  });

  it("Tecnologia exige 18% (margens altas)", () => {
    expect(roeMinimoSetor("Tecnologia")).toBe(18);
  });

  it("Petróleo e Gás exige 10% (cíclico)", () => {
    expect(roeMinimoSetor("Petróleo e Gás")).toBe(10);
  });

  it("retorna default 12% para setores desconhecidos", () => {
    expect(roeMinimoSetor("Setor Que Não Existe")).toBe(12);
    expect(roeMinimoSetor(null)).toBe(12);
    expect(roeMinimoSetor(undefined)).toBe(12);
  });
});

describe("roeMinimoFromCVM - composição de funções", () => {
  it("TAEE11 (Energia Elétrica) → ROE mínimo 8%", () => {
    expect(roeMinimoFromCVM("Emp. Adm. Part. - Energia Elétrica")).toBe(8);
  });

  it("SAPR11 (Saneamento) → ROE mínimo 6%", () => {
    expect(roeMinimoFromCVM("Saneamento, Serv. Água e Gás")).toBe(6);
  });

  it("BBAS3 (Bancos) → ROE mínimo 12%", () => {
    expect(roeMinimoFromCVM("Bancos")).toBe(12);
  });

  it("PETR4 (Petróleo) → ROE mínimo 10%", () => {
    expect(roeMinimoFromCVM("Petróleo e Gás")).toBe(10);
  });

  it("WEGE3 (Bens de Capital) → ROE mínimo 12%", () => {
    expect(roeMinimoFromCVM("Emp. Adm. Part. - Máqs., Equip., Veíc. e Peças")).toBe(12);
  });
});

describe("Tabelas - validações estruturais", () => {
  it("SETOR_CVM_PARA_GENERICO tem entradas", () => {
    expect(Object.keys(SETOR_CVM_PARA_GENERICO).length).toBeGreaterThan(20);
  });

  it("ROE_MINIMO_POR_SETOR tem entradas para setores principais", () => {
    expect(ROE_MINIMO_POR_SETOR["Bancos"]).toBeDefined();
    expect(ROE_MINIMO_POR_SETOR["Energia Elétrica"]).toBeDefined();
    expect(ROE_MINIMO_POR_SETOR["Saneamento"]).toBeDefined();
    expect(ROE_MINIMO_POR_SETOR["Tecnologia"]).toBeDefined();
  });

  it("Todos os ROEs mínimos estão entre 5% e 25% (sanity check)", () => {
    Object.values(ROE_MINIMO_POR_SETOR).forEach(roe => {
      expect(roe).toBeGreaterThanOrEqual(5);
      expect(roe).toBeLessThanOrEqual(25);
    });
  });
});
