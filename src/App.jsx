import { useState, useEffect, useCallback } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, LineChart, Line, Legend
} from "recharts";
import {
  Briefcase, BarChart3, Brain, Target, TrendingUp, Eye, Receipt,
  Sparkles, Save, FileDown, Plus, X, Trash2, Calendar, AlertTriangle,
  CheckCircle2, AlertCircle, Activity, DollarSign, Wallet, PieChart as PieIcon,
  Search, ArrowUp, ArrowDown, Zap, Shield, Rocket, ChevronRight, ChevronDown, Loader2,
  Building2, Landmark, Factory, LogOut, User, History, Coins, GitCompare,
  FileSearch, Bell, Download, Upload, ExternalLink, Clock, Lightbulb,
  RefreshCw, FileUp, TrendingDown, Award, Globe, Undo2, Command
} from "lucide-react";
import {
  carregarCarteiraPrincipal, carregarAtivos, salvarAtivo, removerAtivo,
  registrarCompra, carregarCompras,
  carregarWatchlist, salvarWatchlist, removerWatchlist,
  salvarAnalise, carregarAnalises, removerAnalise,
  registrarProvento, carregarProventos, removerProvento,
  registrarVenda, carregarVendas,
  salvarSnapshotPatrimonio, carregarSnapshotsPatrimonio,
  getCachedPrice, setCachedPrice, clearPriceCache
} from "./supabase";
import {
  CDI_ANO, IBOV_HIST, PALETTE,
  fmt, fmtBRL, fmtK, sleep, extrairJSON,
  juroCompostos, gerarProjecao, calcularIR,
  calcularPesos, novoPrecoMedio, quantidadeComprável,
  dyMedioCarteira, alertasRebalanceamento,
  tickerValido, tipoTicker
} from "./lib/calc";
import EmptyState from "./components/EmptyState";
import CommandPalette from "./components/CommandPalette";
import Sparkline from "./components/Sparkline";
import LoadingSteps from "./components/LoadingSteps";
import OnboardingHero from "./components/OnboardingHero";
import { usePrivacyMode, PrivacyToggle } from "./components/PrivacyMode";
import { useTheme, ThemeToggle, THEME_CSS } from "./components/ThemeToggle";
import TabUniverso from "./components/TabUniverso";
import { carregarUniverso } from "./supabase";
import { getDefaultUniverso, getSetorPorTicker } from "./lib/catalogoB3";
import { useCotacoes } from "./hooks/useCotacoes";
import { buscarCotacoes, buscarCotacao } from "./lib/cotacoes";
import { buscarFundamentos, buscarFundamento } from "./lib/fundamentos";
import { buscarHistorico, buscarHistoricos } from "./lib/historico";
import { analisarRisco, classificarHHI } from "./lib/risco";
import { avaliarRecomendacao, classificarAderencia } from "./lib/criterios";

// ─── Constantes ───────────────────────────────────────────────────────────────
const SK = "investia_v4";

// ─── Storage — agora usamos Supabase, mantemos localStorage como cache ──────
const store = {
  save: async d => { try { localStorage.setItem(SK, JSON.stringify(d)); return true; } catch(_) { return false; } },
  load: async () => { try { const r = localStorage.getItem(SK); return r ? JSON.parse(r) : null; } catch(_) { return null; } }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
// extrairJSON agora vem de ./lib/calc


// ─── IA Principal — via Vercel API proxy (chave segura no servidor) ──────────
const API_URL = "/api/analyze";

async function chamarIAComSearch(prompt, autoRetry = true) {
  const tentar = async () => {
    const tStart = Date.now();
    console.log(`[IA] POST /api/analyze (prompt ${prompt?.length || 0} chars)`);
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // useSearch=false: NÃO usa Google Search grounding.
      // Antes a IA fazia web_search pra buscar cotações/fundamentos, mas:
      //  - Levava 30-50s (estourava timeout do Vercel Hobby)
      //  - Bug do Gemini com search ocasionalmente retornava texto vazio
      //  - Cotação real vem da brapi (em outra chamada paralela)
      //  - Fundamentos reais vêm da bolsai (em outra chamada paralela)
      // A IA só precisa montar a TESE de investimento (qual ticker, % alocação,
      // por quê) - números reais são preenchidos pelo enriquecimento depois.
      body: JSON.stringify({ prompt, useSearch: false, model: "flash" })
    });
    const elapsed = Date.now() - tStart;
    console.log(`[IA] resposta HTTP ${res.status} em ${elapsed}ms`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`[IA] erro do backend:`, err);
      if (res.status === 504 || res.status === 502) {
        const e = new Error("TIMEOUT");
        e.isTimeout = true;
        throw e;
      }
      // Inclui detalhe técnico no console (mas não na UI) para diagnóstico
      if (err._debug) console.warn(`[IA] _debug:`, err._debug);
      throw new Error(err.error || `Erro ${res.status} na API`);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    console.log(`[IA] sucesso: modelo ${data.modelUsado}, texto ${data.text?.length || 0} chars`);
    return extrairJSON(data.text);
  };

  try {
    return await tentar();
  } catch (e) {
    // Retry automático em timeout (1 vez)
    if (e.isTimeout && autoRetry) {
      console.log("Timeout - tentando novamente automaticamente...");
      await sleep(1500);
      try {
        return await tentar();
      } catch (e2) {
        if (e2.isTimeout) {
          throw new Error("A análise está sobrecarregada no momento. Aguarde 30 segundos e tente novamente.");
        }
        throw e2;
      }
    }
    if (e.isTimeout) {
      throw new Error("A análise demorou muito (timeout). Tente novamente — geralmente funciona na 2ª tentativa.");
    }
    throw e;
  }
}

async function chamarIA(prompt) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, useSearch: false, model: "flash" })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 504) {
      throw new Error("A análise demorou muito (timeout). Tente novamente.");
    }
    throw new Error(err.error || `Erro ${res.status} na API`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return extrairJSON(data.text);
}

// ─── Cálculos ────────────────────────────────────────────────────────────────
// juroCompostos e gerarProjecao agora vêm de ./lib/calc


function simularCenarios(pv, pmt, anos) {
  const cenarios = [
    { name:"Conservador (CDI)", taxa:CDI_ANO, color:"var(--ui-success)" },
    { name:"Moderado (IBOV hist.)", taxa:IBOV_HIST, color:"var(--ui-accent)" },
    { name:"Arrojado (18% a.a.)", taxa:18, color:"var(--ui-warning)" },
  ];
  const pts = [];
  for (let m = 0; m <= anos*12; m += Math.max(1, Math.round(anos*12/20))) {
    const obj = { ano: `${(m/12).toFixed(1)}a` };
    cenarios.forEach(c => { obj[c.name] = Math.round(juroCompostos(pv, pmt, c.taxa, m)); });
    pts.push(obj);
  }
  return { pts, cenarios };
}

function calcIR(vendas) {
  const totalVendas = vendas.reduce((s,v) => s + v.qtd * v.precoVenda, 0);
  const lucro = vendas.reduce((s,v) => s + v.qtd * (v.precoVenda - (v.pm||0)), 0);
  const isento = totalVendas <= 20000;
  return { totalVendas, lucro, isento, ir: isento || lucro <= 0 ? 0 : lucro * 0.15, restante: 20000 - totalVendas };
}

/**
 * Estima posições com peso e setor para análise de risco PRÉ-IA.
 * Usa cotações ao vivo (brapi) quando disponíveis, fallback para PM.
 * Retorna estrutura compatível com analisarRisco().
 */
function estimarPosicoesParaRisco(carteira, cotacoes, getSetorFn) {
  if (!carteira || carteira.length === 0) return [];

  // Calcula valor de cada posição
  const posComValor = carteira.map(a => {
    const cotacao = cotacoes?.[a.ticker];
    const preco = cotacao?.preco || a.pm || 0;
    return {
      ticker: a.ticker,
      qtd: a.qtd,
      pm: a.pm,
      preco,
      valor: preco * a.qtd,
      setor: getSetorFn(a.ticker),
      tipo: /11$/.test(a.ticker) ? "FII" : "Ação"
    };
  });

  const valorTotal = posComValor.reduce((s, p) => s + p.valor, 0);
  if (valorTotal === 0) return [];

  // Adiciona peso percentual
  return posComValor.map(p => ({
    ...p,
    peso: (p.valor / valorTotal) * 100
  }));
}

function projetarDividendos(pos) {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  // FIIs: pagam todos os meses (peso 1.0 cada mês)
  // Ações: concentram pagamentos em mar, mai, ago, nov (pesos sazonais aproximados)
  const sazonalidadeAcoes = [0.3, 0.5, 1.8, 0.8, 1.6, 0.7, 0.4, 1.5, 0.6, 0.7, 1.7, 1.4]; // soma = 12
  return meses.map((mes, idx) => {
    let total = 0;
    pos.forEach(p => {
      const dy = p.dy || (p.tipo === "FII" ? 8 : 5);
      const valor = (p.valorAtual || 0) * dy / 100; // anual
      if (p.tipo === "FII") {
        total += valor / 12; // distribui igual nos 12 meses
      } else {
        total += valor / 12 * sazonalidadeAcoes[idx]; // sazonal
      }
    });
    return { mes, dividendos: Math.round(total) };
  });
}

// ─── Micro-componentes ────────────────────────────────────────────────────────
function Badge({ val, suffix="%" }) {
  if (val == null) return null;
  const up = val >= 0;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:3,
      background:up?"rgba(0,229,160,0.09)":"rgba(255,77,109,0.09)",color:up?"var(--ui-success)":"var(--ui-danger)",
      border:`1px solid ${up?"rgba(0,229,160,0.18)":"rgba(255,77,109,0.18)"}`,
      borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700}}>
      {up?"▲":"▼"} {fmt(Math.abs(val))}{suffix}
    </span>
  );
}

function Card({ children, style={}, accent=false, className="" }) {
  return (
    <div className={`card-hover ${className}`} style={{
      background:"var(--ui-bg-card)",
      border:`1px solid ${accent?"rgba(123,97,255,0.27)":"var(--ui-border)"}`,
      borderRadius:10,padding:"16px",
      boxShadow:"var(--ui-shadow-sm)",
      ...style
    }}>
      {children}
    </div>
  );
}

// ─── Toast System ─────────────────────────────────────────────────────────────
let toastListeners = [];
export function showToast(msg, tipo = "success") {
  toastListeners.forEach(fn => fn({ id: Date.now() + Math.random(), msg, tipo }));
}

// Toast com botão "Desfazer". Retorna uma promessa que resolve true se desfeito, false se expirou.
export function showToastUndo(msg, onUndo, duracaoMs = 6000) {
  return new Promise((resolve) => {
    const id = Date.now() + Math.random();
    let resolvido = false;

    const handleUndo = () => {
      if (resolvido) return;
      resolvido = true;
      try { onUndo(); } catch(e) { console.error("Erro ao desfazer:", e); }
      resolve(true);
    };

    const handleExpire = () => {
      if (resolvido) return;
      resolvido = true;
      resolve(false);
    };

    toastListeners.forEach(fn => fn({
      id, msg, tipo: "undo",
      onUndo: handleUndo,
      onExpire: handleExpire,
      duracao: duracaoMs
    }));
  });
}

