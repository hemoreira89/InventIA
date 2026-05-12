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
    --ui-bg: #f0ebe0;
    --ui-bg-card: #faf7f2;
    --ui-bg-card-2: #f4efe6;
    --ui-bg-input: #faf7f2;
    --ui-bg-elevated: #ffffff;
    --ui-bg-secondary: #ece6d9;
    --ui-bg-tertiary: #dfd8ca;
    --ui-bg-strong: #c6bbaa;

    --ui-text: #0d0a06;
    --ui-text-secondary: #2a2018;
    --ui-text-muted: #5a4e3a;
    --ui-text-faint: #7a6a54;
    --ui-text-disabled: #9a8870;

    --ui-border: #d3c8b4;
    --ui-border-strong: #b5a890;
    --ui-border-soft: #e6dfd2;
    --ui-border-accent: rgba(168,112,32,0.3);

    --ui-accent: #a87020;
    --ui-accent-subtle: rgba(168,112,32,0.12);
    --ui-success: #16803c;
    --ui-warning: #b45309;
    --ui-danger: #dc2626;
    --ui-info: #0369a1;

    --ui-focus-ring: rgba(168,112,32,0.22);
    --ui-shadow-sm: 0 1px 3px rgba(0,0,0,0.07);
    --ui-shadow-md: 0 4px 16px rgba(0,0,0,0.11);

    color-scheme: light;
  }

  [data-theme="dark"] {
    --ui-bg: #06090f;
    --ui-bg-card: #0b1018;
    --ui-bg-card-2: #0f1520;
    --ui-bg-input: #07090e;
    --ui-bg-elevated: #121a26;
    --ui-bg-secondary: #141d2b;
    --ui-bg-tertiary: #1c2a3c;
    --ui-bg-strong: #283a50;

    --ui-text: #e6dcc8;
    --ui-text-secondary: #b8a890;
    --ui-text-muted: #7a6e5c;
    --ui-text-faint: #524838;
    --ui-text-disabled: #3c3428;

    --ui-border: #1a2636;
    --ui-border-strong: #253548;
    --ui-border-soft: #101820;
    --ui-border-accent: rgba(201,144,56,0.35);

    --ui-accent: #c99038;
    --ui-accent-subtle: rgba(201,144,56,0.13);
    --ui-success: #22c55e;
    --ui-warning: #f59e0b;
    --ui-danger: #f05050;
    --ui-info: #38bdf8;

    --ui-focus-ring: rgba(201,144,56,0.22);
    --ui-shadow-sm: 0 1px 4px rgba(0,0,0,0.45);
    --ui-shadow-md: 0 4px 20px rgba(0,0,0,0.58);

    color-scheme: dark;
  }

  html, body {
    font-family: 'DM Sans', sans-serif;
  }
`;
