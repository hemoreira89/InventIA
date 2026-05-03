import { useState } from "react";
import { Sparkles, Mail, Lock, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { signIn, signUp } from "./supabase";
import { useTheme, ThemeToggle, THEME_CSS } from "./components/ThemeToggle";

export default function Login({ onAuth }) {
  const themeApi = useTheme();
  const [modo, setModo] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucessoSignup, setSucessoSignup] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    if (!email || !senha) {
      setErro("Preencha email e senha");
      return;
    }
    if (senha.length < 6) {
      setErro("Senha precisa ter no mínimo 6 caracteres");
      return;
    }
    setErro("");
    setLoading(true);
    try {
      if (modo === "login") {
        const data = await signIn(email, senha);
        onAuth(data.session);
      } else {
        const data = await signUp(email, senha);
        if (data.session) {
          onAuth(data.session);
        } else {
          // Confirmação por email necessária
          setSucessoSignup(true);
        }
      }
    } catch (e) {
      const msg = e.message || "Erro desconhecido";
      if (msg.includes("Invalid login")) setErro("Email ou senha incorretos");
      else if (msg.includes("already registered")) setErro("Este email já está cadastrado");
      else if (msg.includes("Email not confirmed")) setErro("Confirme seu email antes de entrar");
      else setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--ui-bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      fontFamily: "'Inter', sans-serif",
      color: "var(--ui-text)",
      position: "relative"
    }}>
      {/* Toggle de tema no canto superior direito */}
      <div style={{position: "absolute", top: 20, right: 20, zIndex: 100}}>
        <ThemeToggle theme={themeApi.theme} toggle={themeApi.toggle}/>
      </div>
      <style>{THEME_CSS}</style>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--ui-bg)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .anim{animation:fadeUp .35s ease both}
        .spin{animation:spin .9s linear infinite}
        input,button{outline:none;font-family:inherit}
        input:focus{border-color:var(--ui-accent)!important;box-shadow:0 0 0 3px rgba(123,97,255,0.15)}
      `}</style>

      <div className="anim" style={{
        width: "100%",
        maxWidth: 400,
        background: "var(--ui-bg-card)",
        border: "1px solid var(--ui-border)",
        borderRadius: 16,
        padding: 32
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: "linear-gradient(135deg,#7b61ff,#00e5a0)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--ui-bg)"
          }}>
            <Sparkles size={22} strokeWidth={2.5}/>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>
              InvestIA <span style={{ color: "var(--ui-accent)" }}>Pro</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--ui-text-faint)", fontWeight: 600, letterSpacing: 1.5 }}>
              B3 · BRASIL
            </div>
          </div>
        </div>

        {sucessoSignup ? (
          <>
            <div style={{
              background: "#00e5a015",
              border: "1px solid #00e5a035",
              borderRadius: 10,
              padding: 16,
              marginBottom: 20
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ui-success)", marginBottom: 6 }}>
                ✉️ Verifique seu email!
              </div>
              <div style={{ fontSize: 12, color: "var(--ui-text-muted)", lineHeight: 1.6 }}>
                Enviamos um link de confirmação para <b style={{color:"var(--ui-text)"}}>{email}</b>.
                Clique no link para ativar sua conta e fazer login.
              </div>
            </div>
            <button
              onClick={() => { setSucessoSignup(false); setModo("login"); }}
              style={{
                width: "100%",
                background: "var(--ui-bg-secondary)",
                border: "1px solid var(--ui-border)",
                borderRadius: 8,
                padding: "12px",
                color: "var(--ui-text)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer"
              }}>
              Voltar para o login
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
                {modo === "login" ? "Entrar" : "Criar conta"}
              </h1>
              <p style={{ fontSize: 13, color: "var(--ui-text-muted)" }}>
                {modo === "login"
                  ? "Acesse sua carteira e análises"
                  : "Comece a usar o InvestIA agora"}
              </p>
            </div>

            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: "block", fontSize: 11, color: "var(--ui-text-faint)",
                fontWeight: 700, letterSpacing: 1, marginBottom: 6
              }}>EMAIL</label>
              <div style={{ position: "relative" }}>
                <Mail size={16} style={{
                  position: "absolute", left: 14, top: "50%",
                  transform: "translateY(-50%)", color: "var(--ui-text-faint)"
                }}/>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  style={{
                    width: "100%",
                    background: "var(--ui-bg)",
                    border: "1px solid var(--ui-border)",
                    borderRadius: 8,
                    padding: "12px 14px 12px 42px",
                    fontSize: 14,
                    color: "var(--ui-text)"
                  }}
                />
              </div>
            </div>

            {/* Senha */}
            <div style={{ marginBottom: 18 }}>
              <label style={{
                display: "block", fontSize: 11, color: "var(--ui-text-faint)",
                fontWeight: 700, letterSpacing: 1, marginBottom: 6
              }}>SENHA</label>
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{
                  position: "absolute", left: 14, top: "50%",
                  transform: "translateY(-50%)", color: "var(--ui-text-faint)"
                }}/>
                <input
                  type="password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={modo === "login" ? "current-password" : "new-password"}
                  style={{
                    width: "100%",
                    background: "var(--ui-bg)",
                    border: "1px solid var(--ui-border)",
                    borderRadius: 8,
                    padding: "12px 14px 12px 42px",
                    fontSize: 14,
                    color: "var(--ui-text)"
                  }}
                />
              </div>
              {modo === "signup" && (
                <div style={{ fontSize: 11, color: "var(--ui-text-faint)", marginTop: 6 }}>
                  Mínimo 6 caracteres
                </div>
              )}
            </div>

            {erro && (
              <div style={{
                background: "#ff4d6d10",
                border: "1px solid #ff4d6d30",
                borderRadius: 8,
                padding: "10px 14px",
                color: "var(--ui-danger)",
                fontSize: 12,
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 8
              }}>
                <AlertCircle size={14} strokeWidth={2.2}/>
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                background: loading ? "var(--ui-bg-secondary)" : "linear-gradient(135deg,#7b61ff,#5540dd)",
                border: "none",
                borderRadius: 8,
                padding: "13px",
                color: "var(--ui-text)",
                fontWeight: 700,
                fontSize: 14,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 14px rgba(123,97,255,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginBottom: 16
              }}>
              {loading
                ? <Loader2 size={16} className="spin"/>
                : <>
                    {modo === "login" ? "Entrar" : "Criar conta"}
                    <ArrowRight size={15} strokeWidth={2.5}/>
                  </>}
            </button>

            <div style={{ textAlign: "center", fontSize: 12, color: "var(--ui-text-faint)" }}>
              {modo === "login" ? (
                <>Não tem conta?{" "}
                  <button
                    type="button"
                    onClick={() => { setModo("signup"); setErro(""); }}
                    style={{
                      background: "none", border: "none",
                      color: "var(--ui-accent)", fontWeight: 700, cursor: "pointer", fontSize: 12
                    }}>
                    Criar agora
                  </button>
                </>
              ) : (
                <>Já tem conta?{" "}
                  <button
                    type="button"
                    onClick={() => { setModo("login"); setErro(""); }}
                    style={{
                      background: "none", border: "none",
                      color: "var(--ui-accent)", fontWeight: 700, cursor: "pointer", fontSize: 12
                    }}>
                    Fazer login
                  </button>
                </>
              )}
            </div>
          </form>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 28, paddingTop: 20,
          borderTop: "1px solid var(--ui-border-soft)",
          textAlign: "center", fontSize: 10, color: "var(--ui-text-disabled)"
        }}>
          Powered by <span style={{color:"var(--ui-accent)",fontWeight:700}}>Gemini 2.5 Pro</span> · Análise B3 com IA
        </div>
      </div>
    </div>
  );
}
