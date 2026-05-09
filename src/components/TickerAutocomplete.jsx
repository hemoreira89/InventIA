import { useState, useEffect, useRef, useCallback } from "react";
import { buscarCatalogo } from "../lib/catalogoScreening";

// Cache em módulo para não re-buscar entre montagens
let catalogoCache = null;

function normalizarBusca(s) {
  return (s || "").toUpperCase().trim();
}

/**
 * Input com autocomplete de tickers da B3.
 * Usa o catálogo do Supabase (screening_catalogo, ~1430 ativos, cache 30min).
 *
 * Props compatíveis com <input>: value, onChange, onKeyDown, placeholder, style, disabled
 * Extra:
 *   onSelect(ticker) — chamado quando o usuário confirma um ticker (Enter ou clique)
 *   maxSugestoes     — limite de resultados (default 8)
 */
export default function TickerAutocomplete({
  value,
  onChange,
  onSelect,
  onKeyDown,
  placeholder = "Ex: PETR4",
  style,
  disabled,
  maxSugestoes = 8,
  inputRef: externalRef,
}) {
  const [sugestoes, setSugestoes] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [selecionado, setSelecionado] = useState(-1);
  const internalRef = useRef(null);
  const inputRef = externalRef || internalRef;
  const containerRef = useRef(null);

  // Carrega catálogo na montagem (uma vez por sessão)
  useEffect(() => {
    if (!catalogoCache) {
      buscarCatalogo()
        .then(data => { catalogoCache = data || []; })
        .catch(() => { catalogoCache = []; });
    }
  }, []);

  // Filtra catálogo conforme digitação
  useEffect(() => {
    const q = normalizarBusca(value);
    if (!q || q.length < 1 || !catalogoCache) {
      setSugestoes([]);
      setAberto(false);
      return;
    }

    const matches = catalogoCache
      .filter(item => {
        const tickerMatch = item.ticker?.toUpperCase().startsWith(q);
        const nomeMatch = item.nome?.toUpperCase().includes(q);
        return tickerMatch || nomeMatch;
      })
      // Prioriza match de ticker exato no início
      .sort((a, b) => {
        const aStart = a.ticker?.toUpperCase().startsWith(q) ? 0 : 1;
        const bStart = b.ticker?.toUpperCase().startsWith(q) ? 0 : 1;
        if (aStart !== bStart) return aStart - bStart;
        // Depois ordena por volume (mais líquido primeiro)
        return (b.volume || 0) - (a.volume || 0);
      })
      .slice(0, maxSugestoes);

    setSugestoes(matches);
    setAberto(matches.length > 0);
    setSelecionado(-1);
  }, [value, maxSugestoes]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const confirmar = useCallback((ticker) => {
    onChange?.({ target: { value: ticker } });
    onSelect?.(ticker);
    setAberto(false);
    setSugestoes([]);
    setSelecionado(-1);
  }, [onChange, onSelect]);

  const handleKeyDown = (e) => {
    if (aberto && sugestoes.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelecionado(p => Math.min(p + 1, sugestoes.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelecionado(p => Math.max(p - 1, -1));
        return;
      }
      if (e.key === "Enter" && selecionado >= 0) {
        e.preventDefault();
        confirmar(sugestoes[selecionado].ticker);
        return;
      }
      if (e.key === "Escape") {
        setAberto(false);
        return;
      }
    }
    onKeyDown?.(e);
  };

  const tipoLabel = (tipo) => {
    if (tipo === "fund") return "FII";
    if (tipo === "stock") return "Ação";
    return tipo || "";
  };

  return (
    <div ref={containerRef} style={{ position: "relative", ...style }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => {
          onChange?.(e);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (sugestoes.length > 0) setAberto(true);
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        style={{
          width: "100%",
          background: "var(--ui-bg-input)",
          border: "1px solid var(--ui-border)",
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 13,
          color: "var(--ui-text)",
          boxSizing: "border-box",
        }}
      />

      {aberto && sugestoes.length > 0 && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          background: "var(--ui-bg-card)",
          border: "1px solid var(--ui-border-strong)",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          zIndex: 9000,
          overflow: "hidden",
          maxHeight: 320,
          overflowY: "auto",
        }}>
          {sugestoes.map((item, i) => (
            <div
              key={item.ticker}
              onMouseDown={(e) => {
                e.preventDefault();
                confirmar(item.ticker);
              }}
              onMouseEnter={() => setSelecionado(i)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "9px 14px",
                cursor: "pointer",
                background: selecionado === i ? "rgba(123,97,255,0.12)" : "transparent",
                borderBottom: i < sugestoes.length - 1 ? "1px solid var(--ui-border)" : "none",
                transition: "background 0.1s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  fontSize: 13,
                  color: "var(--ui-accent)",
                  minWidth: 60,
                }}>
                  {item.ticker}
                </span>
                <span style={{
                  fontSize: 12,
                  color: "var(--ui-text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {item.nome || ""}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {item.setor && (
                  <span style={{
                    fontSize: 10,
                    color: "var(--ui-text-faint)",
                    maxWidth: 100,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {item.setor}
                  </span>
                )}
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  color: item.tipo === "fund" ? "var(--ui-info)" : "var(--ui-success)",
                  background: item.tipo === "fund" ? "rgba(0,180,216,0.12)" : "rgba(0,229,160,0.12)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}>
                  {tipoLabel(item.tipo)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
