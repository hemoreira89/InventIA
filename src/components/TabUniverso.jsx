import { useState, useEffect, useMemo } from "react";
import {
  Globe, Check, X, Plus, RotateCcw, Save, Search,
  CheckSquare, Star, AlertCircle, Sparkles
} from "lucide-react";
import { CATEGORIAS, getDefaultUniverso, getAllTickers } from "../lib/catalogoB3";
import { carregarUniverso, salvarUniverso } from "../supabase";
import { tickerValido } from "../lib/calc";
import { showToast } from "../App";

/**
 * TabUniverso - 100% theme-aware
 * Usa CSS variables --ui-* para se adaptar ao tema (claro/escuro)
 */
export default function TabUniverso({ userId }) {
  const [selecionados, setSelecionados] = useState(new Set());
  const [customizados, setCustomizados] = useState([]);
  const [novoTicker, setNovoTicker] = useState("");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const u = await carregarUniverso(userId);
        if (u && u.tickers?.length > 0) {
          const catalogoTickers = new Set(getAllTickers());
          const doCatalogo = u.tickers.filter(t => catalogoTickers.has(t));
          const customs = u.tickers.filter(t => !catalogoTickers.has(t));
          setSelecionados(new Set(doCatalogo));
          setCustomizados(customs);
        } else {
          setSelecionados(new Set(getDefaultUniverso()));
        }
      } catch (e) {
        console.error(e);
        setSelecionados(new Set(getDefaultUniverso()));
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const toggle = (ticker) => {
    setSelecionados(prev => {
      const novo = new Set(prev);
      if (novo.has(ticker)) novo.delete(ticker);
      else novo.add(ticker);
      return novo;
    });
    setDirty(true);
  };

  const toggleCategoria = (cat) => {
    const tickersDaCategoria = cat.ativos.map(a => a.ticker);
    const todosSelecionados = tickersDaCategoria.every(t => selecionados.has(t));
    setSelecionados(prev => {
      const novo = new Set(prev);
      if (todosSelecionados) tickersDaCategoria.forEach(t => novo.delete(t));
      else tickersDaCategoria.forEach(t => novo.add(t));
      return novo;
    });
    setDirty(true);
  };

  const adicionarCustom = () => {
    const t = novoTicker.toUpperCase().trim();
    if (!t) return;
    if (!tickerValido(t)) {
      showToast("Ticker inválido. Formato esperado: PETR4, MXRF11", "error");
      return;
    }
    if (customizados.includes(t) || selecionados.has(t)) {
      showToast("Ticker já está no universo", "warning");
      return;
    }
    setCustomizados([...customizados, t]);
    setNovoTicker("");
    setDirty(true);
    showToast(`${t} adicionado ao universo`, "success");
  };

  const removerCustom = (ticker) => {
    setCustomizados(customizados.filter(t => t !== ticker));
    setDirty(true);
  };

  const restaurar = () => {
    setSelecionados(new Set(getDefaultUniverso()));
    setCustomizados([]);
    setDirty(true);
    showToast("Universo restaurado para o padrão", "success");
  };

  const selecionarTipo = (tipo) => {
    const tickers = CATEGORIAS
      .filter(c => c.tipo === tipo)
      .flatMap(c => c.ativos.map(a => a.ticker));
    setSelecionados(prev => {
      const novo = new Set(prev);
      tickers.forEach(t => novo.add(t));
      return novo;
    });
    setDirty(true);
  };

  const salvar = async () => {
    if (!userId) return;
    setSalvando(true);
    try {
      const todos = [...Array.from(selecionados), ...customizados];
      await salvarUniverso(userId, todos);
      setDirty(false);
      showToast(`Universo salvo com ${todos.length} ativos`, "success");
    } catch (e) {
      showToast("Erro ao salvar: " + e.message, "error");
    } finally {
      setSalvando(false);
    }
  };

  const categoriasFiltradas = useMemo(() => {
    return CATEGORIAS
      .filter(c => filtroTipo === "todos" || c.tipo === filtroTipo)
      .map(c => ({
        ...c,
        ativos: busca
          ? c.ativos.filter(a =>
              a.ticker.toLowerCase().includes(busca.toLowerCase()) ||
              a.nome.toLowerCase().includes(busca.toLowerCase())
            )
          : c.ativos
      }))
      .filter(c => c.ativos.length > 0);
  }, [busca, filtroTipo]);

  const totalSelecionado = selecionados.size + customizados.length;

  if (loading) {
    return (
      <div style={{padding: 40, textAlign: "center", color: "var(--ui-text-faint)"}}>
        Carregando universo...
      </div>
    );
  }

  return (
    <div style={{display: "flex", flexDirection: "column", gap: 16}}>
      {/* Header com resumo */}
      <div style={{
        background: "var(--ui-bg-card)",
        border: "1px solid var(--ui-border)",
        borderRadius: 14,
        padding: "20px 24px",
        position: "relative",
        overflow: "hidden",
        boxShadow: "var(--ui-shadow-sm)"
      }}>
        <div style={{
          position: "absolute", top: "-100px", right: "-100px",
          width: 300, height: 300,
          background: "radial-gradient(circle, rgba(0,180,216,0.08) 0%, transparent 60%)",
          pointerEvents: "none"
        }}/>

        <div style={{display: "flex", alignItems: "center", gap: 14, marginBottom: 14, position: "relative"}}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: "var(--ui-info)",
            opacity: 0.15,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}/>
          <div style={{
            position: "absolute", left: 0, top: 0,
            width: 44, height: 44,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <Globe size={22} color="var(--ui-info)" strokeWidth={2}/>
          </div>
          <div style={{flex: 1, paddingLeft: 56}}>
            <div style={{fontSize: 17, fontWeight: 800, color: "var(--ui-text)", marginBottom: 2}}>
              Universo de Investimento
            </div>
            <div style={{fontSize: 12, color: "var(--ui-text-muted)"}}>
              Defina quais ativos a IA vai considerar nas análises e recomendações
            </div>
          </div>
        </div>

        <div style={{display: "flex", gap: 24, position: "relative"}}>
          <Stat label="ATIVOS SELECIONADOS" value={totalSelecionado} cor="var(--ui-success)"/>
          <Stat label="DO CATÁLOGO" value={selecionados.size}/>
          <Stat label="CUSTOMIZADOS" value={customizados.length} cor={customizados.length > 0 ? "var(--ui-accent)" : null}/>
        </div>

        {dirty && (
          <div style={{
            marginTop: 14, padding: "10px 14px",
            background: "rgba(217, 119, 6, 0.10)",
            border: "1px solid rgba(217, 119, 6, 0.30)",
            borderRadius: 8, fontSize: 12, color: "var(--ui-warning)",
            display: "flex", alignItems: "center", gap: 8,
            position: "relative"
          }}>
            <AlertCircle size={14}/>
            Você tem alterações não salvas. Clique em "Salvar" para aplicar.
          </div>
        )}
      </div>

      {/* Barra de ações */}
      <div style={{
        background: "var(--ui-bg-card)",
        border: "1px solid var(--ui-border)",
        borderRadius: 12,
        padding: "12px 16px",
        display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
        boxShadow: "var(--ui-shadow-sm)"
      }}>
        <div style={{
          flex: "1 1 220px", display: "flex", alignItems: "center", gap: 8,
          background: "var(--ui-bg-input)",
          border: "1px solid var(--ui-border)",
          borderRadius: 8, padding: "8px 12px"
        }}>
          <Search size={14} color="var(--ui-text-faint)"/>
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por ticker ou nome..."
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "var(--ui-text)", fontSize: 13
            }}
          />
        </div>

        <div style={{
          display: "flex", gap: 4,
          background: "var(--ui-bg-secondary)",
          borderRadius: 8, padding: 3,
          border: "1px solid var(--ui-border)"
        }}>
          {[
            {k: "todos", l: "Todos"},
            {k: "acao", l: "Ações"},
            {k: "fii", l: "FIIs"}
          ].map(opt => (
            <button key={opt.k} onClick={() => setFiltroTipo(opt.k)} style={{
              background: filtroTipo === opt.k ? "var(--ui-info)" : "transparent",
              border: "none", borderRadius: 5,
              padding: "6px 12px", fontSize: 11, fontWeight: 700,
              color: filtroTipo === opt.k ? "var(--ui-text)" : "var(--ui-text-muted)",
              cursor: "pointer"
            }}>{opt.l}</button>
          ))}
        </div>

        <button onClick={() => selecionarTipo("acao")} style={btnSec}>
          <CheckSquare size={13}/> Todas ações
        </button>
        <button onClick={() => selecionarTipo("fii")} style={btnSec}>
          <CheckSquare size={13}/> Todos FIIs
        </button>
        <button onClick={restaurar} style={{...btnSec, color: "var(--ui-warning)"}}>
          <RotateCcw size={13}/> Restaurar padrão
        </button>

        <button onClick={salvar} disabled={!dirty || salvando} style={{
          marginLeft: "auto",
          background: dirty ? "var(--ui-success)" : "var(--ui-bg-secondary)",
          border: "none", borderRadius: 8,
          padding: "10px 18px",
          color: dirty ? "var(--ui-text)" : "var(--ui-text-disabled)",
          fontWeight: 700, fontSize: 12,
          cursor: dirty && !salvando ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: dirty ? "0 4px 12px rgba(0,168,120,0.25)" : "none"
        }}>
          <Save size={13}/>
          {salvando ? "Salvando..." : "Salvar universo"}
        </button>
      </div>

      {/* Adicionar customizado */}
      <div style={{
        background: "var(--ui-bg-card)",
        border: "1px solid var(--ui-border)",
        borderRadius: 12, padding: "14px 18px",
        display: "flex", alignItems: "center", gap: 10,
        flexWrap: "wrap",
        boxShadow: "var(--ui-shadow-sm)"
      }}>
        <Sparkles size={16} color="var(--ui-accent)"/>
        <span style={{fontSize: 12, color: "var(--ui-text-muted)", fontWeight: 600}}>
          Adicionar ticker fora do catálogo:
        </span>
        <input
          type="text"
          value={novoTicker}
          onChange={e => setNovoTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && adicionarCustom()}
          placeholder="Ex: BBSE3, KLBN11"
          style={{
            flex: 1, maxWidth: 240,
            background: "var(--ui-bg-input)",
            border: "1px solid var(--ui-border)",
            borderRadius: 6,
            padding: "8px 12px",
            color: "var(--ui-text)",
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1
          }}
        />
        <button onClick={adicionarCustom} style={{
          background: "rgba(91,61,245,0.10)",
          border: "1px solid rgba(91,61,245,0.30)",
          borderRadius: 6, padding: "7px 14px",
          color: "var(--ui-accent)",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6
        }}>
          <Plus size={13}/> Adicionar
        </button>

        {customizados.length > 0 && (
          <div style={{display: "flex", gap: 6, flexWrap: "wrap"}}>
            {customizados.map(t => (
              <span key={t} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "rgba(91,61,245,0.10)",
                border: "1px solid rgba(91,61,245,0.30)",
                borderRadius: 4, padding: "3px 8px",
                fontSize: 10, fontWeight: 700,
                color: "var(--ui-accent)",
                fontFamily: "'JetBrains Mono', monospace"
              }}>
                {t}
                <button onClick={() => removerCustom(t)} style={{
                  background: "transparent", border: "none",
                  color: "var(--ui-accent)", cursor: "pointer", padding: 0,
                  display: "flex", alignItems: "center"
                }}><X size={11}/></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Categorias */}
      <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 14}}>
        {categoriasFiltradas.map(cat => {
          const tickersCount = cat.ativos.length;
          const selectedInCat = cat.ativos.filter(a => selecionados.has(a.ticker)).length;
          const todosMarcados = selectedInCat === tickersCount && tickersCount > 0;
          const algunsMarcados = selectedInCat > 0 && !todosMarcados;

          return (
            <div key={cat.id} style={{
              background: "var(--ui-bg-card)",
              border: `1px solid ${selectedInCat > 0 ? cat.cor + "40" : "var(--ui-border)"}`,
              borderRadius: 12,
              overflow: "hidden",
              transition: "border-color .2s",
              boxShadow: "var(--ui-shadow-sm)"
            }}>
              <button
                onClick={() => toggleCategoria(cat)}
                style={{
                  width: "100%",
                  background: `${cat.cor}10`,
                  border: "none",
                  padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: 12,
                  cursor: "pointer",
                  borderBottom: "1px solid var(--ui-border-soft)",
                  textAlign: "left"
                }}
              >
                <div style={{fontSize: 22, lineHeight: 1}}>{cat.icone}</div>
                <div style={{flex: 1}}>
                  <div style={{fontSize: 13, fontWeight: 700, color: cat.cor, marginBottom: 2}}>
                    {cat.nome}
                  </div>
                  <div style={{fontSize: 10, color: "var(--ui-text-faint)"}}>{cat.descricao}</div>
                </div>
                <div style={{
                  fontSize: 10, color: "var(--ui-text-disabled)",
                  fontFamily: "'JetBrains Mono', monospace"
                }}>
                  {selectedInCat}/{tickersCount}
                </div>
                <div style={{
                  width: 18, height: 18, borderRadius: 4,
                  background: todosMarcados ? cat.cor : algunsMarcados ? cat.cor + "40" : "transparent",
                  border: `2px solid ${cat.cor}`,
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {todosMarcados && <Check size={11} color="var(--ui-text)" strokeWidth={3}/>}
                  {algunsMarcados && <div style={{width: 8, height: 2, background: "var(--ui-text)"}}/>}
                </div>
              </button>

              <div style={{padding: "8px 0"}}>
                {cat.ativos.map(ativo => {
                  const checked = selecionados.has(ativo.ticker);
                  return (
                    <label key={ativo.ticker} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 16px", cursor: "pointer",
                      transition: "background .1s",
                      background: checked ? `${cat.cor}10` : "transparent"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = checked ? `${cat.cor}20` : "var(--ui-bg-secondary)"}
                    onMouseLeave={e => e.currentTarget.style.background = checked ? `${cat.cor}10` : "transparent"}
                    >
                      <div style={{
                        width: 16, height: 16, borderRadius: 3,
                        background: checked ? cat.cor : "transparent",
                        border: `1.5px solid ${checked ? cat.cor : "var(--ui-border-strong)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0
                      }}>
                        {checked && <Check size={10} color="var(--ui-text)" strokeWidth={3}/>}
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(ativo.ticker)}
                        style={{display: "none"}}
                      />
                      <div style={{flex: 1, display: "flex", alignItems: "center", gap: 8}}>
                        <span style={{
                          fontSize: 12, fontWeight: 700,
                          color: checked ? "var(--ui-text)" : "var(--ui-text-muted)",
                          fontFamily: "'JetBrains Mono', monospace",
                          letterSpacing: 0.5
                        }}>{ativo.ticker}</span>
                        {ativo.popular && <Star size={10} fill="var(--ui-warning)" color="var(--ui-warning)"/>}
                      </div>
                      <span style={{fontSize: 11, color: "var(--ui-text-faint)"}}>{ativo.nome}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        background: "var(--ui-bg-card)",
        border: "1px dashed var(--ui-border)",
        borderRadius: 8, padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 10,
        fontSize: 12, color: "var(--ui-text-muted)"
      }}>
        <Star size={14} fill="var(--ui-warning)" color="var(--ui-warning)"/>
        <span>
          Estrelas amarelas indicam ativos populares (pré-selecionados no padrão).
          Quanto mais focado seu universo, mais relevantes serão as recomendações da IA.
        </span>
      </div>
    </div>
  );
}

const btnSec = {
  background: "var(--ui-bg-elevated)",
  border: "1px solid var(--ui-border)",
  borderRadius: 8, padding: "8px 12px",
  color: "var(--ui-text-secondary)",
  fontSize: 11, fontWeight: 600, cursor: "pointer",
  display: "flex", alignItems: "center", gap: 6
};

function Stat({ label, value, cor }) {
  return (
    <div>
      <div style={{
        fontSize: 9,
        color: "var(--ui-text-disabled)",
        fontWeight: 700,
        letterSpacing: 1.5
      }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 800,
        color: cor || "var(--ui-text)",
        fontFamily: "'JetBrains Mono', monospace"
      }}>{value}</div>
    </div>
  );
}