function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (toast) => {
      setToasts(prev => [...prev, toast]);
      const duracao = toast.duracao || 3500;
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
        if (toast.onExpire) toast.onExpire();
      }, duracao);
    };
    toastListeners.push(handler);
    return () => { toastListeners = toastListeners.filter(h => h !== handler); };
  }, []);

  const fecharToast = (toast) => {
    setToasts(prev => prev.filter(t => t.id !== toast.id));
  };

  if (!toasts.length) return null;

  return (
    <div style={{
      position:"fixed",bottom:24,right:24,zIndex:9999,
      display:"flex",flexDirection:"column",gap:8,maxWidth:420
    }}>
      {toasts.map(t => {
        const cor = t.tipo === "success" ? "var(--ui-success)"
          : t.tipo === "error" ? "var(--ui-danger)"
          : t.tipo === "warning" ? "var(--ui-warning)"
          : t.tipo === "undo" ? "var(--ui-accent)"
          : "var(--ui-accent)";
        const Icon = t.tipo === "success" ? CheckCircle2
          : t.tipo === "error" ? AlertCircle
          : t.tipo === "warning" ? AlertTriangle
          : t.tipo === "undo" ? Trash2
          : Sparkles;
        return (
          <div key={t.id} className="anim" style={{
            background:"var(--ui-bg-card)",border:`1px solid ${cor}50`,borderRadius:10,
            padding:"12px 16px",display:"flex",alignItems:"center",gap:10,
            boxShadow:`0 8px 24px ${cor}20, var(--ui-shadow-md)`,
            minWidth:280
          }}>
            <Icon size={18} color={cor} strokeWidth={2.2}/>
            <span style={{fontSize:13,color:"var(--ui-text)",fontWeight:500,flex:1}}>{t.msg}</span>
            {t.onUndo && (
              <button
                onClick={() => { t.onUndo(); fecharToast(t); }}
                style={{
                  background:"transparent",
                  border:`1px solid ${cor}`,
                  color: cor,
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <Undo2 size={11} strokeWidth={2.5}/>
                Desfazer
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal de Confirmação ─────────────────────────────────────────────────────
function ConfirmModal({ open, titulo, mensagem, onConfirm, onCancel, perigoso = false }) {
  if (!open) return null;
  return (
    <div onClick={onCancel} style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",
      zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",padding:20
    }}>
      <div onClick={e=>e.stopPropagation()} className="anim" style={{
        background:"var(--ui-bg-card)",border:"1px solid var(--ui-border)",borderRadius:12,
        padding:24,maxWidth:420,width:"100%"
      }}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
          <div style={{
            width:40,height:40,borderRadius:10,
            background:perigoso?"rgba(255,77,109,0.12)":"rgba(123,97,255,0.12)",
            display:"flex",alignItems:"center",justifyContent:"center"
          }}>
            {perigoso ? <AlertTriangle size={20} color="var(--ui-danger)"/> : <AlertCircle size={20} color="var(--ui-accent)"/>}
          </div>
          <h3 style={{fontSize:16,fontWeight:700,color:"var(--ui-text)",margin:0}}>{titulo}</h3>
        </div>
        <div style={{fontSize:13,color:"var(--ui-text-muted)",lineHeight:1.6,marginBottom:20}}>{mensagem}</div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onCancel} style={{
            background:"var(--ui-bg-secondary)",border:"1px solid var(--ui-border)",borderRadius:8,
            padding:"10px 18px",color:"var(--ui-text-secondary)",fontWeight:600,fontSize:13,cursor:"pointer"
          }}>Cancelar</button>
          <button onClick={onConfirm} style={{
            background:perigoso?"var(--ui-danger)":"var(--ui-accent)",border:"none",borderRadius:8,
            padding:"10px 18px",color:"#ffffff",fontWeight:700,fontSize:13,cursor:"pointer"
          }}>{perigoso?"Remover":"Confirmar"}</button>
        </div>
      </div>
    </div>
  );
}

function STitle({ children, color="var(--ui-accent)" }) {
  return <div style={{fontSize:11,color,fontWeight:800,letterSpacing:1.2,marginBottom:12,textTransform:"uppercase"}}>{children}</div>;
}

function Stat({ label, value, color, mono=false }) {
  return (
    <div style={{background:"var(--ui-bg-secondary)",borderRadius:8,padding:"10px 12px",border:"1px solid var(--ui-border)"}}>
      <div style={{fontSize:9,color:"var(--ui-text-faint)",marginBottom:4,fontWeight:600,letterSpacing:1}}>{label}</div>
      <div style={{fontSize:14,fontWeight:700,color:color||"var(--ui-text)",
        fontFamily:mono?"'JetBrains Mono',monospace":"inherit"}}>{value}</div>
    </div>
  );
}

// Componente de métrica individual da Análise de Risco
function MetricaRisco({ icone: Icone, label, valor, cor = "default", detalhe, tooltip }) {
  const corPrincipal =
    cor === "success" ? "var(--ui-success)"
    : cor === "warning" ? "var(--ui-warning)"
    : cor === "danger" ? "var(--ui-danger)"
    : "var(--ui-text)";
  const corBg =
    cor === "success" ? "rgba(0,229,160,0.08)"
    : cor === "warning" ? "rgba(255,214,10,0.08)"
    : cor === "danger" ? "rgba(255,77,109,0.08)"
    : "var(--ui-bg-secondary)";
  const corBorda =
    cor === "success" ? "rgba(0,229,160,0.22)"
    : cor === "warning" ? "rgba(255,214,10,0.25)"
    : cor === "danger" ? "rgba(255,77,109,0.22)"
    : "var(--ui-border)";

  return (
    <div title={tooltip} style={{
      background: corBg,
      border: `1px solid ${corBorda}`,
      borderRadius: 9,
      padding: "10px 12px",
      cursor: tooltip ? "help" : "default"
    }}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
        {Icone && <Icone size={11} color={corPrincipal} strokeWidth={2.2}/>}
        <span style={{fontSize:9,color:"var(--ui-text-faint)",fontWeight:700,letterSpacing:1}}>{label}</span>
      </div>
      <div style={{fontSize:18,fontWeight:800,color:corPrincipal,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.1,marginBottom:3}}>
        {valor}
      </div>
      {detalhe && (
        <div style={{fontSize:10,color:"var(--ui-text-muted)",fontWeight:600}}>
          {detalhe}
        </div>
      )}
    </div>
  );
}

// Componente de badges dos critérios fundamentalistas
// Mostra ✅/⚠️/❌ por critério, com pontuação e tooltip explicativo
function CriteriosBadges({ avaliacao, classificacao }) {
  if (!avaliacao || !avaliacao.criterios?.length) return null;

  // Mapeia status para ícone + cor
  const getStatus = (status) => {
    if (status === "aprovado") return { icone: "✓", cor: "var(--ui-success)", bg: "rgba(0,229,160,0.10)", borda: "rgba(0,229,160,0.25)" };
    if (status === "reprovado") return { icone: "✗", cor: "var(--ui-danger)", bg: "rgba(255,77,109,0.10)", borda: "rgba(255,77,109,0.25)" };
    return { icone: "−", cor: "var(--ui-text-faint)", bg: "var(--ui-bg-secondary)", borda: "var(--ui-border)" };
  };

  // Cor do header baseado na classificação
  const corHeader =
    classificacao?.cor === "success" ? "var(--ui-success)"
    : classificacao?.cor === "warning" ? "var(--ui-warning)"
    : classificacao?.cor === "danger" ? "var(--ui-danger)"
    : "var(--ui-text-faint)";

  return (
    <div style={{
      marginTop: 10,
      padding: "8px 10px",
      background: "var(--ui-bg-secondary)",
      borderRadius: 7,
      border: "1px solid var(--ui-border-soft)"
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6,
        flexWrap: "wrap",
        gap: 4
      }}>
        <span style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 1,
          color: "var(--ui-text-faint)"
        }}>
          CRITÉRIOS FUNDAMENTALISTAS
          {avaliacao.setor && (
            <span style={{
              marginLeft: 6,
              fontSize: 9,
              fontWeight: 600,
              color: "var(--ui-text-faint)",
              opacity: 0.75,
              letterSpacing: 0.3,
              textTransform: "none"
            }} title={`Setor (CVM): ${avaliacao.setorCVM || "—"}\nThresholds ajustados para o setor.`}>
              · setor: {avaliacao.setor}
            </span>
          )}
        </span>
        {classificacao && (
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: corHeader
          }} title={classificacao.descricao}>
            {classificacao.nivel}
          </span>
        )}
      </div>
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4
      }}>
        {avaliacao.criterios.map(c => {
          const s = getStatus(c.status);
          return (
            <span
              key={c.chave}
              title={`${c.descricao} — ${c.mensagem}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 7px",
                background: s.bg,
                border: `1px solid ${s.borda}`,
                borderRadius: 5,
                fontSize: 10,
                fontWeight: 600,
                color: s.cor,
                cursor: "help"
              }}
            >
              <span style={{ fontWeight: 800 }}>{s.icone}</span>
              <span>{c.label.replace(/[≥≤<>]\s*\d+\.?\d*%?\s*x?$/, "").trim()}</span>
              {c.status !== "indisponivel" && (
                <span style={{ opacity: 0.85, fontFamily: "'JetBrains Mono', monospace" }}>
                  {c.mensagem}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Estilo padrão de tecla (kbd)
const kbdStyle = {
  display:"inline-flex",
  alignItems:"center",
  justifyContent:"center",
  minWidth:22,
  height:22,
  padding:"0 6px",
  background:"var(--ui-bg-secondary)",
  border:"1px solid var(--ui-border)",
  borderRadius:5,
  fontSize:11,
  fontWeight:600,
  fontFamily:"'JetBrains Mono',monospace",
  color:"var(--ui-text-secondary)",
  boxShadow:"0 1px 2px rgba(0,0,0,0.05)"
};

// Linha "tecla(s) → descrição" do modal de atalhos
function KeyRow({ keys, desc }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,fontSize:12}}>
      <div style={{display:"flex",gap:4,alignItems:"center",minWidth:80}}>
        {keys.map((k, i) => (
          <span key={i} style={{display:"flex",alignItems:"center",gap:4}}>
            <kbd style={kbdStyle}>{k}</kbd>
            {i < keys.length - 1 && <span style={{fontSize:10,color:"var(--ui-text-faint)"}}>+</span>}
          </span>
        ))}
      </div>
      <span style={{color:"var(--ui-text-muted)"}}>{desc}</span>
    </div>
  );
}

const TTip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:"var(--ui-bg-card)",border:"1px solid var(--ui-border)",borderRadius:10,padding:"10px 14px",fontSize:12,boxShadow:"var(--ui-shadow-md)"}}>
      {label && <div style={{color:"var(--ui-text-faint)",marginBottom:4}}>{label}</div>}
      {payload.map((p,i) => (
        <div key={i} style={{color:p.color||p.fill||"var(--ui-text)",fontWeight:600,marginBottom:2}}>
          {p.name}: {typeof p.value==="number" ? p.value>=1000 ? fmtBRL(p.value) : `${fmt(p.value,1)}%` : p.value}
        </div>
      ))}
    </div>
  );
};

// ─── Spinner de loading ───────────────────────────────────────────────────────
function LoadingCard({ fase }) {
  return (
    <Card style={{textAlign:"center",padding:"40px 20px"}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
        <div style={{position:"relative",width:56,height:56}}>
          <div className="spin" style={{width:56,height:56,borderRadius:"50%",
            border:"3px solid var(--ui-bg-tertiary)",borderTopColor:"var(--ui-accent)",position:"absolute"}}/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)"}}><Sparkles size={18} color="var(--ui-accent)" strokeWidth={2.5}/></div>
        </div>
        <div style={{fontSize:13,color:"var(--ui-text-muted)"}}>{fase}</div>
        <div style={{fontSize:11,color:"var(--ui-text-disabled)"}}>IA analisando o mercado...</div>
      </div>
    </Card>
  );
}

// ─── Tab: Carteira ────────────────────────────────────────────────────────────
function TabCarteira({ carteira, setCarteira, historico, setHistorico, dados, onSave, userId, carteiraId, pedirConfirmacao }) {
  const [ticker,setTicker]=useState(""); const [qtd,setQtd]=useState("");
  const [pm,setPm]=useState(""); const [data,setData]=useState("");
  const [pesoAlvo,setPesoAlvo]=useState({});
  const [salvando,setSalvando]=useState(false);

  // Cotações em tempo real (atualiza a cada 60s)
  const tickersCarteira = carteira.map(a => a.ticker);
  const { cotacoes, atualizadoEm } = useCotacoes(tickersCarteira, { intervalMs: 60000 });

  // Histórico de 1 mês para sparklines (atualiza ao mudar carteira, cache 1h)
  const [historicos, setHistoricos] = useState({});
  useEffect(() => {
    if (tickersCarteira.length === 0) return;
    let cancelled = false;
    buscarHistoricos(tickersCarteira, "1mo")
      .then(mapa => { if (!cancelled) setHistoricos(mapa); })
      .catch(e => console.warn("Histórico carteira falhou:", e.message));
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersCarteira.join(",")]);

  const add = async () => {
    const t = ticker.toUpperCase().trim();
    if (!t || !qtd || !carteiraId || !userId) return;
    setSalvando(true);
    try {
      const dataCompra = data || new Date().toISOString().split("T")[0];
      const precoCompra = pm ? Number(pm) : 0;

      // Salva compra no banco (já atualiza/cria o ativo automaticamente)
      await registrarCompra(userId, carteiraId, {
        ticker: t,
        qtd: Number(qtd),
        preco: precoCompra,
        data: dataCompra
      });

      // Atualiza estados locais
      setHistorico(prev => [...prev, { ticker:t, qtd:Number(qtd), pm:precoCompra, data:dataCompra }]);
      setCarteira(prev => {
        const idx = prev.findIndex(x => x.ticker === t);
        if (idx >= 0) {
          const u = [...prev];
          const tot = u[idx].qtd + Number(qtd);
          u[idx] = { ...u[idx], qtd: tot, pm: u[idx].pm && pm ? (u[idx].pm*u[idx].qtd + Number(pm)*Number(qtd)) / tot : pm ? Number(pm) : u[idx].pm };
          return u;
        }
        return [...prev, { ticker:t, qtd:Number(qtd), pm:pm?Number(pm):null }];
      });

      setTicker(""); setQtd(""); setPm(""); setData("");
      onSave();
      showToast(`Compra de ${t} registrada`, "success");
    } catch (e) {
      console.error("Erro ao registrar compra:", e);
      showToast("Erro ao salvar: " + e.message, "error");
    } finally {
      setSalvando(false);
    }
  };

  const removerAtivoCarteira = async (ativo) => {
    // UX moderna: remove direto + toast com 6s pra desfazer
    const ativoRemovido = { ...ativo };
    const indiceOriginal = carteira.findIndex(x => x.ticker === ativo.ticker);

    // Remove imediatamente da UI
    setCarteira(p => p.filter(x => x.ticker !== ativo.ticker));

    // Se tem id, deleta no Supabase em paralelo
    let promessaDelete = null;
    if (ativo.id) {
      promessaDelete = removerAtivo(ativo.id).catch(e => {
        console.error("Erro ao remover do Supabase:", e);
      });
    }

    // Mostra toast com Desfazer
    const desfez = await showToastUndo(
      `${ativo.ticker} removido`,
      () => {
        // Restaura na UI no índice original
        setCarteira(p => {
          const novo = [...p];
          novo.splice(indiceOriginal, 0, ativoRemovido);
          return novo;
        });
      }
    );

    if (desfez) {
      // Usuário desfez. Se já foi salvo no Supabase, precisa re-criar.
      if (ativo.id) {
        try {
          await promessaDelete;
          // Re-salva no Supabase (cria novo registro)
          const novo = await salvarAtivo(userId, carteiraId, {
            ticker: ativoRemovido.ticker,
            qtd: ativoRemovido.qtd,
            pm: ativoRemovido.pm,
            peso_alvo: ativoRemovido.peso_alvo
          });
          // Atualiza id no estado
          setCarteira(p => p.map(x =>
            x.ticker === ativoRemovido.ticker ? { ...x, id: novo.id } : x
          ));
        } catch (e) {
          showToast("Erro ao restaurar: " + e.message, "error");
        }
      }
    } else {
      // Toast expirou — confirma o save no Supabase
      if (promessaDelete) {
        await promessaDelete;
        onSave();
      }
    }
  };

  const alertasReb = dados?.posicoes?.filter(p => {
    const a = pesoAlvo[p.ticker];
    return a && Math.abs(p.peso - a) > 5;
  }) || [];

  // Exportar carteira em CSV
  const exportarCSV = () => {
    const linhas = ["Ticker,Quantidade,Preço Médio,Peso Alvo (%)"];
    carteira.forEach(a => {
      linhas.push(`${a.ticker},${a.qtd},${a.pm || ""},${a.peso_alvo || ""}`);
    });
    const csv = linhas.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventia-carteira-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Carteira exportada", "success");
  };

  // Importar carteira de CSV
  const importarCSV = async (e) => {
    const file = e.target.files[0];
    if (!file || !userId || !carteiraId) return;

    const text = await file.text();
    const linhas = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (linhas.length < 2) {
      showToast("Arquivo CSV vazio ou inválido", "error");
      return;
    }

    // Parser flexível - aceita ; ou ,
    const sep = linhas[0].includes(";") ? ";" : ",";
    const header = linhas[0].toLowerCase().split(sep).map(h => h.trim());

    // Detecta colunas
    const idxTicker = header.findIndex(h => h.includes("ticker") || h.includes("ativo") || h.includes("código") || h.includes("codigo"));
    const idxQtd = header.findIndex(h => h.includes("quantidade") || h.includes("qtd") || h.includes("qtde"));
    const idxPm = header.findIndex(h => h.includes("preço") || h.includes("preco") || h.includes("pm") || h.includes("médio") || h.includes("medio"));

    if (idxTicker === -1 || idxQtd === -1) {
      showToast("CSV precisa ter colunas Ticker e Quantidade", "error");
      e.target.value = "";
      return;
    }

    let importados = 0, erros = 0;
    showToast(`Importando ${linhas.length - 1} ativos...`, "info");

    for (let i = 1; i < linhas.length; i++) {
      const cols = linhas[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
      const ticker = cols[idxTicker]?.toUpperCase();
      const qtd = Number(cols[idxQtd]?.replace(",", "."));
      const pm = idxPm > -1 ? Number(cols[idxPm]?.replace(",", ".")) : null;

      if (!ticker || !qtd || isNaN(qtd)) { erros++; continue; }

      try {
        await salvarAtivo(userId, carteiraId, { ticker, qtd, pm: pm || null });
        importados++;
      } catch (err) { erros++; console.error(err); }
    }

    // Recarregar carteira
    try {
      const ativos = await carregarAtivos(carteiraId);
      setCarteira(ativos.map(a => ({
        id: a.id,
        ticker: a.ticker,
        qtd: Number(a.qtd),
        pm: a.pm ? Number(a.pm) : null,
        peso_alvo: a.peso_alvo ? Number(a.peso_alvo) : null
      })));
    } catch (err) { console.error(err); }

    showToast(`${importados} ativos importados${erros > 0 ? `, ${erros} erros` : ""}`, importados > 0 ? "success" : "error");
    e.target.value = "";
  };

  return (
    <div style={{display:"grid",gridTemplateColumns:"360px 1fr",gap:16,alignItems:"start"}}>
      <div style={{display:"flex",flexDirection:"column",gap:14,position:"sticky",top:120}}>
      <Card>
        <STitle>REGISTRAR COMPRA</STitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <input placeholder="Ticker (PETR4)" value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key==="Enter"&&add()}
            style={{gridColumn:"1/-1",background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:9,padding:"11px 12px",fontSize:13,color:"var(--ui-text)",width:"100%"}}/>
          <input type="number" placeholder="Quantidade" value={qtd} onChange={e=>setQtd(e.target.value)}
            style={{background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:9,padding:"11px 10px",fontSize:13,color:"var(--ui-text)",width:"100%"}}/>
          <input type="number" placeholder="Preço médio R$" value={pm} onChange={e=>setPm(e.target.value)}
            style={{background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:9,padding:"11px 10px",fontSize:13,color:"var(--ui-text)",width:"100%"}}/>
          <input type="date" value={data} onChange={e=>setData(e.target.value)}
            style={{gridColumn:"1/-1",background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:9,padding:"11px 12px",fontSize:13,color:"var(--ui-text)",width:"100%"}}/>
        </div>
        <button onClick={add} style={{width:"100%",background:"linear-gradient(135deg,#7b61ff,#5540dd)",border:"none",borderRadius:9,padding:"12px",color:"#ffffff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          <><Plus size={14} strokeWidth={2.5} style={{display:"inline",verticalAlign:"middle",marginRight:6}}/>Registrar Compra</>
        </button>
      </Card>

      {alertasReb.length > 0 && (
        <div style={{background:"rgba(255,214,10,0.04)",border:"1px solid rgba(255,214,10,0.15)",borderRadius:12,padding:"12px 14px"}}>
          <STitle color="var(--ui-warning)"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><AlertTriangle size={12} strokeWidth={2.5}/>REBALANCEAMENTO NECESSÁRIO</span></STitle>
          {alertasReb.map(p => (
            <div key={p.ticker} style={{fontSize:12,color:"var(--ui-text-muted)",marginBottom:3}}>
              {p.ticker}: atual {fmt(p.peso,1)}% · alvo {pesoAlvo[p.ticker]}% · desvio {fmt(Math.abs(p.peso-pesoAlvo[p.ticker]),1)}%
            </div>
          ))}
        </div>
      )}

      {historico.length > 0 && (
        <Card>
          <STitle>HISTÓRICO DE COMPRAS</STitle>
          {[...historico].reverse().slice(0,8).map((h,i) => (
            <div key={i} style={{display:"flex",justifyContent:"space-between",borderBottom:"1px solid var(--ui-border-soft)",paddingBottom:7,marginBottom:7}}>
              <div><span style={{fontWeight:700,color:"var(--ui-accent)",fontSize:13}}>{h.ticker}</span><span style={{fontSize:11,color:"var(--ui-text-faint)",marginLeft:8}}>{h.data}</span></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:12,color:"var(--ui-text)"}}>{h.qtd} cotas</div>{h.pm&&<div style={{fontSize:11,color:"var(--ui-text-muted)"}}>{fmtBRL(h.pm)} cada</div>}</div>
            </div>
          ))}
        </Card>
      )}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {carteira.length > 0 ? <>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <STitle>ATIVOS ({carteira.length})</STitle>
            {atualizadoEm && (
              <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"var(--ui-text-faint)"}}>
                <span className="blink" style={{width:5,height:5,borderRadius:"50%",background:"var(--ui-success)"}}/>
                <span>Cotações ao vivo · {atualizadoEm.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span>
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={exportarCSV} title="Exportar carteira em CSV" style={{
              background:"var(--ui-bg-secondary)",border:"1px solid var(--ui-border)",borderRadius:6,padding:"6px 10px",
              color:"var(--ui-text-muted)",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontWeight:600
            }}><Download size={12}/>Exportar</button>
            <label style={{
              background:"var(--ui-bg-secondary)",border:"1px solid var(--ui-border)",borderRadius:6,padding:"6px 10px",
              color:"var(--ui-text-muted)",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontWeight:600
            }}>
              <FileUp size={12}/>Importar
              <input type="file" accept=".csv" onChange={importarCSV} style={{display:"none"}}/>
            </label>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
        {carteira.map((a,i) => {
          const pos = dados?.posicoes?.find(p => p.ticker === a.ticker);
          const cotacao = cotacoes[a.ticker];
          // Usa preço da análise IA se houver, senão da cotação em tempo real
          const precoAtual = pos?.preco || cotacao?.preco;
          const valorTotal = precoAtual ? precoAtual * a.qtd : null;
          const variacaoPctPM = a.pm && precoAtual ? (precoAtual - a.pm) / a.pm * 100 : null;
          const variacaoDia = cotacao?.variacaoPct;
          return (
            <Card key={a.ticker}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:34,height:34,borderRadius:9,background:`${PALETTE[i%PALETTE.length]}20`,display:"flex",
                    alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,
                    color:PALETTE[i%PALETTE.length]}}>{a.ticker.slice(0,4)}</div>
                  <div>
                    <div style={{fontWeight:700,color:"var(--ui-text)",fontSize:14}}>{a.ticker}</div>
                    <div style={{fontSize:11,color:"var(--ui-text-faint)"}}>{a.qtd} cotas{a.pm?` · PM ${fmtBRL(a.pm)}`:""}</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {valorTotal != null && (
                    <div style={{textAlign:"right"}}>
                      <div style={{fontWeight:700,color:"var(--ui-text)",fontSize:13,fontFamily:"'JetBrains Mono',monospace"}}>{fmtBRL(valorTotal)}</div>
                      {variacaoPctPM != null && <Badge val={variacaoPctPM}/>}
                    </div>
                  )}
                  <button onClick={() => removerAtivoCarteira(a)}
                    style={{background:"rgba(255,77,109,0.08)",border:"1px solid rgba(255,77,109,0.19)",borderRadius:6,padding:"6px 8px",color:"var(--ui-danger)",cursor:"pointer",display:"flex",alignItems:"center"}}><Trash2 size={13} strokeWidth={2}/></button>
                </div>
              </div>

              {/* Cotação em tempo real (visível mesmo sem análise IA) */}
              {cotacao && precoAtual && (
                <div style={{
                  display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"6px 10px",borderRadius:7,
                  background:"var(--ui-bg-secondary)",
                  marginBottom:6,marginTop:2
                }}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span className="blink" style={{width:6,height:6,borderRadius:"50%",background:"var(--ui-success)"}}/>
                    <span style={{fontSize:10,color:"var(--ui-text-faint)",fontWeight:600,letterSpacing:0.5}}>AO VIVO</span>
                  </div>
                  {/* Sparkline 30d entre o badge "AO VIVO" e o preço */}
                  {historicos[a.ticker]?.pontos?.length >= 5 && (
                    <div style={{flex:1,display:"flex",justifyContent:"center",margin:"0 8px",opacity:0.85}} title="Últimos 30 dias">
                      <Sparkline
                        data={historicos[a.ticker].pontos.map(p => p.c)}
                        width={70}
                        height={20}
                        color="auto"
                        strokeWidth={1.4}
                      />
                    </div>
                  )}
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:12,fontWeight:700,color:"var(--ui-text)",fontFamily:"'JetBrains Mono',monospace"}}>{fmtBRL(precoAtual)}</span>
                    {variacaoDia != null && (
                      <span style={{
                        fontSize:10,fontWeight:700,
                        color: variacaoDia >= 0 ? "var(--ui-success)" : "var(--ui-danger)"
                      }}>
                        {variacaoDia >= 0 ? "▲" : "▼"} {fmt(Math.abs(variacaoDia),2)}%
                      </span>
                    )}
                  </div>
                </div>
              )}

              {pos && (
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>
                  {pos.dy>0 && <span style={{fontSize:10,background:"rgba(255,214,10,0.07)",color:"var(--ui-warning)",borderRadius:10,padding:"2px 7px"}}>DY {fmt(pos.dy)}%</span>}
                  {pos.pl && <span style={{fontSize:10,background:"rgba(123,97,255,0.07)",color:"var(--ui-accent)",borderRadius:10,padding:"2px 7px"}}>P/L {fmt(pos.pl)}</span>}
                  {pos.setor && <span style={{fontSize:10,background:"rgba(255,255,255,0.03)",color:"var(--ui-text-muted)",borderRadius:10,padding:"2px 7px"}}>{pos.setor}</span>}
                </div>
              )}
              <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:"var(--ui-text-disabled)"}}>Peso alvo %:</span>
                <input type="number" placeholder="%" value={pesoAlvo[a.ticker]||""} min={0} max={100}
                  onChange={e => setPesoAlvo(p => ({...p,[a.ticker]:Number(e.target.value)}))}
                  style={{width:58,background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:7,padding:"4px 8px",fontSize:12,color:"var(--ui-text)"}}/>
                {pos && <span style={{fontSize:11,color:"var(--ui-text-disabled)"}}>atual {fmt(pos.peso,1)}%</span>}
              </div>
            </Card>
          );
        })}
        </div>
      </> : (
        <EmptyState
          icon={Briefcase}
          iconColor="var(--ui-accent)"
          title="Sua carteira está pronta para começar"
          description="Adicione ativos manualmente no formulário ao lado, importe um CSV existente, ou analise o mercado sem carteira para ver oportunidades."
          examples={["PETR4", "ITUB4", "MXRF11", "VALE3", "BBAS3"]}
          onExampleClick={(ex) => {
            // Foca o input de ticker e preenche
            setTicker(ex);
            setTimeout(() => {
              const input = document.querySelector('input[placeholder*="Ticker"]');
              input?.focus();
            }, 50);
          }}
        />
      )}

      </div>
    </div>
  );
}

// ─── Seção: Visualizações da Carteira (usado dentro de TabAnalise) ────────────

// Normaliza nomes de setores para evitar duplicatas (ex: "Bancos" vs "Financeiro")
const SETOR_ALIASES = {
  "bancos": "Financeiro",
  "banco": "Financeiro",
  "financeiro": "Financeiro",
  "bancário": "Financeiro",
  "energia elétrica": "Energia",
  "energia eletrica": "Energia",
  "energia": "Energia",
  "petróleo": "Petróleo & Mineração",
  "petroleo": "Petróleo & Mineração",
  "petróleo & mineração": "Petróleo & Mineração",
  "petroleo & mineracao": "Petróleo & Mineração",
  "mineração": "Petróleo & Mineração",
  "mineracao": "Petróleo & Mineração",
  "petróleo & gás": "Petróleo & Mineração",
  "petroleo & gas": "Petróleo & Mineração",
  "petróleo e gás": "Petróleo & Mineração",
  "petroleo e gas": "Petróleo & Mineração",
  "petróleo, gás e biocombustíveis": "Petróleo & Mineração",
  "óleo e gás": "Petróleo & Mineração",
  "oleo e gas": "Petróleo & Mineração",
  "fundos imobiliários": "Fundos Imobiliários",
  "fundos imobiliarios": "Fundos Imobiliários",
  "imobiliário": "Fundos Imobiliários",
  "imobiliario": "Fundos Imobiliários",
  "fii": "Fundos Imobiliários",
  "fiis": "Fundos Imobiliários",
  "logística": "Fundos Imobiliários",
  "logistica": "Fundos Imobiliários",
  "saneamento": "Saneamento",
  "consumo & varejo": "Consumo",
  "consumo e varejo": "Consumo",
  "varejo": "Consumo",
  "consumo": "Consumo",
  "saúde": "Saúde",
  "saude": "Saúde",
};

// Heurística de fallback: detecta categoria por palavra-chave
function detectarSetorPorPalavraChave(s) {
  const lower = s.toLowerCase();
  if (/banc|financ/.test(lower)) return "Financeiro";
  if (/petr[óo]leo|miner|gás|gas|combust/.test(lower)) return "Petróleo & Mineração";
  if (/energia|el[eé]trica|distribu/.test(lower)) return "Energia";
  // FIIs: logístico/logística, papel/papéis, shopping, galpões, lajes, híbrido, indústria
  if (/imobili|fii|log[íi]stic[oa]|shopping|lajes|h[íi]brido|pap[eé]is|pap[eé]l|galp[ãa]o|galp[õo]es|ind[úu]stria/.test(lower)) return "Fundos Imobiliários";
  if (/sane|[áa]gua/.test(lower)) return "Saneamento";
  if (/sa[úu]de|hospital|farma/.test(lower)) return "Saúde";
  if (/varejo|consumo|aliment/.test(lower)) return "Consumo";
  return null;
}

function normalizarSetor(s) {
  if (!s || s === "–" || s === "-") return "Outros";
  const key = s.toLowerCase().trim();
  if (SETOR_ALIASES[key]) return SETOR_ALIASES[key];
  // Tenta heurística por palavra-chave
  const detectado = detectarSetorPorPalavraChave(s);
  if (detectado) return detectado;
  return s; // mantém capitalização original se não conhecido
}

function VisualizacoesCarteira({ dados }) {
  const [g, setG] = useState("pizza");
  if (!dados || !dados.posicoes || dados.posicoes.length === 0) return null;

  const pos = dados.posicoes || [];
  const pizza = pos.map((p,i) => ({ name:p.ticker, value:+p.peso.toFixed(1), fill:PALETTE[i%PALETTE.length] }));
  const setoresMap = {};
  let setorIdx = 0;
  pos.forEach((p) => {
    const s = normalizarSetor(p.setor);
    if (!setoresMap[s]) {
      setoresMap[s] = { name: s, value: 0, fill: PALETTE[setorIdx % PALETTE.length] };
      setorIdx++;
    }
    setoresMap[s].value += p.peso;
  });
  // Arredonda valores para evitar flutuação de 0.01%
  Object.values(setoresMap).forEach(s => { s.value = +s.value.toFixed(1); });
  const perf = pos.filter(p=>p.pm&&p.pm>0).map(p=>({ticker:p.ticker,retorno:+((p.preco-p.pm)/p.pm*100).toFixed(2),fill:(p.preco-p.pm)>=0?"var(--ui-success)":"var(--ui-danger)"})).sort((a,b)=>b.retorno-a.retorno);
  // Canal 52s: só mostra os ativos com dados reais da IA (evita gráfico todo a 50%)
  // Detecta também quando todos os valores são idênticos (IA chutou) e descarta
  const canalRaw = pos.filter(p => typeof p.canal52 === "number" && !isNaN(p.canal52));
  const valoresUnicos = new Set(canalRaw.map(p => p.canal52));
  const canalConfia = canalRaw.length >= 3 && valoresUnicos.size > 1; // pelo menos 3 ativos e algum valor diferente
  const canal = canalConfia ? canalRaw.map(p => ({ ticker:p.ticker, posicao:p.canal52 })) : [];
  const divs = pos.length > 0 ? projetarDividendos(pos) : [];
  const radar = [
    {m:"Diversif.",v:Math.min(100,pos.length*15)},
    {m:"Dividendos",v:Math.min(100,pos.filter(p => {
      // Considera "bom pagador" quem tem DY >= 4%, usando estimativa por tipo se IA não trouxe
      const dy = p.dy || (p.tipo === "FII" ? 8 : 5);
      return dy >= 4;
    }).length/Math.max(1,pos.length)*100)},
    {m:"Valor",v:(() => {
      const validas = pos.filter(p => typeof p.canal52 === "number" && !isNaN(p.canal52));
      if (validas.length === 0) return 50; // sem dados de canal52, valor neutro
      const media = validas.reduce((s,p) => s + p.canal52, 0) / validas.length;
      return Math.max(0, Math.min(100, 100 - media));
    })()},
    {m:"Liquidez",v:Math.min(100,pos.filter(p=>p.tipo==="Ação").length/Math.max(1,pos.length)*100)},
    {m:"Renda",v:Math.min(100,pos.filter(p=>p.tipo==="FII").length/Math.max(1,pos.length)*100)},
  ];

  const TABS_G = [
    {k:"pizza",l:"Alocação"},
    {k:"setores",l:"Setores"},
    {k:"canal",l:"Canal 52s"},
    ...(perf.length>0?[{k:"perf",l:"Performance"}]:[]),
    ...(divs.length>0?[{k:"div",l:"Dividendos"}]:[]),
    {k:"radar",l:"Radar"},
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {TABS_G.map(t => (
          <button key={t.k} onClick={()=>setG(t.k)} style={{padding:"8px 16px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",background:g===t.k?"var(--ui-accent)":"var(--ui-bg-secondary)",border:`1px solid ${g===t.k?"var(--ui-accent)":"var(--ui-border)"}`,color:g===t.k?"#ffffff":"var(--ui-text-muted)",transition:"all .15s"}}>{t.l}</button>
        ))}
      </div>

      <Card style={{minHeight:380}}>
        {g==="pizza" && <>
          <STitle>ALOCAÇÃO POR ATIVO</STitle>
          {pizza.length > 0 ? <>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart><Pie data={pizza} cx="50%" cy="50%" innerRadius={48} outerRadius={82} dataKey="value" paddingAngle={2}>
                {pizza.map((e,i)=><Cell key={i} fill={e.fill}/>)}
              </Pie><Tooltip formatter={v=>[`${fmt(v,1)}%`,"Peso"]}/></PieChart>
            </ResponsiveContainer>
            <div style={{display:"flex",flexWrap:"wrap",gap:"5px 12px",marginTop:8,justifyContent:"center"}}>
              {pizza.map((e,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:8,height:8,borderRadius:2,background:e.fill}}/><span style={{fontSize:10,color:"var(--ui-text-faint)"}}>{e.name} {fmt(e.value,1)}%</span></div>)}
            </div>
          </> : <div style={{textAlign:"center",color:"var(--ui-text-disabled)",padding:"32px 0",fontSize:13}}>Sem ativos na carteira</div>}
        </>}

        {g==="setores" && <>
          <STitle>CONCENTRAÇÃO SETORIAL</STitle>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart><Pie data={Object.values(setoresMap)} cx="50%" cy="50%" outerRadius={82} dataKey="value" paddingAngle={3} label={({name,value})=>`${name} ${fmt(value,0)}%`} labelLine={false}>
              {Object.values(setoresMap).map((e,i)=><Cell key={i} fill={e.fill}/>)}
            </Pie><Tooltip formatter={v=>[`${fmt(v,1)}%`]}/></PieChart>
          </ResponsiveContainer>
        </>}

        {g==="canal" && <>
          <STitle>POSIÇÃO NO CANAL DE 52 SEMANAS (dados B3 via brapi)</STitle>
          <div style={{fontSize:10,color:"var(--ui-text-disabled)",marginBottom:10}}>0% = próximo da mínima · 100% = próximo da máxima anual</div>
          {canal.length > 0 ? (() => {
            // Detecta se todos os valores são iguais (IA retornou 50 pra todos = sem informação útil)
            const valores = canal.map(c => c.posicao);
            const todosIguais = valores.every(v => v === valores[0]);

            if (todosIguais) return (
              <div style={{textAlign:"center",padding:"32px 0"}}>
                <div style={{fontSize:13,color:"var(--ui-text-muted)",marginBottom:6}}>
                  Dados de canal não diferenciados
                </div>
                <div style={{fontSize:11,color:"var(--ui-text-faint)",maxWidth:380,margin:"0 auto",lineHeight:1.5}}>
                  A IA retornou a mesma posição ({valores[0]}%) para todos os ativos, indicando ausência de dados específicos por ticker. Tente rodar nova análise.
                </div>
              </div>
            );

            return <>
              <ResponsiveContainer width="100%" height={Math.max(130,canal.length*36)}>
                <BarChart data={canal} layout="vertical" margin={{left:8,right:16,top:4,bottom:4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--ui-bg-secondary)" horizontal={false}/>
                  <XAxis type="number" domain={[0,100]} tick={{fill:"var(--ui-text-muted)",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                  <YAxis dataKey="ticker" type="category" tick={{fill:"var(--ui-text-faint)",fontSize:11,fontWeight:700}} axisLine={false} tickLine={false} width={50}/>
                  <Tooltip formatter={v=>[`${fmt(v,0)}%`,"Canal"]}/>
                  <Bar dataKey="posicao" radius={[0,6,6,0]}>
                    {canal.map((e,i)=><Cell key={i} fill={e.posicao<=30?"var(--ui-success)":e.posicao<=70?"var(--ui-warning)":"var(--ui-danger)"}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{display:"flex",gap:10,marginTop:8,justifyContent:"center",flexWrap:"wrap"}}>
                {[{c:"var(--ui-success)",l:"Oportunidade"},{c:"var(--ui-warning)",l:"Neutro"},{c:"var(--ui-danger)",l:"Caro"}].map(x=><div key={x.l} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:x.c}}/><span style={{fontSize:10,color:"var(--ui-text-muted)"}}>{x.l}</span></div>)}
              </div>
            </>;
          })() : <div style={{textAlign:"center",padding:"32px 0"}}>
            <div style={{fontSize:13,color:"var(--ui-text-muted)",marginBottom:6}}>
              Sem dados de canal disponíveis
            </div>
            <div style={{fontSize:11,color:"var(--ui-text-faint)",maxWidth:340,margin:"0 auto",lineHeight:1.5}}>
              brapi não retornou min/max de 52 semanas para estes ativos. Pode acontecer com FIIs novos ou tickers com pouca liquidez.
            </div>
          </div>}
        </>}

        {g==="perf" && perf.length > 0 && <>
          <STitle>PERFORMANCE vs PREÇO MÉDIO</STitle>
          <ResponsiveContainer width="100%" height={Math.max(130,perf.length*38)}>
            <BarChart data={perf} layout="vertical" margin={{left:8,right:16,top:4,bottom:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ui-bg-secondary)" horizontal={false}/>
              <XAxis type="number" tick={{fill:"var(--ui-text-muted)",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v>0?"+":""}${fmt(v,1)}%`}/>
              <YAxis dataKey="ticker" type="category" tick={{fill:"var(--ui-text-faint)",fontSize:11,fontWeight:700}} axisLine={false} tickLine={false} width={50}/>
              <Tooltip formatter={v=>[`${v>=0?"+":""}${fmt(v,1)}%`,"Retorno"]}/>
              <Bar dataKey="retorno" radius={[0,6,6,0]}>{perf.map((e,i)=><Cell key={i} fill={e.fill}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </>}

        {g==="div" && divs.length > 0 && <>
          <STitle>PROJEÇÃO DE DIVIDENDOS (12 MESES)</STitle>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={divs} margin={{left:0,right:0,top:5,bottom:5}}>
              <defs><linearGradient id="gd" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--ui-success)" stopOpacity={0.35}/>
                <stop offset="95%" stopColor="var(--ui-success)" stopOpacity={0}/>
              </linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ui-bg-secondary)"/>
              <XAxis dataKey="mes" tick={{fill:"var(--ui-text-muted)",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"var(--ui-text-muted)",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${v}`} width={48}/>
              <Tooltip content={<TTip/>}/>
              <Area type="monotone" dataKey="dividendos" name="Dividendos" stroke="var(--ui-success)" strokeWidth={2} fill="url(#gd)"/>
            </AreaChart>
          </ResponsiveContainer>
          <div style={{textAlign:"center",marginTop:8,fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:700,color:"var(--ui-success)"}}>
            Estimativa anual: {fmtBRL(divs.reduce((s,d)=>s+d.dividendos,0))}
          </div>
        </>}

        {g==="radar" && <>
          <STitle>RADAR DA CARTEIRA</STitle>
          <ResponsiveContainer width="100%" height={210}>
            <RadarChart data={radar} cx="50%" cy="50%" outerRadius={75}>
              <PolarGrid stroke="var(--ui-bg-tertiary)"/>
              <PolarAngleAxis dataKey="m" tick={{fill:"var(--ui-text-faint)",fontSize:11}}/>
              <PolarRadiusAxis angle={30} domain={[0,100]} tick={{fill:"var(--ui-text-disabled)",fontSize:9}}/>
              <Radar name="Carteira" dataKey="v" stroke="var(--ui-accent)" fill="var(--ui-accent)" fillOpacity={0.3}/>
            </RadarChart>
          </ResponsiveContainer>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
            {radar.map(r => <Stat key={r.m} label={r.m} value={`${fmt(r.v,0)}%`} color="var(--ui-accent)"/>)}
          </div>
        </>}
      </Card>
    </div>
  );
}

// ─── Tab: Primeiro Milhão ─────────────────────────────────────────────────────
function TabMeta({ dados }) {
  const [meta,setMeta]=useState("1000000"); const [aporteMensal,setAporteMensal]=useState("1000");
  const [taxaAnual,setTaxaAnual]=useState("12"); const [resultado,setResultado]=useState(null);
  const pv = dados?.totalCarteira || 0;

  const calcular = () => {
    const M=Number(meta)||1e6; const pmt=Number(aporteMensal)||0; const taxa=Number(taxaAnual)||12;
    let meses = 0;
    while (meses < 1200) { meses++; if (juroCompostos(pv,pmt,taxa,meses) >= M) break; }
    const anos = meses/12;
    const totalAportado = pv + pmt*meses;
    const projecao = gerarProjecao(pv, pmt, taxa, Math.ceil(anos)+2);
    setResultado({ meses, anos, totalAportado, totalJuros:M-totalAportado, projecao, divMensal:M*(taxa/100/12), meta:M });
  };

  return (
    <div style={{display:"grid",gridTemplateColumns:"380px 1fr",gap:16,alignItems:"start"}}>
      <Card accent style={{position:"sticky",top:120}}>
        <STitle color="var(--ui-warning)"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Target size={12} strokeWidth={2.5}/>PRIMEIRO MILHÃO</span></STitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:11,color:"var(--ui-text-faint)",marginBottom:5}}>Meta patrimonial (R$)</div>
            <input type="number" value={meta} onChange={e=>setMeta(e.target.value)}
              style={{width:"100%",background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:9,padding:"12px",fontSize:16,color:"var(--ui-warning)",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:"var(--ui-text-faint)",marginBottom:5}}>Aporte mensal (R$)</div>
            <input type="number" value={aporteMensal} onChange={e=>setAporteMensal(e.target.value)}
              style={{width:"100%",background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:9,padding:"11px 10px",fontSize:14,color:"var(--ui-text)",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:"var(--ui-text-faint)",marginBottom:5}}>Taxa anual (%)</div>
            <input type="number" value={taxaAnual} onChange={e=>setTaxaAnual(e.target.value)}
              style={{width:"100%",background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:9,padding:"11px 10px",fontSize:14,color:"var(--ui-text)",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}/>
          </div>
        </div>
        {pv > 0 && <div style={{fontSize:12,color:"var(--ui-text-muted)",marginBottom:10}}>Patrimônio atual: <span style={{color:"var(--ui-success)",fontWeight:700}}>{fmtBRL(pv)}</span> incluído</div>}
        <button onClick={calcular} style={{width:"100%",background:"linear-gradient(135deg,#7b61ff,#5540dd)",border:"none",borderRadius:9,padding:"13px",color:"#ffffff",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:"0 2px 8px rgba(123,97,255,0.25)"}}>
          <><Sparkles size={14} strokeWidth={2.5} style={{display:"inline",verticalAlign:"middle",marginRight:6}}/>Calcular Minha Meta</>
        </button>
      </Card>

      {resultado && <>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Card style={{textAlign:"center",padding:"18px 10px"}}>
            <div style={{fontSize:32,fontWeight:900,color:"var(--ui-warning)",fontFamily:"'JetBrains Mono',monospace"}}>{resultado.anos.toFixed(1)}</div>
            <div style={{fontSize:12,color:"var(--ui-warning)",fontWeight:700}}>anos</div>
            <div style={{fontSize:11,color:"var(--ui-text-faint)",marginTop:2}}>{resultado.meses} meses</div>
          </Card>
          <Card style={{textAlign:"center",padding:"18px 10px"}}>
            <div style={{fontSize:20,fontWeight:900,color:"var(--ui-success)",fontFamily:"'JetBrains Mono',monospace"}}>{fmtK(resultado.divMensal)}</div>
            <div style={{fontSize:11,color:"var(--ui-success)",fontWeight:700}}>renda mensal potencial</div>
            <div style={{fontSize:10,color:"var(--ui-text-faint)",marginTop:2}}>ao atingir a meta</div>
          </Card>
          <Stat label="Total aportado" value={fmtBRL(resultado.totalAportado)} mono/>
          <Stat label="Ganho com juros" value={fmtBRL(Math.max(0,resultado.totalJuros))} color="var(--ui-success)" mono/>
        </div>
        <Card>
          <STitle>PROJEÇÃO PATRIMONIAL</STitle>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={resultado.projecao} margin={{left:0,right:0,top:5,bottom:5}}>
              <defs>
                <linearGradient id="gm" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--ui-warning)" stopOpacity={0.3}/><stop offset="95%" stopColor="var(--ui-warning)" stopOpacity={0}/></linearGradient>
                <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--ui-text-faint)" stopOpacity={0.2}/><stop offset="95%" stopColor="var(--ui-text-faint)" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ui-bg-secondary)"/>
              <XAxis dataKey="ano" tick={{fill:"var(--ui-text-muted)",fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"var(--ui-text-muted)",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v)} width={54}/>
              <Tooltip content={<TTip/>}/>
              <Area type="monotone" dataKey="Sem juros" stroke="var(--ui-text-disabled)" strokeWidth={1} fill="url(#gs)" strokeDasharray="4 2"/>
              <Area type="monotone" dataKey="Com juros" stroke="var(--ui-warning)" strokeWidth={2} fill="url(#gm)"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </>}
    </div>
  );
}

// ─── Tab: Cenários ────────────────────────────────────────────────────────────
function TabCenarios({ dados }) {
  const [aporteMensal,setAporteMensal]=useState("1000"); const [anos,setAnos]=useState("10");
  const [resultado,setResultado]=useState(null);
  const pv = dados?.totalCarteira || 0;

  const simular = () => {
    const { pts, cenarios } = simularCenarios(pv, Number(aporteMensal)||0, Number(anos)||10);
    setResultado({ pts, cenarios, anos:Number(anos) });
  };

  return (
    <div style={{display:"grid",gridTemplateColumns:"380px 1fr",gap:16,alignItems:"start"}}>
      <Card style={{position:"sticky",top:120}}>
        <STitle color="var(--ui-info)"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><BarChart3 size={12} strokeWidth={2.5}/>SIMULADOR DE CENÁRIOS</span></STitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div>
            <div style={{fontSize:11,color:"var(--ui-text-faint)",marginBottom:5}}>Aporte mensal (R$)</div>
            <input type="number" value={aporteMensal} onChange={e=>setAporteMensal(e.target.value)}
              style={{width:"100%",background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:9,padding:"11px 10px",fontSize:14,color:"var(--ui-text)",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:"var(--ui-text-faint)",marginBottom:5}}>Período</div>
            <select value={anos} onChange={e=>setAnos(e.target.value)}
              style={{width:"100%",background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:9,padding:"11px 10px",fontSize:13,color:"var(--ui-text)",cursor:"pointer"}}>
              {[5,10,15,20,25,30].map(a => <option key={a} value={a}>{a} anos</option>)}
            </select>
          </div>
        </div>
        {pv > 0 && <div style={{fontSize:12,color:"var(--ui-text-muted)",marginBottom:10}}>Ponto de partida: <span style={{color:"var(--ui-success)",fontWeight:700}}>{fmtBRL(pv)}</span></div>}
        <button onClick={simular} style={{width:"100%",background:"linear-gradient(135deg,#00b4d8,#0077a8)",border:"none",borderRadius:9,padding:"13px",color:"#ffffff",fontWeight:800,fontSize:14,cursor:"pointer"}}>
          <><Sparkles size={14} strokeWidth={2.5} style={{display:"inline",verticalAlign:"middle",marginRight:6}}/>Simular Cenários</>
        </button>
      </Card>

      {resultado && <>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {resultado.cenarios.map(c => {
            const final = resultado.pts[resultado.pts.length-1]?.[c.name] || 0;
            return (
              <Card key={c.name}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:12,color:"var(--ui-text-faint)",marginBottom:2}}>{c.name}</div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:18,fontWeight:700,color:c.color}}>{fmtK(final)}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"var(--ui-text-faint)"}}>em {resultado.anos} anos</div><div style={{fontSize:12,color:c.color,fontWeight:600}}>+{fmt(c.taxa,1)}% a.a.</div></div>
                </div>
              </Card>
            );
          })}
        </div>
        <Card>
          <STitle>COMPARATIVO DE CENÁRIOS</STitle>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={resultado.pts} margin={{left:0,right:0,top:5,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ui-bg-secondary)"/>
              <XAxis dataKey="ano" tick={{fill:"var(--ui-text-muted)",fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"var(--ui-text-muted)",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v)} width={54}/>
              <Tooltip content={<TTip/>}/>
              <Legend wrapperStyle={{fontSize:11,color:"var(--ui-text-faint)"}}/>
              {resultado.cenarios.map(c => <Line key={c.name} type="monotone" dataKey={c.name} stroke={c.color} strokeWidth={2} dot={false}/>)}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </>}
    </div>
  );
}

// ─── Tab: Watchlist ───────────────────────────────────────────────────────────
function TabWatchlist({ watchlist, setWatchlist, dados, onSave, userId, pedirConfirmacao }) {
  const [ticker,setTicker]=useState(""); const [alvo,setAlvo]=useState(""); const [nota,setNota]=useState("");
  const [salvando,setSalvando]=useState(false);

  const add = async () => {
    const t = ticker.toUpperCase().trim();
    if (!t || !alvo || !userId) return;
    setSalvando(true);
    try {
      const novoItem = await salvarWatchlist(userId, {
        ticker: t,
        preco_alvo: Number(alvo),
        nota
      });
      setWatchlist(prev => [...prev.filter(x=>x.ticker!==t), {
        id: novoItem.id,
        ticker: t,
        alvo: Number(alvo),
        nota,
        adicionado: new Date().toLocaleDateString("pt-BR")
      }]);
      setTicker(""); setAlvo(""); setNota("");
      onSave();
      showToast(`${t} adicionado à watchlist`, "success");
    } catch (e) {
      showToast("Erro: " + e.message, "error");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (item) => {
    const indiceOriginal = watchlist.findIndex(x => x.ticker === item.ticker);
    const itemBackup = { ...item };

    setWatchlist(p => p.filter(x => x.ticker !== item.ticker));

    let promessaDelete = null;
    if (item.id) {
      promessaDelete = removerWatchlist(item.id).catch(e => {
        console.error("Erro ao remover watchlist:", e);
      });
    }

    const desfez = await showToastUndo(
      `${item.ticker} removido da watchlist`,
      () => {
        setWatchlist(p => {
          const novo = [...p];
          novo.splice(indiceOriginal, 0, itemBackup);
          return novo;
        });
      }
    );

    if (desfez && item.id) {
      try {
        await promessaDelete;
        const novo = await salvarWatchlist(userId, {
          ticker: itemBackup.ticker,
          alvo: itemBackup.alvo,
          nota: itemBackup.nota,
          precoIA: itemBackup.precoIA
        });
        setWatchlist(p => p.map(x =>
          x.ticker === itemBackup.ticker ? { ...x, id: novo.id } : x
        ));
      } catch (e) {
        showToast("Erro ao restaurar: " + e.message, "error");
      }
    } else if (!desfez && promessaDelete) {
      await promessaDelete;
      onSave();
    }
  };

  const enriched = watchlist.map(w => {
    const pos = dados?.posicoes?.find(p => p.ticker === w.ticker);
    const preco = pos?.preco || w.precoIA;
    const diff = preco && w.alvo ? (w.alvo - preco) / preco * 100 : null;
    return { ...w, precoAtual:preco, diff, atingiu:preco && preco <= w.alvo };
  });

  const atingiram = enriched.filter(w => w.atingiu);

  return (
    <div style={{display:"grid",gridTemplateColumns:"380px 1fr",gap:16,alignItems:"start"}}>
      <Card style={{position:"sticky",top:120}}>
        <STitle color="var(--ui-accent)"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Eye size={12} strokeWidth={2.5}/>WATCHLIST</span></STitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <input placeholder="Ticker (VALE3)" value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())}
            style={{gridColumn:"1/-1",background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:9,padding:"11px 12px",fontSize:13,color:"var(--ui-text)",width:"100%"}}/>
          <input type="number" placeholder="Preço alvo R$" value={alvo} onChange={e=>setAlvo(e.target.value)}
            style={{background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:9,padding:"11px 10px",fontSize:13,color:"var(--ui-text)",width:"100%"}}/>
          <input placeholder="Nota (opcional)" value={nota} onChange={e=>setNota(e.target.value)}
            style={{background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:9,padding:"11px 10px",fontSize:13,color:"var(--ui-text)",width:"100%"}}/>
        </div>
        <button onClick={add} style={{width:"100%",background:"linear-gradient(135deg,#7b61ff,#5540dd)",border:"none",borderRadius:9,padding:"12px",color:"#ffffff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          <><Plus size={14} strokeWidth={2.5} style={{display:"inline",verticalAlign:"middle",marginRight:6}}/>Adicionar à Watchlist</>
        </button>
      </Card>

      <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {atingiram.length > 0 && (
        <div style={{background:"rgba(0,229,160,0.06)",border:"1px solid rgba(0,229,160,0.19)",borderRadius:12,padding:"14px 16px"}}>
          <STitle color="var(--ui-success)"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Target size={12} strokeWidth={2.5}/>PREÇO ALVO ATINGIDO</span></STitle>
          {atingiram.map(w => (
            <div key={w.ticker} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontWeight:700,color:"var(--ui-success)",fontSize:14}}>{w.ticker}</span>
              <span style={{fontSize:13,color:"var(--ui-text)"}}>{fmtBRL(w.precoAtual)} ≤ alvo {fmtBRL(w.alvo)} ✅</span>
            </div>
          ))}
        </div>
      )}

      {enriched.length > 0 ? (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:14}}>
          {enriched.map(w => (
            <Card key={w.ticker}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:34,height:34,borderRadius:9,background:"rgba(123,97,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"var(--ui-accent)"}}>{w.ticker.slice(0,4)}</div>
                  <div><div style={{fontWeight:700,color:"var(--ui-text)",fontSize:14}}>{w.ticker}</div>{w.nota&&<div style={{fontSize:11,color:"var(--ui-text-faint)"}}>{w.nota}</div>}</div>
                </div>
                <button onClick={() => { setWatchlist(p=>p.filter(x=>x.ticker!==w.ticker)); setTimeout(onSave,200); }}
                  style={{background:"rgba(255,77,109,0.08)",border:"1px solid rgba(255,77,109,0.19)",borderRadius:6,padding:"6px 8px",color:"var(--ui-danger)",cursor:"pointer",display:"flex",alignItems:"center"}}><Trash2 size={13} strokeWidth={2}/></button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <Stat label="Preço (estimado IA)" value={w.precoAtual?fmtBRL(w.precoAtual):"Rode análise"} color={w.atingiu?"var(--ui-success)":"var(--ui-text)"} mono/>
                <Stat label="Preço alvo" value={fmtBRL(w.alvo)} color="var(--ui-accent)" mono/>
                <Stat label="Distância" value={w.diff!=null?`${w.diff>0?"↓":"↑"} ${fmt(Math.abs(w.diff),1)}%`:"–"} color={w.diff!=null?(w.diff>0?"var(--ui-success)":"var(--ui-danger)"):"var(--ui-text-faint)"}/>
              </div>
              {w.diff!=null && (
                <div style={{marginTop:10,background:"var(--ui-bg-secondary)",borderRadius:8,height:6,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,Math.max(0,100-w.diff))}%`,background:w.atingiu?"var(--ui-success)":"var(--ui-accent)",opacity:0.85,borderRadius:8,transition:"width 1s ease"}}/>
                </div>
              )}
              <div style={{fontSize:10,color:"var(--ui-text-disabled)",marginTop:4}}>Adicionado em {w.adicionado}</div>
            </Card>
          ))}
        </div>
      ) : (
        <div style={{textAlign:"center",padding:"32px 0",color:"var(--ui-text-disabled)",fontSize:13}}>Nenhum ativo na watchlist ainda</div>
      )}
      </div>
    </div>
  );
}

