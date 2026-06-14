// ─── /api/cron-emails — Ciclo de email de trial (trial → pago) ───────────────
// Roda 1x/dia. Para cada usuário no trial, envia o email da ETAPA do dia
// (cada etapa 1x, deduplicado em public.emails_lifecycle):
//   boas_vindas   (acabou de começar)  → mostra o que dá pra fazer
//   valor         (faltam ~4 dias)      → reforça valor já entregue
//   urgencia      (faltam 2 dias)       → urgência leve
//   ultima_chance (último dia)          → última chamada
//   winback       (expirou há até 3d)   → reconquista
//
// DORMENTE E SEGURO: se SMTP não estiver configurado, sai sem fazer nada.
// Envio via SMTP (nodemailer) — funciona com Gmail/Workspace hoje e com
// qualquer domínio próprio depois (basta trocar as envs).
//
// ENV: SUPABASE_SERVICE_ROLE, CRON_SECRET,
//      SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, EMAIL_FROM
// Auth: Authorization: Bearer {CRON_SECRET}  (o Vercel cron já envia isso).
import nodemailer from "nodemailer";

export const config = { maxDuration: 60 };

const SUPABASE_URL = "https://bjghaqtyijvlnwlesrst.supabase.co";
const APP_URL = "https://cauril.com.br";
const MAX_POR_RUN = 200; // teto defensivo

// ─── Supabase REST ──────────────────────────────────────────────────────────
function supaHeaders(key) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
async function supaList(table, query, key) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: supaHeaders(key), signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d) ? d : [];
  } catch (e) { console.error(`[EMAILS] LIST ${table}:`, e.message); return []; }
}
async function supaInsert(table, rows, key) {
  if (!rows.length) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...supaHeaders(key), Prefer: "return=minimal" },
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) { console.error(`[EMAILS] INSERT ${table}:`, e.message); }
}

// ─── Etapa do dia a partir dos dias restantes do trial ──────────────────────
function etapaDoDia(diasRestantes) {
  if (diasRestantes >= 6) return "boas_vindas";
  if (diasRestantes === 5) return "historia";
  if (diasRestantes === 4) return "valor";
  if (diasRestantes === 2) return "urgencia";
  if (diasRestantes === 1) return "ultima_chance";
  if (diasRestantes <= 0 && diasRestantes >= -3) return "winback";
  return null;
}

// ─── Templates (HTML simples, on-brand) ─────────────────────────────────────
function botao(texto) {
  return `<a href="${APP_URL}" style="display:inline-block;background:#7b61ff;color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:10px;font-size:15px">${texto}</a>`;
}
function wrap(corpo) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#06060f;padding:32px 0">
  <div style="max-width:520px;margin:0 auto;background:#0b0b1a;border:1px solid #1f1f36;border-radius:16px;padding:32px 28px;color:#e8e8f2">
    <div style="font-size:18px;font-weight:800;margin-bottom:20px">Cau<span style="color:#7b61ff">ril</span></div>
    ${corpo}
    <div style="margin-top:28px;padding-top:18px;border-top:1px solid #1f1f36;font-size:11px;color:#5b5b76;line-height:1.7">
      Conteúdo educacional — não é recomendação de investimento. Você recebe este email porque criou uma conta no Cauril.
      Não quer mais receber? Basta responder este email.
    </div>
  </div>
