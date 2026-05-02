import { Loader2, CheckCircle2, Circle } from "lucide-react";

/**
 * LoadingSteps - mostra etapas de uma operação longa com progresso visual
 * Substitui o "Carregando..." genérico
 */
export default function LoadingSteps({ steps, currentStep = 0, accent = "#7b61ff" }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 10,
      padding: "20px 24px",
      background: "#0a0a0f",
      border: `1px solid ${accent}30`,
      borderRadius: 12,
      maxWidth: 480,
      margin: "0 auto",
      boxShadow: `0 0 40px ${accent}15`
    }}>
      {steps.map((step, i) => {
        const isDone = i < currentStep;
        const isActive = i === currentStep;
        const isPending = i > currentStep;

        return (
          <div
            key={i}
            className={isActive ? "anim" : ""}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              opacity: isPending ? 0.4 : 1,
              transition: "opacity .3s ease"
            }}
          >
            {/* Ícone do step */}
            <div style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isDone && <CheckCircle2 size={20} color="#00e5a0" strokeWidth={2.2}/>}
              {isActive && <Loader2 size={20} className="spin" color={accent} strokeWidth={2.2}/>}
              {isPending && <Circle size={18} color="#3a3a4a" strokeWidth={1.5}/>}
            </div>

            {/* Texto */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isDone ? "#00e5a0" : isActive ? "#ffffff" : "#7a7a8a",
                transition: "color .3s ease"
              }}>{step.label}</div>
              {step.detail && isActive && (
                <div style={{ fontSize: 11, color: "#7a7a8a", marginTop: 2 }}>
                  {step.detail}
                </div>
              )}
            </div>

            {/* Step badge */}
            <div style={{
              fontSize: 10,
              color: "#5a5a6a",
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700
            }}>
              {(i + 1).toString().padStart(2, '0')}/{steps.length.toString().padStart(2, '0')}
            </div>
          </div>
        );
      })}

      {/* Barra de progresso geral */}
      <div style={{
        marginTop: 8,
        height: 3,
        background: "#1a1a25",
        borderRadius: 2,
        overflow: "hidden"
      }}>
        <div style={{
          height: "100%",
          width: `${(currentStep / steps.length) * 100}%`,
          background: `linear-gradient(90deg, ${accent}, #00e5a0)`,
          borderRadius: 2,
          transition: "width .4s cubic-bezier(0.4, 0, 0.2, 1)"
        }}/>
      </div>
    </div>
  );
}
