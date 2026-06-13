// Tela de planos. Dois modos:
//  - Bloqueio (trial/assinatura expirada): ocupa a tela toda, sem fechar — só
//    assinar ou sair da conta.
//  - Upgrade (onClose presente): mesmo conteúdo como overlay, com botão fechar.
// O checkout abre o link configurado em VITE_CHECKOUT_URL_* (Stripe/MP/etc.);
// sem link, cai no contato por email com o pedido pré-preenchido.

import { useEffect } from "react";
import { Check, Crown, LogOut, X, Sparkles, Clock, ShieldCheck, Lock, RefreshCw } from "lucide-react";
import { PLANOS, BENEFICIOS, CONTATO_EMAIL, TRIAL_DIAS } from "../lib/plano";
import { track } from "../lib/track";

function fmtPreco(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function abrirCheckout(plano, email) {
  track("plan_clicked", { plano: plano.id });
  if (plano.checkoutUrl) {
    window.open(plano.checkoutUrl, "_blank", "noopener");
    return;
  }
  const assunto = encodeURIComponent(`Assinatura InvestIA Pro — plano ${plano.nome}`);
  const corpo = encodeURIComponent(
    `Olá! Quero assinar o plano ${plano.nome} (${fmtPreco(plano.preco)}${plano.periodo}) do InvestIA Pro.\n\nMinha conta: ${email || "(informe o email da sua conta)"}`
  );
  window.location.href = `mailto:${CONTATO_EMAIL}?subject=${assunto}&body=${corpo}`;
}

export default function Paywall({ email, status, onLogout, onClose }) {
  const bloqueio = !onClose;
  useEffect(() => {
    track("paywall_view", { motivo: bloqueio ? "bloqueio" : "overlay" });
  }, [bloqueio]);
  const titulo = bloqueio
    ? (status?.trial ? "Seu teste grátis terminou" : "Sua assinatura expirou")
    : "Assine o InvestIA Pro";
  const subtitulo = bloqueio
    ? "Continue acompanhando sua carteira com IA escolhendo um plano abaixo. Seus dados estão salvos e voltam exatamente como você deixou."
    : `Você está no período de teste${status?.diasRestantes != null ? ` — ${status.diasRestantes} dia${status.diasRestantes === 1 ? "" : "s"} restante${status.diasRestantes === 1 ? "" : "s"}` : ""}. Assine para não perder o acesso.`;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "var(--ui-bg)",
      overflowY: "auto",
      fontFamily: "'Inter', sans-serif",
      color: "var(--ui-text)"
    }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "clamp(24px,6vh,64px) 20px 48px" }}>

        {/* Topo: logo + sair/fechar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/icons/icon-192.png" alt="InvestIA" width={44} height={44}
              style={{ width: 44, height: 44, borderRadius: 10, objectFit: "contain" }}/>
            <div style={{ fontSize: 16, fontWeight: 800 }}>
              InvestIA <span style={{ color: "var(--ui-accent)" }}>Pro</span>
            </div>
          </div>
          {onClose ? (
            <button onClick={onClose} aria-label="Fechar" style={{
              background: "var(--ui-bg-secondary)", border: "1px solid var(--ui-border)",
              borderRadius: 8, padding: "8px 10px", color: "var(--ui-text-secondary)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600
            }}><X size={14}/> Fechar</button>
          ) : (
            <button onClick={onLogout} aria-label="Sair da conta" style={{
              background: "var(--ui-bg-secondary)", border: "1px solid var(--ui-border)",
              borderRadius: 8, padding: "8px 12px", color: "var(--ui-text-muted)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600
            }}><LogOut size={13}/> Sair ({email})</button>
          )}
        </div>

        {/* Headline */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: "rgba(123,97,255,0.1)", border: "1px solid rgba(123,97,255,0.3)",
            borderRadius: 99, padding: "6px 14px", fontSize: 11, fontWeight: 700,
            color: "var(--ui-accent)", letterSpacing: 0.5, marginBottom: 18
          }}>
            {bloqueio ? <Clock size={13}/> : <Sparkles size={13}/>}
            {bloqueio ? "ACESSO PAUSADO" : `TESTE GRÁTIS DE ${TRIAL_DIAS} DIAS`}
          </div>
          <h1 style={{ fontSize: "clamp(24px,4vw,34px)", fontWeight: 900, letterSpacing: -0.5, marginBottom: 12 }}>
            {titulo}
          </h1>
          <p style={{ fontSize: 14, color: "var(--ui-text-muted)", maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
            {subtitulo}
          </p>
        </div>

        {/* Cards de planos */}
        <div style={{
          display: "grid", gap: 16, marginBottom: 32,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          maxWidth: 640, marginLeft: "auto", marginRight: "auto"
        }}>
          {PLANOS.map(p => (
            <div key={p.id} style={{
              background: "var(--ui-bg-card)",
              border: p.destaque ? "2px solid var(--ui-accent)" : "1px solid var(--ui-border)",
              borderRadius: 16, padding: 24, position: "relative",
              boxShadow: p.destaque ? "0 8px 32px rgba(123,97,255,0.18)" : "none"
            }}>
              {p.destaque && (
                <div style={{
                  position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
                  background: "linear-gradient(135deg,#7b61ff,#5540dd)", color: "#fff",
                  fontSize: 10, fontWeight: 800, letterSpacing: 1, borderRadius: 99,
                  padding: "4px 12px", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap"
                }}><Crown size={11}/> MELHOR VALOR</div>
              )}
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1, color: "var(--ui-text-faint)", marginBottom: 10 }}>
                {p.nome.toUpperCase()}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 900, fontFamily: "'JetBrains Mono',monospace" }}>
                  {fmtPreco(p.preco)}
                </span>
                <span style={{ fontSize: 13, color: "var(--ui-text-faint)", fontWeight: 600 }}>{p.periodo}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--ui-text-muted)", marginBottom: 18, minHeight: 18 }}>
                {p.precoMensalEquiv
                  ? <>equivale a <b>{fmtPreco(p.precoMensalEquiv)}/mês</b> · {p.descricao}</>
                  : p.descricao}
              </div>
              <button onClick={() => abrirCheckout(p, email)} style={{
                width: "100%",
                background: p.destaque ? "linear-gradient(135deg,#7b61ff,#5540dd)" : "var(--ui-bg-secondary)",
                border: p.destaque ? "none" : "1px solid var(--ui-border)",
                borderRadius: 10, padding: "13px",
                color: p.destaque ? "#fff" : "var(--ui-text)",
                fontWeight: 800, fontSize: 14, cursor: "pointer",
                boxShadow: p.destaque ? "0 4px 14px rgba(123,97,255,0.35)" : "none"
              }}>
                Assinar {p.nome}
              </button>
              <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: "var(--ui-text-faint)" }}>
                Cancele quando quiser · sem fidelidade
              </div>
            </div>
          ))}
        </div>

        {/* Selos de confiança */}
        <div style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px 22px",
          marginBottom: 28, fontSize: 12, color: "var(--ui-text-muted)"
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Lock size={13} color="var(--ui-success)"/> Pagamento seguro</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><RefreshCw size={13} color="var(--ui-success)"/> Cancele quando quiser</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><ShieldCheck size={13} color="var(--ui-success)"/> Seus dados protegidos (LGPD)</span>
        </div>

        {/* Benefícios */}
        <div style={{
          background: "var(--ui-bg-card)", border: "1px solid var(--ui-border)",
          borderRadius: 14, padding: "20px 24px", maxWidth: 640, margin: "0 auto"
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: "var(--ui-text-faint)", marginBottom: 14 }}>
            TUDO INCLUSO EM QUALQUER PLANO
          </div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
            {BENEFICIOS.map(b => (
              <div key={b} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--ui-text-secondary)", lineHeight: 1.5 }}>
                <Check size={14} color="var(--ui-success)" strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }}/>
                {b}
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "var(--ui-text-disabled)", lineHeight: 1.7 }}>
          Pagamento seguro · Ativação em até algumas horas · Dúvidas: <a href={`mailto:${CONTATO_EMAIL}`} style={{ color: "var(--ui-accent)", fontWeight: 600 }}>{CONTATO_EMAIL}</a>
        </div>
      </div>
    </div>
  );
}
