// ─── Insights educacionais para os cards de ativos ───────────────────────────
// Funções puras (testadas) que enriquecem a visualização de um ativo SEM emitir
// recomendação: quebram o score em pilares, calculam valuation educacional
// (Graham/Bazin) e comparam indicadores com a média do setor.
//
// Tudo é dado factual / fórmula pública — alinhado ao posicionamento da
// plataforma como auxílio de ESTUDO, não aconselhamento de investimento.

import { precoTetoBazin, precoJustoGraham, margemSeguranca } from "./calc.js";

// ─── Tooltips: o que cada indicador significa (camada educacional) ────────────
export const EXPLICACOES_INDICADORES = {
  dy: "Dividend Yield: quanto a empresa pagou em proventos nos últimos 12 meses em relação ao preço da cota.",
  pl: "P/L (Preço/Lucro): quantos anos de lucro atual seriam necessários para 'pagar' o preço da ação. Menor costuma indicar ação mais barata.",
  pvp: "P/VP (Preço/Valor Patrimonial): relação entre o preço e o patrimônio por ação. Abaixo de 1 significa negociar abaixo do valor contábil.",
  roe: "ROE (Retorno sobre Patrimônio): lucro gerado para cada real investido pelos sócios. Mede a eficiência da empresa.",
  margemLiquida: "Margem Líquida: percentual da receita que sobra como lucro depois de todas as despesas e impostos.",
  divEbitda: "Dívida Líquida/EBITDA: quantos anos de geração de caixa seriam necessários para quitar a dívida. Menor é mais saudável.",
  roic: "ROIC (Retorno sobre Capital Investido): eficiência da empresa em gerar retorno sobre todo o capital (próprio + dívida). Complementa o ROE.",
  evEbitda: "EV/EBITDA: valor da empresa (incluindo dívida) sobre sua geração de caixa operacional. Múltiplo de valuation; menor costuma indicar mais barato.",
  cagrLucro5y: "Crescimento do lucro (CAGR 5 anos): taxa média anual de crescimento do lucro nos últimos 5 anos.",
  cagrReceita5y: "Crescimento da receita (CAGR 5 anos): taxa média anual de crescimento da receita nos últimos 5 anos.",
  marketCap: "Valor de mercado (market cap): preço da ação × número de ações. Indica o porte da empresa.",
  nav: "NAV / Patrimônio: valor patrimonial líquido do fundo imobiliário.",
  cotistas: "Cotistas: número de investidores no fundo. Mais cotistas costuma indicar maior liquidez e pulverização.",
  score: "Score: nota interna de 0 a 100 que resume a aderência do ativo aos critérios fundamentalistas objetivos. Não é recomendação.",
  canal52: "Canal de 52 semanas: posição do preço atual entre a mínima (0%) e a máxima (100%) do último ano.",
  vacancia: "Vacância: percentual de área/contratos vagos de um FII. Menor significa mais imóveis gerando renda.",
  precoJustoGraham: "Preço justo de Graham: √(22,5 × LPA × VPA). Referência educacional de valor intrínseco — não é preço-alvo nem meta.",
  precoTetoBazin: "Preço-teto de Bazin: dividendo anual ÷ yield mínimo (6%). Referência educacional de quanto pagar para ter o yield desejado — não é meta.",
};

// Faixas plausíveis por indicador. Valores fora disso são quase sempre erro
// de fonte (ex.: bolsai já devolveu DY = -2071% para FIIs). Tratamos como
// indisponível para não poluir os cards com dado claramente inválido.
export const FAIXAS_INDICADORES = {
  dy: [0, 40],            // % ao ano — acima de 40% é praticamente sempre erro
  pl: [-1000, 1000],      // P/L pode ser negativo (prejuízo); só corta absurdos
  pvp: [0.01, 50],        // P/VP é estritamente positivo; 0 = dado ausente/erro
  roe: [-200, 200],       // %
  margemLiquida: [-300, 100], // % — acima de 100% é lucro não-operacional (ex.: equivalência em holdings), não margem real
  divEbitda: [-50, 50],
  evEbitda: [0, 80],      // bancos/holdings estouram (EBITDA ~0) → acima de 80 é erro
};

