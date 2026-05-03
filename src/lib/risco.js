// ─── Análise de Risco Quantitativa ───────────────────────────────────────────
// Funções puras para calcular métricas de risco da carteira.
// Não depende de IA - tudo determinístico baseado nas posições.

/**
 * HHI (Herfindahl-Hirschman Index) - mede concentração.
 * @param {Array<{peso: number}>} itens - lista de itens com campo peso (em %)
 * @returns {number} HHI entre 0 e 10000
 *
 * Interpretação:
 *  - 0-1500:    bem diversificado
 *  - 1500-2500: moderadamente concentrado
 *  - 2500+:     altamente concentrado
 *
 * Exemplo: 4 ativos com 25% cada → 4 × 25² = 2500 (limite da concentração moderada)
 *          1 ativo com 100% → 100² = 10000 (concentração máxima)
 */
export function calcularHHI(itens) {
  if (!itens || itens.length === 0) return 0;
  return Math.round(itens.reduce((sum, it) => sum + Math.pow(it.peso || 0, 2), 0));
}

/**
 * Classifica o HHI em níveis qualitativos.
 * @param {number} hhi
 * @returns {{nivel: string, cor: string, descricao: string}}
 */
export function classificarHHI(hhi) {
  if (hhi < 1500) return {
    nivel: "Diversificado",
    cor: "success",
    descricao: "Boa distribuição entre os ativos"
  };
  if (hhi < 2500) return {
    nivel: "Moderado",
    cor: "warning",
    descricao: "Concentração aceitável, mas atenção a aumentos"
  };
  if (hhi < 5000) return {
    nivel: "Concentrado",
    cor: "warning",
    descricao: "Carteira concentrada, considere diversificar"
  };
  return {
    nivel: "Muito concentrado",
    cor: "danger",
    descricao: "Risco elevado, recomenda-se diversificação urgente"
  };
}

/**
 * Calcula concentração no nível de ativos individuais.
 * @param {Array<{ticker: string, peso: number}>} pos
 * @returns {Object}
 */
export function calcularConcentracao(pos) {
  if (!pos || pos.length === 0) {
    return {
      hhi: 0,
      maiorPosicao: null,
      top3Pct: 0,
      top5Pct: 0,
      qtdAtivos: 0,
      acima10Pct: []
    };
  }

  const ordenados = [...pos].sort((a, b) => (b.peso || 0) - (a.peso || 0));
  const top3 = ordenados.slice(0, 3);
  const top5 = ordenados.slice(0, 5);

  return {
    hhi: calcularHHI(pos),
    maiorPosicao: ordenados[0] ? {
      ticker: ordenados[0].ticker,
      peso: +(ordenados[0].peso || 0).toFixed(1)
    } : null,
    top3Pct: +top3.reduce((s, p) => s + (p.peso || 0), 0).toFixed(1),
    top5Pct: +top5.reduce((s, p) => s + (p.peso || 0), 0).toFixed(1),
    qtdAtivos: pos.length,
    // Posições que individualmente passam de 10% (regra clássica)
    acima10Pct: ordenados
      .filter(p => (p.peso || 0) > 10)
      .map(p => ({ ticker: p.ticker, peso: +(p.peso || 0).toFixed(1) }))
  };
}

/**
 * Calcula concentração setorial.
 * @param {Array<{setor: string, peso: number}>} pos
 * @param {Function} normalizar - função opcional para normalizar nome do setor
 * @returns {Object}
 */
export function calcularConcentracaoSetorial(pos, normalizar = (s) => s) {
  if (!pos || pos.length === 0) {
    return {
      hhi: 0,
      qtdSetores: 0,
      maiorSetor: null,
      distribuicao: []
    };
  }

  // Agrupa pesos por setor (com normalização)
  const setoresMap = {};
  pos.forEach(p => {
    const setor = normalizar(p.setor || "Outros");
    setoresMap[setor] = (setoresMap[setor] || 0) + (p.peso || 0);
  });

  const distribuicao = Object.entries(setoresMap)
    .map(([setor, peso]) => ({ setor, peso: +peso.toFixed(1) }))
    .sort((a, b) => b.peso - a.peso);

  // HHI setorial usa os pesos agregados por setor
  const hhi = calcularHHI(distribuicao);

  return {
    hhi,
    qtdSetores: distribuicao.length,
    maiorSetor: distribuicao[0] || null,
    distribuicao
  };
}

/**
 * Calcula um score consolidado de saúde da carteira (0-100).
 * Combina concentração de ativos, setorial e diversidade.
 * @param {Array} pos
 * @param {Function} normalizarSetor
 * @returns {number}
 */
