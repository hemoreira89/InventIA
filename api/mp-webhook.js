// ─── /api/mp-webhook — notificações do Mercado Pago ──────────────────────────
// Trata 3 tipos de evento (NÃO confiamos no corpo: buscamos o recurso na API do
// MP, que é autoritativa):
//   • payment                          → pagamento avulso (Checkout Pro legado)
//   • subscription_authorized_payment  → cada cobrança recorrente da assinatura
//   • subscription_preapproval         → ciclo de vida da assinatura (autorizada/cancelada)
//
// Idempotência: cada cobrança é gravada em `pagamentos` com referencia = id do
// pagamento (índice único parcial p/ metodo='mercadopago'); duplicatas → 409 → não
// reativam. external_reference = "<userId>:<plano>".
//
// Gated: sem MERCADOPAGO_ACCESS_TOKEN, responde 200 (no-op).
// ENV: MERCADOPAGO_ACCESS_TOKEN, SUPABASE_SERVICE_ROLE
export const config = { maxDuration: 15 };

const SUPABASE_URL = "https://bjghaqtyijvlnwlesrst.supabase.co";
const MESES = { mensal: 1, anual: 12 };

const supaHeaders = (key) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" });

// Diagnóstico: grava o que chega/decide numa tabela legível por SQL (logs do
// Vercel truncam). Fire-and-forget, nunca quebra o fluxo.
function dbg(key, row) {
  fetch(`${SUPABASE_URL}/rest/v1/mp_debug`, {
    method: "POST",
    headers: { ...supaHeaders(key), Prefer: "return=minimal" },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(4000),
  }).catch(() => {});
}

async function mpGet(path, token) {
  const r = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  return r;
}

async function getProfile(key, userId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=email,plano_expira_em&user_id=eq.${userId}`, { headers: supaHeaders(key), signal: AbortSignal.timeout(6000) });
  const a = await r.json().catch(() => []);
  return a?.[0] || null;
}

// Fallback de mapeamento: acha o usuário pelo e-mail (quando o pagamento da
// assinatura não traz external_reference).
async function getProfileByEmail(key, email) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=user_id,plano_expira_em&email=ilike.${encodeURIComponent(email)}`, { headers: supaHeaders(key), signal: AbortSignal.timeout(6000) });
  const a = await r.json().catch(() => []);
  return a?.[0] || null;
}

// Mapeamento CONFIÁVEL: acha o usuário pelo vínculo preapproval_id guardado na
// criação da assinatura (não depende de e-mail nem de external_reference no pagamento).
async function getProfileByPreapproval(key, preId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=user_id,plano_expira_em&mp_preapproval_id=eq.${encodeURIComponent(preId)}`, { headers: supaHeaders(key), signal: AbortSignal.timeout(6000) });
  const a = await r.json().catch(() => []);
  return a?.[0] || null;
}

// Registra a receita (idempotente). Retorna o status HTTP do insert.
async function recordPagamento(key, row) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/pagamentos`, {
    method: "POST",
    headers: { ...supaHeaders(key), Prefer: "return=minimal" },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(8000),
  });
  return r.status;
}

// Estende o plano a partir do maior entre agora e a expiração atual (renovação justa).
async function extendPlan(key, userId, plano, meses, atualExpiraStr) {
  let base = new Date();
  const atual = atualExpiraStr ? new Date(atualExpiraStr) : null;
  if (atual && atual > base) base = atual;
  const expira = new Date(base);
  expira.setMonth(expira.getMonth() + meses);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...supaHeaders(key), Prefer: "return=minimal" },
    body: JSON.stringify({ plano, plano_expira_em: expira.toISOString(), updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(8000),
  });
  return { ok: r.ok, status: r.status, expira: expira.toISOString() };
}

async function setPreapprovalId(key, userId, preId) {
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...supaHeaders(key), Prefer: "return=minimal" },
    body: JSON.stringify({ mp_preapproval_id: preId, updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(8000),
  });
}

