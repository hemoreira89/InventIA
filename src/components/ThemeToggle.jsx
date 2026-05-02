import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

const STORAGE_KEY = "inventia_theme";

/**
 * Hook para gerenciar tema claro/escuro
 * Padrão: claro (light)
 * Persiste no localStorage
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "light";
    } catch {
      return "light";
    }
  });

  // Aplica o tema no <html> via data-theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme]);

  const toggle = () => setTheme(prev => prev === "light" ? "dark" : "light");

  return { theme, toggle, isLight: theme === "light", isDark: theme === "dark" };
}

/**
 * Botão de toggle do tema
 */
export function ThemeToggle({ theme, toggle }) {
  return (
    <button
      onClick={toggle}
      title={theme === "light" ? "Mudar para tema escuro" : "Mudar para tema claro"}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "8px 10px",
        color: "var(--text-secondary)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all .2s"
      }}
    >
      {theme === "light" ? <Moon size={14}/> : <Sun size={14}/>}
    </button>
  );
}

/**
 * CSS variables para os 2 temas
 * Injetar isso no <head> do app
 */
export const THEME_CSS = `
  /* Tema CLARO (padrão) */
  :root,
  [data-theme="light"] {
    --bg: #f5f6f8;
    --bg-card: #ffffff;
    --bg-card-hover: #fafbfc;
    --bg-input: #ffffff;
    --bg-elevated: #ffffff;
    --bg-secondary: #f0f2f5;
    --bg-strong: #e8eaed;

    --text: #0f1419;
    --text-secondary: #4a5568;
    --text-muted: #6b7280;
    --text-faint: #9ca3af;

    --border: #e5e7eb;
    --border-strong: #d1d5db;
    --border-soft: #f0f2f5;

    --accent-primary: #5b3df5;
    --accent-success: #00a878;
    --accent-warning: #d97706;
    --accent-danger: #dc2626;
    --accent-info: #0284c7;

    --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.06);
    --shadow-lg: 0 10px 30px rgba(0,0,0,0.08);

    --topbar-bg: #ffffff;
    --tab-active: #ffffff;

    color-scheme: light;
  }

  /* Tema ESCURO */
  [data-theme="dark"] {
    --bg: #000000;
    --bg-card: #0a0a0f;
    --bg-card-hover: #11111a;
    --bg-input: #000000;
    --bg-elevated: #11111a;
    --bg-secondary: #1a1a25;
    --bg-strong: #252535;

    --text: #ffffff;
    --text-secondary: #c5c5d0;
    --text-muted: #9090a0;
    --text-faint: #6a6a7a;

    --border: #252535;
    --border-strong: #3a3a4a;
    --border-soft: #1a1a25;

    --accent-primary: #7b61ff;
    --accent-success: #00e5a0;
    --accent-warning: #ffd60a;
    --accent-danger: #ff4d6d;
    --accent-info: #00b4d8;

    --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
    --shadow-lg: 0 10px 30px rgba(0,0,0,0.5);

    --topbar-bg: #050507;
    --tab-active: #0a0a0f;

    color-scheme: dark;
  }

  /* Background do body acompanha o tema */
  body {
    background: var(--bg) !important;
    color: var(--text) !important;
    transition: background .2s ease, color .2s ease;
  }

  /* Inputs respondem ao tema */
  input, select, textarea {
    background: var(--bg-input) !important;
    color: var(--text) !important;
    border-color: var(--border) !important;
  }

  input::placeholder, textarea::placeholder {
    color: var(--text-faint) !important;
  }

  /* Scrollbar no light mode */
  [data-theme="light"] ::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }
  [data-theme="light"] ::-webkit-scrollbar-track {
    background: #f0f2f5;
  }
  [data-theme="light"] ::-webkit-scrollbar-thumb {
    background: #cbd5e0;
    border-radius: 6px;
    border: 2px solid #f0f2f5;
  }
  [data-theme="light"] ::-webkit-scrollbar-thumb:hover {
    background: #a0aec0;
  }
`;
