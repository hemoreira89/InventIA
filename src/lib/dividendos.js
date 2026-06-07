// ─── Segurança dos dividendos (heurística transparente) ───────────────────────
// Sinal INDICATIVO de sustentabilidade dos proventos, baseado nos fundamentos
// disponíveis. Não é recomendação — mostra os fatores para o usuário julgar.
// Cada fator vale: bom=100, neutro=50, ruim=0. O nível vem da média dos fatores
// presentes (degrada graciosamente quando faltam dados).

const PTS = { bom: 100, neutro: 50, ruim: 0 };

/**
 * Avalia a segurança/sustentabilidade dos dividendos de um ativo.
 * @param {Object} f - fundamentos (pvp, dy, roe, margemLiquida, divEbitda, lucrosConsistentes...)
 * @param {string} [tipo] - "FII" ou "Ação"
 * @returns {{score:number, nivel:"alta"|"media"|"baixa", fatores:Array}|null}
 */
export function avaliarSegurancaDividendos(f, tipo) {
  if (!f) return null;
  const ehFII = tipo === "FII" || f.tipo === "FII";
  const fatores = [];
  const push = (label, status, detalhe) => fatores.push({ label, status, detalhe });

  if (ehFII) {
    if (f.pvp != null) {
      if (f.pvp <= 1.05) push("P/VP", "bom", `${f.pvp.toFixed(2)} — cota a preço justo ou com desconto`);
      else if (f.pvp <= 1.25) push("P/VP", "neutro", `${f.pvp.toFixed(2)} — leve ágio sobre o patrimônio`);
      else push("P/VP", "ruim", `${f.pvp.toFixed(2)} — ágio alto (risco de compressão do yield)`);
    }
    if (f.dy != null) {
      if (f.dy >= 8 && f.dy <= 12) push("Dividend Yield", "bom", `${f.dy.toFixed(1)}% — faixa saudável e sustentável`);
      else if (f.dy > 12 && f.dy <= 14) push("Dividend Yield", "neutro", `${f.dy.toFixed(1)}% — alto; confira a sustentabilidade`);
      else if (f.dy > 14) push("Dividend Yield", "ruim", `${f.dy.toFixed(1)}% — muito alto (mercado pode estar precificando corte)`);
      else push("Dividend Yield", "neutro", `${f.dy.toFixed(1)}% — abaixo da média de FIIs`);
    }
  } else {
    if (f.lucrosConsistentes != null) {
      push("Lucros consistentes", f.lucrosConsistentes ? "bom" : "ruim",
        f.lucrosConsistentes ? "Lucro crescente nos últimos anos" : "Lucro instável ou em queda");
    }
    if (f.divEbitda != null) {
      if (f.divEbitda <= 2) push("Dívida/EBITDA", "bom", `${f.divEbitda.toFixed(1)}x — endividamento baixo`);
      else if (f.divEbitda <= 3.5) push("Dívida/EBITDA", "neutro", `${f.divEbitda.toFixed(1)}x — alavancagem moderada`);
      else push("Dívida/EBITDA", "ruim", `${f.divEbitda.toFixed(1)}x — alavancagem alta pressiona os dividendos`);
    }
    if (f.roe != null) {
      if (f.roe >= 12) push("ROE", "bom", `${f.roe.toFixed(0)}% — boa geração de retorno`);
      else if (f.roe >= 6) push("ROE", "neutro", `${f.roe.toFixed(0)}% — rentabilidade média`);
      else push("ROE", "ruim", `${f.roe.toFixed(0)}% — baixa rentabilidade`);
    }
    if (f.margemLiquida != null) {
      if (f.margemLiquida >= 15) push("Margem líquida", "bom", `${f.margemLiquida.toFixed(0)}% — folga para distribuir`);
      else if (f.margemLiquida >= 5) push("Margem líquida", "neutro", `${f.margemLiquida.toFixed(0)}% — margem apertada`);
      else push("Margem líquida", "ruim", `${f.margemLiquida.toFixed(0)}% — margem baixa`);
    }
  }

  if (fatores.length < 2) return null; // dados insuficientes para um sinal honesto

  const score = Math.round(fatores.reduce((s, x) => s + PTS[x.status], 0) / fatores.length);
  const nivel = score >= 70 ? "alta" : score >= 45 ? "media" : "baixa";
  return { score, nivel, fatores };
}
