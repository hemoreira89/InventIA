// ─── /api/mp-criar-pagamento — cria preferência de Checkout Pro no Mercado Pago
// Recebe { plano } + JWT do usuário (Authorization). Cria a preferência com
// external_reference = "<userId>:<plano>" e devolve o init_point (URL do
// checkout). A ativação do plano acontece depois, no /api/mp-webhook.
//
// Gated: sem MERCADOPAGO_ACCESS_TOKEN, responde 501 e o front cai no fallback.
// ENV: MERCADOPAGO_ACCESS_TOKEN, SUPABASE_ANON_KEY (valida o JWT do usuário)
export const config = { maxDuration: 15 };

const SUPABASE_URL = "https://bjghaqtyijvlnwlesrst.supabase.co";
const APP_URL = "https://cauril.com.br";

// Preço/título definidos no SERVIDOR (nunca confiar no valor do cliente).
const PLANOS = {
  mensal: { titulo: "Cauril — Plano Mensal", preco: 24.9 },
  anual:  { titulo: "Cauril — Plano Anual",  preco: 199 },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return res.status(501).json({ error: "pagamento não configurado" });

  const planoId = req.body?.plano;
  const plano = PLANOS[planoId];
  if (!plano) return res.status(400).json({ error: "plano inválido" });

  // Identifica o usuário pelo JWT (autoritativo via Supabase Auth).
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "sessão ausente" });
  let userId = null, email = null;
  try {
    const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: auth },
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) { const u = await r.json(); userId = u.id; email = u.email; }
  } catch (e) { console.error("[MP] auth:", e.message); }
  if (!userId) return res.status(401).json({ error: "sessão inválida" });

  try {
    const pref = {
      items: [{ title: plano.titulo, quantity: 1, unit_price: plano.preco, currency_id: "BRL" }],
      ...(email ? { payer: { email } } : {}),
      external_reference: `${userId}:${planoId}`,
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
    if (!r.ok) { console.error("[MP] criar preferência:", data); return res.status(502).json({ error: "falha ao criar pagamento" }); }
    return res.status(200).json({ init_point: data.init_point, id: data.id });
  } catch (e) {
    console.error("[MP] erro:", e.message);
    return res.status(500).json({ error: "erro interno" });
  }
}
