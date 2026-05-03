import { describe, it, expect } from "vitest";
import {
  CRITERIOS_ACAO,
  CRITERIOS_FII,
  STATUS,
  avaliarCriterio,
  avaliarRecomendacao,
  classificarAderencia
} from "../../src/lib/criterios";

describe("avaliarCriterio", () => {
  it("retorna INDISPONIVEL para valor null/undefined/NaN", () => {
    expect(avaliarCriterio(null, CRITERIOS_ACAO.roe).status).toBe(STATUS.INDISPONIVEL);
    expect(avaliarCriterio(undefined, CRITERIOS_ACAO.roe).status).toBe(STATUS.INDISPONIVEL);
    expect(avaliarCriterio(NaN, CRITERIOS_ACAO.roe).status).toBe(STATUS.INDISPONIVEL);
  });

  it("aprova ROE acima de 15", () => {
    const r = avaliarCriterio(18.5, CRITERIOS_ACAO.roe);
    expect(r.status).toBe(STATUS.APROVADO);
    expect(r.valor).toBe(18.5);
  });

  it("reprova ROE abaixo de 15", () => {
    const r = avaliarCriterio(8, CRITERIOS_ACAO.roe);
    expect(r.status).toBe(STATUS.REPROVADO);
    expect(r.mensagem).toContain("mín 15");
  });

  it("aprova ROE exatamente no limite", () => {
    expect(avaliarCriterio(15, CRITERIOS_ACAO.roe).status).toBe(STATUS.APROVADO);
  });

  it("aprova Dívida/EBITDA abaixo de 3", () => {
    expect(avaliarCriterio(1.2, CRITERIOS_ACAO.divEbitda).status).toBe(STATUS.APROVADO);
    expect(avaliarCriterio(2.99, CRITERIOS_ACAO.divEbitda).status).toBe(STATUS.APROVADO);
  });

  it("reprova Dívida/EBITDA acima de 3", () => {
    const r = avaliarCriterio(4.5, CRITERIOS_ACAO.divEbitda);
    expect(r.status).toBe(STATUS.REPROVADO);
    expect(r.mensagem).toContain("máx 3");
  });

  it("respeita min E max simultaneamente", () => {
    // P/VP entre 0.7 e 1.15
    expect(avaliarCriterio(0.5, CRITERIOS_FII.pvp).status).toBe(STATUS.REPROVADO);
    expect(avaliarCriterio(0.9, CRITERIOS_FII.pvp).status).toBe(STATUS.APROVADO);
    expect(avaliarCriterio(1.5, CRITERIOS_FII.pvp).status).toBe(STATUS.REPROVADO);
  });
});

