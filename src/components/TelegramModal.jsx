import { useState, useEffect } from "react";
import { X, Copy, CheckCircle2, ExternalLink, MessageCircle, Loader2 } from "lucide-react";
import { supabase } from "../supabase.js";

export default function TelegramModal({ open, onClose, userId }) {
  const [status, setStatus] = useState("loading"); // loading | linked | unlinked | generating | code
  const [code, setCode] = useState(null);
  const [botUrl, setBotUrl] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [copied, setCopied] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setStatus("loading");
    setCode(null);
    supabase
      .from("telegram_links")
      .select("chat_id")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setStatus(data?.chat_id ? "linked" : "unlinked"));
  }, [open, userId]);

  async function gerarCodigo() {
    setStatus("generating");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/telegram-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      if (!res.ok) throw new Error("Falha ao gerar código");
      const data = await res.json();
      setCode(data.code);
      setBotUrl(data.botUrl);
      setExpiresAt(new Date(data.expiresAt));
      setStatus("code");
    } catch {
      setStatus("unlinked");
      alert("Erro ao gerar código. Tente novamente.");
    }
  }

  async function desvincular() {
    if (!confirm("Deseja desvincular sua conta do Telegram?")) return;
    setUnlinking(true);
    await supabase.from("telegram_links").delete().eq("user_id", userId);
    setUnlinking(false);
    setStatus("unlinked");
  }

  function copiar() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        zIndex: 10000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--ui-bg-card)",
          border: "1px solid var(--ui-border)",
          borderRadius: 16,
          padding: 28,
          width: "100%", maxWidth: 440,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)"
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, #229ED9 0%, #007AB8 100%)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <MessageCircle size={20} color="#fff" fill="#fff" strokeWidth={0}/>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ui-text)" }}>Vincular Telegram</div>
            <div style={{ fontSize: 11, color: "var(--ui-text-muted)" }}>Consulte sua carteira pelo celular</div>
          </div>
          <button
            onClick={onClose}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--ui-text-faint)", padding: 4 }}
          >
            <X size={18}/>
          </button>
        </div>

        {/* Loading */}
        {(status === "loading" || status === "generating") && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--ui-text-muted)", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }}/>
            {status === "loading" ? "Verificando status..." : "Gerando código..."}
          </div>
        )}

        {/* Vinculado */}
        {status === "linked" && (
          <div>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(0,200,83,0.08)",
              border: "1px solid rgba(0,200,83,0.25)",
              borderRadius: 10, padding: "14px 16px", marginBottom: 20
            }}>
              <CheckCircle2 size={18} color="var(--ui-success)" style={{ flexShrink: 0 }}/>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ui-success)" }}>Conta vinculada</div>
                <div style={{ fontSize: 11, color: "var(--ui-text-muted)", marginTop: 2 }}>
                  Converse com o bot em linguagem natural
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {[
                "Como está minha carteira hoje?",
                "Vale a pena comprar mais MXRF11?",
                "Quando vou receber dividendos?"
              ].map(ex => (
                <div key={ex} style={{
                  background: "var(--ui-bg-secondary)",
                  borderRadius: 8, padding: "9px 12px",
                  fontSize: 12, color: "var(--ui-text-secondary)", fontStyle: "italic"
                }}>"{ex}"</div>
              ))}
            </div>
            <button
              onClick={desvincular}
              disabled={unlinking}
              style={{
                width: "100%", padding: "10px",
                background: "transparent",
                border: "1px solid var(--ui-danger)",
                borderRadius: 8, color: "var(--ui-danger)",
                cursor: "pointer", fontSize: 13, fontWeight: 600
              }}
            >
              {unlinking ? "Desvinculando..." : "Desvincular conta"}
            </button>
          </div>
        )}

        {/* Não vinculado */}
        {status === "unlinked" && (
          <div>
            <p style={{ fontSize: 13, color: "var(--ui-text-secondary)", lineHeight: 1.7, marginBottom: 24 }}>
              Vincule sua conta para consultar sua carteira em linguagem natural direto pelo Telegram — sem precisar abrir o app.
            </p>
            <button
              onClick={gerarCodigo}
              style={{
                width: "100%", padding: "13px",
                background: "linear-gradient(135deg, #229ED9 0%, #007AB8 100%)",
                border: "none", borderRadius: 10,
                color: "#fff", fontWeight: 700, fontSize: 14,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8
              }}
            >
              <MessageCircle size={16} fill="#fff" strokeWidth={0}/>
              Gerar código de vínculo
            </button>
          </div>
        )}

        {/* Código gerado */}
        {status === "code" && code && (
          <div>
            <p style={{ fontSize: 13, color: "var(--ui-text-secondary)", lineHeight: 1.7, marginBottom: 16 }}>
              Abra o bot no Telegram e envie o código abaixo. Expira em <strong>10 minutos</strong>.
            </p>
            <div style={{
              background: "var(--ui-bg-secondary)",
              border: "2px dashed var(--ui-accent)",
              borderRadius: 12, padding: "22px 20px",
              textAlign: "center", marginBottom: 14
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 30, fontWeight: 700,
                color: "var(--ui-accent)", letterSpacing: 4
              }}>{code}</div>
              {expiresAt && (
                <div style={{ fontSize: 10, color: "var(--ui-text-disabled)", marginTop: 6 }}>
                  Expira às {expiresAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <button
                onClick={copiar}
                style={{
                  flex: 1, padding: "10px",
                  background: copied ? "rgba(0,200,83,0.1)" : "var(--ui-bg-secondary)",
                  border: `1px solid ${copied ? "var(--ui-success)" : "var(--ui-border)"}`,
                  borderRadius: 8, cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                  color: copied ? "var(--ui-success)" : "var(--ui-text-secondary)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all .2s"
                }}
              >
                {copied ? <><CheckCircle2 size={14}/> Copiado!</> : <><Copy size={14}/> Copiar código</>}
              </button>
              <a
                href={botUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1, padding: "10px",
                  background: "linear-gradient(135deg, #229ED9 0%, #007AB8 100%)",
                  borderRadius: 8, textDecoration: "none",
                  fontSize: 13, fontWeight: 600, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                }}
              >
                <ExternalLink size={14}/> Abrir bot
              </a>
            </div>
            <p style={{ fontSize: 11, color: "var(--ui-text-disabled)", textAlign: "center", margin: 0 }}>
              Após vincular, feche e reabra este painel para ver o status.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
