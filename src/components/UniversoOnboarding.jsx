import { useState, useMemo } from "react";
import {
  X, Check, Sparkles, ArrowRight,
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

/**
 * UniversoOnboarding — tela de preferências por setor (perfil de investidor).
 *
 * Conformidade: NÃO indicamos ativos específicos. O usuário escolhe os SETORES
 * com que mais se identifica e o universo é montado com o setor inteiro. Assim a
 * seleção é uma escolha do usuário, não uma recomendação nossa.
 *
 * Props:
 *  - onConfirm(tickers: string[])  → usuário confirmou os setores escolhidos
 *  - onSkip()                      → usuário preferiu o padrão operacional
 *  - onClose()                     → fechar sem alterar (opcional)
 */
export default function UniversoOnboarding({ onConfirm, onSkip, onClose }) {
  const categorias = useMemo(() => getCategoriasResumo(), []);
  const [selecionadas, setSelecionadas] = useState(new Set());
  const [filtroTipo, setFiltroTipo] = useState("todos");

  const toggle = (id) => {
    setSelecionadas(prev => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };

  const visiveis = categorias.filter(c => filtroTipo === "todos" || c.tipo === filtroTipo);
  const totalAtivos = categorias
    .filter(c => selecionadas.has(c.id))
    .reduce((s, c) => s + c.qtd, 0);

  const confirmar = () => {
    const tickers = getTickersPorCategorias(Array.from(selecionadas));
    onConfirm(tickers);
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
          {onClose && (
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
              SEU PERFIL DE INVESTIDOR
            </span>
          </div>
          <h2 style={{fontSize: 22, fontWeight: 800, color: "var(--ui-text)", margin: "0 0 8px", letterSpacing: -0.3}}>
            Com quais setores você mais se identifica?
          </h2>
          <p style={{fontSize: 13, color: "var(--ui-text-muted)", lineHeight: 1.6, margin: 0, maxWidth: 620}}>
            Escolha os setores que quer acompanhar — a IA vai considerar os ativos desses
            setores nas análises. É só um ponto de partida: você pode ajustar ticker a ticker
            depois. <b style={{color: "var(--ui-text-secondary)"}}>Nada aqui é recomendação de compra.</b>
          </p>
        </div>

        {/* Filtro tipo */}
        <div style={{padding: "14px 26px 0", display: "flex", gap: 4}}>
          <div style={{
            display: "flex", gap: 4,
            background: "var(--ui-bg-secondary)",
            borderRadius: 8, padding: 3, border: "1px solid var(--ui-border)"
          }}>
            {[{k:"todos",l:"Todos"},{k:"acao",l:"Ações"},{k:"fii",l:"FIIs"}].map(opt => (
              <button key={opt.k} onClick={() => setFiltroTipo(opt.k)} style={{
                background: filtroTipo === opt.k ? "var(--ui-accent)" : "transparent",
                border: "none", borderRadius: 5, padding: "6px 14px",
                fontSize: 11, fontWeight: 700,
                color: filtroTipo === opt.k ? "#fff" : "var(--ui-text-muted)",
                cursor: "pointer"
              }}>{opt.l}</button>
            ))}
          </div>
        </div>

        {/* Grade de setores */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "16px 26px",
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10
        }}>
          {visiveis.map(cat => {
            const sel = selecionadas.has(cat.id);
            const Icon = ICON_MAP[cat.icone];
            return (
              <button key={cat.id} onClick={() => toggle(cat.id)} style={{
                textAlign: "left", cursor: "pointer",
                background: sel ? `${cat.cor}12` : "var(--ui-bg-card-2)",
                border: `1.5px solid ${sel ? cat.cor : "var(--ui-border)"}`,
                borderRadius: 12, padding: "14px 14px",
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

        {/* Rodapé */}
        <div style={{
          padding: "16px 26px",
          borderTop: "1px solid var(--ui-border-soft)",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap"
        }}>
          <button onClick={onSkip} style={{
            background: "transparent", border: "none",
            color: "var(--ui-text-muted)", fontSize: 12.5, fontWeight: 600,
            cursor: "pointer", padding: "10px 4px"
          }}>
            Pular — usar conjunto padrão
          </button>
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
              Usar esses setores <ArrowRight size={14}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
