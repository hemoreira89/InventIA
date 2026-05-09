// ─── Funções de cálculo financeiro e formatação ──────────────────────────────
// Todas as funções aqui são pure functions (sem side effects).
// Isso permite testá-las isoladamente com Vitest.

export const CDI_ANO = 13.75;
export const IBOV_HIST = 12.5;

export const PALETTE = [
  "#7b61ff", "#00e5a0", "#ffd60a", "#ff4d6d", "#00b4d8",
  "#f77f00", "#9ef01a", "#e040fb", "#40c4ff", "#ff6b6b",
  "#a8dadc", "#e63946"
];

// ─── Formatação ──────────────────────────────────────────────────────────────

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function fmt(n, d = 2) {
  return n != null && !isNaN(n) ? Number(n).toFixed(d) : "–";
}

export function fmtBRL(n) {
  return n != null && !isNaN(n)
    ? Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "–";
}

export function fmtK(n) {
  if (n == null || isNaN(n)) return "–";
  if (n >= 1e6) return `R$${(n/1e6).toFixed(1)}M`;
  if (n >= 1000) return `R$${(n/1000).toFixed(0)}k`;
  return fmtBRL(n);
}

// ─── JSON helpers ────────────────────────────────────────────────────────────

/**
 * Extrai JSON de qualquer texto, mesmo que venha com explicações ao redor
 * ou em blocos markdown ```json ... ```
 */
export function extrairJSON(text) {
  if (!text || !text.trim()) throw new Error("Resposta vazia da IA");

  // Limpa caracteres invisíveis e normaliza aspas "smart"
  const limpo = text
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "") // zero-width
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")  // smart single quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"'); // smart double quotes

  // Tenta direto primeiro
  try { return JSON.parse(limpo.trim()); } catch(_) {}

  // Remove blocos markdown
  const semMd = limpo.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(semMd); } catch(_) {}

  // Extrai o maior bloco JSON entre chaves (greedy)
  const match = limpo.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch(_) {}
    // Tenta consertar trailing commas
    try { return JSON.parse(match[0].replace(/,\s*([}\]])/g, "$1")); } catch(_) {}
  }

  // Tenta array
  const arrMatch = limpo.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch(_) {}
    try { return JSON.parse(arrMatch[0].replace(/,\s*([}\]])/g, "$1")); } catch(_) {}
  }

  throw new Error("Não foi possível extrair JSON da resposta: " + limpo.slice(0, 200));
}

// ─── Cálculos financeiros ────────────────────────────────────────────────────

/**
 * Calcula valor futuro com juros compostos + aportes mensais
 * @param {number} pv - Valor presente (capital inicial)
 * @param {number} pmt - Aporte mensal
 * @param {number} taxa - Taxa anual em % (ex: 13.75 para 13.75% a.a.)
 * @param {number} n - Número de meses
 */
export function juroCompostos(pv, pmt, taxa, n) {
  const r = taxa / 100 / 12;
  if (r === 0) return pv + pmt * n;
  return pv * Math.pow(1 + r, n) + pmt * (Math.pow(1 + r, n) - 1) / r;
}

/**
 * Gera projeção de patrimônio ao longo dos anos
 */
export function gerarProjecao(pv, pmt, taxa, anos) {
  const pts = [];
  for (let m = 0; m <= anos * 12; m += 3) {
    pts.push({
      ano: `${(m/12).toFixed(1)}a`,
      valor: juroCompostos(pv, pmt, taxa, m),
      meses: m
    });
  }
  return pts;
}

/**
 * Calcula o IR sobre vendas de ações
 * Regra: isento se total vendido no mês < R$20.000 e for ações
 * Alíquota 15% para swing trade, 20% para day trade
 * @param {Array} vendas - [{ticker, qtd, preco, pm, taxas, tipo}]
 * @param {string} tipoMercado - "acoes" | "fii"
 */
