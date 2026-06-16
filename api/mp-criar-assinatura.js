// ─── /api/mp-criar-assinatura — cria assinatura recorrente (preapproval) no MP ──
// Recebe { plano } + JWT do usuário (Authorization). Cria um preapproval (sem plano
// associado) com auto_recurring + external_reference = "<userId>:<plano>" e devolve
// o init_point (URL onde o assinante autoriza a recorrência com cartão).
// A ativação e cada cobrança recorrente acontecem depois, no /api/mp-webhook.
//
// Gated: sem MERCADOPAGO_ACCESS_TOKEN, responde 501 e o front cai no fallback.
// ENV: MERCADOPAGO_ACCESS_TOKEN, SUPABASE_ANON_KEY (valida o JWT do usuário)
export const config = { maxDuration: 15 };

const SUPABASE_URL = "https://bjghaqtyijvlnwlesrst.supabase.co";
const APP_URL = "https://cauril.com.br";

// Preço/recorrência definidos no SERVIDOR (nunca confiar no cliente).
const PLANOS = {
  mensal: { reason: "Cauril — Plano Mensal", frequency: 1,  preco: 24.9 },
  anual:  { reason: "Cauril — Plano Anual",  frequency: 12, preco: 199  },
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
  } catch (e) { console.error("[MP-sub] auth:", e.message); }
  if (!userId) return res.status(401).json({ error: "sessão inválida" });
  if (!email) return res.status(400).json({ error: "conta sem e-mail" });

  try {
    const pre = {
      reason: plano.reason,
      external_reference: `${userId}:${planoId}`,
      payer_email: email,
      back_url: `${APP_URL}/?assinatura=ok`,
      status: "pending", // assinante autoriza no init_point (fluxo redirecionado)
      auto_recurring: {
        frequency: plano.frequency,
        frequency_type: "months",
        transaction_amount: plano.preco,
        currency_id: "BRL",
      },
      // Algumas versões da API honram notification_url aqui; de toda forma o
      // webhook de assinatura deve estar configurado no painel do MP.
      notification_url: `${APP_URL}/api/mp-webhook`,
    };
    const r = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(pre),
      signal: AbortSignal.timeout(10000),
    });
    const data = await r.json();
    if (!r.ok) { console.error("[MP-sub] criar preapproval:", data); return res.status(502).json({ error: "falha ao criar assinatura" }); }
    return res.status(200).json({ init_point: data.init_point, id: data.id });
  } catch (e) {
    console.error("[MP-sub] erro:", e.message);
    return res.status(500).json({ error: "erro interno" });
  }
}
