// ─── Critérios Fundamentalistas (estilo value investing) ─────────────────────
// Funções puras para validar se uma ação ou FII atende a critérios objetivos.
// Inspirado em princípios de Graham, Buffett, Lynch e popularizado no Brasil
// por análises fundamentalistas mainstream.
//
// IMPORTANTE: O critério de ROE para AÇÕES agora é DINÂMICO por setor.
// Setores capital-intensivos (saneamento, energia) têm ROE mínimo menor.
// Setores leves (tech, marca) têm ROE mínimo maior.

import { normalizarSetorCVM, roeMinimoSetor } from "./setorB3";

/**
 * Critérios padrão para AÇÕES.
 * Limites baseados em consenso de literatura fundamentalista brasileira.
 */
export const CRITERIOS_ACAO = {
  roe: { min: 15, label: "ROE ≥ 15%", descricao: "Retorno sobre Patrimônio Líquido (eficiência da gestão)" },
  divEbitda: { max: 3, label: "Dívida/EBITDA ≤ 3x", descricao: "Endividamento saudável (paga dívida em até 3 anos)" },
  margemLiquida: { min: 5, label: "Margem Líquida ≥ 5%", descricao: "Lucratividade real após todas as despesas" },
  dy: { min: 4, label: "DY ≥ 4%", descricao: "Dividend Yield acima da média da poupança" },
  pl: { min: 0, max: 25, label: "P/L entre 0 e 25", descricao: "Preço razoável em relação ao lucro" },
  pvp: { min: 0, max: 4, label: "P/VP ≤ 4x", descricao: "Não pagar muito além do valor patrimonial" }
};

/**
 * Critérios padrão para FIIs.
 * Limites diferentes pela natureza dos fundos imobiliários.
 */
export const CRITERIOS_FII = {
  dy: { min: 7, label: "DY ≥ 7%", descricao: "Yield mínimo esperado para FIIs (acima de Tesouro)" },
  pvp: { min: 0.7, max: 1.15, label: "P/VP entre 0.7 e 1.15", descricao: "Negociar próximo ao valor patrimonial" },
  vacancia: { max: 12, label: "Vacância ≤ 12%", descricao: "Imóveis ocupados (gerando renda)" },
  liquidez: { min: 100000, label: "Liquidez diária ≥ R$ 100k", descricao: "Possível comprar/vender sem dificuldade" }
};

/**
 * Status possíveis de um critério após avaliação.
 */
export const STATUS = {
  APROVADO: "aprovado",      // valor presente e dentro do limite
  REPROVADO: "reprovado",    // valor presente mas fora do limite
  INDISPONIVEL: "indisponivel" // valor não veio na resposta da IA
};

/**
 * Avalia um único critério contra um valor.
 * @param {number|null|undefined} valor - valor do indicador
 * @param {Object} criterio - { min?, max?, label, descricao }
 * @returns {{ status: string, valor, label, descricao, mensagem }}
 */
export function avaliarCriterio(valor, criterio) {
  if (valor == null || isNaN(valor)) {
    return {
      status: STATUS.INDISPONIVEL,
      valor: null,
      label: criterio.label,
      descricao: criterio.descricao,
      mensagem: `Dado indisponível`
    };
  }

  let aprovado = true;
  if (criterio.min != null && valor < criterio.min) aprovado = false;
  if (criterio.max != null && valor > criterio.max) aprovado = false;

  return {
    status: aprovado ? STATUS.APROVADO : STATUS.REPROVADO,
    valor,
    label: criterio.label,
    descricao: criterio.descricao,
    mensagem: formatarMensagem(valor, criterio, aprovado)
  };
}

/**
 * Formata mensagem amigável do critério.
 */
function formatarMensagem(valor, criterio, aprovado) {
  // Heurística: detecta se label tem "%" para formatar
  const ehPct = /%/.test(criterio.label || "");
  const valorFmt = ehPct ? `${Number(valor).toFixed(1)}%` : Number(valor).toFixed(2);

  if (aprovado) return valorFmt;

  // Se reprovado, indica o que faltou/excedeu
  if (criterio.min != null && valor < criterio.min) {
    const minFmt = ehPct ? `${criterio.min}%` : criterio.min;
    return `${valorFmt} (mín ${minFmt})`;
  }
  if (criterio.max != null && valor > criterio.max) {
    const maxFmt = ehPct ? `${criterio.max}%` : criterio.max;
    return `${valorFmt} (máx ${maxFmt})`;
  }
  return valorFmt;
}

