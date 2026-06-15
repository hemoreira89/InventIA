import { useState, useMemo } from "react";
import {
  X, Check, Sparkles, ArrowRight, CheckSquare,
  Coins, TrendingUp, Layers as LayersIcon, Shield, Scale, Flame,
  Landmark, Zap, Fuel, Droplet, ShoppingCart, Stethoscope,
  Factory, Cpu, Package, Building2, FileText, Home,
  Wheat, Trees, Truck, Phone, Layers
} from "lucide-react";
import { getCategoriasResumo, getTickersPorCategorias } from "../lib/catalogoB3";

const ICON_MAP = {
  Landmark, Zap, Fuel, Droplet, ShoppingCart, Stethoscope,
  Factory, Cpu, Package, Building2, FileText, Home,
  Wheat, Trees, Truck, Phone, Layers
};

// Objetivo → foco usado pela análise (fiis/acoes/misto) + filtro do grid de setores
const OBJETIVOS = [
  { k: "fiis",  label: "Renda passiva", desc: "FIIs e dividendos",   icon: Coins,       filtro: "fii" },
  { k: "acoes", label: "Crescimento",   desc: "Ações da B3",          icon: TrendingUp,  filtro: "acao" },
  { k: "misto", label: "Misto",         desc: "Ações + FIIs",         icon: LayersIcon,  filtro: "todos" },
];

const PERFIS = [
  { k: "conservador", label: "Conservador", desc: "Menos risco",   icon: Shield },
  { k: "moderado",    label: "Moderado",    desc: "Equilíbrio",    icon: Scale },
  { k: "arrojado",    label: "Arrojado",    desc: "Mais risco",    icon: Flame },
];

/**
 * UniversoOnboarding — perfil de investidor + preferências por setor.
 *
 * Conformidade: NÃO indicamos ativos específicos. O usuário escolhe objetivo,
 * tolerância a risco e os SETORES; o universo é montado com o setor inteiro.
 * Tudo é escolha do usuário — nada aqui é recomendação de compra.
 *
 * Props:
 *  - onConfirm({ tickers, foco, perfil })  → confirmou as escolhas
 *  - onSkip()        → preferiu o conjunto padrão (só quando não-bloqueante)
 *  - onClose()       → fechar sem alterar (só quando não-bloqueante)
 *  - bloqueante      → primeiro login: sem fechar/pular, exige ≥1 setor
 *  - mostrarPerfil   → exibe objetivo + tolerância a risco (onboarding completo)
 */
