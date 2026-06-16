// ─── /api/mp-webhook — notificação de pagamento do Mercado Pago ──────────────
// O MP chama esta URL quando há evento de pagamento. NÃO confiamos no corpo:
// buscamos o pagamento na API do MP (autoritativo) e, se "approved", registramos
// a receita em `pagamentos` e ativamos o plano do usuário em profiles (via service
// role). O registro em `pagamentos` (com índice único parcial sobre o id do MP) é
// a trava de IDEMPOTÊNCIA: o MP reenvia a mesma notificação várias vezes, e só a
// primeira ativa/estende o plano (evita renovação dupla).
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
    if (!key) return res.status(500).json({ retry: "service role ausente" });
    const supaHeaders = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

    // 2) Perfil atual: email (p/ a receita) + expiração (p/ renovação justa).
    let emailPerfil = pay.payer?.email || null;
    let base = new Date();
    try {
      const gr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=email,plano_expira_em&user_id=eq.${userId}`, { headers: supaHeaders, signal: AbortSignal.timeout(6000) });
      const arr = await gr.json();
      if (arr?.[0]?.email) emailPerfil = arr[0].email;
      const atual = arr?.[0]?.plano_expira_em ? new Date(arr[0].plano_expira_em) : null;
      if (atual && atual > base) base = atual;
    } catch { /* usa agora + email do pagador */ }

    // 3) Registra a receita. O índice único parcial (referencia, metodo='mercadopago')
    //    garante idempotência: notificação duplicada → 409 → não reativa o plano.
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/pagamentos`, {
      method: "POST",
      headers: { ...supaHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: userId,
        email: emailPerfil,
        plano,
        valor: pay.transaction_amount ?? 0,
        metodo: "mercadopago",
        referencia: String(paymentId),
        pago_em: pay.date_approved || new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (ins.status === 409) return res.status(200).json({ ok: true, duplicate: true }); // já processado
    if (!ins.ok) return res.status(500).json({ retry: `insert ${ins.status}` });

    // 4) Pagamento novo → ativa/estende o plano.
    const expira = new Date(base);
    expira.setMonth(expira.getMonth() + meses);
    const ur = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`, {
      method: "PATCH",
      headers: { ...supaHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ plano, plano_expira_em: expira.toISOString(), updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(8000),
    });
    if (!ur.ok) return res.status(500).json({ retry: `update ${ur.status}` }); // 5xx → MP tenta de novo

    console.log(`[MP] ativado ${plano} p/ ${userId} até ${expira.toISOString()} (pgto ${paymentId})`);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[MP] webhook:", e.message);
    return res.status(500).json({ retry: e.message }); // erro transitório → MP tenta de novo
  }
}
