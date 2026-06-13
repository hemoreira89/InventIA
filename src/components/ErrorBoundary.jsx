import { Component } from "react";

/**
 * Error Boundary global. Captura erros de renderização em qualquer aba e
 * mostra uma tela de recuperação em vez de deixar o app em tela branca.
 *
 * Boundaries precisam ser class components (não há equivalente em hooks).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    // Visível nos logs do browser (e em ferramentas de monitoramento, se houver).
    console.error("[ErrorBoundary] Crash capturado:", erro, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ erro: null });
  };

  render() {
    if (!this.state.erro) return this.props.children;

    // Modo compacto (por aba): fallback inline, preserva header/nav do app.
    if (this.props.compact) {
      return (
        <div style={{
          background: "var(--ui-bg-card)", border: "1px solid var(--ui-border)",
          borderRadius: 14, padding: "32px 24px", textAlign: "center", margin: "8px 0",
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ui-text)", marginBottom: 6 }}>
            Esta tela teve um problema
          </div>
          <div style={{ fontSize: 13, color: "var(--ui-text-muted)", lineHeight: 1.6, maxWidth: 380, margin: "0 auto 18px" }}>
            Seus dados estão salvos. Tente de novo ou abra outra aba pelo menu.
          </div>
          <button
            onClick={this.handleReset}
            style={{
              background: "var(--ui-accent, #7b61ff)", color: "#fff", border: "none", borderRadius: 9,
              padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
            Tentar de novo
          </button>
        </div>
      );
    }

    // Lê o tema direto do localStorage — o app pode não ter montado o provider.
    let isLight = true;
    try {
      isLight = localStorage.getItem("inventia_theme") !== "dark";
    } catch {
      isLight = true;
    }
    const bg = isLight ? "#f5f6f8" : "#000000";
    const card = isLight ? "#ffffff" : "#0d0d14";
    const border = isLight ? "#e5e7eb" : "#1a1a25";
    const text = isLight ? "#111827" : "#f5f6f8";
    const muted = isLight ? "#6b7280" : "#8b8b9a";

    return (
      <div style={{
        minHeight: "100vh", background: bg, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 24,
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}>
        <div style={{
          background: card, border: `1px solid ${border}`, borderRadius: 16,
          padding: "32px 28px", maxWidth: 440, width: "100%", textAlign: "center",
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: text, margin: "0 0 8px" }}>
            Algo deu errado
          </h1>
          <p style={{ fontSize: 14, color: muted, lineHeight: 1.5, margin: "0 0 22px" }}>
            Ocorreu um erro inesperado nesta tela. Seus dados estão salvos —
            tente recarregar. Se persistir, volte mais tarde.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#7b61ff", color: "#fff", border: "none", borderRadius: 9,
                padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}>
              Recarregar página
            </button>
            <button
              onClick={this.handleReset}
              style={{
                background: "transparent", color: text, border: `1px solid ${border}`,
                borderRadius: 9, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>
              Tentar de novo
            </button>
          </div>
          {this.state.erro?.message && (
            <p style={{ fontSize: 11, color: muted, marginTop: 18, wordBreak: "break-word", fontFamily: "monospace" }}>
              {String(this.state.erro.message).slice(0, 200)}
            </p>
          )}
        </div>
      </div>
    );
  }
}