/**
 * Devolve uma cópia do ativo com os indicadores numéricos saneados: o que
 * estiver fora da faixa plausível (ou não-numérico) vira null. Não inventa
 * nada — só remove lixo de fonte para não distorcer pilares/critérios/setor.
 */
export function sanitizarIndicadores(rec) {
  if (!rec) return rec;
  const limpo = { ...rec };
  for (const [chave, [min, max]] of Object.entries(FAIXAS_INDICADORES)) {
    const v = num(limpo[chave]);
    limpo[chave] = (v != null && v >= min && v <= max) ? v : null;
  }
  return limpo;
}

/**
 * Detecta se o ativo é do setor financeiro/banco/holding/seguros, onde métricas
 * baseadas em EBITDA (EV/EBITDA, Dívida/EBITDA) e ROIC não têm significado
 * convencional (bancos não têm EBITDA; holdings vivem de participações).
 */
export function ehSetorFinanceiro(rec) {
  if (!rec) return false;
  const s = `${rec.setorCVM || ""} ${rec.setor || ""}`.toLowerCase();
  return /banco|financ|segur|holding|interm|previd|capitaliz/.test(s);
}

/**
 * Zera métricas que não se aplicam ao setor financeiro/bancos (EV/EBITDA,
 * Dívida/EBITDA, ROIC). Evita falsos negativos (ex.: "Dív/EBITDA 5.98" reprovado
 * num banco) e badges sem sentido. Não altera nada para os demais setores.
 */
export function suprimirMetricasNaoAplicaveis(rec) {
  if (!rec || !ehSetorFinanceiro(rec)) return rec;
  return { ...rec, evEbitda: null, divEbitda: null, roic: null };
}

// Clampa um valor em [0, 100].
function clamp100(n) {
  return Math.max(0, Math.min(100, n));
}

// Converte uma nota 0-100 em 0..5 "estrelas"/segmentos preenchidos.
export function notaParaEstrelas(nota) {
  if (nota == null || isNaN(nota)) return 0;
  return Math.max(0, Math.min(5, Math.round(nota / 20)));
}

// Cor qualitativa de uma nota 0-100 (chaves do tema, resolvidas na UI).
export function corDaNota(nota) {
  if (nota == null || isNaN(nota)) return "default";
  if (nota >= 70) return "success";
  if (nota >= 40) return "warning";
  return "danger";
}

/**
 * Quebra a qualidade de um ativo em 3 pilares didáticos (0-100 cada):
 *   - Rentabilidade: o quanto o ativo gera de retorno (ROE/margem; DY p/ FII)
 *   - Proventos:     consistência e geração de renda (DY, lucros consistentes)
 *   - Solidez:       saúde financeira (endividamento, P/VP, vacância)
 *
 * Cada pilar retorna { disponivel, nota, estrelas, base } onde `base` lista os
 * indicadores que entraram no cálculo (para exibir o "porquê"). Pilar sem
 * nenhum dado vem com disponivel:false.
 *
 * @param {Object} rec - ativo com indicadores (dy, pl, pvp, roe, margemLiquida, divEbitda, vacancia, lucrosConsistentes)
 * @returns {{ tipo, rentabilidade, proventos, solidez }}
 */
