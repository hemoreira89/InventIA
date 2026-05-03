// ─── /api/debug-screening — endpoint diagnóstico ────────────────────────────
// Verifica se env vars estão presentes e tabelas existem.
// Não retorna valores das chaves, só confirma se foram setadas.
// Protegido por CRON_SECRET (mesmo segredo).
//
// Modos:
//   ?dryrun=PETR4    → roda o mapeamento real do cron pra UM ticker
//                       (1 ação ou 1 FII), retorna o objeto que IRIA pro
//                       Supabase. Não escreve nada. Custa 2 reqs bolsai.
//   ?inspect=true    → mostra schema cru de PETR4 (ação) e MXRF11 (FII)
//   (sem param)      → só checa env vars + tabelas + bolsai connectivity

import { createClient } from "@supabase/supabase-js";
import { buscarTicker } from "./cron-fundamentos.js";

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

  // ── Modo dry-run: testa o mapeamento real pra 1 ticker, sem escrever ──
  // Custa apenas 2 reqs bolsai (fundamentals + companies, ou fiis + companies)
  // Útil pra validar mudanças no mapeamento antes de rodar o cron inteiro
  const dryrunTicker = req.query?.dryrun;
  if (dryrunTicker) {
    const apiKey = process.env.BOLSAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "BOLSAI_API_KEY não configurado" });
    }

    const ticker = String(dryrunTicker).toUpperCase().trim();
    // Auto-detecta tipo: ticker terminado em 11 (provável FII) ou 3/4/5/6 (ação)
    const tipoChute = /11$/.test(ticker) ? "fund" : "stock";

    try {
      const inicio = Date.now();
      const resultado = await buscarTicker(ticker, tipoChute, apiKey);
      const duracao_ms = Date.now() - inicio;

      return res.status(200).json({
        ok: !!resultado,
        ticker,
        tipo_chute: tipoChute,
        duracao_ms,
        // Objeto exato que iria pro Supabase
        objeto_mapeado: resultado,
        // Identifica campos que ficaram null (suspeitos de mapping ruim)
        campos_null: resultado
          ? Object.entries(resultado)
              .filter(([k, v]) => v === null && k !== "atualizado_em")
              .map(([k]) => k)
          : null,
      });
    } catch (e) {
      return res.status(500).json({ error: e.message, stack: e.stack?.split("\n").slice(0, 5).join(" | ") });
    }
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
    const inicio = Date.now();
    const r = await fetch("https://api.usebolsai.com/api/v1/fundamentals/PETR4", {
      headers: { "X-API-Key": process.env.BOLSAI_API_KEY || "" },
      signal: AbortSignal.timeout(15000), // 15s — bolsai pode estar lenta
    });
    const duracao_ms = Date.now() - inicio;
    diag.bolsai_test = {
      status: r.status,
      ok: r.ok,
      duracao_ms,
      body_preview: r.ok ? "OK (200)" : (await r.text()).slice(0, 200),
    };
  } catch (e) {
    diag.bolsai_test = { erro: e.message };
  }

  // Consulta uso atual da chave bolsai (cota diária restante, etc)
  try {
    const r = await fetch("https://api.usebolsai.com/api/v1/keys/usage", {
      headers: { "X-API-Key": process.env.BOLSAI_API_KEY || "" },
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) {
      diag.bolsai_usage = await r.json();
    } else {
      diag.bolsai_usage = { status: r.status, error: (await r.text()).slice(0, 300) };
    }
    // Captura headers de rate limit (se a bolsai retornar)
    diag.bolsai_usage_headers = {
      "x-ratelimit-remaining": r.headers.get("x-ratelimit-remaining"),
      "x-ratelimit-limit": r.headers.get("x-ratelimit-limit"),
      "x-ratelimit-reset": r.headers.get("x-ratelimit-reset"),
      "retry-after": r.headers.get("retry-after"),
    };
  } catch (e) {
    diag.bolsai_usage = { erro: e.message };
  }

  // Inspeção dos campos retornados (pra mapear corretamente)
  // Mostra TODAS as chaves do JSON da bolsai pra entender o schema real
  if (req.query?.inspect === "true") {
    diag.inspect = {};

    // Ação (PETR4)
    try {
      const r = await fetch("https://api.usebolsai.com/api/v1/fundamentals/PETR4", {
        headers: { "X-API-Key": process.env.BOLSAI_API_KEY || "" },
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) {
        const j = await r.json();
        diag.inspect.acao_PETR4 = {
          chaves: Object.keys(j).sort(),
          amostra: j, // payload completo (pode ser grande, ok pra debug)
        };
      }
    } catch (e) { diag.inspect.acao_PETR4 = { erro: e.message }; }

    // FII (MXRF11)
    try {
      const r = await fetch("https://api.usebolsai.com/api/v1/fiis/MXRF11", {
        headers: { "X-API-Key": process.env.BOLSAI_API_KEY || "" },
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) {
        const j = await r.json();
        diag.inspect.fii_MXRF11 = {
          chaves: Object.keys(j).sort(),
          amostra: j,
        };
      }
    } catch (e) { diag.inspect.fii_MXRF11 = { erro: e.message }; }

    // Companies (PETR4 — pra setor)
    try {
      const r = await fetch("https://api.usebolsai.com/api/v1/companies/PETR4", {
        headers: { "X-API-Key": process.env.BOLSAI_API_KEY || "" },
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) {
        const j = await r.json();
        diag.inspect.companies_PETR4 = {
          chaves: Object.keys(j).sort(),
          amostra: j,
        };
      }
    } catch (e) { diag.inspect.companies_PETR4 = { erro: e.message }; }
  }

  return res.status(200).json(diag);
}
