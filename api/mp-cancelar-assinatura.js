// ─── /api/mp-cancelar-assinatura — cancela a assinatura recorrente do usuário ──
// Recebe o JWT do usuário (Authorization). Lê o mp_preapproval_id do próprio
// perfil, manda o MP cancelar (PUT /preapproval/{id} status=cancelled) e limpa o
// id. O acesso permanece até plano_expira_em (último ciclo pago) e depois expira
// naturalmente — não removemos o plano aqui.
//
// ENV: MERCADOPAGO_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE, SUPABASE_ANON_KEY
export const config = { maxDuration: 15 };

const SUPABASE_URL = "https://bjghaqtyijvlnwlesrst.supabase.co";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return res.status(501).json({ error: "pagamento não configurado" });

  // Identifica o usuário pelo JWT.
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "sessão ausente" });
  let userId = null;
  try {
    const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: auth },
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) { const u = await r.json(); userId = u.id; }
  } catch (e) { console.error("[MP-cancel] auth:", e.message); }
  if (!userId) return res.status(401).json({ error: "sessão inválida" });

  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!key) return res.status(500).json({ error: "service role ausente" });
  const supaHeaders = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  try {
    // Lê a assinatura ativa do usuário.
    const gr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=mp_preapproval_id&user_id=eq.${userId}`, { headers: supaHeaders, signal: AbortSignal.timeout(6000) });
    const arr = await gr.json();
    const preId = arr?.[0]?.mp_preapproval_id;
    if (!preId) return res.status(200).json({ ok: true, semAssinatura: true });

    // Cancela no Mercado Pago.
    const cr = await fetch(`https://api.mercadopago.com/preapproval/${preId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "cancelled" }),
      signal: AbortSignal.timeout(10000),
    });
    if (!cr.ok) {
      const detail = await cr.json().catch(() => ({}));
      console.error("[MP-cancel] preapproval:", detail);
      return res.status(502).json({ error: "falha ao cancelar no Mercado Pago" });
    }

    // Limpa o id (o acesso continua até o fim do ciclo já pago).
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`, {
      method: "PATCH",
      headers: { ...supaHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ mp_preapproval_id: null, updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(8000),
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[MP-cancel] erro:", e.message);
    return res.status(500).json({ error: "erro interno" });
  }
}