export function calcularPilares(rec) {
  if (!rec) return null;
  const ehFII = rec.tipo === "FII" || /11$/.test(rec.ticker || "");

  // Helper: monta um pilar a partir de uma lista de {nota, label} já validados.
  const montar = (componentes) => {
    const validos = componentes.filter(c => c && c.nota != null && !isNaN(c.nota));
    if (validos.length === 0) return { disponivel: false, nota: null, estrelas: 0, base: [] };
    const nota = Math.round(validos.reduce((s, c) => s + c.nota, 0) / validos.length);
    return { disponivel: true, nota, estrelas: notaParaEstrelas(nota), base: validos.map(c => c.label) };
  };

  if (ehFII) {
    // FIIs: a renda (DY) é o centro; solidez via P/VP e vacância.
    const dy = num(rec.dy);
    const pvp = num(rec.pvp);
    const vac = num(rec.vacancia);

    const rentabilidade = montar([
      dy != null ? { nota: clamp100((dy / 12) * 100), label: `DY ${dy.toFixed(1)}%` } : null,
    ]);
    const proventos = montar([
      // Para FII, regularidade ≈ DY sustentável; usa DY como proxy de renda.
      dy != null ? { nota: clamp100((dy / 10) * 100), label: `DY ${dy.toFixed(1)}%` } : null,
    ]);
    const solidez = montar([
      // P/VP perto de 1 é o ideal; muito acima (caro) ou muito abaixo (risco) pontuam menos.
      pvp != null ? { nota: clamp100(100 - Math.abs(pvp - 1) * 120), label: `P/VP ${pvp.toFixed(2)}` } : null,
      vac != null ? { nota: clamp100(100 - (vac / 20) * 100), label: `Vacância ${vac.toFixed(1)}%` } : null,
    ]);
    // FIIs não têm CAGR de lucro/receita — pilar de crescimento não se aplica.
    const crescimento = { disponivel: false, nota: null, estrelas: 0, base: [] };
    return { tipo: "FII", rentabilidade, proventos, solidez, crescimento };
  }

  // Ações
  const roe = num(rec.roe);
  const margem = num(rec.margemLiquida);
  const dy = num(rec.dy);
  const div = num(rec.divEbitda);
  const pvp = num(rec.pvp);
  const lucros = rec.lucrosConsistentes;

  const rentabilidade = montar([
    roe != null ? { nota: clamp100((roe / 20) * 100), label: `ROE ${roe.toFixed(1)}%` } : null,
    margem != null ? { nota: clamp100((margem / 20) * 100), label: `Margem ${margem.toFixed(1)}%` } : null,
  ]);
  const proventos = montar([
    dy != null ? { nota: clamp100((dy / 8) * 100), label: `DY ${dy.toFixed(1)}%` } : null,
    lucros === true ? { nota: 100, label: "Lucros consistentes" } : (lucros === false ? { nota: 30, label: "Lucros irregulares" } : null),
  ]);
  const solidez = montar([
    // Dívida líquida negativa (caixa líquido) é ótimo → 100.
    div != null ? { nota: div <= 0 ? 100 : clamp100(100 - (div / 6) * 100), label: `Dív/EBITDA ${div.toFixed(1)}` } : null,
    pvp != null ? { nota: clamp100(100 - Math.max(0, pvp - 1.5) * 33), label: `P/VP ${pvp.toFixed(2)}` } : null,
  ]);
  // Crescimento: CAGR de lucro e receita (5 anos). Mapeia -20%→0, 0%→50, +20%→100.
  const cagrL = num(rec.cagrLucro5y);
  const cagrR = num(rec.cagrReceita5y);
  const crescimento = montar([
    cagrL != null ? { nota: clamp100(50 + cagrL * 2.5), label: `Lucro ${cagrL >= 0 ? "+" : ""}${cagrL.toFixed(0)}%/a` } : null,
    cagrR != null ? { nota: clamp100(50 + cagrR * 2.5), label: `Receita ${cagrR >= 0 ? "+" : ""}${cagrR.toFixed(0)}%/a` } : null,
  ]);
  return { tipo: "Ação", rentabilidade, proventos, solidez, crescimento };
}

/**
 * Classifica o porte da empresa pelo valor de mercado (market cap).
 * Faixas comuns no mercado brasileiro.
 * @param {number} marketCap - em reais
 * @returns {{ label, valor } | null}
 */
export function classificarPorte(marketCap) {
  const mc = num(marketCap);
  if (mc == null || mc <= 0) return null;
  let label;
  if (mc < 2e9) label = "Small cap";
  else if (mc < 10e9) label = "Mid cap";
  else if (mc < 50e9) label = "Large cap";
  else label = "Mega cap";
  return { label, valor: mc };
}

/**
 * Valuation educacional: preço justo de referência por fórmula pública.
 * - Ações com LPA e VPA: fórmula de Graham.
 * - FIIs ou pagadores de dividendo (sem LPA/VPA): preço-teto de Bazin (6%).
 * NÃO é preço-alvo nem meta — apenas referência de estudo.
 *
 * @param {Object} rec - precisa de precoReal e (lpa,vpa) ou (dy)
 * @returns {{ metodo, precoJusto, margem } | null}
 */
