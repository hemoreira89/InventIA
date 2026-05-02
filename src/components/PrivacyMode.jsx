import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";

const STORAGE_KEY = "inventia_privacy_mode";

/**
 * Hook para modo apresentação - esconde valores monetários
 */
export function usePrivacyMode() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch { return false; }
  });

  const toggle = () => {
    setHidden(prev => {
      const novo = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(novo)); } catch {}
      return novo;
    });
  };

  // Mascara valor: R$ 1.234,56 → R$ ●●●●●
  const masked = (valor, replacement = "●●●●") => {
    if (!hidden) return valor;
    if (typeof valor === "string") {
      // Mantém prefixos como "R$" e "%"
      return valor.replace(/[\d.,]+/g, replacement);
    }
    return replacement;
  };

  return { hidden, toggle, masked };
}

/**
 * Botão de toggle do modo apresentação
 */
export function PrivacyToggle({ hidden, toggle, size = 14 }) {
  return (
    <button
      onClick={toggle}
      title={hidden ? "Mostrar valores" : "Esconder valores (modo apresentação)"}
      style={{
        background: hidden ? "#7b61ff20" : "#0a0a0f",
        border: `1px solid ${hidden ? "#7b61ff50" : "#252535"}`,
        borderRadius: 6,
        padding: "8px 10px",
        color: hidden ? "#7b61ff" : "#9090a0",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all .15s"
      }}
    >
      {hidden ? <EyeOff size={size}/> : <Eye size={size}/>}
    </button>
  );
}