export function calcularIR(vendas, tipoMercado = "acoes") {
  if (!vendas?.length) return { isento: true, ir: 0, totalVendido: 0, lucro: 0 };

  const totalVendido = vendas.reduce((s, v) => s + (Number(v.qtd) * Number(v.preco)), 0);
  const lucro = vendas.reduce((s, v) => {
    const valorVenda = Number(v.qtd) * Number(v.preco);
    const valorCompra = Number(v.qtd) * Number(v.pm || 0);
    const taxas = Number(v.taxas || 0);
    return s + (valorVenda - valorCompra - taxas);
  }, 0);

  // Ações: isento se vendeu menos que R$20k no mês
  if (tipoMercado === "acoes" && totalVendido < 20000) {
    return { isento: true, ir: 0, totalVendido, lucro };
  }

  // FII: sempre tributa 20% sobre lucro
  if (tipoMercado === "fii") {
    return { isento: false, ir: lucro > 0 ? lucro * 0.20 : 0, totalVendido, lucro, aliquota: 20 };
  }

  // Ações: 15% sobre lucro
  return { isento: false, ir: lucro > 0 ? lucro * 0.15 : 0, totalVendido, lucro, aliquota: 15 };
}

/**
 * Calcula peso percentual de cada ativo na carteira
 * @param {Array} carteira - [{ticker, qtd, pm, precoAtual?}]
 * @returns {Array} - [{ticker, peso, valor}]
 */
export function calcularPesos(carteira, precos = {}) {
  if (!carteira?.length) return [];

  const valores = carteira.map(a => {
    const preco = precos[a.ticker] || a.precoAtual || a.pm || 0;
    return {
      ticker: a.ticker,
      qtd: Number(a.qtd),
      preco,
      valor: Number(a.qtd) * preco
    };
  });

  const total = valores.reduce((s, v) => s + v.valor, 0);

  return valores.map(v => ({
    ...v,
    peso: total > 0 ? (v.valor / total) * 100 : 0
  }));
}

/**
 * Calcula preço médio após nova compra
 */
export function novoPrecoMedio(qtdAtual, pmAtual, qtdNova, precoNovo) {
  const totalAtual = qtdAtual * pmAtual;
  const totalNovo = qtdNova * precoNovo;
  const qtdTotal = qtdAtual + qtdNova;
  if (qtdTotal === 0) return 0;
  return (totalAtual + totalNovo) / qtdTotal;
}

/**
 * Calcula a quantidade de ativos que podem ser comprados com um valor
 */
export function quantidadeComprável(valor, preco) {
  if (!preco || preco <= 0) return 0;
  return Math.floor(valor / preco);
}

/**
 * Calcula DY ponderado da carteira
 */
export function dyMedioCarteira(posicoes) {
  if (!posicoes?.length) return 0;
  return posicoes.reduce((s, p) => s + ((p.dy || 0) * (p.peso || 0) / 100), 0);
}

/**
 * Detecta ativos que precisam rebalanceamento
 * @param {Array} posicoes - [{ticker, peso, alvo?}]
 * @param {number} desvio - Desvio máximo aceitável (em %)
 */
export function alertasRebalanceamento(posicoes, pesoAlvo = {}, desvio = 5) {
  if (!posicoes?.length) return [];
  return posicoes.filter(p => {
    const alvo = pesoAlvo[p.ticker];
    if (!alvo) return false;
    return Math.abs(p.peso - alvo) > desvio;
  });
}

// ─── Validações ──────────────────────────────────────────────────────────────

export function tickerValido(ticker) {
  if (!ticker) return false;
  const t = ticker.toUpperCase().trim();
  // Padrão B3: 4 letras + 1-2 dígitos (ex: PETR4, ITUB4, BBAS3, MXRF11)
  return /^[A-Z]{4}[0-9]{1,2}$/.test(t);
}

export function tipoTicker(ticker) {
  if (!ticker) return "desconhecido";
  const t = ticker.toUpperCase().trim();
  // FIIs terminam em 11
  if (/^[A-Z]{4}11$/.test(t)) return "FII";
  // BDRs terminam em 34, 35, 32, 33
  if (/^[A-Z]{4}3[2-5]$/.test(t)) return "BDR";
  // Ações ON terminam em 3
  if (/^[A-Z]{4}3$/.test(t)) return "acao_on";
  // Ações PN terminam em 4
  if (/^[A-Z]{4}4$/.test(t)) return "acao_pn";
  // Units terminam em 11 (ex: SANB11, mas é exceção)
  return "outro";
}

// ─── Análise de carteira ─────────────────────────────────────────────────────

/**
 * Calcula concentração da carteira por setor
 */
export function concentracaoSetor(posicoes) {
  if (!posicoes?.length) return [];
  const setores = {};
  posicoes.forEach(p => {
    const setor = p.setor || "Outros";
    if (!setores[setor]) setores[setor] = 0;
    setores[setor] += p.peso || 0;
  });
  return Object.entries(setores)
    .map(([setor, peso]) => ({ setor, peso }))
    .sort((a, b) => b.peso - a.peso);
}

