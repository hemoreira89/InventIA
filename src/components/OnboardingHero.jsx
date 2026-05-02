import { Sparkles, ArrowRight, Briefcase, FileSearch, Lightbulb, Brain, X } from "lucide-react";

/**
 * OnboardingHero - Tela de boas-vindas para usuários sem carteira
 * Mostra o que o app pode fazer e oferece atalhos para começar
 */
export default function OnboardingHero({ onAddAtivo, onAnalyzeMercado, onImportCSV, onClose }) {
  return (
    <div className="anim" style={{
      background: "linear-gradient(135deg, #0a0a0f 0%, #11111a 100%)",
      border: "1px solid #252535",
      borderRadius: 16,
      padding: "40px 32px",
      position: "relative",
      overflow: "hidden",
      marginBottom: 16
    }}>
      {/* Glow decorativo */}
      <div style={{
        position: "absolute",
        top: "-200px",
        right: "-100px",
        width: 500,
        height: 500,
        background: "radial-gradient(circle, #7b61ff15 0%, transparent 60%)",
        pointerEvents: "none"
      }}/>
      <div style={{
        position: "absolute",
        bottom: "-150px",
        left: "-50px",
        width: 400,
        height: 400,
        background: "radial-gradient(circle, #00e5a012 0%, transparent 60%)",
        pointerEvents: "none"
      }}/>

      {/* Botão fechar */}
      {onClose && (
        <button onClick={onClose} title="Esconder boas-vindas" style={{
          position: "absolute",
          top: 14,
          right: 14,
          background: "transparent",
          border: "none",
          color: "#5a5a6a",
          cursor: "pointer",
          padding: 6,
          borderRadius: 6,
          display: "flex",
          alignItems: "center"
        }}><X size={16}/></button>
      )}

      <div style={{ position: "relative", maxWidth: 800, margin: "0 auto" }}>
        {/* Badge */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "#7b61ff15",
          border: "1px solid #7b61ff35",
          borderRadius: 30,
          padding: "5px 14px",
          marginBottom: 18
        }}>
          <Sparkles size={13} color="#7b61ff"/>
          <span style={{
            fontSize: 11,
            color: "#7b61ff",
            fontWeight: 700,
            letterSpacing: 1.5
          }}>BEM-VINDO AO INVESTIA PRO</span>
        </div>

        {/* Título */}
        <h1 style={{
          fontSize: 32,
          fontWeight: 800,
          color: "#ffffff",
          marginBottom: 12,
          lineHeight: 1.2,
          letterSpacing: -0.5
        }}>
          Análise da B3 com{" "}
          <span style={{
            background: "linear-gradient(135deg, #7b61ff, #00e5a0)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>IA em tempo real</span>
        </h1>

        {/* Subtítulo */}
        <p style={{
          fontSize: 15,
          color: "#a8a8b8",
          lineHeight: 1.6,
          marginBottom: 28,
          maxWidth: 600
        }}>
          Recomendações personalizadas, análise fundamentalista e controle de carteira
          alimentado por <b style={{color: "#fff"}}>Gemini 2.5 Pro</b> + Google Search.
        </p>

        {/* CTAs em grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 24
        }}>
          <button onClick={onAddAtivo} className="cta-card" style={{
            background: "#0a0a14",
            border: "1px solid #252535",
            borderRadius: 12,
            padding: "18px 16px",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            transition: "all .2s ease"
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "#7b61ff20",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0
            }}>
              <Briefcase size={18} color="#7b61ff" strokeWidth={2}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 3 }}>
                Adicionar ativo
              </div>
              <div style={{ fontSize: 11, color: "#7a7a8a", lineHeight: 1.4 }}>
                Registre suas compras manualmente
              </div>
            </div>
            <ArrowRight size={14} color="#5a5a6a"/>
          </button>

          <button onClick={onImportCSV} className="cta-card" style={{
            background: "#0a0a14",
            border: "1px solid #252535",
            borderRadius: 12,
            padding: "18px 16px",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            transition: "all .2s ease"
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "#00e5a020",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0
            }}>
              <FileSearch size={18} color="#00e5a0" strokeWidth={2}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 3 }}>
                Importar CSV
              </div>
              <div style={{ fontSize: 11, color: "#7a7a8a", lineHeight: 1.4 }}>
                Suba sua carteira já existente
              </div>
            </div>
            <ArrowRight size={14} color="#5a5a6a"/>
          </button>

          <button onClick={onAnalyzeMercado} className="cta-card" style={{
            background: "#0a0a14",
            border: "1px solid #252535",
            borderRadius: 12,
            padding: "18px 16px",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            transition: "all .2s ease"
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "#ffd60a20",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0
            }}>
              <Brain size={18} color="#ffd60a" strokeWidth={2}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 3 }}>
                Ver oportunidades
              </div>
              <div style={{ fontSize: 11, color: "#7a7a8a", lineHeight: 1.4 }}>
                IA analisa o mercado para você
              </div>
            </div>
            <ArrowRight size={14} color="#5a5a6a"/>
          </button>
        </div>

        {/* Hint do command palette */}
        <div style={{
          background: "#0a0a14",
          border: "1px solid #1a1a25",
          borderRadius: 8,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 12,
          color: "#7a7a8a"
        }}>
          <Lightbulb size={14} color="#ffd60a"/>
          <span>Dica: aperte</span>
          <kbd style={{
            background: "#1a1a25",
            border: "1px solid #252535",
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 11,
            color: "#c5c5d0",
            fontFamily: "'JetBrains Mono', monospace"
          }}>Ctrl + K</kbd>
          <span>a qualquer momento para busca rápida (ex: digite "PETR4" e analise direto)</span>
        </div>
      </div>

      <style>{`
        .cta-card:hover {
          background: #11111a !important;
          border-color: #3a3a4a !important;
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
