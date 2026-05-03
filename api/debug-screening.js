// ─── /api/debug-screening — endpoint diagnóstico ────────────────────────────
// Verifica se env vars estão presentes e tabelas existem.
// Não retorna valores das chaves, só confirma se foram setadas.
// Protegido por CRON_SECRET (mesmo segredo).

import { createClient } from "@supabase/supabase-js";

export const config = { maxDuration: 10 };

const SUPABASE_URL = "https://bjghaqtyijvlnwlesrst.supabase.co";

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || "";
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return res.status(500).json({ error: "CRON_SECRET ausente no servidor" });
  }
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const diag = {
    env: {
      BRAPI_TOKEN: !!process.env.BRAPI_TOKEN,
      BOLSAI_API_KEY: !!process.env.BOLSAI_API_KEY,
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
      SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE,
      CRON_SECRET: !!process.env.CRON_SECRET,
    },
    env_lengths: {
      BOLSAI_API_KEY: process.env.BOLSAI_API_KEY?.length || 0,
      SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE?.length || 0,
    },
    tabelas: {},
    bolsai_test: null,
  };

  // Testa Supabase
  try {
    const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE || "", {
      auth: { persistSession: false },
    });

    // Conta linhas em cada tabela
    const { count: catalogo, error: e1 } = await supabase
      .from("screening_catalogo")
      .select("*", { count: "exact", head: true });
    diag.tabelas.screening_catalogo = e1 ? { erro: e1.message } : { count: catalogo };

    const { count: fundamentos, error: e2 } = await supabase
      .from("screening_fundamentos")
      .select("*", { count: "exact", head: true });
    diag.tabelas.screening_fundamentos = e2 ? { erro: e2.message } : { count: fundamentos };

    const { count: log, error: e3 } = await supabase
      .from("screening_catalogo_log")
      .select("*", { count: "exact", head: true });
    diag.tabelas.screening_catalogo_log = e3 ? { erro: e3.message } : { count: log };
  } catch (e) {
    diag.tabelas.exception = e.message;
  }

  // Testa bolsai com 1 ticker conhecido
  try {
    const r = await fetch("https://api.usebolsai.com/api/v1/fundamentals/PETR4", {
      headers: { "X-API-Key": process.env.BOLSAI_API_KEY || "" },
      signal: AbortSignal.timeout(5000),
    });
    diag.bolsai_test = {
      status: r.status,
      ok: r.ok,
      body_preview: r.ok ? "OK (200)" : (await r.text()).slice(0, 200),
    };
  } catch (e) {
    diag.bolsai_test = { erro: e.message };
  }

  return res.status(200).json(diag);
}
