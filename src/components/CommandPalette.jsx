import { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, Briefcase, BarChart3, Brain, FileSearch, GitCompare,
  Lightbulb, History, Coins, Eye, Target, TrendingUp, Receipt,
  Activity, ArrowRight, Command, Globe
} from "lucide-react";

/**
 * CommandPalette - Estilo Linear/Notion/Vercel
 * Atalho global: Ctrl+K / Cmd+K
 */
export default function CommandPalette({ open, onClose, onNavigate, onAnalyzeTicker }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Lista de comandos disponíveis
  const allCommands = useMemo(() => [
    { id: "tab-carteira", group: "Navegação", icon: Briefcase, label: "Ir para Carteira", action: "navigate", target: "carteira" },
    { id: "tab-patrimonio", group: "Navegação", icon: Activity, label: "Ir para Patrimônio", action: "navigate", target: "patrimonio" },
    { id: "tab-analise", group: "Navegação", icon: Brain, label: "Ir para Análise IA", action: "navigate", target: "analise" },
    { id: "tab-ticker", group: "Navegação", icon: FileSearch, label: "Ir para Analisar Ticker", action: "navigate", target: "ticker" },
    { id: "tab-comparador", group: "Navegação", icon: GitCompare, label: "Ir para Comparador", action: "navigate", target: "comparador" },
    { id: "tab-oportunidades", group: "Navegação", icon: Lightbulb, label: "Ir para Oportunidades", action: "navigate", target: "oportunidades" },
    { id: "tab-historico", group: "Navegação", icon: History, label: "Ir para Histórico", action: "navigate", target: "historico" },
    { id: "tab-proventos", group: "Navegação", icon: Coins, label: "Ir para Proventos", action: "navigate", target: "proventos" },
    { id: "tab-watchlist", group: "Navegação", icon: Eye, label: "Ir para Watchlist", action: "navigate", target: "watchlist" },
    { id: "tab-universo", group: "Navegação", icon: Globe, label: "Ir para Universo", action: "navigate", target: "universo" },
    { id: "tab-meta", group: "Navegação", icon: Target, label: "Ir para 1º Milhão", action: "navigate", target: "meta" },
    { id: "tab-cenarios", group: "Navegação", icon: TrendingUp, label: "Ir para Cenários", action: "navigate", target: "cenarios" },
    { id: "tab-ir", group: "Navegação", icon: Receipt, label: "Ir para Calculadora IR", action: "navigate", target: "ir" },
  ], []);

  // Detecta se é um ticker (4 letras + dígitos)
  const isTicker = /^[A-Z]{4}[0-9]{1,2}$/.test(query.toUpperCase().trim());

  // Filtra comandos
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase().trim();
    return allCommands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.target?.toLowerCase().includes(q)
    );
  }, [query, allCommands]);

  // Lista final: ticker como primeira opção (se válido) + comandos filtrados
  const items = useMemo(() => {
    const list = [];
    if (isTicker) {
      list.push({
        id: "analyze-ticker",
        group: "Ação rápida",
        icon: FileSearch,
        label: `Analisar ticker ${query.toUpperCase()}`,
        ticker: query.toUpperCase(),
        action: "analyze"
      });
    }
    list.push(...filteredCommands);
    return list;
  }, [isTicker, query, filteredCommands]);

  // Keyboard handling
  useEffect(() => {
    if (!open) return;

    const handler = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = items[selectedIndex];
        if (item) executeCommand(item);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, items, selectedIndex]);

  // Foca input quando abre
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  // Reset selected ao filtrar
  useEffect(() => { setSelectedIndex(0); }, [query]);

  const executeCommand = (item) => {
    if (item.action === "navigate") {
      onNavigate(item.target);
    } else if (item.action === "analyze") {
      onAnalyzeTicker(item.ticker);
    }
    onClose();
  };

  if (!open) return null;

  // Agrupa items
  const grouped = items.reduce((acc, item, idx) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push({ ...item, originalIndex: idx });
    return acc;
  }, {});

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "10vh",
        padding: "10vh 20px 20px"
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="anim"
        style={{
          background: "var(--ui-bg-card)",
          border: "1px solid var(--ui-border)",
          borderRadius: 14,
          width: "100%",
          maxWidth: 580,
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px #000"
        }}
      >
        {/* Input de busca */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--ui-border-soft)",
          display: "flex",
          alignItems: "center",
          gap: 12
        }}>
          <Search size={18} color="var(--ui-text-faint)"/>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Digite um ticker (PETR4) ou comando..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--ui-text)",
              fontSize: 15,
              fontFamily: "'Inter', sans-serif"
            }}
          />
          <kbd style={{
            background: "var(--ui-bg-secondary)",
            border: "1px solid var(--ui-border)",
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 10,
            color: "var(--ui-text-faint)",
            fontFamily: "'JetBrains Mono', monospace"
          }}>ESC</kbd>
        </div>

        {/* Lista de resultados */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
          {items.length === 0 ? (
            <div style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "var(--ui-text-faint)",
              fontSize: 13
            }}>
              Nenhum resultado para "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([groupName, groupItems]) => (
              <div key={groupName}>
                <div style={{
                  padding: "10px 20px 6px",
                  fontSize: 10,
                  color: "var(--ui-text-disabled)",
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: "uppercase"
                }}>{groupName}</div>
                {groupItems.map(item => {
                  const Icon = item.icon;
                  const isSelected = item.originalIndex === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => executeCommand(item)}
                      onMouseEnter={() => setSelectedIndex(item.originalIndex)}
                      style={{
                        width: "100%",
                        background: isSelected ? "rgba(123,97,255,0.08)" : "transparent",
                        border: "none",
                        padding: "10px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        cursor: "pointer",
                        borderLeft: `2px solid ${isSelected ? "var(--ui-accent)" : "transparent"}`,
                        textAlign: "left",
                        transition: "background .1s"
                      }}
                    >
                      <Icon size={16} color={isSelected ? "var(--ui-accent)" : "var(--ui-text-muted)"} strokeWidth={2}/>
                      <span style={{
                        flex: 1,
                        color: isSelected ? "var(--ui-text)" : "var(--ui-text-secondary)",
                        fontSize: 13,
                        fontWeight: isSelected ? 600 : 500
                      }}>{item.label}</span>
                      {isSelected && (
                        <ArrowRight size={14} color="var(--ui-accent)"/>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer com atalhos */}
        <div style={{
          padding: "10px 20px",
          borderTop: "1px solid var(--ui-border-soft)",
          display: "flex",
          gap: 16,
          fontSize: 10,
          color: "var(--ui-text-disabled)"
        }}>
          <span style={{display:"flex",alignItems:"center",gap:5}}>
            <kbd style={{background:"var(--ui-bg-secondary)",border:"1px solid var(--ui-border)",borderRadius:3,padding:"1px 5px",fontFamily:"'JetBrains Mono',monospace"}}>↑↓</kbd>
            navegar
          </span>
          <span style={{display:"flex",alignItems:"center",gap:5}}>
            <kbd style={{background:"var(--ui-bg-secondary)",border:"1px solid var(--ui-border)",borderRadius:3,padding:"1px 5px",fontFamily:"'JetBrains Mono',monospace"}}>↵</kbd>
            selecionar
          </span>
          <span style={{flex:1, textAlign:"right"}}>
            Dica: digite um ticker (ex: <b style={{color:"var(--ui-accent)"}}>PETR4</b>) para análise rápida
          </span>
        </div>
      </div>
    </div>
  );
}
