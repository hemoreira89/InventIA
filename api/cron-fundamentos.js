// ─── /api/cron-fundamentos — Popula fundamentos de todos os ativos ─────────
// Roda diariamente após o cron-screening (7h UTC = 4h Brasil).
// Para cada ticker em `screening_catalogo` com volume relevante, busca
// fundamentos da bolsai e salva em `screening_fundamentos`.
//
// Estratégia: paralelo agressivo (50 simultâneas) com retry.
// ~1400 ativos × 2 reqs (fundamentals + companies) = ~2800 reqs bolsai.
// Plano Pro bolsai (10k/dia) cabe com folga.
//
// ENV vars:
//   BOLSAI_API_KEY           - chave bolsai Pro
//   SUPABASE_SERVICE_ROLE    - chave service_role do Supabase
//   CRON_SECRET              - segredo do Vercel Cron

import { createClient } from "@supabase/supabase-js";

export const config = { maxDuration: 60 }; // Hobby max — 60s

const BOLSAI_BASE = "https://api.usebolsai.com/api/v1";
const SUPABASE_URL = "https://bjghaqtyijvlnwlesrst.supabase.co";

// Volume mínimo pra valer a pena buscar fundamentos.
// Filtra ~600 tickers ilíquidos que não interessariam pra screening anyway.
const VOLUME_MINIMO = 1_000;

// Paralelismo: 50 reqs simultâneas é seguro pro plano Pro
// Paralelismo: 20 reqs simultâneas. Antes era 50, mas a bolsai estava
// retornando timeouts intermitentes em chamadas paralelas demais. 20 é
// um meio-termo que mantém o cron rápido (~30s pra 200 tickers) sem
// stressar a API.
const PARALELISMO = 20;

/**
 * Sanitiza valor numérico vindo da bolsai antes de mandar pro Supabase.
 * - Rejeita NaN, Infinity, strings, objetos
 * - Rejeita valores absurdos que estourariam qualquer NUMERIC razoável
 *   (acima de 1e15 ou abaixo de -1e15)
 * Tudo que não passar vira null em vez de quebrar o upsert silenciosamente.
 *
 * Razão de existir: bug de 04/05/2026 — bolsai retornava valores válidos
 * (ex: nav = 4316720449.78 pra MXRF11) que estouravam NUMERIC(10,2) e o
 * upsert do Supabase rejeitava a linha INTEIRA sem retornar erro pro chunk.
 * Resultado: FIIs grandes ficavam com todos os campos null no banco.
 */
function num(v) {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v)) return null; // pega NaN e Infinity
  if (Math.abs(v) > 1e15) return null;   // teto sanitário (1 quadrilhão)
  return v;
}

// Exporta pra teste unitário (não usado em runtime do endpoint)
export { num };

/**
 * Busca um ticker individual da bolsai (acoes + companies em paralelo).
 * Retorna objeto pronto pra inserir no Supabase, ou null se falhou.
 */
