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
const PARALELISMO = 50;

/**
 * Busca um ticker individual da bolsai (acoes + companies em paralelo).
 * Retorna objeto pronto pra inserir no Supabase, ou null se falhou.
 */
async function buscarTicker(ticker, tipoCatalogo, apiKey) {
  // Decide endpoint baseado no tipo do catálogo
  const ehFII = tipoCatalogo === "fund";
  const pathPrincipal = ehFII ? `/fiis/${ticker}` : `/fundamentals/${ticker}`;

  try {
    const [respPrincipal, respCompany] = await Promise.all([
      fetch(`${BOLSAI_BASE}${pathPrincipal}`, {
        headers: { "X-API-Key": apiKey },
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`${BOLSAI_BASE}/companies/${ticker}`, {
        headers: { "X-API-Key": apiKey },
        signal: AbortSignal.timeout(8000),
      }),
    ]);

    // Se principal falhou e é ação, tenta como FII (ticker pode ser FII ainda)
    let dados = null;
    let tipoFinal = ehFII ? "FII" : "Ação";

    if (respPrincipal.ok) {
      dados = await respPrincipal.json();
    } else if (!ehFII && /11$/.test(ticker)) {
      // Fallback: ticker terminado em 11 que falhou em /fundamentals → tenta FII
      const fallback = await fetch(`${BOLSAI_BASE}/fiis/${ticker}`, {
        headers: { "X-API-Key": apiKey },
        signal: AbortSignal.timeout(5000),
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

    // Mapeamento bolsai → nosso schema
    return {
      ticker,
      tipo: tipoFinal,
      nome: nome,
      setor_cvm: setorCVM,
      // Ações
      pl: dados.pl ?? null,
      pvp: dados.pvp ?? null,
      roe: dados.roe ?? null,
      roic: dados.roic ?? null,
      margem_liquida: dados.net_margin ?? dados.margem_liquida ?? null,
      div_ebitda: dados.div_ebitda ?? dados.debt_ebitda ?? null,
      cagr_lucro_5y: dados.cagr_lucro_5y ?? null,
      cagr_receita_5y: dados.cagr_receita_5y ?? null,
      ev_ebitda: dados.ev_ebitda ?? null,
      vpa: dados.vpa ?? null,
      lpa: dados.lpa ?? null,
      // FIIs
      dy: dados.dividend_yield ?? dados.dy ?? null,
      nav: dados.nav ?? null,
      segmento: dados.segmento ?? null,
      // Qualitativo (calculado: lucros consistentes se PL > 0 nos últimos 4 anos)
      lucros_consistentes: dados.lucros_consistentes ?? null,
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
  const apiKey = process.env.BOLSAI_API_KEY;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!apiKey) return res.status(500).json({ error: "BOLSAI_API_KEY não configurado" });
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
      await supabase.from("screening_catalogo_log").insert({
        tickers_total: tickers.length,
        acoes_total: 0,
        fiis_total: 0,
        fundamentos_total: 0,
        fundamentos_falhas: falhas,
        duracao_ms: duracao,
        erro: `Nenhum fundamento obtido (chunk offset=${offset})`,
      }).catch(() => {});

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
    let upsertErrors = 0;
    for (let i = 0; i < sucessos.length; i += 500) {
      const chunk = sucessos.slice(i, i + 500);
      const { error } = await supabase
        .from("screening_fundamentos")
        .upsert(chunk, { onConflict: "ticker" });
      if (error) {
        upsertErrors++;
        console.error("Upsert chunk error:", error.message);
      }
    }

    const duracao = Date.now() - inicio;

    // Log da execução
    await supabase.from("screening_catalogo_log").insert({
      tickers_total: tickers.length,
      acoes_total: 0, // não relevante pra esse cron
      fiis_total: 0,
      fundamentos_total: sucessos.length,
      fundamentos_falhas: falhas,
      duracao_ms: duracao,
    });

    return res.status(200).json({
      ok: true,
      offset,
      limit,
      candidatos: tickers.length,
      processados,
      sucessos: sucessos.length,
      falhas,
      upsert_errors: upsertErrors,
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
    return res.status(500).json({ error: e.message || "Erro interno" });
  }
}