// ─── Tab: IR ──────────────────────────────────────────────────────────────────
function TabIR({ dados }) {
  const [vendas,setVendas]=useState([]); const [ticker,setTicker]=useState(""); const [qtd,setQtd]=useState(""); const [precoV,setPrecoV]=useState("");

  const addVenda = () => {
    const t = ticker.toUpperCase().trim();
    if (!t || !qtd || !precoV) return;
    const pos = dados?.posicoes?.find(p => p.ticker === t);
    setVendas(prev => [...prev, { ticker:t, qtd:Number(qtd), pm:pos?.pm||0, precoVenda:Number(precoV) }]);
    setTicker(""); setQtd(""); setPrecoV("");
  };

  const ir = calcIR(vendas);

  return (
    <div style={{display:"grid",gridTemplateColumns:"420px 1fr",gap:16,alignItems:"start"}}>
      <Card style={{position:"sticky",top:120}}>
        <STitle color="var(--ui-warning)"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Receipt size={12} strokeWidth={2.5}/>CALCULADORA DE IR</span></STitle>
        <div style={{fontSize:12,color:"var(--ui-text-muted)",lineHeight:1.7,marginBottom:12}}>
          Ações têm isenção de IR para vendas até <b style={{color:"var(--ui-warning)"}}>R$ 20.000/mês</b>. Acima disso, incide 15% sobre o lucro.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
          {[{p:"Ticker",v:ticker,s:setTicker,up:true},{p:"Qtd",v:qtd,s:setQtd,t:"number"},{p:"Preço venda R$",v:precoV,s:setPrecoV,t:"number"}].map((f,i) => (
            <input key={i} type={f.t||"text"} placeholder={f.p} value={f.v}
              onChange={e=>f.s(f.up?e.target.value.toUpperCase():e.target.value)}
              style={{background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:9,padding:"10px 10px",fontSize:13,color:"var(--ui-text)",width:"100%"}}/>
          ))}
        </div>
        <button onClick={addVenda} style={{width:"100%",background:"linear-gradient(135deg,#7b61ff,#5540dd)",border:"none",borderRadius:9,padding:"11px",color:"#ffffff",fontWeight:700,fontSize:13,cursor:"pointer",boxShadow:"0 2px 8px rgba(123,97,255,0.25)"}}>
          <><Plus size={14} strokeWidth={2.5} style={{display:"inline",verticalAlign:"middle",marginRight:6}}/>Simular Venda</>
        </button>
      </Card>

      <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {vendas.length > 0 && <>
        <Card>
          <STitle>VENDAS SIMULADAS</STitle>
          {vendas.map((v,i) => (
            <div key={i} style={{display:"flex",justifyContent:"space-between",borderBottom:"1px solid var(--ui-border-soft)",paddingBottom:7,marginBottom:7}}>
              <div><span style={{fontWeight:700,color:"var(--ui-warning)"}}>{v.ticker}</span><span style={{fontSize:11,color:"var(--ui-text-faint)",marginLeft:8}}>{v.qtd} × {fmtBRL(v.precoVenda)}</span></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:12}}>{fmtBRL(v.qtd*v.precoVenda)}</div><Badge val={v.pm?((v.precoVenda-v.pm)/v.pm*100):null}/></div>
            </div>
          ))}
          <button onClick={()=>setVendas([])} style={{fontSize:11,color:"var(--ui-danger)",background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:5,marginTop:4}}><Trash2 size={11}/>Limpar vendas</button>
        </Card>

        <div style={{background:ir.isento?"rgba(0,229,160,0.06)":"rgba(255,77,109,0.06)",border:`1px solid ${ir.isento?"rgba(0,229,160,0.18)":"rgba(255,77,109,0.18)"}`,borderRadius:16,padding:"18px 16px"}}>
          <STitle color={ir.isento?"var(--ui-success)":"var(--ui-danger)"}><span style={{display:"inline-flex",alignItems:"center",gap:6}}>{ir.isento?<><CheckCircle2 size={12} strokeWidth={2.5}/>ISENTO DE IR</>:<><AlertTriangle size={12} strokeWidth={2.5}/>IR DEVIDO ESTE MÊS</>}</span></STitle>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Stat label="Total de vendas" value={fmtBRL(ir.totalVendas)} mono/>
            <Stat label="Lucro" value={fmtBRL(ir.lucro)} color={ir.lucro>=0?"var(--ui-success)":"var(--ui-danger)"} mono/>
            <Stat label="IR a pagar" value={fmtBRL(ir.ir)} color={ir.ir>0?"var(--ui-danger)":"var(--ui-success)"} mono/>
            <Stat label="Margem isenção" value={ir.restante>0?fmtBRL(ir.restante):"Esgotada"} color={ir.restante>0?"var(--ui-warning)":"var(--ui-danger)"} mono/>
          </div>
          {ir.ir > 0 && <div style={{marginTop:12,fontSize:12,color:"var(--ui-danger)",lineHeight:1.6,display:"flex",gap:8,alignItems:"flex-start"}}><AlertCircle size={14} strokeWidth={2.2} style={{flexShrink:0,marginTop:2}}/>Recolher via DARF até o último dia útil do mês seguinte. Código DARF: 6015.</div>}
        </div>
      </>}
      </div>
    </div>
  );
}