export async function buscarTicker(ticker, tipoCatalogo, apiKey) {
  // Decide endpoint baseado no tipo do catálogo
  const ehFII = tipoCatalogo === "fund";
  const pathPrincipal = ehFII ? `/fiis/${ticker}` : `/fundamentals/${ticker}`;

  try {
    // Fetches em paralelo:
    //   1. principal: /fundamentals (ação) ou /fiis (FII)
    //   2. company:   /companies (setor + nome corporativo, ambos os tipos)
    //   3. dividends: /dividends (DY ttm) — APENAS pra ações; FIIs já têm
    //                 dividend_yield_ttm no /fiis/{ticker}
    const fetches = [
      fetch(`${BOLSAI_BASE}${pathPrincipal}`, {
        headers: { "X-API-Key": apiKey },
        signal: AbortSignal.timeout(20000), // bolsai pode ser lenta (até 15s) — damos folga
      }),
      fetch(`${BOLSAI_BASE}/companies/${ticker}`, {
        headers: { "X-API-Key": apiKey },
        signal: AbortSignal.timeout(20000),
      }),
    ];

    if (!ehFII) {
      // /dividends/{ticker} retorna { dividend_yield_ttm, ttm_per_share, ... }
      // Endpoint descoberto via /api/debug-screening?explore_dividends=PETR4
      // Solução pro bug: 'Pagadoras consistentes' filtrava por dy>4 mas todas
      // as ações tinham dy=null porque o /fundamentals/ não retorna DY.
      fetches.push(
        fetch(`${BOLSAI_BASE}/dividends/${ticker}`, {
          headers: { "X-API-Key": apiKey },
          signal: AbortSignal.timeout(20000),
        })
      );
    }

    const respostas = await Promise.all(fetches);
    const respPrincipal = respostas[0];
    const respCompany = respostas[1];
    const respDividends = ehFII ? null : respostas[2];

    // Se principal falhou e é ação, tenta como FII (ticker pode ser FII ainda)
    let dados = null;
    let tipoFinal = ehFII ? "FII" : "Ação";

    if (respPrincipal.ok) {
      dados = await respPrincipal.json();
    } else if (!ehFII && /11$/.test(ticker)) {
      // Fallback: ticker terminado em 11 que falhou em /fundamentals → tenta FII
      const fallback = await fetch(`${BOLSAI_BASE}/fiis/${ticker}`, {
        headers: { "X-API-Key": apiKey },
        signal: AbortSignal.timeout(15000),
      });
      if (fallback.ok) {
        dados = await fallback.json();
        tipoFinal = "FII";
      }
    }

    if (!dados) return null;

    // Extrai dados de empresa (setor, nome corporativo)
    let setorCVM = null;
    let nome = null;
    if (respCompany.ok) {
      const c = await respCompany.json();
      setorCVM = c.sector || c.cvm_sector || null;
      nome = c.corporate_name || c.name || null;
    }

    // Extrai DY de ações via /dividends/{ticker}.
    // Pra FIIs, dyAcao fica null (eles usam dados.dividend_yield_ttm direto).
    // Se o fetch falhar (404, timeout, ticker sem histórico), dyAcao continua
    // null silenciosamente — não derruba o ticker inteiro.
    let dyAcao = null;
    if (respDividends && respDividends.ok) {
      try {
        const d = await respDividends.json();
        dyAcao = d?.dividend_yield_ttm ?? null;
      } catch {
        // Body inválido — DY fica null mas resto do ticker continua
      }
    }

    // Mapeamento bolsai → nosso schema (validado contra schema real em /api/debug-screening?inspect=true)
    //
    // /fundamentals/{ticker} (ação) retorna:
    //   pl, pvp, roe, roic, ev_ebitda, vpa, lpa, gross_margin, net_margin,
    //   ebit_margin, ebitda_margin, debt_equity, net_debt_equity, net_debt_ebitda,
    //   cagr_revenue_5y, cagr_earnings_5y, ...
    //   NÃO retorna: dividend_yield (vem do /dividends/{ticker})
    //
    // /dividends/{ticker} (ação) retorna:
    //   dividend_yield_ttm, ttm_per_share, current_price, total_payments,
    //   annual_summary, payments
    //
    // /fiis/{ticker} (FII) retorna:
    //   pvp, dividend_yield_ttm, net_asset_value, segment, book_value_per_share, name, ...
    //   NÃO tem: pl, roe (FIIs não têm esses indicadores)
    //
    // Para ação: usa nome de /companies (corporate_name), DY de /dividends
    // Para FII: usa nome de /fiis (campo "name"), DY de /fiis (mesmo campo)
    const nomeAtivo = ehFII
      ? (dados.name || nome)  // FII tem "name", senão fallback pro companies
      : (nome || dados.corporate_name);  // ação usa corporate_name

    // DY: pra FII usa o campo do /fiis/, pra ação usa o do /dividends/
    const dyFinal = ehFII
      ? num(dados.dividend_yield_ttm)
      : num(dyAcao);

    return {
      ticker,
      tipo: tipoFinal,
      nome: nomeAtivo,
      setor_cvm: setorCVM,
      // Ações — sanitizados via num() pra prevenir overflow silencioso
      pl: num(dados.pl),
      pvp: num(dados.pvp),
      roe: num(dados.roe),
      roic: num(dados.roic),
      margem_liquida: num(dados.net_margin),
      div_ebitda: num(dados.net_debt_ebitda),
      cagr_lucro_5y: num(dados.cagr_earnings_5y),
      cagr_receita_5y: num(dados.cagr_revenue_5y),
      ev_ebitda: num(dados.ev_ebitda),
      vpa: num(dados.vpa),
      lpa: num(dados.lpa),
      // Qualidade adicional (adicionado 04/05/2026 — bolsai já retornava
      // mas estava sendo descartado). Usado pra filtros futuros tipo
      // "Blue chip de verdade" (market_cap > 10bi) e refinamento de score.
      market_cap: num(dados.market_cap),
      roa: num(dados.roa),
      debt_equity: num(dados.debt_equity),
      // DY — pra FIIs vem do /fiis/, pra ações vem do /dividends/ (calculado em dyFinal acima)
      dy: dyFinal,
      // FII-only
      nav: num(dados.net_asset_value),
      segmento: dados.segment ?? null,
      // Qualitativo: assume lucros consistentes se cagr de lucros > 0
      // (CAGR negativo significa lucros caindo / prejuízos)
      lucros_consistentes: typeof dados.cagr_earnings_5y === "number"
        ? dados.cagr_earnings_5y > 0
        : null,
      atualizado_em: new Date().toISOString(),
      fonte: "bolsai",
    };
  } catch (e) {
    return null;
  }
}