export default async function handler(req, res) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return res.status(200).json({ skipped: "mp não configurado" });

  const tipo = req.body?.type || req.query?.type || req.query?.topic;
  const objId = req.body?.data?.id || req.query?.["data.id"] || req.query?.id;
  if (!objId) return res.status(200).json({ ignored: "sem id" });
  console.log(`[MP] webhook recebido: tipo=${tipo} id=${objId}`);

  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!key) return res.status(500).json({ retry: "service role ausente" });
  dbg(key, { tipo, obj_id: String(objId), extra: "recebido" });

  try {
    // ── 1) Cobrança (avulsa OU recorrente) → ativa/estende plano + registra receita ──
    if (tipo === "payment" || tipo === "subscription_authorized_payment") {
      let userId, plano, valor, refId, pagoEm, email = null;

      if (tipo === "payment") {
        const pr = await mpGet(`/v1/payments/${objId}`, token);
        if (!pr.ok) {
          const errBody = await pr.text().catch(() => "");
          dbg(key, { tipo, obj_id: String(objId), fetch_status: pr.status, extra: ("FETCH_FAIL " + errBody).slice(0, 400) });
          return res.status(500).json({ retry: `payment ${pr.status}` });
        }
        const pay = await pr.json();
        email = pay.payer?.email || null;
        dbg(key, { tipo, obj_id: String(objId), fetch_status: pr.status, pay_status: pay.status, external_reference: pay.external_reference ?? null, extra: ("payer=" + (email || "") + " meta=" + JSON.stringify(pay.metadata || {})).slice(0, 400) });
        if (pay.status !== "approved") return res.status(200).json({ ignored: pay.status });
        valor = pay.transaction_amount ?? 0;
        refId = String(pay.id || objId);
        pagoEm = pay.date_approved || new Date().toISOString();
        [userId, plano] = String(pay.external_reference || "").split(":");
        // Fallback: pagamento de assinatura às vezes não traz external_reference.
        // Mapeia pelo e-mail do pagador e infere o plano pelo valor (24,90 / 199).
        if (!userId && email) {
          const pf = await getProfileByEmail(key, email);
          if (pf?.user_id) {
            userId = pf.user_id;
            if (!plano) plano = valor >= 100 ? "anual" : "mensal";
          }
        }
      } else {
        // Cobrança recorrente: authorized_payment + preapproval pai (ref confiável).
        const ar = await mpGet(`/authorized_payments/${objId}`, token);
        if (!ar.ok) { dbg(key, { tipo, obj_id: String(objId), fetch_status: ar.status, extra: "AUTHPAY_FAIL" }); return res.status(500).json({ retry: `authpay ${ar.status}` }); }
        const ap = await ar.json();
        const aprovado = ap?.payment?.status === "approved" || ap?.status === "processed";
        const preId = ap.preapproval_id;
        const pre = preId ? await (await mpGet(`/preapproval/${preId}`, token)).json().catch(() => ({})) : {};
        [userId, plano] = String(pre.external_reference || "").split(":");
        valor = ap.transaction_amount ?? 0;
        refId = String(ap.payment?.id || ap.id || objId);
        pagoEm = ap.date_created || new Date().toISOString();
        email = pre.payer_email || null;
        // Backup confiável: vínculo guardado por preapproval_id (independe de e-mail).
        if (!userId && preId) {
          const pf = await getProfileByPreapproval(key, preId);
          if (pf?.user_id) { userId = pf.user_id; if (!plano) plano = valor >= 100 ? "anual" : "mensal"; }
        }
        dbg(key, { tipo, obj_id: String(objId), pay_status: (ap?.payment?.status || ap?.status), external_reference: pre.external_reference ?? null, extra: ("preId=" + preId + " aprovado=" + aprovado).slice(0, 400) });
        if (!aprovado) return res.status(200).json({ ignored: ap?.status || "nao aprovado" });
      }

      const meses = MESES[plano];
      if (!userId || !meses) return res.status(200).json({ ignored: "ref inválida" });

      const prof = await getProfile(key, userId);
      if (prof?.email) email = prof.email;

      // Idempotência: grava o pagamento; se já existe (409), não reativa.
      const st = await recordPagamento(key, {
        user_id: userId, email, plano, valor,
        metodo: "mercadopago", referencia: refId, pago_em: pagoEm,
      });
      if (st === 409) return res.status(200).json({ ok: true, duplicate: true });
      if (st >= 400) return res.status(500).json({ retry: `insert ${st}` });

      const up = await extendPlan(key, userId, plano, meses, prof?.plano_expira_em);
      if (!up.ok) return res.status(500).json({ retry: `update ${up.status}` });
      console.log(`[MP] ${tipo}: ${plano} p/ ${userId} até ${up.expira} (ref ${refId})`);
      return res.status(200).json({ ok: true });
    }

    // ── 2) Ciclo de vida da assinatura → guarda/limpa o id (p/ cancelamento) ──
    if (tipo === "subscription_preapproval" || tipo === "preapproval") {
      const pr = await mpGet(`/preapproval/${objId}`, token);
      if (!pr.ok) return res.status(500).json({ retry: `preapproval ${pr.status}` });
      const pre = await pr.json();
      const [userId] = String(pre.external_reference || "").split(":");
      if (!userId) return res.status(200).json({ ignored: "ref inválida" });
      if (pre.status === "authorized") {
        await setPreapprovalId(key, userId, String(pre.id || objId));
      } else if (pre.status === "cancelled" || pre.status === "paused") {
        await setPreapprovalId(key, userId, null);
      }
      return res.status(200).json({ ok: true, status: pre.status });
    }

    return res.status(200).json({ ignored: tipo || "sem tipo" });
  } catch (e) {
    console.error("[MP] webhook:", e.message);
    return res.status(500).json({ retry: e.message });
  }
}
