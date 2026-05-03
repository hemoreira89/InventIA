import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

const STORAGE_KEY = "inventia_theme";

/**
 * Hook para gerenciar tema claro/escuro
 * Padrão: claro
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || "light"; }
    catch { return "light"; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme]);

  const toggle = () => setTheme(prev => prev === "light" ? "dark" : "light");
  return { theme, toggle, isLight: theme === "light", isDark: theme === "dark" };
}

export function ThemeToggle({ theme, toggle }) {
  return (
    <button
      onClick={toggle}
      title={theme === "light" ? "Mudar para tema escuro" : "Mudar para tema claro"}
      style={{
        background: "var(--ui-bg-secondary)",
        border: "1px solid var(--ui-border)",
        borderRadius: 6,
        padding: "8px 10px",
        color: "var(--ui-text-muted)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {theme === "light" ? <Moon size={14}/> : <Sun size={14}/>}
    </button>
  );
}

/**
 * CSS GLOBAL — variáveis de tema com prefixo --ui-* (não conflita com nada existente).
 *
 * IMPORTANTE: Este sistema só afeta componentes que ATIVAMENTE usam essas variáveis.
 * Componentes com cores hardcoded continuam funcionando como antes (dark mode).
 *
 * Para refatorar uma aba para tema-aware, substitua suas cores hardcoded por:
 *   - background: "var(--ui-bg-card)" no lugar de "#0a0a0f"
 *   - color: "var(--ui-text)" no lugar de "#ffffff"
 *   - border: "1px solid var(--ui-border)" no lugar de "1px solid #252535"
 * etc.
 */
export const THEME_CSS = `
  :root,
  [data-theme="light"] {
    --ui-bg: #f5f6f8;
    --ui-bg-card: #ffffff;
    --ui-bg-card-2: #fafbfc;
    --ui-bg-input: #ffffff;
    --ui-bg-elevated: #ffffff;
    --ui-bg-secondary: #f0f2f5;
    --ui-bg-tertiary: #e8eaed;
    --ui-bg-strong: #cbd5e0;

    /* Texto - escurecido para melhor contraste no light */
    --ui-text: #0f1419;
    --ui-text-secondary: #1a202c;
    --ui-text-muted: #2d3748;
    --ui-text-faint: #4a5568;
    --ui-text-disabled: #718096;

    --ui-border: #d1d5db;
    --ui-border-strong: #9ca3af;
    --ui-border-soft: #e5e7eb;

    /* Accent - mais escuro para contraste no fundo claro */
    --ui-accent: #5b3df5;
    --ui-success: #059669;
    --ui-warning: #d97706;
    --ui-danger: #dc2626;
    --ui-info: #0284c7;

    --ui-shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
    --ui-shadow-md: 0 4px 12px rgba(0,0,0,0.08);

    color-scheme: light;
  }

  [data-theme="dark"] {
    --ui-bg: #000000;
    --ui-bg-card: #0a0a0f;
    --ui-bg-card-2: #0a0a14;
    --ui-bg-input: #000000;
    --ui-bg-elevated: #11111a;
    --ui-bg-secondary: #1a1a25;
    --ui-bg-tertiary: #252535;
    --ui-bg-strong: #3a3a4a;

    --ui-text: #ffffff;
    --ui-text-secondary: #c5c5d0;
    --ui-text-muted: #a8a8b8;
    --ui-text-faint: #7a7a8a;
    --ui-text-disabled: #5a5a6a;

    --ui-border: #252535;
    --ui-border-strong: #3a3a4a;
    --ui-border-soft: #1a1a25;

    --ui-accent: #7b61ff;
    --ui-success: #00e5a0;
    --ui-warning: #ffd60a;
    --ui-danger: #ff4d6d;
    --ui-info: #00b4d8;

    --ui-shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
    --ui-shadow-md: 0 4px 12px rgba(0,0,0,0.4);

    color-scheme: dark;
  }
`;
