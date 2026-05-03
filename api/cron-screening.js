// ─── /api/cron-screening — Popula catálogo de ativos da B3 ───────────────────
// Roda diariamente (6h UTC = 3h da manhã horário Brasil) via Vercel Cron.
// Busca ~750 tickers da brapi (1 chamada por tipo, paginada se necessário) e
// salva em `screening_catalogo` no Supabase.
//
// Requer ENV vars:
//   BRAPI_TOKEN              - token brapi.dev
//   SUPABASE_SERVICE_ROLE    - chave service_role do Supabase
//   CRON_SECRET              - segredo configurado no Vercel Cron header
//
// Acesso: bloqueado a quem não envia Authorization: Bearer {CRON_SECRET}

import { createClient } from "@supabase/supabase-js";

export const config = { maxDuration: 60 };

const BRAPI_BASE = "https://brapi.dev/api";
const SUPABASE_URL = "https://bjghaqtyijvlnwlesrst.supabase.co";

/**
 * Busca uma página da listagem da brapi.
 */
async function buscarPagina(token, tipo, page = 1, limit = 200) {
  const params = new URLSearchParams({
    type: tipo,            // 'stock' | 'fund' | 'bdr'
    sortBy: "volume",
    sortOrder: "desc",
    limit: String(limit),
    page: String(page),
    token,
  });
  const url = `${BRAPI_BASE}/quote/list?${params}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`brapi /quote/list ${tipo} p${page}: HTTP ${r.status} ${txt.slice(0, 200)}`);
  }
  const j = await r.json();
  return {
    stocks: Array.isArray(j.stocks) ? j.stocks : [],
    hasNextPage: !!j.hasNextPage,
    totalCount: j.totalCount || 0,
  };
}

/**
 * Busca todas as páginas de um tipo, agregando em uma lista só.
 */
async function buscarTodos(token, tipo) {
  const todos = [];
  let page = 1;
  // Limita a 5 páginas (200×5 = 1000 ativos, mais que suficiente pra B3)
  while (page <= 5) {
    const { stocks, hasNextPage } = await buscarPagina(token, tipo, page, 200);
    todos.push(...stocks);
    if (!hasNextPage || stocks.length === 0) break;
    page++;
  }
  return todos;
}

/**
 * Mapeia o objeto da brapi pro schema da nossa tabela.
 */
function mapearParaCatalogo(stock, tipo) {
  return {
    ticker: stock.stock,
    nome: stock.name || null,
    setor: stock.sector || null,
    tipo,
    preco: stock.close ?? null,
    market_cap: stock.market_cap_basic != null ? Math.round(stock.market_cap_basic) : null,
    volume: stock.volume != null ? Math.round(stock.volume) : null,
    variacao_pct: stock.change ?? null,
    atualizado_em: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  // ── Autenticação: só Vercel Cron ou chamada manual com secret ──
  const authHeader = req.headers.authorization || "";
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return res.status(500).json({ error: "CRON_SECRET não configurado no ambiente" });
  }
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const inicio = Date.now();
  const brapiToken = process.env.BRAPI_TOKEN;
  const supaServiceKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!brapiToken) return res.status(500).json({ error: "BRAPI_TOKEN não configurado" });
  if (!supaServiceKey) return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE não configurado" });

  const supabase = createClient(SUPABASE_URL, supaServiceKey, {
    auth: { persistSession: false },
  });

  try {
    // ── Busca paralela: ações + FIIs (BDR ignorado por enquanto) ──
    const [acoes, fiis] = await Promise.all([
      buscarTodos(brapiToken, "stock"),
      buscarTodos(brapiToken, "fund"),
    ]);

    const registros = [
      ...acoes.map(s => mapearParaCatalogo(s, "stock")),
      ...fiis.map(s => mapearParaCatalogo(s, "fund")),
    ].filter(r => r.ticker); // descarta entradas sem ticker

    if (registros.length === 0) {
      throw new Error("Nenhum ticker retornado pela brapi");
    }

    // ── Upsert em batch (Supabase aceita arrays) ──
    // upsert: insere se não existe, atualiza se já existe (chave: ticker)
    const { error: upsertErr } = await supabase
      .from("screening_catalogo")
      .upsert(registros, { onConflict: "ticker" });

    if (upsertErr) throw new Error(`Supabase upsert: ${upsertErr.message}`);

    // ── Limpa registros antigos (não atualizados nesta execução) ──
    // Tickers que existem na tabela mas não vieram nesta atualização.
    // Mantém registros das últimas 7 atualizações pra evitar perder dado por
    // uma falha temporária da brapi.
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("screening_catalogo")
      .delete()
      .lt("atualizado_em", seteDiasAtras);

    const duracao = Date.now() - inicio;

    // ── Log da execução ──
    await supabase.from("screening_catalogo_log").insert({
      tickers_total: registros.length,
      acoes_total: acoes.length,
      fiis_total: fiis.length,
      duracao_ms: duracao,
    });

    return res.status(200).json({
      ok: true,
      tickers_total: registros.length,
      acoes_total: acoes.length,
      fiis_total: fiis.length,
      duracao_ms: duracao,
    });
  } catch (e) {
    const duracao = Date.now() - inicio;
    // Loga erro também
    try {
      await supabase.from("screening_catalogo_log").insert({
        tickers_total: 0,
        acoes_total: 0,
        fiis_total: 0,
        duracao_ms: duracao,
        erro: e.message?.slice(0, 500) || String(e),
      });
    } catch { /* ignora erro de log */ }

    console.error("[cron-screening] erro:", e);
    return res.status(500).json({ error: e.message || "Erro interno" });
  }
}