describe("avaliarRecomendacao", () => {
  it("retorna null para input nulo", () => {
    expect(avaliarRecomendacao(null)).toBeNull();
    expect(avaliarRecomendacao(undefined)).toBeNull();
  });

  it("identifica FII pelo sufixo 11", () => {
    const r = avaliarRecomendacao({ ticker: "HGLG11", dy: 8 });
    expect(r.tipo).toBe("FII");
  });

  it("identifica FII por tipo explícito", () => {
    const r = avaliarRecomendacao({ ticker: "ABCD3", tipo: "FII", dy: 8 });
    expect(r.tipo).toBe("FII");
  });

  it("identifica Ação pelo sufixo não-11", () => {
    const r = avaliarRecomendacao({ ticker: "PETR4", roe: 18 });
    expect(r.tipo).toBe("Ação");
  });

  it("usa critérios diferentes para Ação e FII", () => {
    const acao = avaliarRecomendacao({ ticker: "PETR4", dy: 6 });
    const fii = avaliarRecomendacao({ ticker: "HGLG11", dy: 6 });

    // DY 6% aprova em Ação (mín 4%) mas reprova em FII (mín 7%)
    const dyAcao = acao.criterios.find(c => c.chave === "dy");
    const dyFii = fii.criterios.find(c => c.chave === "dy");
    expect(dyAcao.status).toBe(STATUS.APROVADO);
    expect(dyFii.status).toBe(STATUS.REPROVADO);
  });

  it("conta corretamente aprovados/reprovados/indisponíveis", () => {
    const r = avaliarRecomendacao({
      ticker: "BBAS3",
      roe: 18,           // aprovado
      divEbitda: 4.5,    // reprovado
      pl: 5,             // aprovado
      pvp: 0.8,          // aprovado
      // dy, margemLiquida indisponíveis
    });
    expect(r.resumo.aprovados).toBe(3);
    expect(r.resumo.reprovados).toBe(1);
    expect(r.resumo.indisponiveis).toBe(2);
  });

  it("aceita indicadores aninhados", () => {
    const r = avaliarRecomendacao({
      ticker: "BBAS3",
      indicadores: { roe: 18, pl: 5 }
    });
    const roeCrit = r.criterios.find(c => c.chave === "roe");
    expect(roeCrit.status).toBe(STATUS.APROVADO);
  });

  it("calcula pontuação corretamente", () => {
    const r = avaliarRecomendacao({
      ticker: "X3",
      roe: 18, divEbitda: 1, pl: 5, pvp: 1, dy: 5, margemLiquida: 10
    });
    expect(r.resumo.pontuacao).toBe(100);

    const r2 = avaliarRecomendacao({
      ticker: "Y3",
      roe: 5, divEbitda: 5, pl: 30, pvp: 5, dy: 1, margemLiquida: 1
    });
    expect(r2.resumo.pontuacao).toBe(0);
  });

  it("retorna pontuação null quando todos critérios indisponíveis", () => {
    const r = avaliarRecomendacao({ ticker: "Z3" });
    expect(r.resumo.pontuacao).toBeNull();
  });
});

describe("classificarAderencia", () => {
  it("retorna 'Atende todos' quando 0 reprovados", () => {
    const avaliacao = avaliarRecomendacao({
      ticker: "X3",
      roe: 18, divEbitda: 1, pl: 5, pvp: 1, dy: 5, margemLiquida: 10
    });
    const c = classificarAderencia(avaliacao);
    expect(c.cor).toBe("success");
    expect(c.nivel).toContain("todos");
  });

  it("retorna 'Atenção' quando muitos reprovados", () => {
    const avaliacao = avaliarRecomendacao({
      ticker: "Y3",
      roe: 5, divEbitda: 5, pl: 30, pvp: 5, dy: 1, margemLiquida: 1
    });
    const c = classificarAderencia(avaliacao);
    expect(c.cor).toBe("danger");
  });

  it("retorna 'Dados parciais' quando muitos indisponíveis", () => {
    const avaliacao = avaliarRecomendacao({
      ticker: "Z3",
      roe: 18 // só um indicador, todos os outros indisponíveis
    });
    const c = classificarAderencia(avaliacao);
    expect(c.nivel).toContain("parciais");
  });

  it("trata avaliacao null", () => {
    const c = classificarAderencia(null);
    expect(c.cor).toBe("default");
  });
});

