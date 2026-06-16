// ─── /api/mp — ações de pagamento do Mercado Pago (1 function, várias ações) ──
// Consolidado para respeitar o limite de Serverless Functions do plano.
// Dispatch por `action` no corpo:
//   • "assinar"      → cria assinatura recorrente (preapproval) → init_point
//   • "pagar_avulso" → cria pagamento avulso (Checkout Pro)     → init_point
//   • "cancelar"     → cancela a assinatura recorrente do usuário
//
// O webhook do MP fica em /api/mp-webhook (URL fixa chamada pelo MP).
// ENV: MERCADOPAGO_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE, SUPABASE_ANON_KEY
export const config = { maxDuration: 15 };

const SUPABASE_URL = "https://bjghaqtyijvlnwlesrst.supabase.co";
const APP_URL = "https://cauril.com.br";
// Anon key é pública (protegida por RLS) — fallback embutido como em analyze.js,
// pra validar o JWT do usuário mesmo se a env var não estiver no Vercel.
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZ2hhcXR5aWp2bG53bGVzcnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTQwOTUsImV4cCI6MjA5MzMzMDA5NX0.wugciBsGln_K5kkWi479M6KpFV32e8Vyd51bjkhc2vE';

// Preço/recorrência definidos no SERVIDOR (nunca confiar no cliente).
const PLANOS = {
  mensal: { titulo: "Cauril — Plano Mensal", preco: 24.9, frequency: 1 },
  anual:  { titulo: "Cauril — Plano Anual",  preco: 199,  frequency: 12 },
};

async function getUser(auth) {
  if (!auth || !auth.startsWith("Bearer ")) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth },
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) return await r.json();
  } catch (e) { console.error("[mp] auth:", e.message); }
  return null;
}

// ── Assinatura recorrente (preapproval) ──────────────────────────────────────
async function criarAssinatura(req, res, token, user) {
  const plano = PLANOS[req.body?.plano];
  if (!plano) return res.status(400).json({ error: "plano inválido" });
  if (!user.email) return res.status(400).json({ error: "conta sem e-mail" });
  const pre = {
    reason: plano.titulo,
    external_reference: `${user.id}:${req.body.plano}`,
    payer_email: user.email,
    back_url: `${APP_URL}/?assinatura=ok`,
    status: "pending",
    auto_recurring: { frequency: plano.frequency, frequency_type: "months", transaction_amount: plano.preco, currency_id: "BRL" },
    notification_url: `${APP_URL}/api/mp-webhook`,
  };
  const r = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(pre),
    signal: AbortSignal.timeout(10000),
  });
  const data = await r.json();
  if (!r.ok) { console.error("[mp] preapproval:", data); return res.status(502).json({ error: "falha ao criar assinatura" }); }
  return res.status(200).json({ init_point: data.init_point, id: data.id });
}

// ── Pagamento avulso (Checkout Pro) ──────────────────────────────────────────
async function criarPagamento(req, res, token, user) {
  const plano = PLANOS[req.body?.plano];
  if (!plano) return res.status(400).json({ error: "plano inválido" });
  const pref = {
    items: [{ title: plano.titulo, quantity: 1, unit_price: plano.preco, currency_id: "BRL" }],
    ...(user.email ? { payer: { email: user.email } } : {}),
    external_reference: `${user.id}:${req.body.plano}`,
    back_urls: {
      success: `${APP_URL}/?pagamento=ok`,
      failure: `${APP_URL}/?pagamento=falha`,
      pending: `${APP_URL}/?pagamento=pendente`,
    },
    auto_return: "approved",
    notification_url: `${APP_URL}/api/mp-webhook`,
    statement_descriptor: "CAURIL",
  };
  const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(pref),
    signal: AbortSignal.timeout(10000),
  });
  const data = await r.json();
  if (!r.ok) { console.error("[mp] preferência:", data); return res.status(502).json({ error: "falha ao criar pagamento" }); }
  return res.status(200).json({ init_point: data.init_point, id: data.id });
}

// ── Cancelar assinatura recorrente ───────────────────────────────────────────
async function cancelarAssinatura(req, res, token, user) {
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!key) return res.status(500).json({ error: "service role ausente" });
  const supaHeaders = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  const gr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=mp_preapproval_id&user_id=eq.${user.id}`, { headers: supaHeaders, signal: AbortSignal.timeout(6000) });
  const arr = await gr.json();
  const preId = arr?.[0]?.mp_preapproval_id;
  if (!preId) return res.status(200).json({ ok: true, semAssinatura: true });

  const cr = await fetch(`https://api.mercadopago.com/preapproval/${preId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: "cancelled" }),
    signal: AbortSignal.timeout(10000),
  });
  if (!cr.ok) {
    const detail = await cr.json().catch(() => ({}));
    console.error("[mp] cancelar:", detail);
    return res.status(502).json({ error: "falha ao cancelar no Mercado Pago" });
  }
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${user.id}`, {
    method: "PATCH",
    headers: { ...supaHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({ mp_preapproval_id: null, updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(8000),
  });
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return res.status(501).json({ error: "pagamento não configurado" });

  const user = await getUser(req.headers.authorization);
  if (!user?.id) return res.status(401).json({ error: "sessão inválida" });

  const action = req.body?.action;
  try {
    if (action === "assinar")      return await criarAssinatura(req, res, token, user);
    if (action === "pagar_avulso") return await criarPagamento(req, res, token, user);
    if (action === "cancelar")     return await cancelarAssinatura(req, res, token, user);
    return res.status(400).json({ error: "ação inválida" });
  } catch (e) {
    console.error("[mp] erro:", e.message);
    return res.status(500).json({ error: "erro interno" });
  }
}