/**
 * Avalia uma recomendação completa contra os critérios apropriados.
 * Decide automaticamente se é ação ou FII pelo tipo/ticker.
 * Para AÇÕES: ajusta dinamicamente o ROE mínimo baseado no setor da empresa.
 *
 * @param {Object} recomendacao - dados da IA com indicadores
 * @returns {{ tipo, setor, criterios, resumo }}
 */
export function avaliarRecomendacao(rec) {
  if (!rec) return null;

  // Detecta tipo: explícito ou pelo sufixo do ticker (11 = FII)
  const ehFII = rec.tipo === "FII" || /11$/.test(rec.ticker || "");

  // Para ações, ajusta o critério de ROE conforme o setor
  // setorCVM vem da bolsai (/companies/{ticker}), pode ser null se desconhecido
  let tabela = ehFII ? CRITERIOS_FII : { ...CRITERIOS_ACAO };
  let setorGenerico = null;

  if (!ehFII && rec.setorCVM) {
    setorGenerico = normalizarSetorCVM(rec.setorCVM);
    const roeMin = roeMinimoSetor(setorGenerico);

    // Substitui o critério de ROE com o threshold dinâmico
    tabela = {
      ...tabela,
      roe: {
        min: roeMin,
        label: `ROE ≥ ${roeMin}% (${setorGenerico})`,
        descricao: `Retorno sobre Patrimônio Líquido — mínimo ajustado para o setor "${setorGenerico}"`
      }
    };
  }

  // Mapeia campos da recomendação para chaves dos critérios
  // Prioridade: campo explícito > indicadores aninhados
  const indicadores = rec.indicadores || {};
  const valores = {
    roe: rec.roe ?? indicadores.roe,
    divEbitda: rec.divEbitda ?? indicadores.divEbitda,
    margemLiquida: rec.margemLiquida ?? indicadores.margemLiquida,
    dy: rec.dy ?? indicadores.dy,
    pl: rec.pl ?? indicadores.pl,
    pvp: rec.pvp ?? indicadores.pvp,
    vacancia: rec.vacancia ?? indicadores.vacancia,
    liquidez: rec.liquidez ?? indicadores.liquidez
  };

  // Avalia cada critério da tabela
  const criterios = Object.keys(tabela).map(chave => ({
    chave,
    ...avaliarCriterio(valores[chave], tabela[chave])
  }));

  // Resumo agregado
  const aprovados = criterios.filter(c => c.status === STATUS.APROVADO).length;
  const reprovados = criterios.filter(c => c.status === STATUS.REPROVADO).length;
  const indisponiveis = criterios.filter(c => c.status === STATUS.INDISPONIVEL).length;
  const total = criterios.length;
  const validados = total - indisponiveis;

  // Pontuação: 100% se todos aprovados, 0% se todos reprovados, NaN se nenhum validado
  const pontuacao = validados === 0 ? null : Math.round((aprovados / validados) * 100);

  return {
    tipo: ehFII ? "FII" : "Ação",
    setor: setorGenerico, // útil para UI mostrar contexto
    setorCVM: rec.setorCVM ?? null, // bruto, caso UI queira
    criterios,
    resumo: { aprovados, reprovados, indisponiveis, total, pontuacao }
  };
}

/**
 * Classifica a aderência geral da recomendação.
 * @param {Object} avaliacao - retorno de avaliarRecomendacao
 * @returns {{ nivel: string, cor: string, descricao: string }}
 */
export function classificarAderencia(avaliacao) {
  if (!avaliacao || !avaliacao.resumo) {
    return { nivel: "Indisponível", cor: "default", descricao: "Sem dados para avaliar" };
  }

  const { reprovados, indisponiveis, pontuacao } = avaliacao.resumo;

  // Se mais da metade dos critérios não tem dado, marca como indisponível
  if (indisponiveis > avaliacao.criterios.length / 2) {
    return {
      nivel: "Dados parciais",
      cor: "default",
      descricao: `${indisponiveis} critérios sem dado disponível`
    };
  }

  if (reprovados === 0) {
    return {
      nivel: "Atende todos os critérios",
      cor: "success",
      descricao: "Aprovada nos critérios fundamentalistas"
    };
  }

  if (pontuacao >= 70) {
    return {
      nivel: "Atende a maioria",
      cor: "warning",
      descricao: `${reprovados} critério${reprovados > 1 ? "s" : ""} fora do ideal`
    };
  }

  return {
    nivel: "Atenção",
    cor: "danger",
    descricao: `${reprovados} critérios não atendidos`
  };
}