export default function UniversoOnboarding({ onConfirm, onSkip, onClose, bloqueante = false, mostrarPerfil = false }) {
  const categorias = useMemo(() => getCategoriasResumo(), []);
  const [selecionadas, setSelecionadas] = useState(new Set());
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [foco, setFoco] = useState("misto");
  const [perfil, setPerfil] = useState("moderado");

  const toggle = (id) => {
    setSelecionadas(prev => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };

  const escolherObjetivo = (obj) => {
    setFoco(obj.k);
    setFiltroTipo(obj.filtro);
  };

  const visiveis = categorias.filter(c => filtroTipo === "todos" || c.tipo === filtroTipo);

  const selecionarTodos = () => {
    setSelecionadas(prev => {
      const novo = new Set(prev);
      visiveis.forEach(c => novo.add(c.id));
      return novo;
    });
  };

  const totalAtivos = categorias
    .filter(c => selecionadas.has(c.id))
    .reduce((s, c) => s + c.qtd, 0);

  const confirmar = () => {
    const tickers = getTickersPorCategorias(Array.from(selecionadas));
    onConfirm({ tickers, foco: mostrarPerfil ? foco : null, perfil: mostrarPerfil ? perfil : null });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, backdropFilter: "blur(3px)"
    }}>
      <div className="anim" style={{
        background: "var(--ui-bg-card)",
        border: "1px solid var(--ui-border)",
        borderRadius: 16,
        width: "100%", maxWidth: 780, maxHeight: "90vh",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: "var(--ui-shadow-md)"
      }}>
        {/* Cabeçalho */}
        <div style={{
          padding: "22px 26px 18px",
          borderBottom: "1px solid var(--ui-border-soft)",
          position: "relative"
        }}>
          {onClose && !bloqueante && (
            <button onClick={onClose} title="Fechar" style={{
              position: "absolute", top: 16, right: 16,
              background: "transparent", border: "none",
              color: "var(--ui-text-disabled)", cursor: "pointer",
              padding: 6, display: "flex", alignItems: "center"
            }}><X size={18}/></button>
          )}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(123,97,255,0.08)",
            border: "1px solid rgba(123,97,255,0.21)",
            borderRadius: 30, padding: "5px 14px", marginBottom: 14
          }}>
            <Sparkles size={13} color="var(--ui-accent)"/>
            <span style={{fontSize: 11, color: "var(--ui-accent)", fontWeight: 700, letterSpacing: 1.5}}>
              {bloqueante ? "PRIMEIRO PASSO · SEU PERFIL" : "SEU PERFIL DE INVESTIDOR"}
            </span>
          </div>
          <h2 style={{fontSize: 22, fontWeight: 800, color: "var(--ui-text)", margin: "0 0 8px", letterSpacing: -0.3}}>
            Vamos calibrar suas análises
          </h2>
          <p style={{fontSize: 13, color: "var(--ui-text-muted)", lineHeight: 1.6, margin: 0, maxWidth: 620}}>
            Suas escolhas definem o que a IA considera — quanto mais focado, mais relevante.
            Dá pra ajustar tudo depois. <b style={{color: "var(--ui-text-secondary)"}}>Nada aqui é recomendação de compra.</b>
          </p>
        </div>

        {/* Corpo rolável */}
        <div style={{flex: 1, overflowY: "auto", padding: "18px 26px"}}>
          {mostrarPerfil && (
            <>
              <SecaoTitulo n="1" texto="O que você busca?"/>
              <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 22}}>
                {OBJETIVOS.map(obj => (
                  <Chip key={obj.k} ativo={foco === obj.k} onClick={() => escolherObjetivo(obj)}
                    Icon={obj.icon} label={obj.label} desc={obj.desc}/>
                ))}
              </div>

              <SecaoTitulo n="2" texto="Tolerância a risco"/>
              <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 22}}>
                {PERFIS.map(p => (
                  <Chip key={p.k} ativo={perfil === p.k} onClick={() => setPerfil(p.k)}
                    Icon={p.icon} label={p.label} desc={p.desc}/>
                ))}
              </div>
            </>
          )}

          <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8}}>
            <SecaoTitulo n={mostrarPerfil ? "3" : null} texto="Setores que você quer acompanhar"/>
            <div style={{display: "flex", gap: 8, alignItems: "center"}}>
              <div style={{
                display: "flex", gap: 4,
                background: "var(--ui-bg-secondary)",
                borderRadius: 8, padding: 3, border: "1px solid var(--ui-border)"
              }}>
                {[{k:"todos",l:"Todos"},{k:"acao",l:"Ações"},{k:"fii",l:"FIIs"}].map(opt => (
                  <button key={opt.k} onClick={() => setFiltroTipo(opt.k)} style={{
                    background: filtroTipo === opt.k ? "var(--ui-accent)" : "transparent",
                    border: "none", borderRadius: 5, padding: "5px 12px",
                    fontSize: 11, fontWeight: 700,
                    color: filtroTipo === opt.k ? "#fff" : "var(--ui-text-muted)",
                    cursor: "pointer"
                  }}>{opt.l}</button>
                ))}
              </div>
              <button onClick={selecionarTodos} style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "var(--ui-bg-elevated)", border: "1px solid var(--ui-border)",
                borderRadius: 8, padding: "6px 11px", fontSize: 11, fontWeight: 700,
                color: "var(--ui-text-secondary)", cursor: "pointer"
              }}><CheckSquare size={13}/> Selecionar todos</button>
            </div>
          </div>

          <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))", gap: 10}}>
            {visiveis.map(cat => {
              const sel = selecionadas.has(cat.id);
              const Icon = ICON_MAP[cat.icone];
              return (
                <button key={cat.id} onClick={() => toggle(cat.id)} style={{
                  textAlign: "left", cursor: "pointer",
                  background: sel ? `${cat.cor}12` : "var(--ui-bg-card-2)",
                  border: `1.5px solid ${sel ? cat.cor : "var(--ui-border)"}`,
                  borderRadius: 12, padding: "13px 13px",
                  display: "flex", alignItems: "flex-start", gap: 11,
                  transition: "all .15s ease"
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: `${cat.cor}1a`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: cat.cor
                  }}>
                    {Icon ? <Icon size={18} strokeWidth={2}/> : null}
                  </div>
                  <div style={{flex: 1, minWidth: 0}}>
                    <div style={{fontSize: 13, fontWeight: 700, color: "var(--ui-text)", marginBottom: 2}}>
                      {cat.nome}
                    </div>
                    <div style={{fontSize: 10.5, color: "var(--ui-text-faint)", lineHeight: 1.4}}>
                      {cat.qtd} ativos
                    </div>
                  </div>
                  <div style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    background: sel ? cat.cor : "transparent",
                    border: `2px solid ${sel ? cat.cor : "var(--ui-border-strong)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {sel && <Check size={11} color="#fff" strokeWidth={3}/>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rodapé */}
        <div style={{
          padding: "16px 26px",
          borderTop: "1px solid var(--ui-border-soft)",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap"
        }}>
          {bloqueante ? (
            <span style={{fontSize: 12, color: "var(--ui-text-faint)", padding: "10px 4px"}}>
              Escolha ao menos 1 setor para começar
            </span>
          ) : (
            <button onClick={onSkip} style={{
              background: "transparent", border: "none",
              color: "var(--ui-text-muted)", fontSize: 12.5, fontWeight: 600,
              cursor: "pointer", padding: "10px 4px"
            }}>
              Pular — usar conjunto padrão
            </button>
          )}
          <div style={{marginLeft: "auto", display: "flex", alignItems: "center", gap: 14}}>
            <span style={{fontSize: 11.5, color: "var(--ui-text-faint)"}}>
              {selecionadas.size > 0
                ? `${selecionadas.size} setor(es) · ${totalAtivos} ativos`
                : "Nenhum setor selecionado"}
            </span>
            <button onClick={confirmar} disabled={selecionadas.size === 0} style={{
              background: selecionadas.size > 0 ? "var(--ui-accent)" : "var(--ui-bg-secondary)",
              border: "none", borderRadius: 9, padding: "11px 20px",
              color: selecionadas.size > 0 ? "#fff" : "var(--ui-text-disabled)",
              fontSize: 13, fontWeight: 700,
              cursor: selecionadas.size > 0 ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: selecionadas.size > 0 ? "0 4px 12px rgba(123,97,255,0.25)" : "none"
            }}>
              Começar <ArrowRight size={14}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecaoTitulo({ n, texto }) {
  return (
    <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 10}}>
      {n && (
        <span style={{
          width: 20, height: 20, borderRadius: "50%",
          background: "rgba(123,97,255,0.12)", color: "var(--ui-accent)",
          fontSize: 11, fontWeight: 800,
          display: "inline-flex", alignItems: "center", justifyContent: "center"
        }}>{n}</span>
      )}
      <span style={{fontSize: 13, fontWeight: 700, color: "var(--ui-text)"}}>{texto}</span>
    </div>
  );
}

function Chip({ ativo, onClick, Icon, label, desc }) {
  return (
    <button onClick={onClick} style={{
      textAlign: "left", cursor: "pointer",
      background: ativo ? "rgba(123,97,255,0.10)" : "var(--ui-bg-card-2)",
      border: `1.5px solid ${ativo ? "var(--ui-accent)" : "var(--ui-border)"}`,
      borderRadius: 12, padding: "12px 13px",
      display: "flex", alignItems: "center", gap: 10,
      transition: "all .15s ease"
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: ativo ? "rgba(123,97,255,0.15)" : "var(--ui-bg-secondary)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: ativo ? "var(--ui-accent)" : "var(--ui-text-muted)"
      }}>
        <Icon size={17} strokeWidth={2}/>
      </div>
      <div style={{minWidth: 0}}>
        <div style={{fontSize: 12.5, fontWeight: 700, color: ativo ? "var(--ui-text)" : "var(--ui-text-secondary)"}}>{label}</div>
        <div style={{fontSize: 10, color: "var(--ui-text-faint)"}}>{desc}</div>
      </div>
    </button>
  );
}
