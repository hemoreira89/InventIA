import { ArrowRight } from "lucide-react";

/**
 * EmptyState - Componente reutilizável para estados vazios bonitos
 * Substitui o "tristão" por algo convidativo com ilustração SVG e CTA
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  onCta,
  examples,
  onExampleClick,
  iconColor = "#7b61ff",
  variant = "default" // "default" | "primary" | "minimal"
}) {

  return (
    <div className="anim" style={{
      background: variant === "primary" ? "#0a0a0f" : "#0a0a0f",
      border: `1px ${variant === "primary" ? "solid" : "dashed"} ${variant === "primary" ? "#252535" : "#252535"}`,
      borderRadius: 14,
      padding: "48px 24px",
      textAlign: "center",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Glow decorativo de fundo */}
      <div style={{
        position: "absolute",
        top: "-100px",
        left: "50%",
        transform: "translateX(-50%)",
        width: 300,
        height: 300,
        background: `radial-gradient(circle, ${iconColor}15 0%, transparent 70%)`,
        pointerEvents: "none"
      }}/>

      {/* Ícone com glow */}
      <div style={{
        width: 80,
        height: 80,
        borderRadius: 20,
        background: `${iconColor}10`,
        border: `1px solid ${iconColor}30`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 20px",
        position: "relative",
        boxShadow: `0 0 40px ${iconColor}20`
      }}>
        {Icon && <Icon size={36} color={iconColor} strokeWidth={1.5}/>}
      </div>

      {/* Título */}
      {title && (
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#ffffff",
          marginBottom: 8,
          position: "relative"
        }}>{title}</div>
      )}

      {/* Descrição */}
      {description && (
        <div style={{
          fontSize: 13,
          color: "#a8a8b8",
          lineHeight: 1.6,
          maxWidth: 420,
          margin: "0 auto",
          position: "relative"
        }}>{description}</div>
      )}

      {/* CTA principal */}
      {cta && (
        <button onClick={onCta} className="empty-cta" style={{
          marginTop: 22,
          background: `linear-gradient(135deg, ${iconColor}, ${iconColor}cc)`,
          border: "none",
          borderRadius: 10,
          padding: "12px 24px",
          color: "#ffffff",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          boxShadow: `0 8px 24px ${iconColor}30`,
          position: "relative",
          transition: "transform .15s ease, box-shadow .15s ease"
        }}>
          {cta}
          <ArrowRight size={15} strokeWidth={2.5}/>
        </button>
      )}

      {/* Exemplos clicáveis */}
      {examples?.length > 0 && (
        <div style={{
          marginTop: 24,
          paddingTop: 20,
          borderTop: "1px solid #1a1a25",
          maxWidth: 480,
          margin: "24px auto 0",
          position: "relative"
        }}>
          <div style={{
            fontSize: 10,
            color: "#5a5a6a",
            fontWeight: 700,
            letterSpacing: 1.5,
            marginBottom: 10
          }}>EXPERIMENTE COM</div>
          <div style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            flexWrap: "wrap"
          }}>
            {examples.map((ex, i) => (
              <button
                key={i}
                onClick={() => onExampleClick?.(ex)}
                style={{
                  background: "#1a1a25",
                  border: "1px solid #252535",
                  borderRadius: 6,
                  padding: "6px 12px",
                  color: "#c5c5d0",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: 0.5,
                  transition: "all .15s ease"
                }}
                onMouseEnter={e => {
                  e.target.style.background = `${iconColor}20`;
                  e.target.style.borderColor = `${iconColor}50`;
                  e.target.style.color = iconColor;
                }}
                onMouseLeave={e => {
                  e.target.style.background = "#1a1a25";
                  e.target.style.borderColor = "#252535";
                  e.target.style.color = "#c5c5d0";
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .empty-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px ${iconColor}45;
        }
      `}</style>
    </div>
  );
}