// ─── Tab: Análise IA ──────────────────────────────────────────────────────────
function TabAnalise({ dados, aporte, perfil, loading, fase }) {
  if (loading) return <LoadingCard fase={fase}/>;
  if (!dados?.analise) return (
    <div style={{textAlign:"center",padding:"48px 0",color:"var(--ui-text-disabled)",fontSize:13}}>
      Configure o aporte e clique em <b style={{color:"var(--ui-accent)"}}>Analisar</b>
    </div>
  );

  const a = dados.analise;
  const pos = dados.posicoes || [];
  const temCarteira = pos.length > 0;

  // Análise de risco quantitativa (calculada localmente, sem IA)
  const risco = temCarteira ? analisarRisco(pos, normalizarSetor) : null;
  const score = risco?.score ?? null;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Badge IA */}
      <div style={{background:"rgba(123,97,255,0.06)",border:"1px solid rgba(123,97,255,0.15)",borderRadius:10,padding:"12px 16px",display:"flex",gap:12,alignItems:"center"}}>
        <div style={{
          width:32,height:32,borderRadius:8,background:"rgba(123,97,255,0.12)",
          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0
        }}><Sparkles size={16} color="var(--ui-accent)" strokeWidth={2.5}/></div>
        <div style={{fontSize:12,color:"var(--ui-text-muted)",lineHeight:1.6}}>
          Análise gerada pelo <b style={{color:"var(--ui-text)"}}>Gemini 2.5 Flash</b> com cotações em tempo real (<b>brapi</b>) e fundamentos oficiais B3/CVM (<b>bolsai</b>). Confirme na sua corretora antes de operar.
        </div>
      </div>

      {/* Análise de Risco Quantitativa */}
      {risco && (
        <Card accent>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{textAlign:"center",minWidth:70}}>
                <div style={{fontSize:40,fontWeight:900,color:score>=70?"var(--ui-success)":score>=45?"var(--ui-warning)":"var(--ui-danger)",fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{score}</div>
                <div style={{fontSize:10,color:score>=70?"var(--ui-success)":score>=45?"var(--ui-warning)":"var(--ui-danger)",marginTop:2,fontWeight:700}}>{score>=70?"Saudável":score>=45?"Moderado":"Atenção"}</div>
                <div style={{fontSize:9,color:"var(--ui-text-disabled)"}}>Score</div>
              </div>
              <div>
                <STitle>ANÁLISE DE RISCO</STitle>
                <div style={{fontSize:11,color:"var(--ui-text-faint)",marginTop:2}}>Métricas quantitativas calculadas a partir da carteira</div>
              </div>
            </div>
          </div>

          {/* Grid de métricas */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginBottom:14}}>
            <MetricaRisco
              icone={PieIcon}
              label="HHI ATIVOS"
              valor={risco.concentracao.hhi.toLocaleString("pt-BR")}
              cor={classificarHHI(risco.concentracao.hhi).cor}
              detalhe={classificarHHI(risco.concentracao.hhi).nivel}
              tooltip="Índice de Herfindahl: <1500 diversificado, 1500-2500 moderado, 2500+ concentrado"
            />
            <MetricaRisco
              icone={TrendingUp}
              label="MAIOR POSIÇÃO"
              valor={risco.concentracao.maiorPosicao ? `${risco.concentracao.maiorPosicao.peso}%` : "–"}
              cor={
                !risco.concentracao.maiorPosicao ? "default"
                : risco.concentracao.maiorPosicao.peso > 25 ? "danger"
                : risco.concentracao.maiorPosicao.peso > 15 ? "warning"
                : "success"
              }
              detalhe={risco.concentracao.maiorPosicao?.ticker || "–"}
              tooltip="Maior posição individual. Ideal manter abaixo de 15% para evitar concentração."
            />
            <MetricaRisco
              icone={Activity}
              label="TOP 3 ATIVOS"
              valor={`${risco.concentracao.top3Pct}%`}
              cor={
                risco.concentracao.top3Pct > 70 ? "danger"
                : risco.concentracao.top3Pct > 50 ? "warning"
                : "success"
              }
              detalhe={`${risco.concentracao.qtdAtivos} ativo${risco.concentracao.qtdAtivos !== 1 ? "s" : ""} no total`}
              tooltip="Quanto da carteira está nos 3 maiores ativos. Acima de 70% indica concentração."
            />
            <MetricaRisco
              icone={Building2}
              label="SETOR DOMINANTE"
              valor={risco.setorial.maiorSetor ? `${risco.setorial.maiorSetor.peso}%` : "–"}
              cor={
                !risco.setorial.maiorSetor ? "default"
                : risco.setorial.maiorSetor.peso > 50 ? "danger"
                : risco.setorial.maiorSetor.peso > 35 ? "warning"
                : "success"
              }
              detalhe={risco.setorial.maiorSetor?.setor || "–"}
              tooltip="Maior exposição setorial. Acima de 50% indica risco setorial elevado."
            />
            <MetricaRisco
              icone={Globe}
              label="DIVERSIFICAÇÃO"
              valor={`${risco.setorial.qtdSetores}`}
              cor={
                risco.setorial.qtdSetores >= 5 ? "success"
                : risco.setorial.qtdSetores >= 3 ? "warning"
                : "danger"
              }
              detalhe={`setor${risco.setorial.qtdSetores !== 1 ? "es" : ""}`}
              tooltip="Quantidade de setores diferentes na carteira. 5+ é ideal para boa diversificação."
            />
            <MetricaRisco
              icone={Shield}
              label="HHI SETORIAL"
              valor={risco.setorial.hhi.toLocaleString("pt-BR")}
              cor={classificarHHI(risco.setorial.hhi).cor}
              detalhe={classificarHHI(risco.setorial.hhi).nivel}
              tooltip="Concentração entre setores. Mesma escala do HHI de ativos."
            />
          </div>

          {/* Alertas */}
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {risco.alertas.map((al, i) => {
              const cor = al.tipo === "danger" ? "var(--ui-danger)" : al.tipo === "warning" ? "var(--ui-warning)" : "var(--ui-success)";
              const Icon = al.tipo === "danger" ? AlertCircle : al.tipo === "warning" ? AlertTriangle : CheckCircle2;
              const bg = al.tipo === "danger" ? "rgba(255,77,109,0.06)" : al.tipo === "warning" ? "rgba(255,214,10,0.07)" : "rgba(0,229,160,0.06)";
              const border = al.tipo === "danger" ? "rgba(255,77,109,0.18)" : al.tipo === "warning" ? "rgba(255,214,10,0.2)" : "rgba(0,229,160,0.18)";
              return (
                <div key={i} style={{
                  background: bg,
                  border: `1px solid ${border}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}>
                  <Icon size={14} color={cor} strokeWidth={2.2} style={{flexShrink:0}}/>
                  <span style={{fontSize:12,color:"var(--ui-text-secondary)"}}>{al.mensagem}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Diagnóstico */}
      <Card>
        <STitle>{temCarteira?"DIAGNÓSTICO DA CARTEIRA":"CONTEXTO DO MERCADO"}</STitle>
        <p style={{fontSize:13,color:"var(--ui-text-muted)",lineHeight:1.75}}>{a.diagnostico}</p>
      </Card>

      {/* Alertas em grid */}
      {a.alertas?.length > 0 && <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
      {a.alertas?.map((al,i) => (
        <div key={i} style={{background:al.tipo==="perigo"?"rgba(255,77,109,0.06)":al.tipo==="atencao"?"rgba(255,214,10,0.06)":"rgba(0,229,160,0.06)",border:`1px solid ${al.tipo==="perigo"?"rgba(255,77,109,0.18)":al.tipo==="atencao"?"rgba(255,214,10,0.18)":"rgba(0,229,160,0.18)"}`,borderRadius:10,padding:"12px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
          <div style={{flexShrink:0,marginTop:1}}>
            {al.tipo==="perigo"
              ? <AlertCircle size={18} color="var(--ui-danger)" strokeWidth={2.2}/>
              : al.tipo==="atencao"
                ? <AlertTriangle size={18} color="var(--ui-warning)" strokeWidth={2.2}/>
                : <CheckCircle2 size={18} color="var(--ui-success)" strokeWidth={2.2}/>}
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:"var(--ui-text)",marginBottom:4}}>{al.titulo}</div>
            <div style={{fontSize:12,color:"var(--ui-text-muted)",lineHeight:1.6}}>{al.descricao}</div>
          </div>
        </div>
      ))}
      </div>}

      {/* Recomendações */}
      {a.recomendacoes?.length > 0 && <>
        <STitle>RECOMENDAÇÕES PARA {fmtBRL(aporte)}</STitle>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(380px,1fr))",gap:14}}>
        {a.recomendacoes.map((r,i) => {
          // Usa avaliação pré-calculada (enriquecimento) ou calcula se for análise antiga
          const avaliacao = r.avaliacaoCriterios || avaliarRecomendacao(r);
          const classificacao = classificarAderencia(avaliacao);
          return (
          <Card key={i} style={{
            borderColor: r.score>=80 ? "rgba(0,229,160,0.31)" : r.score>=60 ? "rgba(255,214,10,0.25)" : r.nova ? "rgba(0,229,160,0.18)" : "var(--ui-bg-tertiary)",
            position: "relative",
            overflow: "hidden"
          }}>
            {/* Glow lateral baseado no score */}
            {r.score >= 70 && (
              <div style={{
                position:"absolute",left:0,top:0,bottom:0,width:3,
                background: r.score>=85 ? "linear-gradient(180deg,#00e5a0,#00b4d8)" : "rgba(0,229,160,0.38)"
              }}/>
            )}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:40,height:40,borderRadius:10,background:r.nova?"rgba(0,229,160,0.12)":"rgba(123,97,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:r.nova?"var(--ui-success)":"var(--ui-accent)"}}>{r.ticker.slice(0,4)}</div>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontWeight:800,fontSize:15,color:"var(--ui-text)"}}>{r.ticker}</span>
                    {r.nova && <span style={{fontSize:9,background:"rgba(0,229,160,0.09)",color:"var(--ui-success)",border:"1px solid rgba(0,229,160,0.2)",borderRadius:4,padding:"2px 6px",fontWeight:700,letterSpacing:0.5}}>NOVO</span>}
                  </div>
                  <div style={{fontSize:11,color:"var(--ui-text-faint)"}}>{r.acao} · {r.setor}</div>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:700,fontSize:16,color:"var(--ui-accent)"}}>{r.alocacao}%</div>
                <div style={{fontSize:12,color:"var(--ui-text-faint)"}}>{fmtBRL(aporte*(r.alocacao/100))}</div>
              </div>
            </div>

            {/* Indicadores estimados */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
              {(r.precoReal||r.precoEstimado) ? <span style={{fontSize:11,background:r.precoReal?"rgba(0,229,160,0.12)":"var(--ui-bg-secondary)",color:r.precoReal?"var(--ui-success)":"var(--ui-text-muted)",borderRadius:10,padding:"3px 8px",fontWeight:600}}>{r.precoReal?"● ":"~"}{fmtBRL(r.precoReal||r.precoEstimado)}{r.fontePreco?` · ${r.fontePreco}`:""}</span> : null}
              {r.dy > 0 ? <span style={{fontSize:11,background:"rgba(255,214,10,0.14)",color:"var(--ui-warning)",borderRadius:10,padding:"3px 8px",fontWeight:600}}>DY ~{fmt(r.dy)}%</span> : null}
              {r.pl > 0 ? <span style={{fontSize:11,background:"rgba(123,97,255,0.14)",color:"var(--ui-accent)",borderRadius:10,padding:"3px 8px",fontWeight:600}}>P/L ~{fmt(r.pl)}</span> : null}
              {r.score > 0 ? <span style={{fontSize:11,background:"rgba(0,229,160,0.14)",color:"var(--ui-success)",borderRadius:10,padding:"3px 8px",fontWeight:600}}>Score {r.score}/100</span> : null}
              {r.canal52 != null && <span style={{fontSize:11,background:r.canal52<=30?"rgba(0,229,160,0.14)":r.canal52<=70?"rgba(255,214,10,0.14)":"rgba(255,77,109,0.14)",color:r.canal52<=30?"var(--ui-success)":r.canal52<=70?"var(--ui-warning)":"var(--ui-danger)",borderRadius:10,padding:"3px 8px",fontWeight:600}}>Canal {r.canal52}%</span>}
            </div>

            <div style={{fontSize:12,color:"var(--ui-text-muted)",lineHeight:1.65,background:"var(--ui-bg-input)",borderRadius:9,padding:"10px 12px"}}>{r.justificativa}</div>

            {/* Critérios fundamentalistas validados */}
            <CriteriosBadges avaliacao={avaliacao} classificacao={classificacao}/>

            {r.unidades > 0 && (
              <div style={{marginTop:8,fontSize:11,color:"var(--ui-text-muted)"}}>
                ~{r.unidades} {r.tipo==="FII"?"cotas":"ações"} com {fmtBRL(aporte*(r.alocacao/100))}
              </div>
            )}
          </Card>
          );
        })}
        </div>
      </>}

      {/* Vender */}
      {a.vender?.length > 0 && <>
        <STitle color="var(--ui-danger)"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><AlertCircle size={12} strokeWidth={2.5}/>CONSIDERE REVISAR / VENDER</span></STitle>
        {a.vender.map((v,i) => (
          <Card key={i} style={{borderColor:"rgba(255,77,109,0.12)"}}>
            <div style={{fontWeight:700,fontSize:14,color:"var(--ui-danger)",marginBottom:4}}>{v.ticker}</div>
            <div style={{fontSize:12,color:"var(--ui-text-muted)",lineHeight:1.6}}>{v.motivo}</div>
          </Card>
        ))}
      </>}

      {/* Seção colapsável: Visualizações da Carteira */}
      {temCarteira && <VisualizacoesColapsavel dados={dados}/>}

      {a.aviso && <div style={{background:"rgba(255,214,10,0.08)",border:"1px solid rgba(255,214,10,0.3)",borderRadius:10,padding:"12px 14px",fontSize:11,color:"var(--ui-text-secondary)",lineHeight:1.6,display:"flex",gap:8,alignItems:"flex-start"}}><AlertTriangle size={14} strokeWidth={2.2} style={{flexShrink:0,marginTop:1,color:"var(--ui-warning)"}}/>{a.aviso}</div>}
    </div>
  );
}

// ─── Wrapper colapsável para as visualizações da carteira ─────────────────────
function VisualizacoesColapsavel({ dados }) {
  const [aberto, setAberto] = useState(false);

  return (
    <Card style={{padding:0,overflow:"hidden"}}>
      <button onClick={() => setAberto(v => !v)} style={{
        width:"100%",
        background:"transparent",
        border:"none",
        padding:"14px 18px",
        cursor:"pointer",
        display:"flex",
        alignItems:"center",
        justifyContent:"space-between",
        textAlign:"left"
      }}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{
            width:32,height:32,borderRadius:8,
            background:"rgba(123,97,255,0.12)",
            display:"flex",alignItems:"center",justifyContent:"center"
          }}>
            <BarChart3 size={16} color="var(--ui-accent)" strokeWidth={2.2}/>
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"var(--ui-text)"}}>Visualizações da Carteira</div>
            <div style={{fontSize:11,color:"var(--ui-text-faint)"}}>
              Alocação, setores, performance, projeção de dividendos
            </div>
          </div>
        </div>
        <ChevronDown
          size={18}
          color="var(--ui-text-muted)"
          style={{
            transition:"transform 0.2s",
            transform: aberto ? "rotate(180deg)" : "rotate(0)"
          }}
        />
      </button>

      {aberto && (
        <div style={{
          padding:"0 18px 18px",
          borderTop:"1px solid var(--ui-border-soft)",
          paddingTop:18
        }}>
          <VisualizacoesCarteira dados={dados}/>
        </div>
      )}
    </Card>
  );
}

// ─── Tab: Análise de Ticker Individual ────────────────────────────────────────
function TabTicker({ userId, chamarIAComSearch }) {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState("");
  const [fase, setFase] = useState("");
  const [step, setStep] = useState(0);

  // Escuta eventos do Command Palette para análise direta
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.ticker) {
        setTicker(e.detail.ticker);
        // Executa análise automaticamente após setar o ticker
        setTimeout(() => analisarTicker(e.detail.ticker), 100);
      }
    };
    window.addEventListener("inventia:analyze-ticker", handler);
    return () => window.removeEventListener("inventia:analyze-ticker", handler);
  }, []);

  const analisar = () => analisarTicker(ticker);

  const analisarTicker = async (tickerArg) => {
    const t = (tickerArg || "").toUpperCase().trim();
    if (!t) { setErro("Digite um ticker"); return; }
    setErro(""); setLoading(true); setResultado(null); setStep(0);
    try {
      // ── PASSO 1-2: dados quantitativos via APIs (paralelo, ~1-2s total) ──
      setStep(1);
      setFase("Buscando dados B3 e fundamentos CVM...");

      const [cotacao, fundamentos, historico] = await Promise.all([
        buscarCotacao(t).catch(() => null),
        buscarFundamento(t).catch(() => null),
        buscarHistorico(t, "1mo").catch(() => null),
      ]);

      // Se nenhuma API achou o ticker, aborta antes de gastar tempo da IA
      if (!cotacao && !fundamentos) {
        throw new Error(`Ticker ${t} não encontrado. Verifique se é um ticker válido da B3.`);
      }

      const ehFII = fundamentos?.tipo === "FII" || /11$/.test(t);
      const nomeAtivo = fundamentos?.nome || cotacao?.nome || t;

      // ── PASSO 3: IA só para a parte qualitativa (tese + argumentos) ──
      // Passa os dados reais como contexto para a IA gerar análise embasada
      setStep(2);
      setStep(3);
      setFase("Gemini gerando tese de investimento...");

      const dadosParaIA = {
        ticker: t,
        nome: nomeAtivo,
        tipo: fundamentos?.tipo || (ehFII ? "FII" : "Ação"),
        setor: fundamentos?.setorCVM || null,
        preco: cotacao?.preco,
        variacaoDia: cotacao?.variacaoPct,
        canal52: cotacao?.canal52,
        ...(ehFII ? {
          dy: fundamentos?.dy,
          pvp: fundamentos?.pvp,
          nav: fundamentos?.nav,
          segmento: fundamentos?.segmento,
        } : {
          pl: fundamentos?.pl,
          pvp: fundamentos?.pvp,
          roe: fundamentos?.roe,
          roic: fundamentos?.roic,
          margemLiquida: fundamentos?.margemLiquida,
          divEbitda: fundamentos?.divEbitda,
          cagrLucro5y: fundamentos?.cagrLucro5y,
          cagrReceita5y: fundamentos?.cagrReceita5y,
        }),
      };

      const promptIA = `Você é analista financeiro brasileiro. Hoje: ${new Date().toLocaleDateString("pt-BR")}.

DADOS REAIS DE ${t} (já consultei B3/CVM, NÃO precisa buscar de novo):
${JSON.stringify(dadosParaIA, null, 2)}

Sua tarefa: gerar a TESE DE INVESTIMENTO baseada nesses números.

Responda APENAS este JSON (sem markdown, sem inventar números além dos fornecidos):
{
  "fundamentos": "Análise dos fundamentos em 2-3 parágrafos: contexto da empresa, vantagens competitivas, riscos do setor. SEM repetir os números — eles já estão visíveis na UI",
  "tese": {
    "tipo": "comprar|aguardar|evitar",
    "score": 80,
    "argumentos_positivos": ["ponto 1", "ponto 2", "ponto 3"],
    "argumentos_negativos": ["ponto 1", "ponto 2"],
    "preco_alvo": 55.0,
    "horizonte": "12 meses"
  },
  "comparaveis": ["TICKER1", "TICKER2", "TICKER3"],
  "resumo": "1-2 frases finais: vale a pena ou não, agora"
}

Use os dados quantitativos para JUSTIFICAR a tese. Se ROE ou DY estiver baixo,
mencione isso nos argumentos negativos. Se canal52 > 70%, mencione que está caro.`;

      const teseIA = await chamarIAComSearch(promptIA);

      setStep(4);

      // ── PASSO 4: monta resultado final unindo dados reais + tese da IA ──
      const resultadoFinal = {
        ticker: t,
        nome: nomeAtivo,
        tipo: dadosParaIA.tipo,
        setor: dadosParaIA.setor,
        preco: cotacao?.preco,
        fontePreco: "brapi.dev (B3 oficial)",
        variacaoDia: cotacao?.variacaoPct,
        indicadores: {
          dy: ehFII ? fundamentos?.dy : null, // Ações só têm DY se vier da brapi
          pl: fundamentos?.pl,
          pvp: fundamentos?.pvp,
          roe: ehFII ? null : fundamentos?.roe,
          roic: ehFII ? null : fundamentos?.roic,
          margemLiquida: ehFII ? null : fundamentos?.margemLiquida,
          divEbitda: ehFII ? null : fundamentos?.divEbitda,
          cagrLucro5y: ehFII ? null : fundamentos?.cagrLucro5y,
          min52: cotacao?.min52,
          max52: cotacao?.max52,
          canal52: cotacao?.canal52,
        },
        // Sparkline com últimos 30 dias
        historico: historico?.pontos || [],
        // Texto qualitativo da IA
        fundamentos: teseIA?.fundamentos,
        tese: teseIA?.tese,
        comparaveis: teseIA?.comparaveis || [],
        resumo: teseIA?.resumo,
        aviso: "Cotação e fundamentos via brapi/bolsai (B3/CVM). Tese gerada por IA. Confirme antes de operar.",
      };

      setResultado(resultadoFinal);
    } catch (e) {
      setErro(e.message || "Erro na análise");
    } finally {
      setLoading(false);
      setFase("");
      setTimeout(() => setStep(0), 500);
    }
  };

  // Steps para o LoadingSteps
  const steps = [
    { label: "Buscando cotação na brapi (B3)" },
    { label: "Buscando fundamentos na bolsai (CVM)", detail: "DY, P/L, ROE, P/VP, margens..." },
    { label: "Gemini gerando tese de investimento", detail: "Pode levar 5-15 segundos" },
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <STitle><span style={{display:"inline-flex",alignItems:"center",gap:6}}><FileSearch size={12} strokeWidth={2.5}/>ANÁLISE INDIVIDUAL DE TICKER</span></STitle>
        <div style={{display:"flex",gap:10}}>
          <input
            type="text"
            placeholder="Ex: PETR4, ITUB4, MXRF11, BBAS3..."
            value={ticker}
            onChange={e=>setTicker(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==="Enter"&&analisar()}
            style={{flex:1,background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:8,padding:"12px 16px",fontSize:16,color:"var(--ui-text)",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,letterSpacing:1}}
          />
          <button onClick={analisar} disabled={loading} style={{background:loading?"var(--ui-bg-secondary)":"linear-gradient(135deg,#7b61ff,#5540dd)",border:"none",borderRadius:8,padding:"12px 24px",color:"#ffffff",fontWeight:700,fontSize:13,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:8}}>
            {loading ? <Loader2 size={15} className="spin"/> : <Sparkles size={15} strokeWidth={2.5}/>}
            {loading ? fase || "Analisando..." : "Analisar"}
          </button>
        </div>
        {erro && <div style={{marginTop:10,background:"rgba(255,77,109,0.06)",border:"1px solid rgba(255,77,109,0.19)",borderRadius:8,padding:"10px 14px",color:"var(--ui-danger)",fontSize:12,display:"flex",alignItems:"center",gap:8}}><AlertCircle size={14}/>{erro}</div>}
      </Card>

      {/* LoadingSteps animado durante análise */}
      {loading && step > 0 && (
        <LoadingSteps steps={steps} currentStep={step - 1} accent="var(--ui-accent)"/>
      )}

      {resultado && (
        <>
          {/* Header do ativo */}
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:14}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:54,height:54,borderRadius:12,background:"rgba(123,97,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"var(--ui-accent)"}}>{resultado.ticker.slice(0,4)}</div>
                <div>
                  <div style={{fontSize:22,fontWeight:800,color:"var(--ui-text)",marginBottom:4}}>{resultado.ticker}</div>
                  <div style={{fontSize:13,color:"var(--ui-text-muted)"}}>{resultado.nome} · {resultado.setor}</div>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:28,fontWeight:800,color:"var(--ui-text)",fontFamily:"'JetBrains Mono',monospace"}}>{fmtBRL(resultado.preco)}</div>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
                  {resultado.variacaoDia != null && <Badge val={resultado.variacaoDia}/>}
                  {resultado.variacaoAno != null && <span style={{fontSize:11,color:resultado.variacaoAno>=0?"var(--ui-success)":"var(--ui-danger)",fontWeight:600}}>Ano: {resultado.variacaoAno>=0?"+":""}{fmt(resultado.variacaoAno,1)}%</span>}
                </div>
                {/* Mini gráfico dos últimos 30 dias */}
                {resultado.historico && resultado.historico.length > 1 && (
                  <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
                    <Sparkline data={resultado.historico.map(p => p.c)} width={140} height={36} color="auto" strokeWidth={1.8}/>
                  </div>
                )}
                {resultado.fontePreco && <div style={{fontSize:10,color:"var(--ui-text-disabled)",marginTop:4}}>Fonte: {resultado.fontePreco}</div>}
              </div>
            </div>
          </Card>

          {/* Indicadores */}
          {resultado.indicadores && (
            <Card>
              <STitle>INDICADORES FUNDAMENTALISTAS</STitle>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
                {resultado.indicadores.dy != null && <Stat label="DIVIDEND YIELD" value={fmt(resultado.indicadores.dy,2)+"%"} color="var(--ui-warning)" mono/>}
                {resultado.indicadores.pl != null && <Stat label="P/L" value={fmt(resultado.indicadores.pl,2)} color="var(--ui-accent)" mono/>}
                {resultado.indicadores.pvp != null && <Stat label="P/VP" value={fmt(resultado.indicadores.pvp,2)} color="var(--ui-accent)" mono/>}
                {resultado.indicadores.roe != null && <Stat label="ROE" value={fmt(resultado.indicadores.roe,1)+"%"} color="var(--ui-success)" mono/>}
                {resultado.indicadores.margemLiquida != null && <Stat label="MARGEM LÍQ." value={fmt(resultado.indicadores.margemLiquida,1)+"%"} mono/>}
                {resultado.indicadores.divEbitda != null && <Stat label="DÍV/EBITDA" value={fmt(resultado.indicadores.divEbitda,2)} mono/>}
                {resultado.indicadores.min52 != null && <Stat label="MÍN 52S" value={fmtBRL(resultado.indicadores.min52)} color="var(--ui-danger)" mono/>}
                {resultado.indicadores.max52 != null && <Stat label="MÁX 52S" value={fmtBRL(resultado.indicadores.max52)} color="var(--ui-success)" mono/>}
                {resultado.indicadores.canal52 != null && <Stat label="CANAL 52S" value={resultado.indicadores.canal52+"%"} color={resultado.indicadores.canal52<=30?"var(--ui-success)":resultado.indicadores.canal52<=70?"var(--ui-warning)":"var(--ui-danger)"} mono/>}
              </div>
            </Card>
          )}

          {/* Tese */}
          {resultado.tese && (
            <Card style={{border:`1px solid ${resultado.tese.tipo==="comprar"?"rgba(0,229,160,0.25)":resultado.tese.tipo==="aguardar"?"rgba(255,214,10,0.25)":"rgba(255,77,109,0.25)"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{
                    fontSize:11,fontWeight:800,letterSpacing:1.5,padding:"5px 12px",borderRadius:6,
                    background:resultado.tese.tipo==="comprar"?"rgba(0,229,160,0.18)":resultado.tese.tipo==="aguardar"?"rgba(255,214,10,0.22)":"rgba(255,77,109,0.18)",
                    border:`1px solid ${resultado.tese.tipo==="comprar"?"rgba(0,229,160,0.4)":resultado.tese.tipo==="aguardar"?"rgba(194,65,12,0.35)":"rgba(255,77,109,0.4)"}`,
                    color:resultado.tese.tipo==="comprar"?"var(--ui-success)":resultado.tese.tipo==="aguardar"?"var(--ui-warning)":"var(--ui-danger)"
                  }}>{resultado.tese.tipo.toUpperCase()}</span>
                  {resultado.tese.score && <span style={{fontSize:11,color:"var(--ui-text-muted)"}}>Score <b style={{color:"var(--ui-text)"}}>{resultado.tese.score}/100</b></span>}
                </div>
                {resultado.tese.preco_alvo && (
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:10,color:"var(--ui-text-faint)",fontWeight:700,letterSpacing:1}}>PREÇO ALVO ({resultado.tese.horizonte || "12m"})</div>
                    <div style={{fontSize:18,fontWeight:800,color:"var(--ui-accent)",fontFamily:"'JetBrains Mono',monospace"}}>{fmtBRL(resultado.tese.preco_alvo)}</div>
                    <div style={{fontSize:11,color:resultado.tese.preco_alvo>resultado.preco?"var(--ui-success)":"var(--ui-danger)",fontWeight:600}}>
                      {resultado.tese.preco_alvo>resultado.preco?"+":""}{fmt((resultado.tese.preco_alvo-resultado.preco)/resultado.preco*100,1)}%
                    </div>
                  </div>
                )}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {resultado.tese.argumentos_positivos?.length>0 && (
                  <div>
                    <div style={{fontSize:10,color:"var(--ui-success)",fontWeight:700,letterSpacing:1,marginBottom:8,display:"flex",alignItems:"center",gap:6}}><CheckCircle2 size={12}/>PONTOS POSITIVOS</div>
                    {resultado.tese.argumentos_positivos.map((arg,i) => (
                      <div key={i} style={{fontSize:12,color:"var(--ui-text-muted)",marginBottom:6,paddingLeft:14,position:"relative",lineHeight:1.5}}>
                        <span style={{position:"absolute",left:0,color:"var(--ui-success)"}}>+</span>{arg}
                      </div>
                    ))}
                  </div>
                )}
                {resultado.tese.argumentos_negativos?.length>0 && (
                  <div>
                    <div style={{fontSize:10,color:"var(--ui-danger)",fontWeight:700,letterSpacing:1,marginBottom:8,display:"flex",alignItems:"center",gap:6}}><AlertCircle size={12}/>PONTOS DE ATENÇÃO</div>
                    {resultado.tese.argumentos_negativos.map((arg,i) => (
                      <div key={i} style={{fontSize:12,color:"var(--ui-text-muted)",marginBottom:6,paddingLeft:14,position:"relative",lineHeight:1.5}}>
                        <span style={{position:"absolute",left:0,color:"var(--ui-danger)"}}>−</span>{arg}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Fundamentos */}
          {resultado.fundamentos && (
            <Card>
              <STitle>ANÁLISE FUNDAMENTALISTA</STitle>
              <div style={{fontSize:13,color:"var(--ui-text-muted)",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{resultado.fundamentos}</div>
            </Card>
          )}

          {/* Resumo + comparáveis */}
          <div style={{display:"grid",gridTemplateColumns:resultado.comparaveis?.length?"2fr 1fr":"1fr",gap:14}}>
            {resultado.resumo && (
              <Card accent>
                <STitle>RESUMO</STitle>
                <div style={{fontSize:14,color:"var(--ui-text)",lineHeight:1.6,fontWeight:500}}>{resultado.resumo}</div>
                {resultado.ultimoDividendo && (
                  <div style={{marginTop:12,padding:"10px 14px",background:"rgba(255,214,10,0.06)",border:"1px solid rgba(255,214,10,0.15)",borderRadius:8,display:"flex",alignItems:"center",gap:10}}>
                    <Coins size={16} color="var(--ui-warning)"/>
                    <div style={{fontSize:12,color:"var(--ui-text-muted)"}}>Último provento: <b style={{color:"var(--ui-warning)"}}>{fmtBRL(resultado.ultimoDividendo.valor)}</b> em {resultado.ultimoDividendo.data}</div>
                  </div>
                )}
              </Card>
            )}
            {resultado.comparaveis?.length > 0 && (
              <Card>
                <STitle>ATIVOS COMPARÁVEIS</STitle>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {resultado.comparaveis.map((t,i) => (
                    <button key={i} onClick={()=>{setTicker(t); setTimeout(analisar, 100);}} style={{
                      background:"var(--ui-bg-secondary)",border:"1px solid var(--ui-border)",borderRadius:6,padding:"8px 12px",
                      color:"var(--ui-accent)",fontWeight:700,fontSize:12,cursor:"pointer",textAlign:"left",
                      fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"center",justifyContent:"space-between"
                    }}>
                      {t} <ChevronRight size={14}/>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {resultado.aviso && <div style={{background:"rgba(255,214,10,0.08)",border:"1px solid rgba(255,214,10,0.3)",borderRadius:10,padding:"12px 14px",fontSize:11,color:"var(--ui-text-secondary)",lineHeight:1.6,display:"flex",gap:8,alignItems:"flex-start"}}><AlertTriangle size={14} strokeWidth={2.2} style={{flexShrink:0,marginTop:1,color:"var(--ui-warning)"}}/>{resultado.aviso}</div>}
        </>
      )}

      {!resultado && !loading && (
        <Card style={{textAlign:"center",padding:"40px 20px",border:"1px dashed var(--ui-border)"}}>
          <FileSearch size={36} color="var(--ui-bg-strong)" strokeWidth={1.5} style={{margin:"0 auto 14px"}}/>
          <div style={{color:"var(--ui-text-faint)",fontSize:13,marginBottom:8}}>Análise profunda de qualquer ticker da B3</div>
          <div style={{color:"var(--ui-text-disabled)",fontSize:12,lineHeight:1.7}}>
            Digite um ticker e o app puxa cotação ao vivo (brapi),<br/>
            fundamentos oficiais (bolsai/CVM) e gera tese com Gemini.
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Comparador de Ativos ────────────────────────────────────────────────
function TabComparador({ chamarIAComSearch }) {
  const [tickers, setTickers] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState("");
  const [fase, setFase] = useState("");

  const comparar = async () => {
    const ts = tickers.map(t=>t.toUpperCase().trim()).filter(Boolean);
    if (ts.length < 2) { setErro("Adicione pelo menos 2 tickers"); return; }
    setErro(""); setLoading(true); setResultado(null);
    try {
      // ── PASSO 1: dados quantitativos via APIs (paralelo) ──
      setFase(`📊 Buscando dados de ${ts.length} ativos (B3/CVM)...`);

      const [cotacoes, fundamentos] = await Promise.all([
        buscarCotacoes(ts).catch(() => ({})),
        buscarFundamentos(ts).catch(() => ({})),
      ]);

      // Verifica se conseguiu pelo menos algum dado
      const tickersComDados = ts.filter(t => cotacoes[t] || fundamentos[t]);
      if (tickersComDados.length < 2) {
        throw new Error("Não foi possível obter dados de pelo menos 2 dos tickers fornecidos. Verifique se os tickers existem na B3.");
      }

      // Monta os ativos com dados reais
      const ativosReais = ts.map(t => {
        const cot = cotacoes[t];
        const fund = fundamentos[t];
        const ehFII = fund?.tipo === "FII" || /11$/.test(t);
        return {
          ticker: t,
          nome: fund?.nome || cot?.nome || t,
          setor: fund?.setorCVM || (ehFII ? "Fundo Imobiliário" : null),
          tipo: fund?.tipo || (ehFII ? "FII" : "Ação"),
          preco: cot?.preco ?? null,
          variacaoDia: cot?.variacaoPct ?? null,
          canal52: cot?.canal52 ?? null,
          // Fundamentos (depende do tipo)
          ...(ehFII ? {
            dy: fund?.dy ?? null,
            pvp: fund?.pvp ?? null,
            pl: null,
            roe: null,
          } : {
            pl: fund?.pl ?? null,
            pvp: fund?.pvp ?? null,
            roe: fund?.roe ?? null,
            roic: fund?.roic ?? null,
            margemLiquida: fund?.margemLiquida ?? null,
            divEbitda: fund?.divEbitda ?? null,
          }),
        };
      });

      // ── PASSO 2: IA só para análise comparativa qualitativa ──
      setFase("🧠 Gerando análise comparativa...");

      const promptIA = `Você é analista financeiro brasileiro. Hoje: ${new Date().toLocaleDateString("pt-BR")}.

DADOS REAIS DOS ATIVOS (já consultei B3/CVM, NÃO precisa buscar):
${JSON.stringify(ativosReais, null, 2)}

Sua tarefa: comparação qualitativa baseada nesses números.

Responda APENAS este JSON (sem markdown, sem inventar números):
{
  "ativos_extra": [
    {
      "ticker": "${ts[0]}",
      "ponto_forte": "principal vantagem em uma frase curta baseada nos dados",
      "ponto_fraco": "principal risco em uma frase curta",
      "score": 80
    }
  ],
  "comparativo": "Análise em 2-3 parágrafos: quem é melhor para RENDA, quem é melhor para CRESCIMENTO, qual o trade-off de cada um. Use os números fornecidos para justificar.",
  "vencedor": {
    "ticker": "TICKER",
    "motivo": "Por que esse é a melhor opção considerando o conjunto"
  },
  "ranking": [
    {"ticker":"TICKER","posicao":1,"justificativa":"motivo curto baseado nos números"}
  ]
}

Inclua TODOS os ${ts.length} tickers em ativos_extra e ranking, na mesma ordem que recebeu.`;

      const teseIA = await chamarIAComSearch(promptIA).catch(() => ({}));

      // ── PASSO 3: monta resultado final ──
      // Combina dados reais (ativosReais) com análise qualitativa da IA (ativos_extra)
      const ativosFinais = ativosReais.map((a, i) => {
        const extra = teseIA?.ativos_extra?.find(e => e.ticker === a.ticker)
                  || teseIA?.ativos_extra?.[i]
                  || {};
        return {
          ...a,
          ponto_forte: extra.ponto_forte || "—",
          ponto_fraco: extra.ponto_fraco || "—",
          score: extra.score ?? null,
        };
      });

      setResultado({
        tickers: ts,
        ativos: ativosFinais,
        comparativo: teseIA?.comparativo || "Análise comparativa indisponível.",
        vencedor: teseIA?.vencedor || null,
        ranking: teseIA?.ranking || [],
        aviso: "Cotação e fundamentos via brapi/bolsai (B3/CVM). Comparação gerada por IA. Confirme antes de operar.",
      });
    } catch (e) {
      setErro(e.message || "Erro");
    } finally {
      setLoading(false);
      setFase("");
    }
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <STitle><span style={{display:"inline-flex",alignItems:"center",gap:6}}><GitCompare size={12} strokeWidth={2.5}/>COMPARADOR DE ATIVOS</span></STitle>
        <div style={{fontSize:12,color:"var(--ui-text-muted)",marginBottom:12,lineHeight:1.6}}>
          Compare 2 a 4 ativos lado a lado. A IA analisa fundamentos, valuation e indica qual é a melhor escolha.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10,marginBottom:14}}>
          {tickers.map((t,i) => (
            <input
              key={i}
              type="text"
              placeholder={`Ticker ${i+1}`}
              value={t}
              onChange={e=>{const u=[...tickers];u[i]=e.target.value.toUpperCase();setTickers(u);}}
              style={{background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:8,padding:"12px 14px",fontSize:14,color:"var(--ui-text)",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,letterSpacing:1}}
            />
          ))}
        </div>
        <button onClick={comparar} disabled={loading} style={{width:"100%",background:loading?"var(--ui-bg-secondary)":"linear-gradient(135deg,#7b61ff,#5540dd)",border:"none",borderRadius:8,padding:"13px",color:"#ffffff",fontWeight:700,fontSize:14,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          {loading ? <><Loader2 size={15} className="spin"/>{fase || "Comparando..."}</> : <><GitCompare size={15} strokeWidth={2.5}/>Comparar Ativos</>}
        </button>
        {erro && <div style={{marginTop:10,background:"rgba(255,77,109,0.06)",border:"1px solid rgba(255,77,109,0.19)",borderRadius:8,padding:"10px 14px",color:"var(--ui-danger)",fontSize:12,display:"flex",alignItems:"center",gap:8}}><AlertCircle size={14}/>{erro}</div>}
      </Card>

      {resultado && (
        <>
          {/* Vencedor */}
          {resultado.vencedor && (
            <Card accent style={{background:"linear-gradient(135deg,rgba(123,97,255,0.06),#00e5a005)"}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:48,height:48,borderRadius:12,background:"linear-gradient(135deg,#7b61ff,#00e5a0)",display:"flex",alignItems:"center",justifyContent:"center"}}><Sparkles size={22} color="#ffffff" strokeWidth={2.5}/></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:"var(--ui-accent)",fontWeight:700,letterSpacing:1.5,marginBottom:4}}>VENCEDOR DA COMPARAÇÃO</div>
                  <div style={{fontSize:24,fontWeight:800,color:"var(--ui-text)",marginBottom:6}}>{resultado.vencedor.ticker}</div>
                  <div style={{fontSize:13,color:"var(--ui-text-muted)",lineHeight:1.6}}>{resultado.vencedor.motivo}</div>
                </div>
              </div>
            </Card>
          )}

          {/* Tabela comparativa */}
          {resultado.ativos?.length > 0 && (
            <Card>
              <STitle>COMPARAÇÃO LADO A LADO</STitle>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid var(--ui-border)"}}>
                      <th style={{textAlign:"left",padding:"10px 8px",color:"var(--ui-text-faint)",fontWeight:700,fontSize:10,letterSpacing:1}}>ATIVO</th>
                      <th style={{textAlign:"right",padding:"10px 8px",color:"var(--ui-text-faint)",fontWeight:700,fontSize:10,letterSpacing:1}}>PREÇO</th>
                      <th style={{textAlign:"right",padding:"10px 8px",color:"var(--ui-text-faint)",fontWeight:700,fontSize:10,letterSpacing:1}}>DY</th>
                      <th style={{textAlign:"right",padding:"10px 8px",color:"var(--ui-text-faint)",fontWeight:700,fontSize:10,letterSpacing:1}}>P/L</th>
                      <th style={{textAlign:"right",padding:"10px 8px",color:"var(--ui-text-faint)",fontWeight:700,fontSize:10,letterSpacing:1}}>P/VP</th>
                      <th style={{textAlign:"right",padding:"10px 8px",color:"var(--ui-text-faint)",fontWeight:700,fontSize:10,letterSpacing:1}}>ROE</th>
                      <th style={{textAlign:"right",padding:"10px 8px",color:"var(--ui-text-faint)",fontWeight:700,fontSize:10,letterSpacing:1}}>SCORE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.ativos.map((a,i) => (
                      <tr key={i} style={{borderBottom:"1px solid var(--ui-border-soft)"}}>
                        <td style={{padding:"12px 8px"}}>
                          <div style={{fontWeight:700,color:a.ticker===resultado.vencedor?.ticker?"var(--ui-accent)":"var(--ui-text)"}}>{a.ticker}</div>
                          <div style={{fontSize:10,color:"var(--ui-text-faint)"}}>{a.setor}</div>
                        </td>
                        <td style={{textAlign:"right",padding:"12px 8px",fontFamily:"'JetBrains Mono',monospace",color:"var(--ui-text)",fontWeight:600}}>{fmtBRL(a.preco)}</td>
                        <td style={{textAlign:"right",padding:"12px 8px",fontFamily:"'JetBrains Mono',monospace",color:"var(--ui-warning)",fontWeight:600}}>{a.dy?fmt(a.dy,2)+"%":"–"}</td>
                        <td style={{textAlign:"right",padding:"12px 8px",fontFamily:"'JetBrains Mono',monospace",color:"var(--ui-text)"}}>{a.pl?fmt(a.pl,2):"–"}</td>
                        <td style={{textAlign:"right",padding:"12px 8px",fontFamily:"'JetBrains Mono',monospace",color:"var(--ui-text)"}}>{a.pvp?fmt(a.pvp,2):"–"}</td>
                        <td style={{textAlign:"right",padding:"12px 8px",fontFamily:"'JetBrains Mono',monospace",color:"var(--ui-success)",fontWeight:600}}>{a.roe?fmt(a.roe,1)+"%":"–"}</td>
                        <td style={{textAlign:"right",padding:"12px 8px"}}>
                          <span style={{
                            padding:"4px 10px",borderRadius:6,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",
                            background:a.score>=70?"rgba(0,229,160,0.12)":a.score>=50?"rgba(255,214,10,0.12)":"rgba(255,77,109,0.12)",
                            color:a.score>=70?"var(--ui-success)":a.score>=50?"var(--ui-warning)":"var(--ui-danger)"
                          }}>{a.score}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Pontos fortes/fracos */}
          {resultado.ativos?.length > 0 && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
              {resultado.ativos.map((a,i) => (
                <Card key={i}>
                  <div style={{fontWeight:800,fontSize:15,color:"var(--ui-text)",marginBottom:10}}>{a.ticker}</div>
                  {a.ponto_forte && (
                    <div style={{marginBottom:8,fontSize:12,color:"var(--ui-text-muted)",display:"flex",gap:8}}>
                      <CheckCircle2 size={14} color="var(--ui-success)" style={{flexShrink:0,marginTop:2}}/>
                      <div>{a.ponto_forte}</div>
                    </div>
                  )}
                  {a.ponto_fraco && (
                    <div style={{fontSize:12,color:"var(--ui-text-muted)",display:"flex",gap:8}}>
                      <AlertCircle size={14} color="var(--ui-danger)" style={{flexShrink:0,marginTop:2}}/>
                      <div>{a.ponto_fraco}</div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Análise comparativa */}
          {resultado.comparativo && (
            <Card>
              <STitle>ANÁLISE COMPARATIVA</STitle>
              <div style={{fontSize:13,color:"var(--ui-text-muted)",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{resultado.comparativo}</div>
            </Card>
          )}

          {resultado.aviso && <div style={{background:"rgba(255,214,10,0.08)",border:"1px solid rgba(255,214,10,0.3)",borderRadius:10,padding:"12px 14px",fontSize:11,color:"var(--ui-text-secondary)",display:"flex",gap:8,alignItems:"flex-start"}}><AlertTriangle size={14} strokeWidth={2.2} style={{flexShrink:0,marginTop:1,color:"var(--ui-warning)"}}/>{resultado.aviso}</div>}
        </>
      )}

      {!resultado && !loading && (
        <Card style={{textAlign:"center",padding:"40px 20px",border:"1px dashed var(--ui-border)"}}>
          <GitCompare size={36} color="var(--ui-bg-strong)" strokeWidth={1.5} style={{margin:"0 auto 14px"}}/>
          <div style={{color:"var(--ui-text-faint)",fontSize:13}}>Compare ativos lado a lado e descubra a melhor escolha</div>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Histórico de Análises ───────────────────────────────────────────────
function TabHistorico({ userId, pedirConfirmacao }) {
  const [analises, setAnalises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState(null);

  useEffect(() => {
    if (!userId) return;
    carregarAnalises(userId, 50)
      .then(setAnalises)
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [userId]);

  const removerItem = (analise) => {
    pedirConfirmacao({
      titulo: "Remover análise?",
      mensagem: `Remover esta análise de ${analise.tipo} do dia ${new Date(analise.created_at).toLocaleDateString("pt-BR")}? Esta ação não pode ser desfeita.`,
      perigoso: true,
      onConfirm: async () => {
        try {
          await removerAnalise(analise.id);
          setAnalises(p => p.filter(x => x.id !== analise.id));
          showToast("Análise removida", "success");
        } catch (e) { showToast("Erro: " + e.message, "error"); }
      }
    });
  };

  const compartilhar = async (analise) => {
    const url = `${window.location.origin}/?analise=${analise.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copiado! Cole para compartilhar.", "success");
    } catch {
      prompt("Copie este link:", url);
    }
  };

  if (loading) return <Card style={{textAlign:"center",padding:"40px"}}><Loader2 size={24} className="spin" color="var(--ui-accent)" style={{margin:"0 auto"}}/></Card>;

  if (!analises.length) return (
    <Card style={{textAlign:"center",padding:"40px 20px",border:"1px dashed var(--ui-border)"}}>
      <History size={36} color="var(--ui-bg-strong)" strokeWidth={1.5} style={{margin:"0 auto 14px"}}/>
      <div style={{color:"var(--ui-text-faint)",fontSize:13}}>Nenhuma análise no histórico ainda</div>
      <div style={{color:"var(--ui-text-disabled)",fontSize:12,marginTop:6}}>Rode uma análise IA e ela aparecerá aqui automaticamente</div>
    </Card>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <STitle><span style={{display:"inline-flex",alignItems:"center",gap:6}}><History size={12} strokeWidth={2.5}/>HISTÓRICO DE ANÁLISES ({analises.length})</span></STitle>

      {analises.map(a => {
        const isOpen = expandido === a.id;
        const data = new Date(a.created_at);
        return (
          <Card key={a.id} style={{cursor:"pointer"}} className="card-hover">
            <div onClick={() => setExpandido(isOpen ? null : a.id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14}}>
              <div style={{display:"flex",alignItems:"center",gap:14,flex:1}}>
                <div style={{width:42,height:42,borderRadius:10,background:a.tipo==="carteira"?"rgba(123,97,255,0.12)":"rgba(0,229,160,0.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {a.tipo==="carteira" ? <Briefcase size={18} color="var(--ui-accent)"/> : <Brain size={18} color="var(--ui-success)"/>}
                </div>
                <div>
                  <div style={{fontWeight:700,color:"var(--ui-text)",fontSize:14,marginBottom:2}}>
                    Análise {a.tipo === "carteira" ? "de carteira" : "de mercado"}
                    {a.aporte && <span style={{color:"var(--ui-text-faint)",fontWeight:500,fontSize:12,marginLeft:8}}>· {fmtBRL(a.aporte)}</span>}
                  </div>
                  <div style={{fontSize:11,color:"var(--ui-text-faint)",display:"flex",alignItems:"center",gap:10}}>
                    <span style={{display:"inline-flex",alignItems:"center",gap:4}}><Clock size={11}/>{data.toLocaleDateString("pt-BR")} {data.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span>
                    {a.perfil && <span>· {a.perfil}</span>}
                    {a.foco && <span>· {a.foco}</span>}
                    {a.resultado?.recomendacoes?.length && <span>· {a.resultado.recomendacoes.length} recomendações</span>}
                  </div>
                </div>
              </div>
              <ChevronRight size={16} color="var(--ui-text-faint)" style={{transform:isOpen?"rotate(90deg)":"rotate(0)",transition:"transform .2s"}}/>
            </div>

            {isOpen && (
              <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--ui-border-soft)"}}>
                {a.resultado?.diagnostico && (
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10,color:"var(--ui-accent)",fontWeight:700,letterSpacing:1,marginBottom:6}}>DIAGNÓSTICO</div>
                    <div style={{fontSize:13,color:"var(--ui-text-muted)",lineHeight:1.6}}>{a.resultado.diagnostico}</div>
                  </div>
                )}
                {a.resultado?.recomendacoes?.length > 0 && (
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10,color:"var(--ui-accent)",fontWeight:700,letterSpacing:1,marginBottom:8}}>RECOMENDAÇÕES</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                      {a.resultado.recomendacoes.map((r,i) => (
                        <div key={i} style={{background:"var(--ui-bg-input)",border:"1px solid var(--ui-border-soft)",borderRadius:8,padding:"10px 12px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                            <span style={{fontWeight:700,color:"var(--ui-text)",fontSize:13}}>{r.ticker}</span>
                            <span style={{fontSize:11,color:"var(--ui-accent)",fontWeight:700}}>{r.alocacao}%</span>
                          </div>
                          {r.precoReal && <div style={{fontSize:11,color:"var(--ui-success)",fontFamily:"'JetBrains Mono',monospace"}}>{fmtBRL(r.precoReal)}</div>}
                          {r.dy && <div style={{fontSize:10,color:"var(--ui-warning)"}}>DY {fmt(r.dy)}%</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{display:"flex",gap:8,paddingTop:12,borderTop:"1px solid var(--ui-border-soft)"}}>
                  <button onClick={(e)=>{e.stopPropagation(); compartilhar(a);}} style={{
                    background:"rgba(123,97,255,0.08)",border:"1px solid rgba(123,97,255,0.21)",borderRadius:6,
                    padding:"7px 12px",color:"var(--ui-accent)",fontSize:11,fontWeight:600,cursor:"pointer",
                    display:"flex",alignItems:"center",gap:6
                  }}><ExternalLink size={12}/>Copiar link</button>
                  <button onClick={(e)=>{e.stopPropagation(); removerItem(a);}} style={{
                    background:"rgba(255,77,109,0.08)",border:"1px solid rgba(255,77,109,0.19)",borderRadius:6,
                    padding:"7px 12px",color:"var(--ui-danger)",fontSize:11,fontWeight:600,cursor:"pointer",
                    display:"flex",alignItems:"center",gap:6
                  }}><Trash2 size={12}/>Remover</button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─── Tab: Proventos ───────────────────────────────────────────────────────────
function TabProventos({ userId, pedirConfirmacao }) {
  const [proventos, setProventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState("");
  const [tipo, setTipo] = useState("dividendo");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!userId) return;
    carregarProventos(userId)
      .then(setProventos)
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [userId]);

  const adicionar = async () => {
    const t = ticker.toUpperCase().trim();
    if (!t || !valor || !data) return;
    setSalvando(true);
    try {
      const novo = await registrarProvento(userId, {
        ticker: t, tipo, valor: Number(valor),
        data_pagamento: data, observacao: obs
      });
      setProventos(prev => [novo, ...prev]);
      setTicker(""); setValor(""); setData(""); setObs("");
      showToast(`Provento de ${novo.ticker} registrado`, "success");
    } catch (e) {
      showToast("Erro: " + e.message, "error");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id) => {
    const prov = proventos.find(p => p.id === id);
    if (!prov) return;
    const indiceOriginal = proventos.findIndex(p => p.id === id);

    setProventos(p => p.filter(x => x.id !== id));
    const promessaDelete = removerProvento(id).catch(e => {
      console.error("Erro ao remover provento:", e);
    });

    const desfez = await showToastUndo(
      `Provento de ${prov.ticker} removido`,
      () => {
        setProventos(p => {
          const novo = [...p];
          novo.splice(indiceOriginal, 0, prov);
          return novo;
        });
      }
    );

    if (desfez) {
      try {
        await promessaDelete;
        const novo = await registrarProvento(userId, {
          ticker: prov.ticker,
          tipo: prov.tipo,
          valor: prov.valor,
          data_pagamento: prov.data_pagamento,
          observacao: prov.observacao
        });
        setProventos(p => p.map(x => x.id === id ? novo : x));
      } catch (e) {
        showToast("Erro ao restaurar: " + e.message, "error");
      }
    } else {
      await promessaDelete;
    }
  };

  // Estatísticas
  const totalAno = proventos.filter(p => new Date(p.data_pagamento).getFullYear() === new Date().getFullYear()).reduce((s,p) => s + Number(p.valor), 0);
  const totalMes = proventos.filter(p => {
    const d = new Date(p.data_pagamento);
    return d.getFullYear() === new Date().getFullYear() && d.getMonth() === new Date().getMonth();
  }).reduce((s,p) => s + Number(p.valor), 0);
  const totalGeral = proventos.reduce((s,p) => s + Number(p.valor), 0);

  // Gráfico mensal últimos 12 meses
  const meses = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const ano = d.getFullYear(), mes = d.getMonth();
    const total = proventos.filter(p => {
      const dp = new Date(p.data_pagamento);
      return dp.getFullYear() === ano && dp.getMonth() === mes;
    }).reduce((s,p) => s + Number(p.valor), 0);
    meses.push({
      mes: d.toLocaleDateString("pt-BR",{month:"short"}).replace(".",""),
      valor: total
    });
  }

  // Por ticker
  const porTicker = {};
  proventos.forEach(p => {
    if (!porTicker[p.ticker]) porTicker[p.ticker] = 0;
    porTicker[p.ticker] += Number(p.valor);
  });
  const topTickers = Object.entries(porTicker).sort((a,b)=>b[1]-a[1]).slice(0,5);

  return (
    <div style={{display:"grid",gridTemplateColumns:"380px 1fr",gap:16,alignItems:"start"}}>
      {/* Coluna esquerda: registrar + stats */}
      <div style={{display:"flex",flexDirection:"column",gap:14,position:"sticky",top:120}}>
        <Card>
          <STitle color="var(--ui-success)"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Coins size={12} strokeWidth={2.5}/>REGISTRAR PROVENTO</span></STitle>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <input type="text" placeholder="Ticker (ex: TAEE11)" value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} style={{background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"var(--ui-text)",fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}/>
            <select value={tipo} onChange={e=>setTipo(e.target.value)} style={{background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"var(--ui-text)"}}>
              <option value="dividendo">Dividendo</option>
              <option value="jcp">JCP</option>
              <option value="rendimento">Rendimento (FII)</option>
              <option value="bonificacao">Bonificação</option>
            </select>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <input type="number" step="0.01" placeholder="Valor R$" value={valor} onChange={e=>setValor(e.target.value)} style={{background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"var(--ui-text)",fontFamily:"'JetBrains Mono',monospace"}}/>
              <input type="date" value={data} onChange={e=>setData(e.target.value)} style={{background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"var(--ui-text)"}}/>
            </div>
            <input type="text" placeholder="Observação (opcional)" value={obs} onChange={e=>setObs(e.target.value)} style={{background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"var(--ui-text)"}}/>
            <button onClick={adicionar} disabled={salvando || !ticker || !valor || !data} style={{background:salvando?"var(--ui-bg-secondary)":"linear-gradient(135deg,#059669,#047857)",border:"none",borderRadius:8,padding:"11px",color:"#ffffff",fontWeight:700,fontSize:13,cursor:salvando?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,boxShadow:salvando?"none":"0 2px 8px rgba(5,150,105,0.25)"}}>
              {salvando ? <Loader2 size={14} className="spin"/> : <Plus size={14} strokeWidth={2.5}/>}
              Registrar
            </button>
          </div>
        </Card>

        <Card>
          <STitle>RESUMO</STitle>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <Stat label="ESTE MÊS" value={fmtBRL(totalMes)} color="var(--ui-success)" mono/>
            <Stat label="ESTE ANO" value={fmtBRL(totalAno)} color="var(--ui-success)" mono/>
            <Stat label="TOTAL ACUMULADO" value={fmtBRL(totalGeral)} color="var(--ui-accent)" mono/>
            <Stat label="MÉDIA MENSAL (12M)" value={fmtBRL(meses.reduce((s,m)=>s+m.valor,0)/12)} mono/>
          </div>
        </Card>
      </div>

      {/* Coluna direita: gráfico + lista */}
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {meses.some(m => m.valor > 0) && (
          <Card>
            <STitle>RECEBIMENTOS — ÚLTIMOS 12 MESES</STitle>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={meses} margin={{left:0,right:0,top:5,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--ui-bg-secondary)"/>
                <XAxis dataKey="mes" tick={{fill:"var(--ui-text-faint)",fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"var(--ui-text-faint)",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${v}`}/>
                <Tooltip content={<TTip/>}/>
                <Bar dataKey="valor" name="Proventos" fill="var(--ui-success)" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {topTickers.length > 0 && (
          <Card>
            <STitle>TOP 5 PAGADORES</STitle>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {topTickers.map(([t,v],i) => {
                const pct = (v / totalGeral) * 100;
                return (
                  <div key={t}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontWeight:700,color:"var(--ui-text)",fontSize:13}}>{t}</span>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",color:"var(--ui-success)",fontWeight:700,fontSize:13}}>{fmtBRL(v)}</span>
                    </div>
                    <div style={{background:"var(--ui-bg-secondary)",borderRadius:4,height:6,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${pct}%`,background:"var(--ui-success)",opacity:0.85,borderRadius:4}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {loading ? <Card><Loader2 size={24} className="spin" color="var(--ui-accent)" style={{margin:"20px auto",display:"block"}}/></Card> : proventos.length === 0 ? (
          <Card style={{textAlign:"center",padding:"40px 20px",border:"1px dashed var(--ui-border)"}}>
            <Coins size={36} color="var(--ui-bg-strong)" strokeWidth={1.5} style={{margin:"0 auto 14px"}}/>
            <div style={{color:"var(--ui-text-faint)",fontSize:13,marginBottom:6}}>Nenhum provento registrado</div>
            <div style={{color:"var(--ui-text-disabled)",fontSize:12,lineHeight:1.6}}>Adicione seus dividendos, JCP e rendimentos<br/>recebidos para acompanhar sua renda passiva.</div>
          </Card>
        ) : (
          <Card>
            <STitle>HISTÓRICO ({proventos.length})</STitle>
            <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:500,overflowY:"auto"}}>
              {proventos.map(p => (
                <div key={p.id} style={{background:"var(--ui-bg-input)",border:"1px solid var(--ui-border-soft)",borderRadius:8,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:32,height:32,borderRadius:8,background:"rgba(0,229,160,0.10)",display:"flex",alignItems:"center",justifyContent:"center"}}><Coins size={14} color="var(--ui-success)"/></div>
                    <div>
                      <div style={{fontWeight:700,color:"var(--ui-text)",fontSize:13}}>{p.ticker} <span style={{fontSize:10,color:"var(--ui-text-faint)",fontWeight:500,marginLeft:4,textTransform:"uppercase"}}>{p.tipo}</span></div>
                      <div style={{fontSize:11,color:"var(--ui-text-faint)"}}>{new Date(p.data_pagamento).toLocaleDateString("pt-BR")}{p.observacao && ` · ${p.observacao}`}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:"var(--ui-success)",fontSize:14}}>{fmtBRL(p.valor)}</span>
                    <button onClick={()=>remover(p.id)} style={{background:"rgba(255,77,109,0.08)",border:"1px solid rgba(255,77,109,0.19)",borderRadius:6,padding:"5px 7px",color:"var(--ui-danger)",cursor:"pointer",display:"flex"}}><Trash2 size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Patrimônio (evolução histórica) ─────────────────────────────────────
function TabPatrimonio({ userId, dados }) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState(90);

  const carregar = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await carregarSnapshotsPatrimonio(userId, periodo);
      setSnapshots(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, [userId, periodo]);

  const salvarHoje = async () => {
    if (!dados?.totalCarteira) {
      showToast("Rode uma análise primeiro para registrar o patrimônio", "warning");
      return;
    }
    try {
      await salvarSnapshotPatrimonio(userId, dados.totalCarteira, dados.posicoes);
      showToast(`Snapshot salvo: ${fmtBRL(dados.totalCarteira)}`, "success");
      carregar();
    } catch (e) { showToast("Erro: " + e.message, "error"); }
  };

  const dadosGrafico = snapshots.map(s => ({
    data: new Date(s.data).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}),
    valor: Number(s.valor)
  }));

  const primeiro = snapshots[0];
  const ultimo = snapshots[snapshots.length-1];
  const variacao = primeiro && ultimo ? ((ultimo.valor - primeiro.valor) / primeiro.valor) * 100 : 0;
  const ganho = primeiro && ultimo ? Number(ultimo.valor) - Number(primeiro.valor) : 0;

  // Comparação com CDI/IBOV
  const diasPeriodo = primeiro ? (new Date(ultimo.data) - new Date(primeiro.data)) / (1000*60*60*24) : 0;
  const fatorCDI = Math.pow(1 + CDI_ANO/100, diasPeriodo/365) - 1;
  const cdiAcumulado = primeiro ? Number(primeiro.valor) * fatorCDI : 0;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <div>
            <STitle><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Activity size={12} strokeWidth={2.5}/>EVOLUÇÃO DO PATRIMÔNIO</span></STitle>
            <div style={{fontSize:12,color:"var(--ui-text-muted)"}}>Acompanhe sua jornada patrimonial ao longo do tempo</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {[30,90,180,365].map(d => (
              <button key={d} onClick={()=>setPeriodo(d)} style={{
                background:periodo===d?"var(--ui-accent)":"var(--ui-bg-secondary)",
                border:`1px solid ${periodo===d?"var(--ui-accent)":"var(--ui-border)"}`,
                borderRadius:6,padding:"6px 12px",color:periodo===d?"#ffffff":"var(--ui-text-secondary)",
                fontSize:11,fontWeight:700,cursor:"pointer"
              }}>{d}d</button>
            ))}
            <button onClick={salvarHoje} style={{
              background:"linear-gradient(135deg,#00e5a0,#00b4d8)",border:"none",borderRadius:6,
              padding:"7px 12px",color:"#1a1a25",fontSize:11,fontWeight:700,cursor:"pointer",
              display:"flex",alignItems:"center",gap:5,marginLeft:6
            }}><Save size={12}/>Snapshot</button>
          </div>
        </div>
      </Card>

      {snapshots.length >= 2 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
          <Stat label="ATUAL" value={fmtBRL(ultimo.valor)} color="var(--ui-success)" mono/>
          <Stat label="VARIAÇÃO" value={`${variacao>=0?"+":""}${fmt(variacao,2)}%`} color={variacao>=0?"var(--ui-success)":"var(--ui-danger)"} mono/>
          <Stat label="GANHO/PERDA" value={fmtBRL(ganho)} color={ganho>=0?"var(--ui-success)":"var(--ui-danger)"} mono/>
          <Stat label="CDI NO PERÍODO" value={fmtBRL(cdiAcumulado)} color="var(--ui-warning)" mono/>
        </div>
      )}

      {loading ? (
        <Card><Loader2 size={24} className="spin" color="var(--ui-accent)" style={{margin:"40px auto",display:"block"}}/></Card>
      ) : snapshots.length < 2 ? (
        <Card style={{textAlign:"center",padding:"40px 20px",border:"1px dashed var(--ui-border)"}}>
          <Activity size={36} color="var(--ui-bg-strong)" strokeWidth={1.5} style={{margin:"0 auto 14px"}}/>
          <div style={{color:"var(--ui-text-faint)",fontSize:13,marginBottom:6}}>
            {snapshots.length === 0 ? "Nenhum snapshot ainda" : "Apenas 1 snapshot — precisamos de pelo menos 2 para gerar o gráfico"}
          </div>
          <div style={{color:"var(--ui-text-disabled)",fontSize:12,lineHeight:1.6,marginBottom:14}}>
            Os snapshots são tirados manualmente. Rode uma análise da carteira<br/>
            e clique em <b style={{color:"var(--ui-success)"}}>Snapshot</b> para registrar seu patrimônio do dia.
          </div>
          <div style={{color:"var(--ui-text-disabled)",fontSize:11,fontStyle:"italic"}}>
            Dica: tire 1 snapshot por semana para acompanhar a evolução.
          </div>
        </Card>
      ) : (
        <Card>
          <STitle>HISTÓRICO ({snapshots.length} snapshots)</STitle>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={dadosGrafico} margin={{left:0,right:0,top:10,bottom:5}}>
              <defs>
                <linearGradient id="gradPatrimonio" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ui-accent)" stopOpacity={0.4}/>
                  <stop offset="100%" stopColor="var(--ui-accent)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ui-bg-secondary)"/>
              <XAxis dataKey="data" tick={{fill:"var(--ui-text-faint)",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"var(--ui-text-faint)",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v)}/>
              <Tooltip content={<TTip/>}/>
              <Area type="monotone" dataKey="valor" name="Patrimônio" stroke="var(--ui-accent)" strokeWidth={2} fill="url(#gradPatrimonio)"/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Oportunidades (scan da B3 com IA) ───────────────────────────────────
function TabOportunidades({ chamarIAComSearch, universoTickers = [] }) {
  const [filtros, setFiltros] = useState({
    tipo: "acoes_subprecificadas",
    perfil: "moderado",
    setor: "qualquer"
  });
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState("");
  const [fase, setFase] = useState("");

  const TIPOS = {
    acoes_subprecificadas: {
      titulo: "Ações sub-precificadas",
      descricao: "Encontre ações com P/L baixo, P/VP < 1 e bons fundamentos",
      icon: TrendingDown
    },
    fiis_alto_dy: {
      titulo: "FIIs com alto DY",
      descricao: "FIIs com Dividend Yield acima da média e P/VP atrativo",
      icon: Coins
    },
    crescimento: {
      titulo: "Empresas em crescimento",
      descricao: "Receita crescendo 20%+, lucros consistentes e setores promissores",
      icon: Rocket
    },
    blue_chips_baratas: {
      titulo: "Blue chips em desconto",
      descricao: "Grandes empresas líderes negociando com desconto histórico",
      icon: Award
    },
    dividendos_estaveis: {
      titulo: "Pagadoras consistentes",
      descricao: "Histórico de 5+ anos pagando dividendos crescentes",
      icon: DollarSign
    }
  };

  const buscar = async () => {
    setErro(""); setLoading(true); setResultado(null);
    try {
      setFase("🔍 Escaneando B3...");
      const cfg = TIPOS[filtros.tipo];
      const setorTxt = filtros.setor !== "qualquer" ? `Foque em empresas do setor ${filtros.setor}.` : "";

      // Restringe busca ao universo do usuário (se definido)
      const universoTxt = universoTickers.length > 0
        ? `\nIMPORTANTE: Considere APENAS estes tickers: ${universoTickers.slice(0, 50).join(", ")}.`
        : "";

      const prompt = `Analista B3, ${new Date().toLocaleDateString("pt-BR")}.

Tipo: ${cfg.titulo} — ${cfg.descricao}
Perfil: ${filtros.perfil}
${setorTxt}${universoTxt}

Use Google Search 1x: "${filtros.tipo.replace(/_/g," ")} B3 ${new Date().getFullYear()}"

Selecione 5-8 ativos. Responda APENAS com JSON (sem markdown):
{
  "tipo": "${filtros.tipo}",
  "criterios_usados": "1 frase dos critérios",
  "oportunidades": [
    {"ticker":"TICKER","nome":"Nome","setor":"Setor","preco":22.5,"dy":8.5,"pl":4.2,"pvp":0.65,"score":85,"destaque":"motivo principal em 1 frase","risco_principal":"risco em 1 frase","potencial_upside":25}
  ],
  "contexto_macro": "1 parágrafo sobre o mercado atual",
  "aviso": "Lista gerada por IA. Confirme antes de operar."
}

Ordene por score (maior primeiro).`;

      setFase("🧠 IA selecionando oportunidades...");
      let r;
      try {
        r = await chamarIAComSearch(prompt);
      } catch (e1) {
        // Se falhou na extração de JSON, tenta novamente com prompt reforçado
        if (e1.message && e1.message.includes("JSON")) {
          setFase("🔄 Tentando novamente...");
          await sleep(1500);
          const promptReforcado = prompt + "\n\nIMPORTANTE: Retorne APENAS o objeto JSON válido, sem texto antes ou depois, sem markdown, sem explicações.";
          r = await chamarIAComSearch(promptReforcado);
        } else {
          throw e1;
        }
      }
      setResultado(r);
    } catch (e) {
      setErro(e.message || "Erro");
    } finally {
      setLoading(false);
      setFase("");
    }
  };

  const TipoIcon = TIPOS[filtros.tipo].icon;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <STitle><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Lightbulb size={12} strokeWidth={2.5}/>OPORTUNIDADES DO MOMENTO</span></STitle>
        <div style={{fontSize:12,color:"var(--ui-text-muted)",marginBottom:14,lineHeight:1.6}}>
          A IA escaneia a B3 buscando ativos que se encaixam no critério escolhido. Use como ponto de partida para suas próprias análises.
        </div>

        {/* Tipo de oportunidade */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10,marginBottom:14}}>
          {Object.entries(TIPOS).map(([k,cfg]) => {
            const Icon = cfg.icon;
            const ativo = filtros.tipo === k;
            return (
              <button key={k} onClick={()=>setFiltros({...filtros,tipo:k})} style={{
                background:ativo?"rgba(123,97,255,0.08)":"var(--ui-bg-card-2)",
                border:`1px solid ${ativo?"rgba(123,97,255,0.38)":"var(--ui-bg-secondary)"}`,
                borderRadius:10,padding:"12px 14px",color:"var(--ui-text)",cursor:"pointer",
                textAlign:"left",display:"flex",alignItems:"flex-start",gap:10
              }}>
                <Icon size={18} color={ativo?"var(--ui-accent)":"var(--ui-text-faint)"} strokeWidth={2}/>
                <div>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:3,color:ativo?"var(--ui-text)":"var(--ui-text-secondary)"}}>{cfg.titulo}</div>
                  <div style={{fontSize:10,color:"var(--ui-text-faint)",lineHeight:1.4}}>{cfg.descricao}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Filtros adicionais */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
          <select value={filtros.perfil} onChange={e=>setFiltros({...filtros,perfil:e.target.value})}
            style={{background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"var(--ui-text)",cursor:"pointer"}}>
            <option value="conservador">Conservador</option>
            <option value="moderado">Moderado</option>
            <option value="arrojado">Arrojado</option>
          </select>
          <select value={filtros.setor} onChange={e=>setFiltros({...filtros,setor:e.target.value})}
            style={{background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"var(--ui-text)",cursor:"pointer"}}>
            <option value="qualquer">Qualquer setor</option>
            <option value="bancos">Bancos</option>
            <option value="energia eletrica">Energia Elétrica</option>
            <option value="saneamento">Saneamento</option>
            <option value="petróleo e gás">Petróleo & Gás</option>
            <option value="siderurgia">Siderurgia</option>
            <option value="varejo">Varejo</option>
            <option value="tecnologia">Tecnologia</option>
            <option value="saúde">Saúde</option>
            <option value="agro">Agronegócio</option>
            <option value="imobiliário">Imobiliário (FIIs)</option>
          </select>
          <button onClick={buscar} disabled={loading} style={{
            background:loading?"var(--ui-bg-secondary)":"linear-gradient(135deg,#7b61ff,#5540dd)",border:"none",borderRadius:8,
            padding:"10px 18px",color:"#ffffff",fontWeight:700,fontSize:13,cursor:loading?"not-allowed":"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8
          }}>
            {loading ? <><Loader2 size={14} className="spin"/>{fase || "Buscando..."}</> : <><Sparkles size={14} strokeWidth={2.5}/>Buscar oportunidades</>}
          </button>
        </div>

        {erro && <div style={{background:"rgba(255,77,109,0.06)",border:"1px solid rgba(255,77,109,0.19)",borderRadius:8,padding:"10px 14px",color:"var(--ui-danger)",fontSize:12,display:"flex",alignItems:"center",gap:8}}><AlertCircle size={14}/>{erro}</div>}
      </Card>

      {resultado && (
        <>
          {resultado.contexto_macro && (
            <Card accent>
              <STitle><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Activity size={12} strokeWidth={2.5}/>CONTEXTO DO MERCADO</span></STitle>
              <div style={{fontSize:13,color:"var(--ui-text-muted)",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{resultado.contexto_macro}</div>
              {resultado.criterios_usados && (
                <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid var(--ui-border-soft)",fontSize:11,color:"var(--ui-text-faint)",fontStyle:"italic"}}>
                  Critérios: {resultado.criterios_usados}
                </div>
              )}
            </Card>
          )}

          {resultado.oportunidades?.length > 0 && (
            <>
              <STitle>{resultado.oportunidades.length} OPORTUNIDADES IDENTIFICADAS</STitle>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(360px,1fr))",gap:12}}>
                {resultado.oportunidades.map((o,i) => (
                  <Card key={i} className="card-hover" style={{position:"relative",overflow:"hidden"}}>
                    {/* Score badge */}
                    <div style={{position:"absolute",top:12,right:12}}>
                      <div style={{
                        padding:"4px 10px",borderRadius:6,fontWeight:800,fontSize:13,
                        fontFamily:"'JetBrains Mono',monospace",
                        background:o.score>=80?"rgba(0,229,160,0.12)":o.score>=65?"rgba(255,214,10,0.12)":"rgba(255,77,109,0.12)",
                        color:o.score>=80?"var(--ui-success)":o.score>=65?"var(--ui-warning)":"var(--ui-danger)",
                        border:`1px solid ${o.score>=80?"rgba(0,229,160,0.25)":o.score>=65?"rgba(255,214,10,0.25)":"rgba(255,77,109,0.25)"}`
                      }}>{o.score}</div>
                    </div>

                    {/* Ranking */}
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                      <div style={{
                        width:28,height:28,borderRadius:7,
                        background:i<3?"linear-gradient(135deg,#ffd60a,#f77f00)":"var(--ui-bg-secondary)",
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:12,fontWeight:800,color:i<3?"#1a1a25":"var(--ui-text-faint)"
                      }}>#{i+1}</div>
                      <div>
                        <div style={{fontWeight:800,color:"var(--ui-text)",fontSize:16}}>{o.ticker}</div>
                        <div style={{fontSize:10,color:"var(--ui-text-faint)"}}>{o.setor}</div>
                      </div>
                    </div>

                    <div style={{fontSize:11,color:"var(--ui-text-muted)",marginBottom:12,lineHeight:1.5}}>{o.nome}</div>

                    <div style={{
                      background:"var(--ui-bg-input)",border:"1px solid var(--ui-border-soft)",borderRadius:8,padding:10,
                      display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:12
                    }}>
                      <div>
                        <div style={{fontSize:9,color:"var(--ui-text-disabled)",fontWeight:700,letterSpacing:0.5}}>PREÇO</div>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--ui-text)",fontFamily:"'JetBrains Mono',monospace"}}>{fmtBRL(o.preco)}</div>
                      </div>
                      {o.dy != null && <div>
                        <div style={{fontSize:9,color:"var(--ui-text-disabled)",fontWeight:700,letterSpacing:0.5}}>DY</div>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--ui-warning)",fontFamily:"'JetBrains Mono',monospace"}}>{fmt(o.dy,1)}%</div>
                      </div>}
                      {o.pl != null && <div>
                        <div style={{fontSize:9,color:"var(--ui-text-disabled)",fontWeight:700,letterSpacing:0.5}}>P/L</div>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--ui-accent)",fontFamily:"'JetBrains Mono',monospace"}}>{fmt(o.pl,1)}</div>
                      </div>}
                      {o.pvp != null && <div>
                        <div style={{fontSize:9,color:"var(--ui-text-disabled)",fontWeight:700,letterSpacing:0.5}}>P/VP</div>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--ui-accent)",fontFamily:"'JetBrains Mono',monospace"}}>{fmt(o.pvp,2)}</div>
                      </div>}
                    </div>

                    {o.destaque && (
                      <div style={{display:"flex",gap:8,marginBottom:8}}>
                        <CheckCircle2 size={14} color="var(--ui-success)" style={{flexShrink:0,marginTop:1}}/>
                        <div style={{fontSize:12,color:"var(--ui-text-muted)",lineHeight:1.5}}>{o.destaque}</div>
                      </div>
                    )}

                    {o.risco_principal && (
                      <div style={{display:"flex",gap:8,marginBottom:o.potencial_upside?8:0}}>
                        <AlertCircle size={14} color="var(--ui-danger)" style={{flexShrink:0,marginTop:1}}/>
                        <div style={{fontSize:12,color:"var(--ui-text-muted)",lineHeight:1.5}}>{o.risco_principal}</div>
                      </div>
                    )}

                    {o.potencial_upside != null && (
                      <div style={{
                        marginTop:10,padding:"6px 10px",borderRadius:6,
                        background:"rgba(123,97,255,0.06)",border:"1px solid rgba(123,97,255,0.19)",
                        display:"flex",alignItems:"center",justifyContent:"space-between"
                      }}>
                        <span style={{fontSize:10,color:"var(--ui-text-faint)",fontWeight:700,letterSpacing:1}}>POTENCIAL UPSIDE</span>
                        <span style={{fontSize:14,fontWeight:800,color:"var(--ui-success)",fontFamily:"'JetBrains Mono',monospace"}}>+{o.potencial_upside}%</span>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}

          {resultado.aviso && <div style={{background:"rgba(255,214,10,0.08)",border:"1px solid rgba(255,214,10,0.3)",borderRadius:10,padding:"12px 14px",fontSize:11,color:"var(--ui-text-secondary)",display:"flex",gap:8,alignItems:"flex-start"}}><AlertTriangle size={14} strokeWidth={2.2} style={{flexShrink:0,marginTop:1,color:"var(--ui-warning)"}}/>{resultado.aviso}</div>}
        </>
      )}

      {!resultado && !loading && (
        <Card style={{textAlign:"center",padding:"40px 20px",border:"1px dashed var(--ui-border)"}}>
          <Lightbulb size={36} color="var(--ui-bg-strong)" strokeWidth={1.5} style={{margin:"0 auto 14px"}}/>
          <div style={{color:"var(--ui-text-faint)",fontSize:13,marginBottom:6}}>Descubra novas oportunidades de investimento</div>
          <div style={{color:"var(--ui-text-disabled)",fontSize:12,lineHeight:1.6}}>
            Escolha o tipo de oportunidade que busca acima<br/>
            e clique em <b style={{color:"var(--ui-accent)"}}>Buscar oportunidades</b>.
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── App Principal ────────────────────────────────────────────────────────────
export default function App({ session, onLogout }) {
  const [tab, setTab] = useState("carteira");
  const [carteira, setCarteira] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [aporte, setAporte] = useState("");
  const [foco, setFoco] = useState("misto");
  const [perfil, setPerfil] = useState("moderado");
  const [loading, setLoading] = useState(false);
  const [fase, setFase] = useState("");
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [savedMsg, setSavedMsg] = useState("");
  const [carteiraId, setCarteiraId] = useState(null);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [confirmacao, setConfirmacao] = useState({open:false});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return localStorage.getItem("inventia_hide_onboarding") !== "true"; }
    catch { return true; }
  });
  const privacy = usePrivacyMode();
  const themeApi = useTheme();

  // Cotações ao vivo da carteira (preço/variação via brapi)
  // Fundamentos vêm da bolsai via buscarFundamentos quando necessário
  const tickersCarteira = carteira.map(a => a.ticker);
  const { cotacoes: cotacoesGlobais } = useCotacoes(tickersCarteira, {
    intervalMs: 60000,
  });

  const pedirConfirmacao = (config) => setConfirmacao({...config, open:true});

  // Atalhos globais de teclado
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  useEffect(() => {
    let lastKey = null;
    let lastKeyTime = 0;

    const handler = (e) => {
      // Ignora se está em input/textarea (exceto Escape)
      const tag = e.target.tagName.toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || tag === "select";

      // Ctrl/Cmd + K → Paleta de comandos
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }

      // Escape → fecha modais
      if (e.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        if (showShortcutsHelp) setShowShortcutsHelp(false);
        return;
      }

      // Resto dos atalhos não funcionam quando em inputs
      if (isInput) return;

      // ? → mostra ajuda de atalhos
      if (e.key === "?" && !e.shiftKey) {
        e.preventDefault();
        setShowShortcutsHelp(prev => !prev);
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowShortcutsHelp(prev => !prev);
        return;
      }

      // / → abre paleta (alternativa ao Ctrl+K)
      if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }

      // Sequência "g + tecla" para navegação rápida (estilo Vim/GitHub)
      const now = Date.now();
      if (lastKey === "g" && (now - lastKeyTime) < 1000) {
        const navMap = {
          "c": "carteira",
          "p": "patrimonio",
          "a": "analise",
          "t": "ticker",
          "o": "oportunidades",
          "h": "historico",
          "d": "proventos", // d de Dividendos
          "w": "watchlist",
          "u": "universo",
          "m": "meta",
          "i": "ir",
          "x": "cenarios",
        };
        if (navMap[e.key]) {
          e.preventDefault();
          setTab(navMap[e.key]);
          lastKey = null;
          return;
        }
      }
      lastKey = e.key;
      lastKeyTime = now;
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [paletteOpen, showShortcutsHelp]);

  const fecharOnboarding = () => {
    setShowOnboarding(false);
    try { localStorage.setItem("inventia_hide_onboarding", "true"); } catch {}
  };

  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  // Carregar dados do Supabase
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        // Pega carteira principal (criada automaticamente pelo trigger)
        let cart = await carregarCarteiraPrincipal(userId);
        if (cart) {
          setCarteiraId(cart.id);
          const ativos = await carregarAtivos(cart.id);
          setCarteira(ativos.map(a => ({
            id: a.id,
            ticker: a.ticker,
            qtd: Number(a.qtd),
            pm: a.pm ? Number(a.pm) : null,
            peso_alvo: a.peso_alvo ? Number(a.peso_alvo) : null
          })));

          const compras = await carregarCompras(userId);
          setHistorico(compras.map(c => ({
            ticker: c.ticker,
            qtd: Number(c.qtd),
            pm: Number(c.preco),
            data: c.data
          })));
        }

        const wl = await carregarWatchlist(userId);
        setWatchlist(wl.map(w => ({
          id: w.id,
          ticker: w.ticker,
          alvo: w.preco_alvo ? Number(w.preco_alvo) : null,
          nota: w.nota || "",
          adicionado: new Date(w.created_at).toLocaleDateString("pt-BR")
        })));
      } catch (e) {
        console.error("Erro ao carregar dados:", e);
      } finally {
        setCarregandoDados(false);
      }
    })();
  }, [userId]);

  const salvar = useCallback(async () => {
    setSavedMsg("Salvo automaticamente ✓");
    setTimeout(() => setSavedMsg(""), 2000);
  }, []);

  // Universo de investimento do usuário (tickers que a IA vai considerar)
  // IMPORTANTE: precisa estar declarado ANTES do useCallback `analisar` que usa
  // ele como dependência. Caso contrário o esbuild minifica e gera TDZ
  // (Cannot access 'universoTickers' before initialization).
  const [universoTickers, setUniversoTickers] = useState(getDefaultUniverso());
  useEffect(() => {
    if (!userId) return;
    carregarUniverso(userId).then(u => {
      if (u?.tickers?.length > 0) {
        setUniversoTickers(u.tickers);
      }
    }).catch(() => {});
  }, [userId]);

  const aporteNum = () => parseFloat((aporte||"").replace(/[R$\s.]/g,"").replace(",",".")) || 0;
  const handleAporte = e => {
    const raw = e.target.value.replace(/\D/g,"");
    setAporte(raw ? (parseInt(raw)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) : "");
  };

  const analisar = useCallback(async () => {
    const v = aporteNum();
    if (v < 50) { setErro("Informe o valor do aporte (mínimo R$ 50)."); return; }
    setErro(null); setLoading(true); setDados(null); setTab("analise");

    try {
      const temCarteira = carteira.length > 0;
      const perfilDesc = {
        conservador: "conservador — prioriza dividendos, baixo risco, setores defensivos (energia, bancos sólidos, FIIs de papel)",
        moderado: "moderado — equilíbrio entre renda e crescimento",
        arrojado: "arrojado — aceita volatilidade, foca em crescimento de capital"
      }[perfil];
      const focoDesc = { acoes:"ações da B3", fiis:"fundos imobiliários (FIIs)", misto:"mix de ações e FIIs" }[foco];

      setFase("📊 Calculando perfil de risco da carteira...");

      // Calcula análise de risco LOCAL (antes da IA) usando preços ao vivo + setor do catálogo
      const posEstimadas = estimarPosicoesParaRisco(carteira, cotacoesGlobais, getSetorPorTicker);
      const riscoPre = posEstimadas.length > 0 ? analisarRisco(posEstimadas, normalizarSetor) : null;

      setFase("🔍 Gemini buscando cotações no Google Finance...");

      const carteiraInfo = temCarteira
        ? `\nCARTEIRA ATUAL DO INVESTIDOR:\n${carteira.map(a=>`- ${a.ticker}: ${a.qtd} cotas${a.pm?`, PM R$${a.pm}`:""}`).join("\n")}`
        : "";

      // Tickers a serem analisados: universo do usuário (ou padrão)
      // Filtra por foco (FII só vê 11, ações só não-11, misto vê tudo)
      const universoFiltrado = universoTickers.filter(t => {
        if (foco === "fiis") return /11$/.test(t);
        if (foco === "acoes") return !/11$/.test(t);
        return true;
      });

      const tickersCarteira = carteira.map(a => a.ticker).join(", ");
      const todosOsTickers = [...new Set([
        ...(tickersCarteira ? tickersCarteira.split(", ") : []),
        ...universoFiltrado
      ])].join(", ");

      // Bloco de contexto de risco (apenas se já há carteira)
      const contextoRisco = riscoPre ? `

CONTEXTO DE RISCO (calculado a partir da carteira):
- HHI ativos: ${riscoPre.concentracao.hhi} (${classificarHHI(riscoPre.concentracao.hhi).nivel})
- HHI setorial: ${riscoPre.setorial.hhi} (${classificarHHI(riscoPre.setorial.hhi).nivel})
- Maior posição: ${riscoPre.concentracao.maiorPosicao?.ticker || "–"} com ${riscoPre.concentracao.maiorPosicao?.peso || 0}%
- Top 3 ativos: ${riscoPre.concentracao.top3Pct}% da carteira
- Setor dominante: ${riscoPre.setorial.maiorSetor?.setor || "–"} com ${riscoPre.setorial.maiorSetor?.peso || 0}%
- Setores na carteira: ${riscoPre.setorial.qtdSetores}
${riscoPre.concentracao.acima10Pct.length > 0 ? `- Posições acima de 10%: ${riscoPre.concentracao.acima10Pct.map(p => `${p.ticker} (${p.peso}%)`).join(", ")}` : ""}

USE este contexto ao recomendar:
- Se HHI > 2500 ou setor dominante > 40%, EVITE reforçar setores/posições já concentrados
- Se houver posição > 25%, NÃO recomende mais cotas dela
- Se setores < 4, PRIORIZE diversificação setorial
- Mencione na justificativa como a recomendação melhora ou mantém o perfil de risco` : "";

      const prompt = `Analista B3, ${new Date().toLocaleDateString("pt-BR")}.

Use Google Search 1x: "cotações ${todosOsTickers.split(", ").slice(0,6).join(" ")} hoje"

${temCarteira
  ? `Carteira: ${carteira.map(a=>`${a.ticker}(${a.qtd})`).join(", ")}.
Aloque R$ ${v.toFixed(2)} (perfil ${perfil}, ${focoDesc}). Pode reforçar ou diversificar.`
  : `Recomende ${focoDesc} para R$ ${v.toFixed(2)} (perfil ${perfil}).`}
${contextoRisco}

Use APENAS estes tickers: ${universoFiltrado.slice(0, 20).join(", ")}.

CRITÉRIOS FUNDAMENTALISTAS — busque e retorne TODOS os indicadores possíveis:
- AÇÕES: ROE (preferir ≥15%), Dívida Líquida/EBITDA (preferir ≤3), Margem Líquida (preferir ≥5%), DY, P/L, P/VP
- FIIs: DY (preferir ≥7%), P/VP (preferir 0.7-1.15), vacância, liquidez diária

Priorize ativos que ATENDEM aos critérios. Se recomendar algo que não atende, justifique o porquê.

Responda APENAS com JSON (sem markdown):
{
  "diagnostico": "1-2 frases sobre o mercado E sobre o risco da carteira atual",
  "alertas": [{"tipo":"perigo|atencao|ok","titulo":"...","descricao":"..."}],
  "recomendacoes": [
    {"ticker":"PETR4","nome":"Petrobras","tipo":"Ação","setor":"Petróleo","acao":"Comprar","nova":${!temCarteira},"alocacao":30,"precoReal":48.5,"precoEstimado":48.5,"dy":12.5,"pl":4.2,"pvp":1.2,"roe":18.5,"divEbitda":1.5,"margemLiquida":15.2,"lucrosConsistentes":true,"vacancia":null,"diversificado":null,"score":82,"justificativa":"breve, mencionando impacto no risco e aderência aos critérios"}
  ],
  "vender": ${temCarteira ? `[]` : "[]"},
  "aviso": "Confirme na sua corretora."
}

INDICADORES por tipo de ativo (use seu conhecimento de mercado, retorne null se não souber):
- AÇÕES: dy, pl, pvp, roe (% retorno sobre PL), divEbitda (Dívida Líquida/EBITDA), margemLiquida (% lucro líquido), lucrosConsistentes (true se lucros positivos nos últimos 5 anos), score
- FIIs: dy, pvp, vacancia (% vacância física/financeira), diversificado (true se >5 imóveis OU >10 inquilinos), score

OBS: Não retorne canal52 - o backend calcula com dados reais da B3.

IMPORTANTE: O sistema enriquece os indicadores DEPOIS com dados oficiais (B3, CVM).
Sua função é montar a TESE: qual ticker, % alocação, justificativa. Os números
exatos serão sobrescritos pelo backend. Se não tiver certeza de um indicador,
retorne null - é mais seguro que inventar.

Regras:
- 3 a 5 recomendações, alocação soma 100
- Se um indicador for desconhecido, retorne null (NÃO invente)
- Para FIIs use lucrosConsistentes=null. Para Ações use vacancia=null e diversificado=null.
- SOMENTE JSON, sem markdown`;

      setFase("🧠 Gemini 2.5 Pro analisando...");
      const analise = await chamarIAComSearch(prompt);

      // Busca cotação atual (brapi) E fundamentos reais (bolsai) em paralelo
      // Inclui tickers das recomendações E da carteira atual (pra montar `posicoes`
      // com dados reais sem precisar pedir pra IA via web_search).
      const tickersRecs = (analise.recomendacoes || []).map(r => r.ticker).filter(Boolean);
      const tickersCarteiraSet = new Set([
        ...tickersRecs,
        ...carteira.map(a => a.ticker),
      ]);
      const tickersParaBuscar = Array.from(tickersCarteiraSet);
      let cotacoesReais = {};
      let fundamentosReais = {};
      if (tickersParaBuscar.length > 0) {
        setFase("📊 Buscando cotações e fundamentos reais...");
        try {
          const [dadosCotacoes, dadosFundamentos] = await Promise.all([
            buscarCotacoes(tickersParaBuscar).catch(e => {
              console.warn("brapi falhou:", e.message);
              return {};
            }),
            buscarFundamentos(tickersParaBuscar).catch(e => {
              console.warn("bolsai falhou:", e.message);
              return {};
            })
          ]);
          cotacoesReais = dadosCotacoes;
          fundamentosReais = dadosFundamentos;
        } catch (e) {
          console.warn("Falhou ao buscar dados externos:", e.message);
        }
      }

      // Enriquecer recomendações com unidades calculadas + fundamentos reais
      const recsEnriquecidas = (analise.recomendacoes || []).map(r => {
        const cot = cotacoesReais[r.ticker];
        const fund = fundamentosReais[r.ticker];
        const ehFII = fund?.tipo === "FII" || /11$/.test(r.ticker || "");

        // Sobrescreve chutes da IA com dados reais quando disponíveis
        // Mantém valor da IA como fallback se nenhuma fonte externa retornou
        const enriquecido = {
          ...r,
          // Preço real da brapi (tem prioridade sobre o que a IA disse)
          precoReal: cot?.preco ?? r.precoReal ?? r.precoEstimado,

          // Canal de 52 semanas real da brapi (substitui chute da IA)
          // canal52: 0% = preço próximo da mínima anual, 100% = próximo da máxima
          canal52: cot?.canal52 != null ? Math.round(cot.canal52) : (r.canal52 ?? null),
          min52: cot?.min52 ?? null,
          max52: cot?.max52 ?? null,

          // Setor (vem da bolsai /companies/{ticker}) - usado para ROE setorial dinâmico
          setorCVM: fund?.setorCVM ?? r.setorCVM ?? null,

          // Indicadores fundamentalistas reais da bolsai (sobrescrevem chutes da IA)
          // P/L, P/VP funcionam para ações e FIIs
          pl: fund?.pl ?? r.pl,
          pvp: fund?.pvp ?? r.pvp,

          // Específicos por tipo
          ...(ehFII ? {
            // FII: DY do bolsai é dividend_yield_ttm (12 meses)
            dy: fund?.dy ?? r.dy,
            // vacancia e liquidez não vêm do bolsai - mantém o que a IA chutou
            vacancia: r.vacancia ?? null,
            liquidez: r.liquidez ?? null,
          } : {
            // Ação: indicadores fundamentalistas reais
            dy: r.dy, // bolsai não retorna DY direto pra ações
            roe: fund?.roe ?? r.roe,
            margemLiquida: fund?.margemLiquida ?? r.margemLiquida,
            divEbitda: fund?.divEbitda ?? r.divEbitda,
            // Bonus: lucros consistentes derivado do CAGR 5 anos
            lucrosConsistentes: fund?.lucrosConsistentes ?? r.lucrosConsistentes,
          }),

          // Marca origem para debug/UI
          fonteDados: fund ? "bolsai+brapi" : (cot ? "brapi" : "ia"),
          // Bônus disponíveis (não usados nos critérios atuais, mas úteis para futuras features)
          ...(fund && !ehFII ? {
            roic: fund.roic,
            cagrLucro5y: fund.cagrLucro5y,
            evEbitda: fund.evEbitda,
          } : {}),
        };

        return {
          ...enriquecido,
          unidades: enriquecido.precoReal ? Math.floor(v * (r.alocacao/100) / enriquecido.precoReal) : null,
          // Avalia critérios fundamentalistas com dados (preferencialmente) reais
          avaliacaoCriterios: avaliarRecomendacao(enriquecido),
        };
      });

      // Montar posições da carteira COM dados reais (sem precisar de IA)
      // Antes pedíamos pra IA buscar via web_search, mas:
      //  - Já temos cotações ao vivo via brapi em cotacoesGlobais
      //  - Já temos fundamentos via bolsai em fundamentosReais (acima)
      //  - Canal de 52 semanas vem direto da brapi (fiftyTwoWeekHigh/Low)
      let posicoes = [];
      if (temCarteira) {
        setFase("📊 Calculando posições...");

        posicoes = carteira.map(a => {
          const cot = cotacoesReais[a.ticker] || cotacoesGlobais[a.ticker] || {};
          const fund = fundamentosReais[a.ticker] || {};
          const preco = cot.preco || a.pm || 0;
          const valorAtual = preco * a.qtd;
          return {
            ticker: a.ticker,
            qtd: a.qtd,
            pm: a.pm,
            preco,
            valorAtual,
            dy: fund.dy || 0,
            pl: fund.pl || null,
            setor: fund.setorCVM || getSetorPorTicker(a.ticker),
            tipo: fund.tipo || (/11$/.test(a.ticker) ? "FII" : "Ação"),
            // Canal 52 semanas real (brapi retorna fiftyTwoWeekHigh/Low direto)
            canal52: cot.canal52 != null ? Math.round(cot.canal52) : null,
            min52: cot.min52 ?? null,
            max52: cot.max52 ?? null,
            historico: [],
          };
        });
      }

      const totalCarteira = posicoes.reduce((s,p) => s + p.valorAtual, 0);
      const posicoesComPeso = posicoes.map(p => ({
        ...p, peso: totalCarteira > 0 ? (p.valorAtual/totalCarteira)*100 : 0
      }));

      // Atualizar watchlist com cotações reais via brapi (não precisa de IA)
      if (watchlist.length > 0) {
        try {
          const wTickers = watchlist.map(w => w.ticker);
          const wCotacoes = await buscarCotacoes(wTickers).catch(() => ({}));
          setWatchlist(prev => prev.map(w => ({
            ...w,
            precoIA: wCotacoes[w.ticker]?.preco || w.precoIA
          })));
        } catch(_) {}
      }

      setFase("✅ Análise concluída!");
      await sleep(400);

      const dadosFinais = {
        posicoes: posicoesComPeso,
        totalCarteira,
        analise: { ...analise, recomendacoes: recsEnriquecidas },
        ts: new Date()
      };
      setDados(dadosFinais);

      // Salva análise no histórico (Supabase)
      if (userId) {
        try {
          await salvarAnalise(userId, {
            tipo: temCarteira ? "carteira" : "mercado",
            aporte: v,
            perfil,
            foco,
            resultado: { ...analise, recomendacoes: recsEnriquecidas },
            tickers_analisados: todosOsTickers.split(", ")
          });
        } catch(e) { console.warn("Erro ao salvar análise:", e); }

        // Salva snapshot do patrimônio automaticamente (se houver carteira analisada)
        if (temCarteira && totalCarteira > 0) {
          try {
            await salvarSnapshotPatrimonio(userId, totalCarteira, posicoesComPeso);
          } catch(e) { console.warn("Erro ao salvar snapshot:", e); }
        }
      }

    } catch(e) {
      console.error("Erro análise:", e);
      setErro(`Erro: ${e.message || "Tente novamente."}`);
      setTab("carteira");
    } finally {
      setLoading(false);
      setFase("");
    }
  }, [carteira, watchlist, aporte, foco, perfil, cotacoesGlobais, universoTickers]);

  const TABS = [
    {k:"carteira",icon:Briefcase,label:"Carteira",cor:"var(--ui-success)",grupo:"portfolio"},
    {k:"patrimonio",icon:Activity,label:"Patrimônio",cor:"var(--ui-success)",grupo:"portfolio"},
    {k:"analise",icon:Brain,label:"Análise IA",cor:"var(--ui-accent)",grupo:"analysis"},
    {k:"ticker",icon:FileSearch,label:"Analisar Ticker",cor:"var(--ui-accent)",grupo:"analysis"},
    {k:"comparador",icon:GitCompare,label:"Comparador",cor:"var(--ui-accent)",grupo:"analysis"},
    {k:"oportunidades",icon:Lightbulb,label:"Oportunidades",cor:"var(--ui-accent)",grupo:"analysis"},
    {k:"historico",icon:History,label:"Histórico",cor:"var(--ui-warning)",grupo:"control"},
    {k:"proventos",icon:Coins,label:"Proventos",cor:"var(--ui-warning)",grupo:"control"},
    {k:"watchlist",icon:Eye,label:"Watchlist",cor:"var(--ui-warning)",grupo:"control"},
    {k:"universo",icon:Globe,label:"Universo",cor:"var(--ui-warning)",grupo:"control"},
    {k:"ir",icon:Receipt,label:"IR",cor:"var(--ui-warning)",grupo:"control"},
    {k:"meta",icon:Target,label:"1º Milhão",cor:"var(--ui-info)",grupo:"planning"},
    {k:"cenarios",icon:TrendingUp,label:"Cenários",cor:"var(--ui-info)",grupo:"planning"},
  ];

  // Métricas para a barra superior
  const metricaCarteira = dados?.totalCarteira || 0;
  const metricaPosicoes = dados?.posicoes?.length || 0;
  const metricaDY = dados?.posicoes?.length ? (dados.posicoes.reduce((s,p)=>s+(p.dy||0)*(p.peso/100),0)) : 0;

  // Sparklines fake (em produção viria dos snapshots de patrimônio)
  // Gerados a partir dos snapshots reais quando disponíveis
  const [sparkPatrimonio, setSparkPatrimonio] = useState([]);
  useEffect(() => {
    if (!userId) return;
    carregarSnapshotsPatrimonio(userId, 30).then(snaps => {
      if (snaps?.length >= 2) {
        setSparkPatrimonio(snaps.map(s => Number(s.valor)));
      }
    }).catch(() => {});
  }, [userId, dados?.totalCarteira]);

  // Relógio em tempo real
  const [horaAtual, setHoraAtual] = useState(new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}));
  useEffect(() => {
    const interval = setInterval(() => {
      setHoraAtual(new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{minHeight:"100vh",background:"var(--ui-bg)",fontFamily:"'Inter','Segoe UI',sans-serif",color:"var(--ui-text)"}}>
      <style>{THEME_CSS}</style>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--ui-bg);transition:background .2s ease}
        ::-webkit-scrollbar{width:8px;height:8px}
        ::-webkit-scrollbar-track{background:var(--ui-bg)}
        ::-webkit-scrollbar-thumb{background:var(--ui-bg-tertiary);border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:var(--ui-bg-strong)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateY(12px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes shimmer{0%{background-position:-1000px 0}100%{background-position:1000px 0}}
        .anim{animation:fadeUp .35s ease both}
        .spin{animation:spin .9s linear infinite}
        .blink{animation:blink 2s ease infinite}
        input,select,button,textarea{outline:none;font-family:inherit}
        input:focus,select:focus{border-color:var(--ui-accent)!important;box-shadow:0 0 0 3px rgba(123,97,255,0.15)}
        button:hover:not(:disabled){filter:brightness(1.1)}
        .tab-btn{transition:all .15s ease}
        .tab-btn:hover{background:var(--ui-bg-secondary)!important;color:var(--ui-text-secondary)!important}
        .card-hover{transition:border-color .2s ease,transform .2s ease}
        .card-hover:hover{border-color:var(--ui-border-strong)!important;transform:translateY(-1px)}

        /* Inputs e selects respeitam tema globalmente */
        input, select, textarea {
          color: var(--ui-text);
        }
        input::placeholder, textarea::placeholder {
          color: var(--ui-text-disabled);
          opacity: 1;
        }
        /* No light mode, inputs com background preto ficam brancos */
        [data-theme="light"] input[style*="background:var(--ui-bg-input)"],
        [data-theme="light"] select[style*="background:var(--ui-bg-input)"],
        [data-theme="light"] textarea[style*="background:var(--ui-bg-input)"] {
          background: var(--ui-bg-input) !important;
          color: var(--ui-text) !important;
        }
        /* Dropdowns */
        select option {
          background: var(--ui-bg-card);
          color: var(--ui-text);
        }
        /* No light mode, recharts adapta */
        [data-theme="light"] .recharts-cartesian-axis-tick-value { fill: var(--ui-text-faint) !important; }
        [data-theme="light"] .recharts-cartesian-grid line { stroke: var(--ui-border) !important; }
      `}</style>

      {/* TOP BAR - Estilo TradingView */}
      <div style={{
        position:"sticky",top:0,zIndex:100,
        background: themeApi.isLight ? "rgba(255,255,255,0.96)" : "rgba(0,0,0,0.92)",
        backdropFilter:"blur(20px)",
        borderBottom:"1px solid var(--ui-border)",
        boxShadow: themeApi.isLight ? "0 1px 3px rgba(0,0,0,0.04)" : "none"
      }}>
        {/* Linha 1: Brand + Métricas + Status */}
        <div style={{
          display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"10px 24px",gap:24,flexWrap:"wrap"
        }}>
          {/* Brand */}
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{
              width:36,height:36,borderRadius:8,
              background:"linear-gradient(135deg,#7b61ff,#00e5a0)",
              display:"flex",alignItems:"center",justifyContent:"center",
              color:"#ffffff"
            }}><Sparkles size={20} strokeWidth={2.5}/></div>
            <div>
              <div style={{fontSize:14,fontWeight:800,letterSpacing:-0.3,color:"var(--ui-text)"}}>
                InvestIA <span style={{color:"var(--ui-accent)"}}>Pro</span>
              </div>
              <div style={{fontSize:9,color:"var(--ui-text-faint)",fontWeight:600,letterSpacing:1.5}}>B3 · BRASIL</div>
            </div>
          </div>

          {/* Métricas centralizadas com sparklines */}
          <div style={{display:"flex",alignItems:"center",gap:32,flex:1,justifyContent:"center"}}>
            <Metric
              label="PATRIMÔNIO"
              value={metricaCarteira>0 ? (privacy.hidden ? "R$●●●●" : fmtK(metricaCarteira)) : "—"}
              accent={metricaCarteira>0?"var(--ui-success)":null}
              sparkline={sparkPatrimonio}
              sparkColor="auto"
            />
            <Metric label="POSIÇÕES" value={metricaPosicoes||"—"}/>
            <Metric label="DY MÉDIO" value={metricaPosicoes?`${fmt(metricaDY,2)}%`:"—"} accent={metricaDY>5?"var(--ui-warning)":null}/>
            <Metric label="WATCHLIST" value={watchlist.length||"—"}/>
          </div>

          {/* Status à direita */}
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"var(--ui-text-faint)"}}>
              <span className="blink" style={{width:6,height:6,borderRadius:"50%",background:"var(--ui-success)"}}/>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{horaAtual}</span>
            </div>
            {savedMsg && (
              <span style={{fontSize:11,color:"var(--ui-success)",fontWeight:600}}>{savedMsg}</span>
            )}

            {/* Botão Ctrl+K */}
            <button onClick={() => setPaletteOpen(true)} title="Busca rápida (Ctrl+K)" style={{
              background:"var(--ui-bg-secondary)",
              border:"1px solid var(--ui-border)",
              borderRadius:6,
              padding:"7px 10px",
              color:"var(--ui-text-secondary)",
              cursor:"pointer",
              display:"flex",alignItems:"center",gap:7,fontSize:11,fontWeight:600
            }}>
              <Search size={13}/>
              <kbd style={{
                background:"var(--ui-bg-secondary)",
                border:"1px solid var(--ui-border)",
                borderRadius:3,
                padding:"1px 5px",fontSize:9,
                color:"var(--ui-text-faint)",
                fontFamily:"'JetBrains Mono',monospace"
              }}>⌘K</kbd>
            </button>

            {/* Botão de ajuda de atalhos */}
            <button onClick={() => setShowShortcutsHelp(true)} title="Atalhos de teclado (?)" style={{
              background:"var(--ui-bg-secondary)",
              border:"1px solid var(--ui-border)",
              borderRadius:6,
              padding:"7px 10px",
              color:"var(--ui-text-secondary)",
              cursor:"pointer",
              display:"flex",alignItems:"center",fontSize:13,fontWeight:700
            }}>
              ?
            </button>

            {/* Modo Privacidade */}
            <PrivacyToggle hidden={privacy.hidden} toggle={privacy.toggle}/>
            <ThemeToggle theme={themeApi.theme} toggle={themeApi.toggle}/>

            {/* User badge */}
            <div style={{
              display:"flex",alignItems:"center",gap:8,
              background:"var(--ui-bg-secondary)",
              border:"1px solid var(--ui-border)",
              borderRadius:6,
              padding:"7px 12px"
            }}>
              <User size={13} color="var(--ui-accent)"/>
              <span style={{fontSize:11,color:"var(--ui-text-secondary)",fontWeight:600,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{userEmail}</span>
            </div>
            <button onClick={onLogout} title="Sair" style={{
              background:"var(--ui-bg-secondary)",
              border:"1px solid var(--ui-border)",
              borderRadius:6,
              padding:"8px 10px",
              color:"var(--ui-danger)",
              cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center"
            }}><LogOut size={14}/></button>
          </div>
        </div>

        {/* Linha 2: Tabs com agrupamento por cor */}
        <div style={{
          display:"flex",padding:"0 24px",gap:0,
          borderTop:"1px solid var(--ui-border)",
          alignItems:"center",overflowX:"auto"
        }}>
          {TABS.map((t, i) => {
            const Icon = t.icon;
            const ativo = tab === t.k;
            const grupoAtual = t.grupo;
            const grupoAnterior = i > 0 ? TABS[i-1].grupo : null;
            const novoGrupo = grupoAnterior && grupoAnterior !== grupoAtual;

            return (
              <div key={t.k} style={{display:"flex",alignItems:"center"}}>
                {novoGrupo && (
                  <div style={{
                    width:1,height:18,background:"var(--ui-border)",margin:"0 8px"
                  }}/>
                )}
                <button onClick={()=>setTab(t.k)} className="tab-btn"
                  style={{
                    background:"transparent",border:"none",cursor:"pointer",
                    padding:"12px 14px",fontSize:13,fontWeight:600,
                    color:ativo ? "var(--ui-text)" : "var(--ui-text-muted)",
                    borderBottom:`2px solid ${ativo ? t.cor : "transparent"}`,
                    display:"flex",alignItems:"center",gap:7,
                    whiteSpace:"nowrap",
                    position:"relative"
                  }}>
                  <Icon size={14} strokeWidth={2} color={ativo ? t.cor : undefined}/>
                  <span>{t.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <div style={{padding:"20px 24px",maxWidth:1600,margin:"0 auto"}}>
        {/* PAINEL DE ANÁLISE - Horizontal (apenas na aba Análise IA) */}
        {tab === "analise" && (
        <div className="anim" style={{
          background:"var(--ui-bg-card)",border:"1px solid var(--ui-border)",borderRadius:12,
          padding:"16px 20px",marginBottom:20,
          display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",
          boxShadow:"var(--ui-shadow-sm)"
        }}>
          <div style={{flex:"1 1 200px",minWidth:160}}>
            <div style={{fontSize:10,color:"var(--ui-text-faint)",fontWeight:700,letterSpacing:1,marginBottom:6}}>VALOR DO APORTE</div>
            <input type="text" placeholder="R$ 0,00" value={aporte} onChange={handleAporte}
              style={{width:"100%",background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:8,
                padding:"10px 14px",fontSize:18,color:"var(--ui-text)",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}/>
            <div style={{display:"flex",gap:5,marginTop:7}}>
              {[500,1000,2000,5000].map(vv => (
                <button key={vv} onClick={()=>setAporte(vv.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}))}
                  style={{flex:1,background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:5,
                    padding:"5px 0",fontSize:10,color:"var(--ui-text-muted)",cursor:"pointer",
                    fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>
                  {fmtK(vv)}
                </button>
              ))}
            </div>
          </div>

          <div style={{width:1,alignSelf:"stretch",background:"var(--ui-border)"}}/>

          <div style={{flex:"1 1 160px",minWidth:140}}>
            <div style={{fontSize:10,color:"var(--ui-text-faint)",fontWeight:700,letterSpacing:1,marginBottom:6}}>PERFIL</div>
            <select value={perfil} onChange={e=>setPerfil(e.target.value)}
              style={{width:"100%",background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:8,
                padding:"10px 12px",fontSize:13,color:"var(--ui-text)",cursor:"pointer",fontWeight:600}}>
              <option value="conservador">Conservador</option>
              <option value="moderado">Moderado</option>
              <option value="arrojado">Arrojado</option>
            </select>
          </div>

          <div style={{flex:"1 1 160px",minWidth:140}}>
            <div style={{fontSize:10,color:"var(--ui-text-faint)",fontWeight:700,letterSpacing:1,marginBottom:6}}>FOCO</div>
            <select value={foco} onChange={e=>setFoco(e.target.value)}
              style={{width:"100%",background:"var(--ui-bg-input)",border:"1px solid var(--ui-border)",borderRadius:8,
                padding:"10px 12px",fontSize:13,color:"var(--ui-text)",cursor:"pointer",fontWeight:600}}>
              <option value="acoes">Ações</option>
              <option value="fiis">FIIs</option>
              <option value="misto">Misto</option>
            </select>
          </div>

          <div style={{flex:"2 1 280px",minWidth:240}}>
            <div style={{fontSize:10,color:"var(--ui-text-faint)",fontWeight:700,letterSpacing:1,marginBottom:6}}>&nbsp;</div>
            <button onClick={analisar} disabled={loading}
              style={{
                width:"100%",
                background:loading?"var(--ui-bg-secondary)":"linear-gradient(135deg,#7b61ff,#5540dd)",
                border:"none",borderRadius:8,padding:"12px 18px",color:"#ffffff",
                fontWeight:700,fontSize:13,cursor:loading?"not-allowed":"pointer",
                boxShadow:loading?"none":"0 4px 14px rgba(123,97,255,0.35)",
                display:"flex",alignItems:"center",justifyContent:"center",gap:10
              }}>
              {loading
                ? <>
                    <span className="spin" style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(123,97,255,0.27)",borderTopColor:"var(--ui-accent)",display:"inline-block"}}/>
                    <span style={{fontSize:12,color:"var(--ui-text-secondary)"}}>{fase||"Analisando..."}</span>
                  </>
                : <><Sparkles size={16} strokeWidth={2.5}/> <span>Analisar{carteira.length>0?` carteira (${carteira.length})`:" mercado"}</span></>
              }
            </button>
          </div>
        </div>
        )}

        {erro && tab === "analise" && (
          <div style={{
            background:"rgba(255,77,109,0.06)",border:"1px solid rgba(255,77,109,0.19)",borderRadius:8,
            padding:"10px 14px",color:"var(--ui-danger)",fontSize:12,marginBottom:16,
            display:"flex",alignItems:"center",gap:8
          }}><AlertCircle size={14} strokeWidth={2.2}/>{erro}</div>
        )}

        {/* ÁREA DE CONTEÚDO - Tab atual */}
        {/* Onboarding hero - mostrado apenas se carteira vazia + não foi fechado */}
        {showOnboarding && tab === "carteira" && carteira.length === 0 && !carregandoDados && (
          <OnboardingHero
            onAddAtivo={() => {
              fecharOnboarding();
              setTimeout(() => {
                document.querySelector('input[placeholder*="Ticker"]')?.focus();
              }, 100);
            }}
            onImportCSV={() => {
              fecharOnboarding();
              setTimeout(() => document.querySelector('input[type="file"]')?.click(), 100);
            }}
            onAnalyzeMercado={() => {
              fecharOnboarding();
              setTab("oportunidades");
            }}
            onClose={fecharOnboarding}
          />
        )}

        <div key={tab} className="anim" style={{animation:"slideIn .25s cubic-bezier(0.4, 0, 0.2, 1) both"}}>
          {tab==="carteira" && <TabCarteira carteira={carteira} setCarteira={setCarteira} historico={historico} setHistorico={setHistorico} dados={dados} onSave={salvar} userId={userId} carteiraId={carteiraId} pedirConfirmacao={pedirConfirmacao}/>}
          {tab==="analise" && <TabAnalise dados={dados} aporte={aporteNum()} perfil={perfil} loading={loading} fase={fase}/>}
          {tab==="ticker" && <TabTicker userId={userId} chamarIAComSearch={chamarIAComSearch}/>}
          {tab==="comparador" && <TabComparador chamarIAComSearch={chamarIAComSearch}/>}
          {tab==="oportunidades" && <TabOportunidades chamarIAComSearch={chamarIAComSearch} universoTickers={universoTickers}/>}
          {tab==="patrimonio" && <TabPatrimonio userId={userId} dados={dados}/>}
          {tab==="historico" && <TabHistorico userId={userId} pedirConfirmacao={pedirConfirmacao}/>}
          {tab==="proventos" && <TabProventos userId={userId} pedirConfirmacao={pedirConfirmacao}/>}
          {tab==="meta" && <TabMeta dados={dados}/>}
          {tab==="cenarios" && <TabCenarios dados={dados}/>}
          {tab==="watchlist" && <TabWatchlist watchlist={watchlist} setWatchlist={setWatchlist} dados={dados} onSave={salvar} userId={userId} pedirConfirmacao={pedirConfirmacao}/>}
          {tab==="universo" && <TabUniverso userId={userId}/>}
          {tab==="ir" && <TabIR dados={dados}/>}
        </div>

        {/* Toast notifications */}
        <ToastContainer/>

        {/* Modal de confirmação */}
        <ConfirmModal
          open={confirmacao.open}
          titulo={confirmacao.titulo}
          mensagem={confirmacao.mensagem}
          perigoso={confirmacao.perigoso}
          onConfirm={() => { confirmacao.onConfirm?.(); setConfirmacao({open:false}); }}
          onCancel={() => setConfirmacao({open:false})}
        />

        {/* Command Palette (Ctrl+K) */}
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onNavigate={(target) => setTab(target)}
          onAnalyzeTicker={(t) => {
            setTab("ticker");
            // O TabTicker pega o ticker do estado interno, então passamos via window evento
            setTimeout(() => {
              const evt = new CustomEvent("inventia:analyze-ticker", { detail: { ticker: t } });
              window.dispatchEvent(evt);
            }, 100);
          }}
        />

        {/* Modal de ajuda dos atalhos (?) */}
        {showShortcutsHelp && (
          <div onClick={() => setShowShortcutsHelp(false)} style={{
            position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",
            zIndex:9997,display:"flex",alignItems:"center",justifyContent:"center",padding:20
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background:"var(--ui-bg-card)",border:"1px solid var(--ui-border)",borderRadius:14,
              padding:"24px 28px",maxWidth:520,width:"100%",
              boxShadow:"0 20px 60px rgba(0,0,0,0.3)"
            }}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{
                    width:36,height:36,borderRadius:9,
                    background:"rgba(123,97,255,0.12)",
                    display:"flex",alignItems:"center",justifyContent:"center"
                  }}>
                    <Command size={18} color="var(--ui-accent)" strokeWidth={2.2}/>
                  </div>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:"var(--ui-text)"}}>Atalhos de Teclado</div>
                    <div style={{fontSize:11,color:"var(--ui-text-faint)"}}>Pressione <kbd style={kbdStyle}>?</kbd> para abrir/fechar</div>
                  </div>
                </div>
                <button onClick={() => setShowShortcutsHelp(false)} style={{
                  background:"transparent",border:"none",cursor:"pointer",
                  color:"var(--ui-text-muted)",padding:4
                }}><X size={20}/></button>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:"var(--ui-text-faint)",marginBottom:8}}>GERAIS</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    <KeyRow keys={["⌘","K"]} desc="Abrir paleta de comandos"/>
                    <KeyRow keys={["/"]} desc="Buscar (alternativa ao ⌘K)"/>
                    <KeyRow keys={["?"]} desc="Mostrar/ocultar este painel"/>
                    <KeyRow keys={["Esc"]} desc="Fechar modais e paleta"/>
                  </div>
                </div>

                <div>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:"var(--ui-text-faint)",marginBottom:8}}>NAVEGAÇÃO RÁPIDA (g + tecla)</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                    <KeyRow keys={["g","c"]} desc="Carteira"/>
                    <KeyRow keys={["g","p"]} desc="Patrimônio"/>
                    <KeyRow keys={["g","a"]} desc="Análise IA"/>
                    <KeyRow keys={["g","t"]} desc="Analisar Ticker"/>
                    <KeyRow keys={["g","o"]} desc="Oportunidades"/>
                    <KeyRow keys={["g","h"]} desc="Histórico"/>
                    <KeyRow keys={["g","d"]} desc="Proventos (Dividendos)"/>
                    <KeyRow keys={["g","w"]} desc="Watchlist"/>
                    <KeyRow keys={["g","u"]} desc="Universo"/>
                    <KeyRow keys={["g","m"]} desc="1º Milhão"/>
                    <KeyRow keys={["g","i"]} desc="Calculadora IR"/>
                    <KeyRow keys={["g","x"]} desc="Cenários"/>
                  </div>
                </div>

                <div style={{
                  padding:"10px 12px",
                  background:"rgba(123,97,255,0.08)",
                  border:"1px solid rgba(123,97,255,0.2)",
                  borderRadius:8,
                  fontSize:11,color:"var(--ui-text-muted)",lineHeight:1.5
                }}>
                  💡 <b>Dica:</b> dentro da paleta de comandos (<kbd style={kbdStyle}>⌘K</kbd>), digite um ticker (ex: PETR4) para analisar diretamente.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop:40,padding:"20px 0",borderTop:"1px solid var(--ui-border)",
          textAlign:"center",fontSize:11,color:"var(--ui-text-faint)"
        }}>
          Powered by <span style={{color:"var(--ui-accent)",fontWeight:700}}>Gemini 2.5 Pro</span> + Google Search · 
          Cotações em tempo real · Confirme preços na sua corretora antes de operar
        </div>
      </div>
    </div>
  );
}

// Componente Metric para a barra superior
function Metric({ label, value, accent, sparkline, sparkColor = "var(--ui-accent)" }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2}}>
      <div style={{fontSize:9,color:"var(--ui-text-faint)",fontWeight:800,letterSpacing:1.2}}>{label}</div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{
          fontSize:14,fontWeight:700,
          color: accent || "var(--ui-text)",
          fontFamily:"'JetBrains Mono',monospace"
        }}>{value}</div>
        {sparkline && sparkline.length >= 5 && (
          <Sparkline data={sparkline} width={70} height={22} color={sparkColor} strokeWidth={1.8}/>
        )}
      </div>
    </div>
  );
}