/**
 * Detecta concentração excessiva (1 ativo > 30% ou 1 setor > 50%)
 */
export function temConcentracaoRisco(posicoes) {
  if (!posicoes?.length) return false;
  const ativoAlto = posicoes.some(p => (p.peso || 0) > 30);
  const setores = concentracaoSetor(posicoes);
  const setorAlto = setores.some(s => s.peso > 50);
  return ativoAlto || setorAlto;
}

// ─── Projeção de Renda Passiva ────────────────────────────────────────────────

/**
 * Projeta a evolução do patrimônio e renda passiva ao longo dos anos.
 * @param {Object} params
 * @param {number} params.patrimonioInicial - Patrimônio atual em R$
 * @param {number} params.aporteMensal      - Aporte mensal em R$
 * @param {number} params.dyAnual           - DY médio esperado (% a.a., ex: 8 para 8%)
 * @param {number} params.taxaCrescimento   - Crescimento do patrimônio (% a.a., ex: 10)
 * @param {number} params.anos              - Horizonte em anos
 * @returns {Array<{ano, patrimonio, rendaMensal, rendaAnual}>}
 */
export function projetarRendaPassiva({ patrimonioInicial, aporteMensal, dyAnual, taxaCrescimento, anos }) {
  const pv = Number(patrimonioInicial) || 0;
  const pmt = Number(aporteMensal) || 0;
  const dy = (Number(dyAnual) || 8) / 100;
  const n = Math.max(1, Math.round(Number(anos) || 20));

  const pontos = [];
  for (let a = 0; a <= n; a++) {
    const patrimonioAnual = juroCompostos(pv, pmt * 12, Number(taxaCrescimento), a * 12);
    const rendaMensal = (patrimonioAnual * dy) / 12;
    pontos.push({
      ano: `${a}a`,
      patrimonio: Math.round(patrimonioAnual),
      rendaMensal: Math.round(rendaMensal),
      rendaAnual: Math.round(rendaMensal * 12),
    });
  }
  return pontos;
}

/**
 * Calcula o ano em que a renda mensal atinge a meta de independência financeira.
 * @param {Array} projecao - resultado de projetarRendaPassiva
 * @param {number} metaMensal - renda alvo em R$/mês (default: R$10.000)
 * @returns {Object|null} - ponto da projeção onde a meta foi atingida, ou null
 */
export function acharIndependenciaFinanceira(projecao, metaMensal = 10000) {
  if (!projecao?.length) return null;
  return projecao.find(p => p.rendaMensal >= metaMensal) || null;
}

// ─── Rebalanceamento ─────────────────────────────────────────────────────────

/**
 * Calcula ações de rebalanceamento para cada ativo.
 * @param {Array}  posicoes   - [{ticker, pesoAtual, pesoAlvo, valorAtual, preco}]
 * @param {number} aporte     - Valor disponível para aportar (R$)
 * @returns {Array<{ticker, pesoAtual, pesoAlvo, delta, valorAlvo, acao, qtdSugerida}>}
 */
export function calcularRebalanceamento(posicoes, aporte = 0) {
  if (!posicoes?.length) return [];

  const totalAtual = posicoes.reduce((s, p) => s + (p.valorAtual || 0), 0);
  const totalComAporte = totalAtual + aporte;

  return posicoes.map(p => {
    const pesoAtual = +(p.pesoAtual || 0).toFixed(2);
    const pesoAlvo = +(p.pesoAlvo || 0).toFixed(2);
    const delta = +(pesoAtual - pesoAlvo).toFixed(2);
    const valorAlvo = pesoAlvo > 0 ? totalComAporte * pesoAlvo / 100 : null;
    const diferenca = valorAlvo != null ? valorAlvo - (p.valorAtual || 0) : null;
    const qtdSugerida = (diferenca != null && diferenca > 0 && p.preco > 0)
      ? Math.ceil(diferenca / p.preco)
      : null;

    return {
      ticker: p.ticker,
      pesoAtual,
      pesoAlvo,
      delta,
      valorAtual: p.valorAtual || 0,
      valorAlvo,
      diferenca,
      acao: diferenca == null ? null : diferenca > 0 ? "comprar" : "manter",
      qtdSugerida,
    };
  });
}

// ─── Calendário de Proventos ─────────────────────────────────────────────────