export function valuationEducacional(rec) {
  if (!rec) return null;
  const preco = num(rec.precoReal) ?? num(rec.precoEstimado) ?? num(rec.preco);
  const ehFII = rec.tipo === "FII" || /11$/.test(rec.ticker || "");

  // Graham só para ações com lucro e patrimônio positivos.
  if (!ehFII) {
    const justo = precoJustoGraham(num(rec.lpa), num(rec.vpa));
    if (justo != null) {
      return { metodo: "Graham", precoJusto: round2(justo), margem: round1(margemSeguranca(preco, justo)) };
    }
  }

  // Bazin: precisa do dividendo anual. Deriva de DY × preço quando não há valor direto.
  const dy = num(rec.dy);
  if (preco != null && dy != null && dy > 0) {
    const dividendoAnual = preco * (dy / 100);
    const teto = precoTetoBazin(dividendoAnual, 6);
    if (teto != null) {
      return { metodo: "Bazin", precoJusto: round2(teto), margem: round1(margemSeguranca(preco, teto)) };
    }
  }
  return null;
}

/**
 * Calcula medianas por setor a partir de uma população de ativos.
 * Mediana é mais robusta a outliers que a média (P/L de uma empresa em
 * recuperação distorce a média). Ignora valores ausentes.
 *
 * @param {Array} populacao - ativos com { setorCVM|setor, pl, pvp, roe, dy }
 * @returns {Object} mapa setor → { pl, pvp, roe, dy, n }
 */
export function calcularMediasSetor(populacao) {
  if (!populacao || populacao.length === 0) return {};
  const grupos = {};
  for (const a of populacao) {
    const setor = a.setorCVM || a.setor;
    if (!setor) continue;
    (grupos[setor] = grupos[setor] || []).push(a);
  }
  const out = {};
  for (const [setor, itens] of Object.entries(grupos)) {
    out[setor] = {
      pl: mediana(itens.map(i => num(i.pl))),
      pvp: mediana(itens.map(i => num(i.pvp))),
      roe: mediana(itens.map(i => num(i.roe))),
      dy: mediana(itens.map(i => num(i.dy))),
      n: itens.length,
    };
  }
  return out;
}

/**
 * Compara os indicadores de um ativo com a mediana do seu setor.
 * Para cada indicador disponível devolve { valor, mediana, favoravel }.
 * `favoravel` segue a lógica de cada métrica (P/L e P/VP: menor é melhor;
 * ROE e DY: maior é melhor).
 *
 * @param {Object} rec
 * @param {Object} medias - retorno de calcularMediasSetor
 * @returns {Array<{chave, valor, mediana, favoravel}>}
 */
export function compararComSetor(rec, medias) {
  if (!rec || !medias) return [];
  const setor = rec.setorCVM || rec.setor;
  const m = setor ? medias[setor] : null;
  if (!m) return [];

  const defs = [
    { chave: "pl", menorMelhor: true },
    { chave: "pvp", menorMelhor: true },
    { chave: "roe", menorMelhor: false },
    { chave: "dy", menorMelhor: false },
  ];
  const out = [];
  for (const d of defs) {
    const valor = num(rec[d.chave]);
    const med = num(m[d.chave]);
    if (valor == null || med == null) continue;
    const favoravel = d.menorMelhor ? valor <= med : valor >= med;
    out.push({ chave: d.chave, valor, mediana: med, favoravel });
  }
  return out;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function num(v) {
  if (v == null || v === "" || isNaN(Number(v))) return null;
  return Number(v);
}
function round1(v) { return v == null ? null : Math.round(v * 10) / 10; }
function round2(v) { return v == null ? null : Math.round(v * 100) / 100; }

function mediana(valores) {
  const vs = valores.filter(v => v != null && !isNaN(v)).sort((a, b) => a - b);
  if (vs.length === 0) return null;
  const meio = Math.floor(vs.length / 2);
  return vs.length % 2 ? vs[meio] : round2((vs[meio - 1] + vs[meio]) / 2);
}