</div>`;
}
const TEMPLATES = {
  boas_vindas: () => ({
    subject: "Bem-vindo ao Cauril — seu teste de 7 dias começou",
    html: wrap(`<p style="font-size:15px;line-height:1.7;color:#b8b8cc">Seu teste grátis está rodando. Em 1 minuto você já vê sua carteira da B3 analisada por IA: tese, risco e o que fazer no próximo aporte.</p>
      <p style="font-size:15px;line-height:1.7;color:#b8b8cc">Comece adicionando seus ativos (ou rode com uma carteira de exemplo) e peça a primeira análise.</p>
      <p style="margin:24px 0">${botao("Fazer minha primeira análise")}</p>`),
  }),
  historia: () => ({
    subject: "O nome por trás do Cauril",
    html: wrap(`<p style="font-size:15px;line-height:1.7;color:#b8b8cc">Quando alguém te pergunta o que é dinheiro, a resposta automática é uma nota, uma moeda, um número na tela do banco. Mas a história é bem mais antiga que isso.</p>
      <p style="font-size:15px;line-height:1.7;color:#b8b8cc">Há mais de 3 mil anos, muito antes do metal e do papel, as pessoas já guardavam valor numa concha: o <b style="color:#e8e8f2">cauri</b>. Da África ao Brasil, ele foi uma das primeiras moedas do mundo — pequeno, resistente, aceito por todos. Cabia na palma da mão e atravessava continentes.</p>
      <p style="font-size:15px;line-height:1.7;color:#b8b8cc">É daí que vem o nome <b style="color:#e8e8f2">Cauril</b>.</p>
      <p style="font-size:15px;line-height:1.7;color:#b8b8cc">No fundo, investir é a mesma ideia de sempre: pegar o que você tem hoje e transformar em segurança amanhã. O que mudou foi a ferramenta — agora você não precisa decifrar a B3 sozinho. Uma IA lê o mercado por você, organiza sua carteira e aponta o próximo passo.</p>
      <p style="font-size:16px;line-height:1.8;color:#e8e8f2;font-weight:700;font-style:italic;margin:22px 0 0">A sabedoria de milênios, com a tecnologia de hoje. A sua riqueza, com história. 🐚</p>
      <p style="margin:26px 0 0">${botao("Analisar minha carteira")}</p>`),
  }),
  valor: () => ({
    subject: "Já viu o raio-X de risco da sua carteira?",
    html: wrap(`<p style="font-size:15px;line-height:1.7;color:#b8b8cc">Além da análise com IA, o Cauril mostra a concentração por ativo e setor, um score de risco e o plano de rebalanceamento com simulação de aporte.</p>
      <p style="font-size:15px;line-height:1.7;color:#b8b8cc">Aproveite enquanto o teste está completo:</p>
      <p style="margin:24px 0">${botao("Ver meu painel de risco")}</p>`),
  }),
  urgencia: () => ({
    subject: "Faltam 2 dias do seu teste grátis",
    html: wrap(`<p style="font-size:15px;line-height:1.7;color:#b8b8cc">Seu teste do Cauril termina em <b style="color:#e8e8f2">2 dias</b>. Depois disso, o acesso à análise com IA pausa — mas seus dados continuam salvos.</p>
      <p style="font-size:15px;line-height:1.7;color:#b8b8cc">Assine e continue sem interrupção: <b style="color:#e8e8f2">R$ 24,90/mês</b> ou <b style="color:#00e5a0">R$ 199/ano</b> (2 meses grátis). Cancele quando quiser.</p>
      <p style="margin:24px 0">${botao("Assinar e manter o acesso")}</p>`),
  }),
  ultima_chance: () => ({
    subject: "Último dia do seu teste grátis ⏳",
    html: wrap(`<p style="font-size:15px;line-height:1.7;color:#b8b8cc">Hoje é o <b style="color:#e8e8f2">último dia</b> do seu teste. A partir de amanhã a análise com IA fica pausada até você assinar.</p>
      <p style="font-size:15px;line-height:1.7;color:#b8b8cc">Garanta o acesso por <b style="color:#e8e8f2">R$ 24,90/mês</b> ou <b style="color:#00e5a0">R$ 199/ano</b>. Sem fidelidade.</p>
      <p style="margin:24px 0">${botao("Assinar agora")}</p>`),
  }),
  winback: () => ({
    subject: "Sua carteira continua salva — volte quando quiser",
    html: wrap(`<p style="font-size:15px;line-height:1.7;color:#b8b8cc">Seu teste terminou, mas tudo que você cadastrou continua aqui, intacto. Quando voltar, a IA retoma de onde parou.</p>
      <p style="font-size:15px;line-height:1.7;color:#b8b8cc">Reative por <b style="color:#e8e8f2">R$ 24,90/mês</b> ou <b style="color:#00e5a0">R$ 199/ano</b> — cancele quando quiser.</p>
      <p style="margin:24px 0">${botao("Reativar meu acesso")}</p>`),
  }),
};

export default async function handler(req, res) {
  // Auth
  const auth = req.headers.authorization || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "não autorizado" });
  }

  // Gate: sem SMTP configurado, fica dormente (não envia nada).
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, SUPABASE_SERVICE_ROLE } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return res.status(200).json({ skipped: "SMTP não configurado", enviados: 0 });
  }
  if (!SUPABASE_SERVICE_ROLE) {
    return res.status(200).json({ skipped: "SUPABASE_SERVICE_ROLE ausente", enviados: 0 });
  }

  const from = EMAIL_FROM || SMTP_USER;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465, // 465 = SSL; 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  // 1) Usuários no trial (com email e trial_fim)
  const trials = await supaList(
    "profiles",
    "select=user_id,email,trial_fim&plano=eq.trial&email=not.is.null&trial_fim=not.is.null&limit=" + MAX_POR_RUN,
    SUPABASE_SERVICE_ROLE
  );
  if (!trials.length) return res.status(200).json({ enviados: 0, motivo: "nenhum trial" });

  const agora = Date.now();
  const dia = 86400000;

  // 2) Decide etapa de cada um
  const candidatos = [];
  for (const t of trials) {
    const dias = Math.ceil((new Date(t.trial_fim).getTime() - agora) / dia);
    const etapa = etapaDoDia(dias);
    if (etapa) candidatos.push({ user_id: t.user_id, email: t.email, etapa });
  }
  if (!candidatos.length) return res.status(200).json({ enviados: 0, motivo: "nenhuma etapa hoje" });

  // 3) Remove quem já recebeu aquela etapa
  const ids = [...new Set(candidatos.map(c => c.user_id))];
  const jaEnviados = await supaList(
    "emails_lifecycle",
    `select=user_id,etapa&user_id=in.(${ids.join(",")})`,
    SUPABASE_SERVICE_ROLE
  );
  const enviadoSet = new Set(jaEnviados.map(e => `${e.user_id}:${e.etapa}`));
  const pendentes = candidatos.filter(c => !enviadoSet.has(`${c.user_id}:${c.etapa}`));

  // 4) Envia + registra
  let enviados = 0;
  const registros = [];
  for (const p of pendentes) {
    try {
      const { subject, html } = TEMPLATES[p.etapa]();
      await transporter.sendMail({ from, to: p.email, subject, html });
      registros.push({ user_id: p.user_id, etapa: p.etapa });
      enviados++;
    } catch (e) {
      console.error(`[EMAILS] envio falhou (${p.email}/${p.etapa}):`, e.message);
    }
  }
  await supaInsert("emails_lifecycle", registros, SUPABASE_SERVICE_ROLE);

  return res.status(200).json({ enviados, candidatos: candidatos.length });
}