export function calcularScoreSaude(pos, normalizarSetor) {
  if (!pos || pos.length === 0) return 0;

  const conc = calcularConcentracao(pos);
  const setorial = calcularConcentracaoSetorial(pos, normalizarSetor);

  // Componente 1: Concentração de ativos (peso 35%)
  // HHI 0-1500 = 100 pontos, HHI 5000+ = 0 pontos (linear)
  const concScore = Math.max(0, Math.min(100, 100 - ((conc.hhi - 1500) / 35)));

  // Componente 2: Concentração setorial (peso 35%)
  const setorialScore = Math.max(0, Math.min(100, 100 - ((setorial.hhi - 1500) / 35)));

  // Componente 3: Quantidade de setores (peso 20%)
  // 1 setor = 0, 5+ setores = 100
  const setoresScore = Math.min(100, (setorial.qtdSetores / 5) * 100);

  // Componente 4: Penalidade por posições acima de 10% (peso 10%)
  const penalidade = Math.min(100, conc.acima10Pct.length * 25);
  const penalScore = 100 - penalidade;

  return Math.round(
    concScore * 0.35 +
    setorialScore * 0.35 +
    setoresScore * 0.20 +
    penalScore * 0.10
  );
}

/**
 * Gera alertas qualitativos baseados nas métricas.
 * @param {Array} pos
 * @param {Function} normalizarSetor
 * @returns {Array<{tipo: 'success'|'warning'|'danger', mensagem: string}>}
 */
export function gerarAlertasRisco(pos, normalizarSetor) {
  if (!pos || pos.length === 0) return [];

  const alertas = [];
  const conc = calcularConcentracao(pos);
  const setorial = calcularConcentracaoSetorial(pos, normalizarSetor);

  // Maior posição individual
  if (conc.maiorPosicao && conc.maiorPosicao.peso > 25) {
    alertas.push({
      tipo: "danger",
      mensagem: `${conc.maiorPosicao.ticker} representa ${conc.maiorPosicao.peso}% da carteira (recomendado: até 15%)`
    });
  } else if (conc.maiorPosicao && conc.maiorPosicao.peso > 15) {
    alertas.push({
      tipo: "warning",
      mensagem: `${conc.maiorPosicao.ticker} representa ${conc.maiorPosicao.peso}% da carteira`
    });
  }

  // Top 3 muito concentrado
  if (conc.top3Pct > 70) {
    alertas.push({
      tipo: "warning",
      mensagem: `Os 3 maiores ativos representam ${conc.top3Pct}% da carteira`
    });
  }

  // Setor dominante
  if (setorial.maiorSetor && setorial.maiorSetor.peso > 50) {
    alertas.push({
      tipo: "danger",
      mensagem: `${setorial.maiorSetor.peso}% concentrado em ${setorial.maiorSetor.setor}`
    });
  } else if (setorial.maiorSetor && setorial.maiorSetor.peso > 35) {
    alertas.push({
      tipo: "warning",
      mensagem: `${setorial.maiorSetor.peso}% em ${setorial.maiorSetor.setor} (atenção à exposição setorial)`
    });
  }

  // Pouca diversificação setorial
  if (setorial.qtdSetores < 3 && pos.length >= 5) {
    alertas.push({
      tipo: "warning",
      mensagem: `Apenas ${setorial.qtdSetores} ${setorial.qtdSetores === 1 ? "setor" : "setores"} representados`
    });
  }

  // Carteira muito pequena
  if (pos.length < 5) {
    alertas.push({
      tipo: "warning",
      mensagem: `Apenas ${pos.length} ${pos.length === 1 ? "ativo" : "ativos"} (recomendado: 8 ou mais)`
    });
  }

  // Tudo OK
  if (alertas.length === 0) {
    alertas.push({
      tipo: "success",
      mensagem: "Carteira bem diversificada, sem concentrações preocupantes"
    });
  }

  return alertas;
}

/**
 * Faz análise de risco completa - função-fachada.
 * @param {Array} pos
 * @param {Function} normalizarSetor - opcional
 * @returns {Object}
 */
export function analisarRisco(pos, normalizarSetor = (s) => s) {
  return {
    score: calcularScoreSaude(pos, normalizarSetor),
    concentracao: calcularConcentracao(pos),
    setorial: calcularConcentracaoSetorial(pos, normalizarSetor),
    alertas: gerarAlertasRisco(pos, normalizarSetor)
  };
}