describe("avaliarRecomendacao - critério ROE setorial dinâmico", () => {
  it("Banco com ROE 13% (acima de 12%) → APROVADO", () => {
    const av = avaliarRecomendacao({
      ticker: "BBSE3",
      setorCVM: "Bancos",
      roe: 13, divEbitda: 1, margemLiquida: 10, dy: 6, pl: 10, pvp: 1.5
    });
    const roeCriterio = av.criterios.find(c => c.chave === "roe");
    expect(roeCriterio.status).toBe("aprovado");
    expect(av.setor).toBe("Bancos");
  });

  it("Energia Elétrica com ROE 11% (acima do mínimo 8%) → APROVADO", () => {
    const av = avaliarRecomendacao({
      ticker: "TAEE11_ACAO",
      setorCVM: "Emp. Adm. Part. - Energia Elétrica",
      roe: 11, divEbitda: 2, margemLiquida: 30, dy: 7, pl: 8, pvp: 2
    });
    const roeCriterio = av.criterios.find(c => c.chave === "roe");
    expect(roeCriterio.status).toBe("aprovado");
    expect(av.setor).toBe("Energia Elétrica");
  });

  it("Saneamento com ROE 8% (acima do mínimo 6%) → APROVADO", () => {
    const av = avaliarRecomendacao({
      ticker: "SAPR3",
      setorCVM: "Saneamento, Serv. Água e Gás",
      roe: 8, divEbitda: 2, margemLiquida: 15, dy: 5, pl: 10, pvp: 1
    });
    const roeCriterio = av.criterios.find(c => c.chave === "roe");
    expect(roeCriterio.status).toBe("aprovado");
    expect(av.setor).toBe("Saneamento");
  });

  it("Saneamento com ROE 4% (abaixo do mínimo 6%) → REPROVADO", () => {
    const av = avaliarRecomendacao({
      ticker: "SAPR3_RUIM",
      setorCVM: "Saneamento, Serv. Água e Gás",
      roe: 4, divEbitda: 2, margemLiquida: 15, dy: 5, pl: 10, pvp: 1
    });
    const roeCriterio = av.criterios.find(c => c.chave === "roe");
    expect(roeCriterio.status).toBe("reprovado");
  });

  it("Tecnologia com ROE 16% (abaixo do mínimo 18%) → REPROVADO", () => {
    const av = avaliarRecomendacao({
      ticker: "TECH3",
      setorCVM: "Programas e Serviços",
      roe: 16, divEbitda: 1, margemLiquida: 20, dy: 1, pl: 15, pvp: 3
    });
    const roeCriterio = av.criterios.find(c => c.chave === "roe");
    expect(roeCriterio.status).toBe("reprovado");
    expect(av.setor).toBe("Tecnologia");
  });

  it("BBAS3 com ROE real 7.24% (abaixo do mínimo 12% Bancos) → REPROVADO", () => {
    const av = avaliarRecomendacao({
      ticker: "BBAS3",
      setorCVM: "Bancos",
      roe: 7.24
    });
    const roeCriterio = av.criterios.find(c => c.chave === "roe");
    expect(roeCriterio.status).toBe("reprovado");
    expect(roeCriterio.label).toContain("Bancos");
    expect(roeCriterio.label).toContain("12%");
  });

  it("Sem setorCVM mantém threshold padrão de 15%", () => {
    const av = avaliarRecomendacao({
      ticker: "XPTO3",
      roe: 14 // entre 12 e 15: passaria com setor genérico mas falha sem setor (15)
    });
    const roeCriterio = av.criterios.find(c => c.chave === "roe");
    expect(roeCriterio.status).toBe("reprovado"); // 14 < 15 (default fixo)
    expect(av.setor).toBe(null);
  });

  it("FIIs ignoram lógica setorial (não tem ROE)", () => {
    const av = avaliarRecomendacao({
      ticker: "HGLG11",
      setorCVM: "Fundos Imobiliários",
      pvp: 0.94, dy: 7.3
    });
    expect(av.tipo).toBe("FII");
    // FII não tem critério ROE
    const roeCriterio = av.criterios.find(c => c.chave === "roe");
    expect(roeCriterio).toBeUndefined();
  });

  it("Label do critério ROE inclui o setor quando aplicável", () => {
    const av = avaliarRecomendacao({
      ticker: "TAEE3",
      setorCVM: "Energia Elétrica",
      roe: 10
    });
    const roeCriterio = av.criterios.find(c => c.chave === "roe");
    expect(roeCriterio.label).toContain("Energia Elétrica");
    expect(roeCriterio.label).toContain("8%");
  });
});