// Sazonalidade mensal para ações BR (pesos somam 12, um por mês Jan-Dez).
// Baseado no padrão real da B3: dividendos concentram em mar/mai/ago/nov.
export const SAZONALIDADE_ACOES = [0.3, 0.5, 1.8, 0.8, 1.6, 0.7, 0.4, 1.5, 0.6, 0.7, 1.7, 1.4];

/**
 * Projeta o calendário de proventos para os próximos 12 meses (a partir de hoje).
 *
 * Para cada mês retorna:
 *   - projetado: estimativa baseada em DY + sazonalidade (sempre calculado)
 *   - real:      soma dos proventos reais já registrados naquele mês (se houver)
 *   - ativos:    breakdown por ticker com o valor projetado
 *
 * @param {Array}  carteira            - [{ticker, qtd, pm}]
 * @param {Object} precos              - { [ticker]: number } preços atuais
 * @param {Object} dys                 - { [ticker]: number } DY anual em % (ex: 8.5)
 * @param {Array}  proventosHistorico  - [{ticker, valor, data_pagamento}] do banco
 * @param {Date}   hoje                - data de referência (default: new Date())
 * @returns {Array<{
 *   mesLabel, mesAno, ano, mes (0-indexed), isFuturo, isAtual,
 *   projetado, real, ativos: [{ticker, valor, tipo}]
 * }>}
 */
export function projetarCalendario(carteira, precos, dys, proventosHistorico, hoje = new Date()) {
  const NOMES_MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const anoHoje = hoje.getFullYear();
  const mesHoje = hoje.getMonth(); // 0-indexed

  // Pré-computa valor atual de cada ativo
  const posicoes = (carteira || []).map(a => {
    const preco = precos?.[a.ticker] || a.pm || 0;
    const valor = preco * (a.qtd || 0);
    const dy = dys?.[a.ticker] ?? (isFII(a.ticker) ? 8 : 5);
    return { ticker: a.ticker, valor, dy, tipo: isFII(a.ticker) ? "FII" : "Ação" };
  }).filter(p => p.valor > 0);

  // Agrupa proventos históricos por ano+mês para lookup rápido
  const histMap = {};
  (proventosHistorico || []).forEach(p => {
    const d = new Date(p.data_pagamento + "T12:00:00");
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!histMap[key]) histMap[key] = 0;
    histMap[key] += Number(p.valor) || 0;
  });

  const resultado = [];
  for (let i = 0; i < 12; i++) {
    const totalMeses = mesHoje + i;
    const ano = anoHoje + Math.floor(totalMeses / 12);
    const mes = totalMeses % 12;                  // 0-indexed

    const isFuturo = ano > anoHoje || (ano === anoHoje && mes > mesHoje);
    const isAtual  = ano === anoHoje && mes === mesHoje;
    const histKey  = `${ano}-${mes}`;
    const real     = histMap[histKey] ?? null;

    // Projeção por ativo neste mês
    const ativos = posicoes.map(p => {
      const dividendoAnual = p.valor * p.dy / 100;
      const fator = p.tipo === "FII" ? 1.0 : SAZONALIDADE_ACOES[mes];
      const valor = Math.round(dividendoAnual / 12 * fator);
      return { ticker: p.ticker, valor, tipo: p.tipo };
    }).filter(a => a.valor > 0);

    const projetado = ativos.reduce((s, a) => s + a.valor, 0);

    resultado.push({
      mesLabel: NOMES_MESES[mes],
      mesAno: `${NOMES_MESES[mes]}/${String(ano).slice(2)}`,
      ano,
      mes,
      isFuturo,
      isAtual,
      projetado,
      real,
      ativos: ativos.sort((a, b) => b.valor - a.valor),
    });
  }

  return resultado;
}

function isFII(ticker) {
  return /^[A-Z]{4}11$/.test((ticker || "").toUpperCase().trim());
}

/**
 * Retorna estatísticas resumidas da projeção do calendário.
 */
export function resumoCalendario(calendario) {
  if (!calendario?.length) return { totalAnual: 0, mediaMensal: 0, melhorMes: null, piorMes: null };

  const totais = calendario.map(m => m.projetado);
  const totalAnual = totais.reduce((s, v) => s + v, 0);
  const mediaMensal = Math.round(totalAnual / 12);
  const maxVal = Math.max(...totais);
  const minVal = Math.min(...totais.filter(v => v > 0));
  const melhorMes = calendario.find(m => m.projetado === maxVal) || null;
  const piorMes = calendario.find(m => m.projetado === minVal) || null;

  return { totalAnual, mediaMensal, melhorMes, piorMes };
}
