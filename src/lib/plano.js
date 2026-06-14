// Planos e teste grátis — lógica pura (testada) + acesso ao perfil no Supabase.
//
// Modelo: todo cadastro novo nasce com plano='trial' e trial_fim = signup + 7 dias
// (definido no banco, via trigger). Quando o trial expira, o app bloqueia com a
// tela de planos (Paywall). A ativação de um plano pago é feita no banco
// (plano='mensal'|'anual' + plano_expira_em) — manualmente ou por webhook de
// pagamento no futuro. 'vitalicio' nunca expira.

import { supabase } from "../supabase";
import { BRAND } from "./brand";

export const TRIAL_DIAS = 7;

// Links de checkout configuráveis sem mexer no código (Vercel → env vars).
// Ex.: link de pagamento do Stripe, Mercado Pago, Kiwify etc.
// Sem link configurado, o botão cai no contato por email.
const CHECKOUT_MENSAL = import.meta.env?.VITE_CHECKOUT_URL_MENSAL || "";
const CHECKOUT_ANUAL = import.meta.env?.VITE_CHECKOUT_URL_ANUAL || "";
export const CONTATO_EMAIL = import.meta.env?.VITE_CONTATO_EMAIL || "hemoreira89@gmail.com";

export const PLANOS = [
  {
    id: "mensal",
    nome: "Mensal",
    preco: 24.9,
    periodo: "/mês",
    descricao: "Acesso completo, cancele quando quiser",
    checkoutUrl: CHECKOUT_MENSAL,
    destaque: false,
  },
  {
    id: "anual",
    nome: "Anual",
    preco: 199,
    periodo: "/ano",
    precoMensalEquiv: 199 / 12,
    descricao: "2 meses grátis vs. o plano mensal",
    checkoutUrl: CHECKOUT_ANUAL,
    destaque: true,
  },
];

export const BENEFICIOS = [
  "Análise da carteira completa com IA (Gemini)",
  "Análise individual de qualquer ticker da B3",
  "Explorador de ativos e comparador",
  "Cotações em tempo real e evolução do patrimônio",
  "Dashboard de risco, rebalanceamento e renda passiva",
  "Calculadora de IR, proventos, watchlist e alertas",
];

/**
 * Calcula a situação de acesso a partir da linha de `profiles`.
 * Pura (recebe `agora` para testes). Retorna sempre o mesmo shape:
 *   { plano, ativo, trial, expirado, diasRestantes, trialFim }
 *
 * Perfil ausente (conta criada antes da migração, ou trigger atrasado):
 * fail-open — trata como trial cheio para nunca trancar usuário por bug nosso.
 */
export function statusPlano(perfil, agora = new Date()) {
  if (!perfil) {
    return { plano: "trial", ativo: true, trial: true, expirado: false, diasRestantes: TRIAL_DIAS, trialFim: null };
  }

  if (perfil.plano === "vitalicio") {
    return { plano: "vitalicio", ativo: true, trial: false, expirado: false, diasRestantes: null, trialFim: null };
  }

  if (perfil.plano === "mensal" || perfil.plano === "anual") {
    const exp = perfil.plano_expira_em ? new Date(perfil.plano_expira_em) : null;
    const ativo = !exp || exp > agora;
    const diasRestantes = exp ? Math.max(0, Math.ceil((exp - agora) / 86400000)) : null;
    return { plano: perfil.plano, ativo, trial: false, expirado: !ativo, diasRestantes, trialFim: null };
  }

  // trial (ou valor desconhecido — trata como trial pela trial_fim)
  const fim = perfil.trial_fim ? new Date(perfil.trial_fim) : null;
  if (!fim || isNaN(fim)) {
    return { plano: "trial", ativo: true, trial: true, expirado: false, diasRestantes: TRIAL_DIAS, trialFim: null };
  }
  const msRestantes = fim - agora;
  const diasRestantes = Math.max(0, Math.ceil(msRestantes / 86400000));
  return {
    plano: "trial",
    ativo: msRestantes > 0,
    trial: true,
    expirado: msRestantes <= 0,
    diasRestantes,
    trialFim: fim,
  };
}

/**
 * Carrega o perfil de plano do usuário no Supabase.
 * Nunca lança: em erro de rede/RLS retorna null (statusPlano(null) = fail-open).
 */
export async function carregarPerfilPlano(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("plano, trial_fim, plano_expira_em")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("[plano] erro ao carregar perfil:", error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.warn("[plano] exceção ao carregar perfil:", e?.message);
    return null;
  }
}

/**
 * Inicia o checkout de um plano. Ordem de tentativa:
 *   1. Link estático configurado (VITE_CHECKOUT_URL_*), se houver.
 *   2. Mercado Pago (Checkout Pro) via /api/mp-criar-pagamento — auto-ativa o
 *      plano por webhook após o pagamento.
 *   3. Fallback: contato por email (enquanto pagamento não está configurado).
 */
export async function iniciarCheckout(plano, email) {
  if (plano.checkoutUrl) {
    window.open(plano.checkoutUrl, "_blank", "noopener");
    return;
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/mp-criar-pagamento", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ plano: plano.id }),
    });
    if (r.ok) {
      const { init_point } = await r.json();
      if (init_point) { window.location.href = init_point; return; }
    }
  } catch (e) {
    console.warn("[plano] checkout MP indisponível, usando fallback:", e?.message);
  }
  // Fallback: email com o pedido pré-preenchido.
  const assunto = encodeURIComponent(`Assinatura ${BRAND.full} — plano ${plano.nome}`);
  const corpo = encodeURIComponent(
    `Olá! Quero assinar o plano ${plano.nome} do ${BRAND.full}.\n\nMinha conta: ${email || "(informe o email da sua conta)"}`
  );
  window.location.href = `mailto:${CONTATO_EMAIL}?subject=${assunto}&body=${corpo}`;
}