/**
 * Processa array de tickers em batches paralelos.
 * Para antes do timeout do Vercel (deixa 5s de folga pra fazer upsert e
 * responder), retornando os sucessos parciais ao invés de timeoutar.
 */
async function processarEmBatches(tickers, apiKey, batchSize = PARALELISMO, deadlineMs = null) {
  const sucessos = [];
  let falhas = 0;
  let processados = 0;

  for (let i = 0; i < tickers.length; i += batchSize) {
    // Se já está perto do deadline, para e retorna o que tem
    if (deadlineMs && Date.now() > deadlineMs) {
      console.warn(`[cron-fundamentos] Deadline atingido após ${processados} tickers. Parando para não timeoutar.`);
      break;
    }

    const batch = tickers.slice(i, i + batchSize);
    const resultados = await Promise.all(
      batch.map(t => buscarTicker(t.ticker, t.tipo, apiKey))
    );
    for (const r of resultados) {
      if (r) sucessos.push(r);
      else falhas++;
    }
    processados += batch.length;
  }

  return { sucessos, falhas, processados };
}

export default async function handler(req, res) {
  // ── Auth ──
  const authHeader = req.headers.authorization || "";
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return res.status(500).json({ error: "CRON_SECRET não configurado" });
  }
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const inicio = Date.now();
  const apiKey = process.env.BOLSAI_TOKEN || process.env.BOLSAI_API_KEY;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!apiKey) return res.status(500).json({ error: "BOLSAI_TOKEN não configurado" });
  if (!supaKey) return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE não configurado" });

  const supabase = createClient(SUPABASE_URL, supaKey, {
    auth: { persistSession: false },
  });

  try {
    // ── Pagina o catálogo (Hobby tem 60s — divide em chunks de 500) ──
    const offset = parseInt(req.query?.offset || "0", 10);
    const limit = parseInt(req.query?.limit || "500", 10);

    const { data: tickers, error: errTickers } = await supabase
      .from("screening_catalogo")
      .select("ticker, tipo, volume")
      .gte("volume", VOLUME_MINIMO)
      .in("tipo", ["stock", "fund"])
      .order("volume", { ascending: false })  // mais líquidos primeiro
      .range(offset, offset + limit - 1);

    if (errTickers) throw new Error(`Supabase: ${errTickers.message}`);
    if (!tickers || tickers.length === 0) {
      return res.status(200).json({
        ok: true,
        message: "Nenhum ticker neste range",
        offset,
        limit,
        candidatos: 0,
      });
    }

    // ── Busca fundamentos em batches paralelos ──
    // Vercel Hobby tem 60s de timeout. Reservamos 8s pra upsert+resposta,
    // então damos 50s pro processamento de fundamentos.
    const deadlineMs = inicio + 50_000;
    const { sucessos, falhas, processados } = await processarEmBatches(tickers, apiKey, PARALELISMO, deadlineMs);

    // Se nenhum sucesso, distinguimos entre 2 cenários:
    // 1. API key inválida ou quota estourada (tudo falha): retorna 200 com warning
    //    pra GitHub Actions não dar 'failed' em chunks que caem em zona morta
    //    do catálogo (ETFs, BDRs obscuros que a bolsai não cobre).
    //    O log do Supabase + o JSON da resposta deixam claro o que rolou.
    if (sucessos.length === 0) {
      const duracao = Date.now() - inicio;
      try {
        await supabase.from("screening_catalogo_log").insert({
          tickers_total: tickers.length,
          acoes_total: 0,
          fiis_total: 0,
          fundamentos_total: 0,
          fundamentos_falhas: falhas,
          duracao_ms: duracao,
          erro: `Nenhum fundamento obtido (chunk offset=${offset})`,
        });
      } catch (e) {
        console.warn("[cron-fundamentos] log warning falhou:", e.message);
      }

      return res.status(200).json({
        ok: true,
        warning: "Nenhum fundamento obtido neste range. Provavelmente são tickers que a bolsai não cobre (ETFs, units obscuras, etc).",
        offset,
        limit,
        candidatos: tickers.length,
        processados,
        sucessos: 0,
        falhas,
        duracao_ms: duracao,
      });
    }

    // ── Upsert em chunks de 500 (Supabase tem limite de payload) ──
    // Estratégia defensiva: se o batch falhar, tenta linha-a-linha e loga
    // o ticker exato que estourou. Antes (commit pré-04/05), um overflow
    // silencioso em 1 linha fazia o batch inteiro ser rejeitado sem erro
    // visível — virava bug fantasma de FIIs com todos os campos null.
    let upsertErrors = 0;
    let upsertFallbackTickers = []; // tickers que falharam mesmo no retry
    for (let i = 0; i < sucessos.length; i += 500) {
      const chunk = sucessos.slice(i, i + 500);
      const { error } = await supabase
        .from("screening_fundamentos")
        .upsert(chunk, { onConflict: "ticker" });

      if (!error) continue;

      // Batch falhou — tenta cada linha individualmente pra isolar a culpada
      console.error(`[cron-fundamentos] Batch upsert falhou (${chunk.length} linhas):`, error.message);
      console.error(`[cron-fundamentos] Tentando fallback linha-a-linha...`);

      for (const linha of chunk) {
        const { error: errLinha } = await supabase
          .from("screening_fundamentos")
          .upsert(linha, { onConflict: "ticker" });
        if (errLinha) {
          upsertErrors++;
          upsertFallbackTickers.push(linha.ticker);
          console.error(`[cron-fundamentos] Linha rejeitada ticker=${linha.ticker}: ${errLinha.message}`);
        }
      }
    }

    const duracao = Date.now() - inicio;

    // Log da execução (NUNCA fatal — se falhar, logamos e seguimos)
    try {
      const { error: logErr } = await supabase.from("screening_catalogo_log").insert({
        tickers_total: tickers.length,
        acoes_total: 0,
        fiis_total: 0,
        fundamentos_total: sucessos.length,
        fundamentos_falhas: falhas,
        duracao_ms: duracao,
      });
      if (logErr) console.warn("[cron-fundamentos] log falhou:", logErr.message);
    } catch (e) {
      console.warn("[cron-fundamentos] log exception:", e.message);
    }

    return res.status(200).json({
      ok: true,
      offset,
      limit,
      candidatos: tickers.length,
      processados,
      sucessos: sucessos.length,
      falhas,
      upsert_errors: upsertErrors,
      // Se algum ticker estourou o upsert (mesmo após fallback linha-a-linha),
      // lista quais. Vazio = todos os sucessos foram persistidos com sucesso.
      upsert_fallback_tickers: upsertFallbackTickers,
      duracao_ms: duracao,
      // Se processou tudo no range pedido E o range atingiu o limit (ou seja,
      // pode ter mais ainda no catálogo), sugere próximo offset
      proxima_chamada: (processados === tickers.length && tickers.length === limit)
        ? `?offset=${offset + limit}&limit=${limit}`
        : null,
      // Se processou parcialmente (deadline atingido), sugere reprocessar
      // do meio em diante na próxima chamada
      truncado: processados < tickers.length
        ? { proximo_offset: offset + processados, restantes: tickers.length - processados }
        : null,
    });
  } catch (e) {
    console.error("[cron-fundamentos] erro:", e);
    return res.status(500).json({
      error: e.message || "Erro interno",
      // Stack ajuda diagnóstico (sem exposição de info sensível, é apenas linha/arquivo)
      stack: e.stack ? e.stack.split("\n").slice(0, 5).join(" | ") : null,
    });
  }
}
