// Endpoint de diagnóstico para o bot Telegram.
// Use: GET /api/telegram-debug?code=INV-XXXXXX
// Retorna info sobre: env vars, conectividade Supabase, lookup do código, políticas RLS.

export const config = { maxDuration: 15 };

const SUPABASE_URL = "https://bjghaqtyijvlnwlesrst.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZ2hhcXR5aWp2bG53bGVzcnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTQwOTUsImV4cCI6MjA5MzMzMDA5NX0.wugciBsGln_K5kkWi479M6KpFV32e8Vyd51bjkhc2vE";

async function tentarQuery(label, url, key) {
  try {
    const res = await fetch(url, {
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(8000)
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return {
      label,
      status: res.status,
      ok: res.ok,
      body: json ?? text.slice(0, 300),
      url: url.replace(SUPABASE_URL, "<SUPABASE>")
    };
  } catch (e) {
    return { label, error: e.message };
  }
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  const code = (req.query?.code || "").toUpperCase();

  const env = {
    has_TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
    has_TELEGRAM_BOT_USERNAME: !!process.env.TELEGRAM_BOT_USERNAME,
    has_SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE,
    SUPABASE_SERVICE_ROLE_length: (process.env.SUPABASE_SERVICE_ROLE || "").length,
    SUPABASE_SERVICE_ROLE_starts_with: (process.env.SUPABASE_SERVICE_ROLE || "").slice(0, 12) + "...",
    has_GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    has_BRAPI_TOKEN: !!process.env.BRAPI_TOKEN,
  };

  const tests = [];

  // Teste 1: SELECT em telegram_link_codes com anon key
  tests.push(await tentarQuery(
    "1. SELECT all link_codes (anon)",
    `${SUPABASE_URL}/rest/v1/telegram_link_codes?select=code,user_id,expires_at,used&limit=5`,
    SUPABASE_ANON_KEY
  ));

  // Teste 2: SELECT específico do código informado (anon)
  if (code) {
    tests.push(await tentarQuery(
      `2. SELECT code=${code} (anon)`,
      `${SUPABASE_URL}/rest/v1/telegram_link_codes?code=eq.${encodeURIComponent(code)}&select=*&limit=1`,
      SUPABASE_ANON_KEY
    ));
  }

  // Teste 3: SELECT com service_role (se disponível)
  if (process.env.SUPABASE_SERVICE_ROLE) {
    tests.push(await tentarQuery(
      "3. SELECT all link_codes (service_role)",
      `${SUPABASE_URL}/rest/v1/telegram_link_codes?select=code&limit=3`,
      process.env.SUPABASE_SERVICE_ROLE
    ));

    if (code) {
      tests.push(await tentarQuery(
        `4. SELECT code=${code} (service_role)`,
        `${SUPABASE_URL}/rest/v1/telegram_link_codes?code=eq.${encodeURIComponent(code)}&select=*&limit=1`,
        process.env.SUPABASE_SERVICE_ROLE
      ));
    }
  }

  // Teste 5: SELECT em telegram_links (anon)
  tests.push(await tentarQuery(
    "5. SELECT telegram_links (anon)",
    `${SUPABASE_URL}/rest/v1/telegram_links?select=user_id,chat_id&limit=3`,
    SUPABASE_ANON_KEY
  ));

  // Teste 6: SELECT telegram_links com service_role para pegar user_id vinculado
  let linkedUserId = null;
  if (process.env.SUPABASE_SERVICE_ROLE) {
    const r6 = await tentarQuery(
      "6. SELECT telegram_links (service_role)",
      `${SUPABASE_URL}/rest/v1/telegram_links?select=user_id,chat_id&limit=5`,
      process.env.SUPABASE_SERVICE_ROLE
    );
    tests.push(r6);
    if (Array.isArray(r6.body) && r6.body[0]?.user_id) linkedUserId = r6.body[0].user_id;

    // Teste 7: SELECT carteiras com service_role para o user_id vinculado
    if (linkedUserId) {
      const r7 = await tentarQuery(
        `7. SELECT carteiras user_id=${linkedUserId.slice(0, 8)}... (service_role)`,
        `${SUPABASE_URL}/rest/v1/carteiras?user_id=eq.${linkedUserId}&select=id,nome,created_at`,
        process.env.SUPABASE_SERVICE_ROLE
      );
      tests.push(r7);

      // Teste 8: SELECT ativos da primeira carteira encontrada
      const carteiraId = Array.isArray(r7.body) && r7.body[0]?.id;
      if (carteiraId) {
        tests.push(await tentarQuery(
          `8. SELECT ativos carteira_id=${carteiraId.slice(0, 8)}... (service_role)`,
          `${SUPABASE_URL}/rest/v1/ativos?carteira_id=eq.${carteiraId}&select=ticker,qtd,pm&limit=20`,
          process.env.SUPABASE_SERVICE_ROLE
        ));
      }
    }

    // Teste 9: SELECT carteiras genérico (testa GRANT)
    tests.push(await tentarQuery(
      "9. SELECT all carteiras (service_role)",
      `${SUPABASE_URL}/rest/v1/carteiras?select=user_id,nome&limit=3`,
      process.env.SUPABASE_SERVICE_ROLE
    ));

    // Teste 10: SELECT ativos genérico (testa GRANT)
    tests.push(await tentarQuery(
      "10. SELECT all ativos (service_role)",
      `${SUPABASE_URL}/rest/v1/ativos?select=ticker,carteira_id&limit=3`,
      process.env.SUPABASE_SERVICE_ROLE
    ));
  }

  return res.status(200).json({
    code_tested: code || "(nenhum — passe ?code=INV-XXXXXX)",
    deployed_commit: "diagnostic v2 (carteiras/ativos)",
    linked_user_id: linkedUserId,
    env,
    tests
  });
}
