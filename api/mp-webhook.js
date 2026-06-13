// ─── /api/mp-webhook — notificação de pagamento do Mercado Pago ──────────────
// O MP chama esta URL quando há evento de pagamento. NÃO confiamos no corpo:
// buscamos o pagamento na API do MP (autoritativo) e, se "approved", ativamos
// o plano do usuário em profiles (plano + plano_expira_em), via service role.
//
// external_reference = "<userId>:<plano>" (definido em mp-criar-pagamento).
// Gated: sem MERCADOPAGO_ACCESS_TOKEN, responde 200 (no-op).
// ENV: MERCADOPAGO_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE
export const config = { maxDuration: 15 };

const SUPABASE_URL = "https://bjghaqtyijvlnwlesrst.supabase.co";
const MESES = { mensal: 1, anual: 12 };

export default async function handler(req, res) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return res.status(200).json({ skipped: "mp não configurado" });

  // O id do pagamento pode vir no corpo (data.id) ou na query.
  const tipo = req.body?.type || req.query?.type || req.query?.topic;
  const paymentId = req.body?.data?.id || req.query?.["data.id"] || req.query?.id;
  if (tipo && tipo !== "payment") return res.status(200).json({ ignored: tipo });
  if (!paymentId) return res.status(200).json({ ignored: "sem id" });

  try {
    // 1) Confirma o pagamento direto no MP.
    const pr = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!pr.ok) return res.status(500).json({ retry: `payment ${pr.status}` }); // 5xx → MP tenta de novo
    const pay = await pr.json();
    if (pay.status !== "approved") return res.status(200).json({ ignored: pay.status });

    const [userId, plano] = String(pay.external_reference || "").split(":");
    const meses = MESES[plano];
    if (!userId || !meses) return res.status(200).json({ ignored: "ref inválida" });

    const key = process.env.SUPABASE_SERVICE_ROLE;
    const supaHeaders = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

    // 2) Estende a partir do maior entre agora e a expiração atual (renovação justa).
    let base = new Date();
    try {
      const gr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=plano_expira_em&user_id=eq.${userId}`, { headers: supaHeaders, signal: AbortSignal.timeout(6000) });
      const arr = await gr.json();
      const atual = arr?.[0]?.plano_expira_em ? new Date(arr[0].plano_expira_em) : null;
      if (atual && atual > base) base = atual;
    } catch { /* usa agora */ }
    const expira = new Date(base);
    expira.setMonth(expira.getMonth() + meses);

    // 3) Ativa o plano.
    const ur = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`, {
      method: "PATCH",
      headers: { ...supaHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ plano, plano_expira_em: expira.toISOString(), updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(8000),
    });
    if (!ur.ok) return res.status(500).json({ retry: `update ${ur.status}` }); // 5xx → MP tenta de novo

    console.log(`[MP] ativado ${plano} p/ ${userId} até ${expira.toISOString()}`);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[MP] webhook:", e.message);
    return res.status(500).json({ retry: e.message }); // erro transitório → MP tenta de novo
  }
}
