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
