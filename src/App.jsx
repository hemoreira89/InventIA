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
  Search, ArrowUp, ArrowDown, Zap, Shield, Rocket, ChevronRight, Loader2,
  Building2, Landmark, Factory, LogOut, User, History, Coins, GitCompare,
  FileSearch, Bell, Download, Upload, ExternalLink, Clock
} from "lucide-react";
import {
  carregarCarteiraPrincipal, carregarAtivos, salvarAtivo, removerAtivo,
  registrarCompra, carregarCompras,
  carregarWatchlist, salvarWatchlist, removerWatchlist,
  salvarAnalise, carregarAnalises,
  registrarProvento, carregarProventos, removerProvento,
  registrarVenda, carregarVendas
} from "./supabase";

// ─── Constantes ───────────────────────────────────────────────────────────────
const SK = "investia_v4";
const PALETTE = ["#7b61ff","#00e5a0","#ffd60a","#ff4d6d","#00b4d8","#f77f00","#9ef01a","#e040fb","#40c4ff","#ff6b6b","#a8dadc","#e63946"];
const CDI_ANO = 13.75;
const IBOV_HIST = 12.5;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = (n, d=2) => n != null && !isNaN(n) ? Number(n).toFixed(d) : "–";
const fmtBRL = n => n != null && !isNaN(n) ? Number(n).toLocaleString("pt-BR", {style:"currency", currency:"BRL"}) : "–";
const fmtK = n => n >= 1e6 ? `R$${(n/1e6).toFixed(1)}M` : n >= 1000 ? `R$${(n/1000).toFixed(0)}k` : fmtBRL(n);

// ─── Storage — agora usamos Supabase, mantemos localStorage como cache ──────
const store = {
  save: async d => { try { localStorage.setItem(SK, JSON.stringify(d)); return true; } catch(_) { return false; } },
  load: async () => { try { const r = localStorage.getItem(SK); return r ? JSON.parse(r) : null; } catch(_) { return null; } }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Extrai JSON de qualquer texto — mesmo que venha com explicações ao redor
function extrairJSON(text) {
  if (!text || !text.trim()) throw new Error("Resposta vazia da IA");
  // Tenta direto primeiro
  try { return JSON.parse(text.trim()); } catch(_) {}
  // Remove blocos markdown
  const semMd = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(semMd); } catch(_) {}
  // Extrai o maior bloco JSON do texto (entre { e })
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch(_) {}
  }
  // Extrai array JSON
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch(_) {}
  }
  throw new Error("Não foi possível extrair JSON da resposta: " + text.slice(0, 200));
}

// ─── IA Principal — via Vercel API proxy (chave segura no servidor) ──────────
const API_URL = "/api/analyze";

async function chamarIAComSearch(prompt) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, useSearch: true, model: "pro" })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error ${res.status}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return extrairJSON(data.text);
}

async function chamarIA(prompt) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, useSearch: true, model: "flash" })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error ${res.status}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return extrairJSON(data.text);
}

// ─── Cálculos ─────────────────────────────────────────────────────────────────
function juroCompostos(pv, pmt, taxa, n) {
  const r = taxa / 100 / 12;
  if (r === 0) return pv + pmt * n;
  return pv * Math.pow(1+r, n) + pmt * (Math.pow(1+r, n) - 1) / r;
}

function gerarProjecao(pv, pmt, taxa, anos) {
  const pts = [];
  for (let m = 0; m <= anos * 12; m += 3) {
    pts.push({
      ano: `${(m/12).toFixed(1)}a`,
      "Com juros": Math.round(juroCompostos(pv, pmt, taxa, m)),
      "Sem juros": Math.round(pv + pmt * m),
    });
  }
  return pts;
}

function simularCenarios(pv, pmt, anos) {
  const cenarios = [
    { name:"Conservador (CDI)", taxa:CDI_ANO, color:"#00e5a0" },
    { name:"Moderado (IBOV hist.)", taxa:IBOV_HIST, color:"#7b61ff" },
    { name:"Arrojado (18% a.a.)", taxa:18, color:"#ffd60a" },
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

function calcScore(pos) {
  const setores = {};
  pos.forEach(p => { setores[p.setor] = (setores[p.setor]||0) + p.peso; });
  const maxSetor = Math.max(...Object.values(setores));
  const concScore = Math.max(0, 100 - maxSetor * 1.2);
  const divScore = pos.filter(p => p.tipo === "FII" || p.dy > 3).length / (pos.length||1) * 100;
  return Math.round(concScore * 0.55 + divScore * 0.45);
}

function projetarDividendos(pos) {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return meses.map(mes => ({
    mes,
    dividendos: Math.round(pos.reduce((s,p) => s + (p.valorAtual||0) * (p.dy||0) / 100 / 12, 0))
  }));
}

// ─── Micro-componentes ────────────────────────────────────────────────────────
function Badge({ val, suffix="%" }) {
  if (val == null) return null;
  const up = val >= 0;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:3,
      background:up?"#00e5a018":"#ff4d6d18",color:up?"#00e5a0":"#ff4d6d",
      border:`1px solid ${up?"#00e5a030":"#ff4d6d30"}`,
      borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700}}>
      {up?"▲":"▼"} {fmt(Math.abs(val))}{suffix}
    </span>
  );
}

function Card({ children, style={}, accent=false, className="" }) {
  return (
    <div className={`card-hover ${className}`} style={{
      background:"#0a0a0f",
      border:`1px solid ${accent?"#7b61ff44":"#252535"}`,
      borderRadius:10,padding:"16px",...style
    }}>
      {children}
    </div>
  );
}

function STitle({ children, color="#7b61ff" }) {
  return <div style={{fontSize:10,color,fontWeight:700,letterSpacing:1.5,marginBottom:12,textTransform:"uppercase"}}>{children}</div>;
}

function Stat({ label, value, color, mono=false }) {
  return (
    <div style={{background:"#000000",borderRadius:8,padding:"10px 12px",border:"1px solid #1a1a25"}}>
      <div style={{fontSize:9,color:"#7a7a8a",marginBottom:4,fontWeight:600,letterSpacing:1}}>{label}</div>
      <div style={{fontSize:14,fontWeight:700,color:color||"#ffffff",
        fontFamily:mono?"'JetBrains Mono',monospace":"inherit"}}>{value}</div>
    </div>
  );
}

const TTip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:"#12122e",border:"1px solid #2a2a50",borderRadius:10,padding:"10px 14px",fontSize:12}}>
      {label && <div style={{color:"#888",marginBottom:4}}>{label}</div>}
      {payload.map((p,i) => (
        <div key={i} style={{color:p.color||p.fill||"#ffffff",fontWeight:600,marginBottom:2}}>
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
            border:"3px solid #252535",borderTopColor:"#7b61ff",position:"absolute"}}/>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)"}}><Sparkles size={18} color="#7b61ff" strokeWidth={2.5}/></div>
        </div>
        <div style={{fontSize:13,color:"#a8a8b8"}}>{fase}</div>
        <div style={{fontSize:11,color:"#5a5a6a"}}>IA analisando o mercado...</div>
      </div>
    </Card>
  );
}

// ─── Tab: Carteira ────────────────────────────────────────────────────────────
function TabCarteira({ carteira, setCarteira, historico, setHistorico, dados, onSave, userId, carteiraId }) {
  const [ticker,setTicker]=useState(""); const [qtd,setQtd]=useState("");
  const [pm,setPm]=useState(""); const [data,setData]=useState("");
  const [pesoAlvo,setPesoAlvo]=useState({});
  const [salvando,setSalvando]=useState(false);

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
    } catch (e) {
      console.error("Erro ao registrar compra:", e);
      alert("Erro ao salvar: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const removerAtivoCarteira = async (ativo) => {
    if (!ativo.id) {
      // Ativo só local
      setCarteira(p => p.filter(x => x.ticker !== ativo.ticker));
      return;
    }
    try {
      await removerAtivo(ativo.id);
      setCarteira(p => p.filter(x => x.ticker !== ativo.ticker));
      onSave();
    } catch (e) {
      alert("Erro ao remover: " + e.message);
    }
  };

  const alertasReb = dados?.posicoes?.filter(p => {
    const a = pesoAlvo[p.ticker];
    return a && Math.abs(p.peso - a) > 5;
  }) || [];

  return (
    <div style={{display:"grid",gridTemplateColumns:"360px 1fr",gap:16,alignItems:"start"}}>
      <div style={{display:"flex",flexDirection:"column",gap:14,position:"sticky",top:120}}>
      <Card>
        <STitle>REGISTRAR COMPRA</STitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <input placeholder="Ticker (PETR4)" value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key==="Enter"&&add()}
            style={{gridColumn:"1/-1",background:"#000000",border:"1px solid #252535",borderRadius:9,padding:"11px 12px",fontSize:13,color:"#ffffff",width:"100%"}}/>
          <input type="number" placeholder="Quantidade" value={qtd} onChange={e=>setQtd(e.target.value)}
            style={{background:"#000000",border:"1px solid #252535",borderRadius:9,padding:"11px 10px",fontSize:13,color:"#ffffff",width:"100%"}}/>
          <input type="number" placeholder="Preço médio R$" value={pm} onChange={e=>setPm(e.target.value)}
            style={{background:"#000000",border:"1px solid #252535",borderRadius:9,padding:"11px 10px",fontSize:13,color:"#ffffff",width:"100%"}}/>
          <input type="date" value={data} onChange={e=>setData(e.target.value)}
            style={{gridColumn:"1/-1",background:"#000000",border:"1px solid #252535",borderRadius:9,padding:"11px 12px",fontSize:13,color:"#ffffff",width:"100%"}}/>
        </div>
        <button onClick={add} style={{width:"100%",background:"linear-gradient(135deg,#7b61ff,#5540dd)",border:"none",borderRadius:9,padding:"12px",color:"#ffffff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          <><Plus size={14} strokeWidth={2.5} style={{display:"inline",verticalAlign:"middle",marginRight:6}}/>Registrar Compra</>
        </button>
      </Card>

      {alertasReb.length > 0 && (
        <div style={{background:"#ffd60a0a",border:"1px solid #ffd60a25",borderRadius:12,padding:"12px 14px"}}>
          <STitle color="#ffd60a"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><AlertTriangle size={12} strokeWidth={2.5}/>REBALANCEAMENTO NECESSÁRIO</span></STitle>
          {alertasReb.map(p => (
            <div key={p.ticker} style={{fontSize:12,color:"#a8a8b8",marginBottom:3}}>
              {p.ticker}: atual {fmt(p.peso,1)}% · alvo {pesoAlvo[p.ticker]}% · desvio {fmt(Math.abs(p.peso-pesoAlvo[p.ticker]),1)}%
            </div>
          ))}
        </div>
      )}

      {historico.length > 0 && (
        <Card>
          <STitle>HISTÓRICO DE COMPRAS</STitle>
          {[...historico].reverse().slice(0,8).map((h,i) => (
            <div key={i} style={{display:"flex",justifyContent:"space-between",borderBottom:"1px solid #1a1a25",paddingBottom:7,marginBottom:7}}>
              <div><span style={{fontWeight:700,color:"#7b61ff",fontSize:13}}>{h.ticker}</span><span style={{fontSize:11,color:"#6a6a7a",marginLeft:8}}>{h.data}</span></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:12,color:"#ffffff"}}>{h.qtd} cotas</div>{h.pm&&<div style={{fontSize:11,color:"#9090a0"}}>{fmtBRL(h.pm)} cada</div>}</div>
            </div>
          ))}
        </Card>
      )}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {carteira.length > 0 ? <>
        <STitle>ATIVOS ({carteira.length})</STitle>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
        {carteira.map((a,i) => {
          const pos = dados?.posicoes?.find(p => p.ticker === a.ticker);
          return (
            <Card key={a.ticker}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:34,height:34,borderRadius:9,background:"#1a1a25",display:"flex",
                    alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,
                    color:PALETTE[i%PALETTE.length]}}>{a.ticker.slice(0,4)}</div>
                  <div>
                    <div style={{fontWeight:700,color:"#ffffff",fontSize:14}}>{a.ticker}</div>
                    <div style={{fontSize:11,color:"#6a6a7a"}}>{a.qtd} cotas{a.pm?` · PM ${fmtBRL(a.pm)}`:""}</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {pos && (
                    <div style={{textAlign:"right"}}>
                      <div style={{fontWeight:700,color:"#ffffff",fontSize:13,fontFamily:"'JetBrains Mono',monospace"}}>{fmtBRL(pos.valorAtual)}</div>
                      {pos.pm && <Badge val={(pos.preco-pos.pm)/pos.pm*100}/>}
                    </div>
                  )}
                  <button onClick={() => removerAtivoCarteira(a)}
                    style={{background:"#ff4d6d15",border:"1px solid #ff4d6d30",borderRadius:6,padding:"6px 8px",color:"#ff4d6d",cursor:"pointer",display:"flex",alignItems:"center"}}><Trash2 size={13} strokeWidth={2}/></button>
                </div>
              </div>
              {pos && (
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>
                  {pos.dy>0 && <span style={{fontSize:10,background:"#ffd60a12",color:"#ffd60a",borderRadius:10,padding:"2px 7px"}}>DY {fmt(pos.dy)}%</span>}
                  {pos.pl && <span style={{fontSize:10,background:"#7b61ff12",color:"#7b61ff",borderRadius:10,padding:"2px 7px"}}>P/L {fmt(pos.pl)}</span>}
                  {pos.setor && <span style={{fontSize:10,background:"#ffffff08",color:"#9090a0",borderRadius:10,padding:"2px 7px"}}>{pos.setor}</span>}
                </div>
              )}
              <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:"#5a5a6a"}}>Peso alvo %:</span>
                <input type="number" placeholder="%" value={pesoAlvo[a.ticker]||""} min={0} max={100}
                  onChange={e => setPesoAlvo(p => ({...p,[a.ticker]:Number(e.target.value)}))}
                  style={{width:58,background:"#000000",border:"1px solid #252535",borderRadius:7,padding:"4px 8px",fontSize:12,color:"#ffffff"}}/>
                {pos && <span style={{fontSize:11,color:"#5a5a6a"}}>atual {fmt(pos.peso,1)}%</span>}
              </div>
            </Card>
          );
        })}
        </div>
      </> : (
        <Card style={{textAlign:"center",padding:"28px 16px",border:"1px dashed #252535"}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:10}}><Briefcase size={32} color="#444" strokeWidth={1.5}/></div>
          <div style={{color:"#6a6a7a",fontSize:13,marginBottom:6}}>Carteira vazia</div>
          <div style={{color:"#5a5a6a",fontSize:12,lineHeight:1.7}}>
            Adicione seus ativos acima para análise personalizada,<br/>
            ou analise sem carteira para ver oportunidades de mercado.
          </div>
        </Card>
      )}

      </div>
    </div>
  );
}

// ─── Tab: Gráficos ────────────────────────────────────────────────────────────
function TabGraficos({ dados }) {
  const [g, setG] = useState("pizza");
  if (!dados) return <div style={{textAlign:"center",padding:"48px 0",color:"#5a5a6a",fontSize:13}}>Rode a análise primeiro ↑</div>;

  const pos = dados.posicoes || [];
  const pizza = pos.map((p,i) => ({ name:p.ticker, value:+p.peso.toFixed(1), fill:PALETTE[i%PALETTE.length] }));
  const setoresMap = {};
  pos.forEach((p,i) => { const s=p.setor||"Outros"; if(!setoresMap[s]) setoresMap[s]={name:s,value:0,fill:PALETTE[i%PALETTE.length]}; setoresMap[s].value+=p.peso; });
  const perf = pos.filter(p=>p.pm&&p.pm>0).map(p=>({ticker:p.ticker,retorno:+((p.preco-p.pm)/p.pm*100).toFixed(2),fill:(p.preco-p.pm)>=0?"#00e5a0":"#ff4d6d"})).sort((a,b)=>b.retorno-a.retorno);
  const canal = pos.map(p => ({ ticker:p.ticker, posicao:p.canal52??50 }));
  const divs = pos.length > 0 ? projetarDividendos(pos) : [];
  const radar = [
    {m:"Diversif.",v:Math.min(100,pos.length*15)},
    {m:"Dividendos",v:Math.min(100,pos.filter(p=>p.dy>4).length/Math.max(1,pos.length)*100)},
    {m:"Valor",v:Math.min(100,100-pos.reduce((s,p)=>s+(p.canal52||50),0)/Math.max(1,pos.length))},
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
          <button key={t.k} onClick={()=>setG(t.k)} style={{padding:"8px 16px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",background:g===t.k?"#7b61ff":"#0a0a0f",border:`1px solid ${g===t.k?"#7b61ff":"#252535"}`,color:g===t.k?"#ffffff":"#9090a0",transition:"all .15s"}}>{t.l}</button>
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
              {pizza.map((e,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:8,height:8,borderRadius:2,background:e.fill}}/><span style={{fontSize:10,color:"#888"}}>{e.name} {fmt(e.value,1)}%</span></div>)}
            </div>
          </> : <div style={{textAlign:"center",color:"#5a5a6a",padding:"32px 0",fontSize:13}}>Sem ativos na carteira</div>}
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
          <STitle>POSIÇÃO NO CANAL DE 52 SEMANAS (estimado pela IA)</STitle>
          <div style={{fontSize:10,color:"#5a5a6a",marginBottom:10}}>0% = próximo da mínima · 100% = próximo da máxima anual</div>
          {canal.length > 0 ? <>
            <ResponsiveContainer width="100%" height={Math.max(130,canal.length*36)}>
              <BarChart data={canal} layout="vertical" margin={{left:8,right:16,top:4,bottom:4}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a25" horizontal={false}/>
                <XAxis type="number" domain={[0,100]} tick={{fill:"#9090a0",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                <YAxis dataKey="ticker" type="category" tick={{fill:"#aaa",fontSize:11,fontWeight:700}} axisLine={false} tickLine={false} width={50}/>
                <Tooltip formatter={v=>[`${fmt(v,0)}%`,"Canal"]}/>
                <Bar dataKey="posicao" radius={[0,6,6,0]}>
                  {canal.map((e,i)=><Cell key={i} fill={e.posicao<=30?"#00e5a0":e.posicao<=70?"#ffd60a":"#ff4d6d"}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{display:"flex",gap:10,marginTop:8,justifyContent:"center",flexWrap:"wrap"}}>
              {[{c:"#00e5a0",l:"Oportunidade"},{c:"#ffd60a",l:"Neutro"},{c:"#ff4d6d",l:"Caro"}].map(x=><div key={x.l} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:x.c}}/><span style={{fontSize:10,color:"#9090a0"}}>{x.l}</span></div>)}
            </div>
          </> : <div style={{textAlign:"center",color:"#5a5a6a",padding:"24px 0",fontSize:13}}>Sem dados</div>}
        </>}

        {g==="perf" && perf.length > 0 && <>
          <STitle>PERFORMANCE vs PREÇO MÉDIO</STitle>
          <ResponsiveContainer width="100%" height={Math.max(130,perf.length*38)}>
            <BarChart data={perf} layout="vertical" margin={{left:8,right:16,top:4,bottom:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a25" horizontal={false}/>
              <XAxis type="number" tick={{fill:"#9090a0",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v>0?"+":""}${fmt(v,1)}%`}/>
              <YAxis dataKey="ticker" type="category" tick={{fill:"#aaa",fontSize:11,fontWeight:700}} axisLine={false} tickLine={false} width={50}/>
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
                <stop offset="5%" stopColor="#ffd60a" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ffd60a" stopOpacity={0}/>
              </linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a25"/>
              <XAxis dataKey="mes" tick={{fill:"#9090a0",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"#9090a0",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${v}`} width={48}/>
              <Tooltip content={<TTip/>}/>
              <Area type="monotone" dataKey="dividendos" name="Dividendos" stroke="#ffd60a" strokeWidth={2} fill="url(#gd)"/>
            </AreaChart>
          </ResponsiveContainer>
          <div style={{textAlign:"center",marginTop:8,fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:700,color:"#ffd60a"}}>
            Estimativa anual: {fmtBRL(divs.reduce((s,d)=>s+d.dividendos,0))}
          </div>
        </>}

        {g==="radar" && <>
          <STitle>RADAR DA CARTEIRA</STitle>
          <ResponsiveContainer width="100%" height={210}>
            <RadarChart data={radar} cx="50%" cy="50%" outerRadius={75}>
              <PolarGrid stroke="#252535"/>
              <PolarAngleAxis dataKey="m" tick={{fill:"#888",fontSize:11}}/>
              <PolarRadiusAxis angle={30} domain={[0,100]} tick={{fill:"#5a5a6a",fontSize:9}}/>
              <Radar name="Carteira" dataKey="v" stroke="#7b61ff" fill="#7b61ff" fillOpacity={0.3}/>
            </RadarChart>
          </ResponsiveContainer>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
            {radar.map(r => <Stat key={r.m} label={r.m} value={`${fmt(r.v,0)}%`} color="#7b61ff"/>)}
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
        <STitle color="#ffd60a"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Target size={12} strokeWidth={2.5}/>PRIMEIRO MILHÃO</span></STitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div style={{gridColumn:"1/-1"}}>
            <div style={{fontSize:11,color:"#6a6a7a",marginBottom:5}}>Meta patrimonial (R$)</div>
            <input type="number" value={meta} onChange={e=>setMeta(e.target.value)}
              style={{width:"100%",background:"#000000",border:"1px solid #252535",borderRadius:9,padding:"12px",fontSize:16,color:"#ffd60a",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:"#6a6a7a",marginBottom:5}}>Aporte mensal (R$)</div>
            <input type="number" value={aporteMensal} onChange={e=>setAporteMensal(e.target.value)}
              style={{width:"100%",background:"#000000",border:"1px solid #252535",borderRadius:9,padding:"11px 10px",fontSize:14,color:"#ffffff",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:"#6a6a7a",marginBottom:5}}>Taxa anual (%)</div>
            <input type="number" value={taxaAnual} onChange={e=>setTaxaAnual(e.target.value)}
              style={{width:"100%",background:"#000000",border:"1px solid #252535",borderRadius:9,padding:"11px 10px",fontSize:14,color:"#ffffff",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}/>
          </div>
        </div>
        {pv > 0 && <div style={{fontSize:12,color:"#9090a0",marginBottom:10}}>Patrimônio atual: <span style={{color:"#00e5a0",fontWeight:700}}>{fmtBRL(pv)}</span> incluído</div>}
        <button onClick={calcular} style={{width:"100%",background:"linear-gradient(135deg,#ffd60a,#f77f00)",border:"none",borderRadius:9,padding:"13px",color:"#000",fontWeight:800,fontSize:14,cursor:"pointer"}}>
          <><Sparkles size={14} strokeWidth={2.5} style={{display:"inline",verticalAlign:"middle",marginRight:6}}/>Calcular Minha Meta</>
        </button>
      </Card>

      {resultado && <>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Card style={{textAlign:"center",padding:"18px 10px"}}>
            <div style={{fontSize:32,fontWeight:900,color:"#ffd60a",fontFamily:"'JetBrains Mono',monospace"}}>{resultado.anos.toFixed(1)}</div>
            <div style={{fontSize:12,color:"#ffd60a",fontWeight:700}}>anos</div>
            <div style={{fontSize:11,color:"#6a6a7a",marginTop:2}}>{resultado.meses} meses</div>
          </Card>
          <Card style={{textAlign:"center",padding:"18px 10px"}}>
            <div style={{fontSize:20,fontWeight:900,color:"#00e5a0",fontFamily:"'JetBrains Mono',monospace"}}>{fmtK(resultado.divMensal)}</div>
            <div style={{fontSize:11,color:"#00e5a0",fontWeight:700}}>renda mensal potencial</div>
            <div style={{fontSize:10,color:"#6a6a7a",marginTop:2}}>ao atingir a meta</div>
          </Card>
          <Stat label="Total aportado" value={fmtBRL(resultado.totalAportado)} mono/>
          <Stat label="Ganho com juros" value={fmtBRL(Math.max(0,resultado.totalJuros))} color="#00e5a0" mono/>
        </div>
        <Card>
          <STitle>PROJEÇÃO PATRIMONIAL</STitle>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={resultado.projecao} margin={{left:0,right:0,top:5,bottom:5}}>
              <defs>
                <linearGradient id="gm" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ffd60a" stopOpacity={0.3}/><stop offset="95%" stopColor="#ffd60a" stopOpacity={0}/></linearGradient>
                <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6a6a7a" stopOpacity={0.2}/><stop offset="95%" stopColor="#6a6a7a" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a25"/>
              <XAxis dataKey="ano" tick={{fill:"#9090a0",fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"#9090a0",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v)} width={54}/>
              <Tooltip content={<TTip/>}/>
              <Area type="monotone" dataKey="Sem juros" stroke="#5a5a6a" strokeWidth={1} fill="url(#gs)" strokeDasharray="4 2"/>
              <Area type="monotone" dataKey="Com juros" stroke="#ffd60a" strokeWidth={2} fill="url(#gm)"/>
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
        <STitle color="#00b4d8"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><BarChart3 size={12} strokeWidth={2.5}/>SIMULADOR DE CENÁRIOS</span></STitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div>
            <div style={{fontSize:11,color:"#6a6a7a",marginBottom:5}}>Aporte mensal (R$)</div>
            <input type="number" value={aporteMensal} onChange={e=>setAporteMensal(e.target.value)}
              style={{width:"100%",background:"#000000",border:"1px solid #252535",borderRadius:9,padding:"11px 10px",fontSize:14,color:"#ffffff",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:"#6a6a7a",marginBottom:5}}>Período</div>
            <select value={anos} onChange={e=>setAnos(e.target.value)}
              style={{width:"100%",background:"#000000",border:"1px solid #252535",borderRadius:9,padding:"11px 10px",fontSize:13,color:"#ffffff",cursor:"pointer"}}>
              {[5,10,15,20,25,30].map(a => <option key={a} value={a}>{a} anos</option>)}
            </select>
          </div>
        </div>
        {pv > 0 && <div style={{fontSize:12,color:"#9090a0",marginBottom:10}}>Ponto de partida: <span style={{color:"#00e5a0",fontWeight:700}}>{fmtBRL(pv)}</span></div>}
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
                  <div><div style={{fontSize:12,color:"#888",marginBottom:2}}>{c.name}</div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:18,fontWeight:700,color:c.color}}>{fmtK(final)}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"#6a6a7a"}}>em {resultado.anos} anos</div><div style={{fontSize:12,color:c.color,fontWeight:600}}>+{fmt(c.taxa,1)}% a.a.</div></div>
                </div>
              </Card>
            );
          })}
        </div>
        <Card>
          <STitle>COMPARATIVO DE CENÁRIOS</STitle>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={resultado.pts} margin={{left:0,right:0,top:5,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a25"/>
              <XAxis dataKey="ano" tick={{fill:"#9090a0",fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"#9090a0",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v)} width={54}/>
              <Tooltip content={<TTip/>}/>
              <Legend wrapperStyle={{fontSize:11,color:"#888"}}/>
              {resultado.cenarios.map(c => <Line key={c.name} type="monotone" dataKey={c.name} stroke={c.color} strokeWidth={2} dot={false}/>)}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </>}
    </div>
  );
}

// ─── Tab: Watchlist ───────────────────────────────────────────────────────────
function TabWatchlist({ watchlist, setWatchlist, dados, onSave, userId }) {
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
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (item) => {
    if (item.id) {
      try { await removerWatchlist(item.id); } catch(_) {}
    }
    setWatchlist(p => p.filter(x => x.ticker !== item.ticker));
    onSave();
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
        <STitle color="#e040fb"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Eye size={12} strokeWidth={2.5}/>WATCHLIST</span></STitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <input placeholder="Ticker (VALE3)" value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())}
            style={{gridColumn:"1/-1",background:"#000000",border:"1px solid #252535",borderRadius:9,padding:"11px 12px",fontSize:13,color:"#ffffff",width:"100%"}}/>
          <input type="number" placeholder="Preço alvo R$" value={alvo} onChange={e=>setAlvo(e.target.value)}
            style={{background:"#000000",border:"1px solid #252535",borderRadius:9,padding:"11px 10px",fontSize:13,color:"#ffffff",width:"100%"}}/>
          <input placeholder="Nota (opcional)" value={nota} onChange={e=>setNota(e.target.value)}
            style={{background:"#000000",border:"1px solid #252535",borderRadius:9,padding:"11px 10px",fontSize:13,color:"#ffffff",width:"100%"}}/>
        </div>
        <button onClick={add} style={{width:"100%",background:"linear-gradient(135deg,#e040fb,#9c27b0)",border:"none",borderRadius:9,padding:"12px",color:"#ffffff",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          <><Plus size={14} strokeWidth={2.5} style={{display:"inline",verticalAlign:"middle",marginRight:6}}/>Adicionar à Watchlist</>
        </button>
      </Card>

      <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {atingiram.length > 0 && (
        <div style={{background:"#00e5a010",border:"1px solid #00e5a030",borderRadius:12,padding:"14px 16px"}}>
          <STitle color="#00e5a0"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Target size={12} strokeWidth={2.5}/>PREÇO ALVO ATINGIDO</span></STitle>
          {atingiram.map(w => (
            <div key={w.ticker} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontWeight:700,color:"#00e5a0",fontSize:14}}>{w.ticker}</span>
              <span style={{fontSize:13,color:"#ffffff"}}>{fmtBRL(w.precoAtual)} ≤ alvo {fmtBRL(w.alvo)} ✅</span>
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
                  <div style={{width:34,height:34,borderRadius:9,background:"#1a1a25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#e040fb"}}>{w.ticker.slice(0,4)}</div>
                  <div><div style={{fontWeight:700,color:"#ffffff",fontSize:14}}>{w.ticker}</div>{w.nota&&<div style={{fontSize:11,color:"#6a6a7a"}}>{w.nota}</div>}</div>
                </div>
                <button onClick={() => { setWatchlist(p=>p.filter(x=>x.ticker!==w.ticker)); setTimeout(onSave,200); }}
                  style={{background:"#ff4d6d15",border:"1px solid #ff4d6d30",borderRadius:6,padding:"6px 8px",color:"#ff4d6d",cursor:"pointer",display:"flex",alignItems:"center"}}><Trash2 size={13} strokeWidth={2}/></button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <Stat label="Preço (estimado IA)" value={w.precoAtual?fmtBRL(w.precoAtual):"Rode análise"} color={w.atingiu?"#00e5a0":"#ffffff"} mono/>
                <Stat label="Preço alvo" value={fmtBRL(w.alvo)} color="#e040fb" mono/>
                <Stat label="Distância" value={w.diff!=null?`${w.diff>0?"↓":"↑"} ${fmt(Math.abs(w.diff),1)}%`:"–"} color={w.diff!=null?(w.diff>0?"#00e5a0":"#ff4d6d"):"#888"}/>
              </div>
              {w.diff!=null && (
                <div style={{marginTop:10,background:"#000000",borderRadius:8,height:6,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,Math.max(0,100-w.diff))}%`,background:w.atingiu?"#00e5a0":"#e040fb",borderRadius:8,transition:"width 1s ease"}}/>
                </div>
              )}
              <div style={{fontSize:10,color:"#5a5a6a",marginTop:4}}>Adicionado em {w.adicionado}</div>
            </Card>
          ))}
        </div>
      ) : (
        <div style={{textAlign:"center",padding:"32px 0",color:"#5a5a6a",fontSize:13}}>Nenhum ativo na watchlist ainda</div>
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
        <STitle color="#ffd60a"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Receipt size={12} strokeWidth={2.5}/>CALCULADORA DE IR</span></STitle>
        <div style={{fontSize:12,color:"#9090a0",lineHeight:1.7,marginBottom:12}}>
          Ações têm isenção de IR para vendas até <b style={{color:"#ffd60a"}}>R$ 20.000/mês</b>. Acima disso, incide 15% sobre o lucro.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
          {[{p:"Ticker",v:ticker,s:setTicker,up:true},{p:"Qtd",v:qtd,s:setQtd,t:"number"},{p:"Preço venda R$",v:precoV,s:setPrecoV,t:"number"}].map((f,i) => (
            <input key={i} type={f.t||"text"} placeholder={f.p} value={f.v}
              onChange={e=>f.s(f.up?e.target.value.toUpperCase():e.target.value)}
              style={{background:"#000000",border:"1px solid #252535",borderRadius:9,padding:"10px 10px",fontSize:13,color:"#ffffff",width:"100%"}}/>
          ))}
        </div>
        <button onClick={addVenda} style={{width:"100%",background:"linear-gradient(135deg,#ffd60a,#f77f00)",border:"none",borderRadius:9,padding:"11px",color:"#000",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          <><Plus size={14} strokeWidth={2.5} style={{display:"inline",verticalAlign:"middle",marginRight:6}}/>Simular Venda</>
        </button>
      </Card>

      <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {vendas.length > 0 && <>
        <Card>
          <STitle>VENDAS SIMULADAS</STitle>
          {vendas.map((v,i) => (
            <div key={i} style={{display:"flex",justifyContent:"space-between",borderBottom:"1px solid #1a1a25",paddingBottom:7,marginBottom:7}}>
              <div><span style={{fontWeight:700,color:"#ffd60a"}}>{v.ticker}</span><span style={{fontSize:11,color:"#6a6a7a",marginLeft:8}}>{v.qtd} × {fmtBRL(v.precoVenda)}</span></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:12}}>{fmtBRL(v.qtd*v.precoVenda)}</div><Badge val={v.pm?((v.precoVenda-v.pm)/v.pm*100):null}/></div>
            </div>
          ))}
          <button onClick={()=>setVendas([])} style={{fontSize:11,color:"#ff4d6d",background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:5,marginTop:4}}><Trash2 size={11}/>Limpar vendas</button>
        </Card>

        <div style={{background:ir.isento?"#00e5a010":"#ff4d6d10",border:`1px solid ${ir.isento?"#00e5a030":"#ff4d6d30"}`,borderRadius:16,padding:"18px 16px"}}>
          <STitle color={ir.isento?"#00e5a0":"#ff4d6d"}><span style={{display:"inline-flex",alignItems:"center",gap:6}}>{ir.isento?<><CheckCircle2 size={12} strokeWidth={2.5}/>ISENTO DE IR</>:<><AlertTriangle size={12} strokeWidth={2.5}/>IR DEVIDO ESTE MÊS</>}</span></STitle>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Stat label="Total de vendas" value={fmtBRL(ir.totalVendas)} mono/>
            <Stat label="Lucro" value={fmtBRL(ir.lucro)} color={ir.lucro>=0?"#00e5a0":"#ff4d6d"} mono/>
            <Stat label="IR a pagar" value={fmtBRL(ir.ir)} color={ir.ir>0?"#ff4d6d":"#00e5a0"} mono/>
            <Stat label="Margem isenção" value={ir.restante>0?fmtBRL(ir.restante):"Esgotada"} color={ir.restante>0?"#ffd60a":"#ff4d6d"} mono/>
          </div>
          {ir.ir > 0 && <div style={{marginTop:12,fontSize:12,color:"#ff6b85",lineHeight:1.6,display:"flex",gap:8,alignItems:"flex-start"}}><AlertCircle size={14} strokeWidth={2.2} style={{flexShrink:0,marginTop:2}}/>Recolher via DARF até o último dia útil do mês seguinte. Código DARF: 6015.</div>}
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
    <div style={{textAlign:"center",padding:"48px 0",color:"#5a5a6a",fontSize:13}}>
      Configure o aporte e clique em <b style={{color:"#7b61ff"}}>Analisar</b>
    </div>
  );

  const a = dados.analise;
  const pos = dados.posicoes || [];
  const temCarteira = pos.length > 0;
  const score = temCarteira ? calcScore(pos) : null;
  const setores = {};
  pos.forEach(p => { setores[p.setor] = (setores[p.setor]||0) + 1; });
  const correlacoes = Object.entries(setores).filter(([,n])=>n>1).map(([s,n])=>({setor:s,n}));

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Badge IA */}
      <div style={{background:"#7b61ff10",border:"1px solid #7b61ff25",borderRadius:10,padding:"12px 16px",display:"flex",gap:12,alignItems:"center"}}>
        <div style={{
          width:32,height:32,borderRadius:8,background:"#7b61ff20",
          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0
        }}><Sparkles size={16} color="#7b61ff" strokeWidth={2.5}/></div>
        <div style={{fontSize:12,color:"#a8a8b8",lineHeight:1.6}}>
          Análise gerada pelo <b style={{color:"#fff"}}>Gemini 2.5 Pro</b> com cotações buscadas via Google Search em tempo real. Confirme na sua corretora antes de operar.
        </div>
      </div>

      {/* Score */}
      {score != null && (
        <Card accent>
          <div style={{display:"flex",gap:14,alignItems:"center"}}>
            <div style={{textAlign:"center",minWidth:70}}>
              <div style={{fontSize:40,fontWeight:900,color:score>=70?"#00e5a0":score>=45?"#ffd60a":"#ff4d6d",fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{score}</div>
              <div style={{fontSize:10,color:score>=70?"#00e5a0":score>=45?"#ffd60a":"#ff4d6d",marginTop:2,fontWeight:700}}>{score>=70?"Saudável":score>=45?"Moderado":"Atenção"}</div>
              <div style={{fontSize:9,color:"#5a5a6a"}}>Score</div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:"#9090a0",fontWeight:700,marginBottom:6}}>SAÚDE DA CARTEIRA</div>
              {correlacoes.map((c,i) => <div key={i} style={{fontSize:12,color:"#ffd60a",marginBottom:3}}>⚠️ {c.n} ativos em {c.setor} — alta correlação</div>)}
              {!correlacoes.length && <div style={{fontSize:12,color:"#00e5a0"}}>✅ Boa diversificação setorial</div>}
            </div>
          </div>
        </Card>
      )}

      {/* Diagnóstico */}
      <Card>
        <STitle>{temCarteira?"DIAGNÓSTICO DA CARTEIRA":"CONTEXTO DO MERCADO"}</STitle>
        <p style={{fontSize:13,color:"#a8a8b8",lineHeight:1.75}}>{a.diagnostico}</p>
      </Card>

      {/* Alertas em grid */}
      {a.alertas?.length > 0 && <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
      {a.alertas?.map((al,i) => (
        <div key={i} style={{background:al.tipo==="perigo"?"#ff4d6d10":al.tipo==="atencao"?"#ffd60a10":"#00e5a010",border:`1px solid ${al.tipo==="perigo"?"#ff4d6d28":al.tipo==="atencao"?"#ffd60a28":"#00e5a028"}`,borderRadius:10,padding:"12px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
          <div style={{flexShrink:0,marginTop:1}}>
            {al.tipo==="perigo"
              ? <AlertCircle size={18} color="#ff4d6d" strokeWidth={2.2}/>
              : al.tipo==="atencao"
                ? <AlertTriangle size={18} color="#ffd60a" strokeWidth={2.2}/>
                : <CheckCircle2 size={18} color="#00e5a0" strokeWidth={2.2}/>}
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:"#ffffff",marginBottom:4}}>{al.titulo}</div>
            <div style={{fontSize:12,color:"#a8a8b8",lineHeight:1.6}}>{al.descricao}</div>
          </div>
        </div>
      ))}
      </div>}

      {/* Recomendações */}
      {a.recomendacoes?.length > 0 && <>
        <STitle>RECOMENDAÇÕES PARA {fmtBRL(aporte)}</STitle>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(380px,1fr))",gap:14}}>
        {a.recomendacoes.map((r,i) => (
          <Card key={i} style={{borderColor:r.nova?"#00e5a030":"#252535"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:40,height:40,borderRadius:10,background:r.nova?"#00e5a018":"#1a1a25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:r.nova?"#00e5a0":"#7b61ff"}}>{r.ticker.slice(0,4)}</div>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontWeight:800,fontSize:15,color:"#ffffff"}}>{r.ticker}</span>
                    {r.nova && <span style={{fontSize:9,background:"#00e5a018",color:"#00e5a0",border:"1px solid #00e5a028",borderRadius:4,padding:"2px 6px",fontWeight:700,letterSpacing:0.5}}>NOVO</span>}
                  </div>
                  <div style={{fontSize:11,color:"#6a6a7a"}}>{r.acao} · {r.setor}</div>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:700,fontSize:16,color:"#7b61ff"}}>{r.alocacao}%</div>
                <div style={{fontSize:12,color:"#6a6a7a"}}>{fmtBRL(aporte*(r.alocacao/100))}</div>
              </div>
            </div>

            {/* Indicadores estimados */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
              {(r.precoReal||r.precoEstimado) && <span style={{fontSize:11,background:r.precoReal?"#00e5a015":"#ffffff08",color:r.precoReal?"#00e5a0":"#a8a8b8",borderRadius:10,padding:"3px 8px"}}>{r.precoReal?"● ":"~"}{fmtBRL(r.precoReal||r.precoEstimado)}{r.fontePreco?` · ${r.fontePreco}`:""}</span>}
              {r.dy && <span style={{fontSize:11,background:"#ffd60a12",color:"#ffd60a",borderRadius:10,padding:"3px 8px"}}>DY ~{fmt(r.dy)}%</span>}
              {r.pl && <span style={{fontSize:11,background:"#7b61ff12",color:"#7b61ff",borderRadius:10,padding:"3px 8px"}}>P/L ~{fmt(r.pl)}</span>}
              {r.score && <span style={{fontSize:11,background:"#00e5a012",color:"#00e5a0",borderRadius:10,padding:"3px 8px"}}>Score {r.score}/100</span>}
              {r.canal52 != null && <span style={{fontSize:11,background:r.canal52<=30?"#00e5a012":r.canal52<=70?"#ffd60a12":"#ff4d6d12",color:r.canal52<=30?"#00e5a0":r.canal52<=70?"#ffd60a":"#ff4d6d",borderRadius:10,padding:"3px 8px"}}>Canal {r.canal52}%</span>}
            </div>

            <div style={{fontSize:12,color:"#a8a8b8",lineHeight:1.65,background:"#000000",borderRadius:9,padding:"10px 12px"}}>{r.justificativa}</div>

            {r.unidades && (
              <div style={{marginTop:8,fontSize:11,color:"#9090a0"}}>
                ~{r.unidades} {r.tipo==="FII"?"cotas":"ações"} com {fmtBRL(aporte*(r.alocacao/100))}
              </div>
            )}
          </Card>
        ))}
        </div>
      </>}

      {/* Vender */}
      {a.vender?.length > 0 && <>
        <STitle color="#ff4d6d"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><AlertCircle size={12} strokeWidth={2.5}/>CONSIDERE REVISAR / VENDER</span></STitle>
        {a.vender.map((v,i) => (
          <Card key={i} style={{borderColor:"#ff4d6d20"}}>
            <div style={{fontWeight:700,fontSize:14,color:"#ff6b85",marginBottom:4}}>{v.ticker}</div>
            <div style={{fontSize:12,color:"#a8a8b8",lineHeight:1.6}}>{v.motivo}</div>
          </Card>
        ))}
      </>}

      {a.aviso && <div style={{background:"#ffd60a08",border:"1px solid #ffd60a18",borderRadius:10,padding:"12px 14px",fontSize:11,color:"#ffd60a99",lineHeight:1.6,display:"flex",gap:8,alignItems:"flex-start"}}><AlertTriangle size={14} strokeWidth={2.2} style={{flexShrink:0,marginTop:1,color:"#ffd60a"}}/>{a.aviso}</div>}
    </div>
  );
}

// ─── Tab: Análise de Ticker Individual ────────────────────────────────────────
function TabTicker({ userId, chamarIAComSearch }) {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState("");
  const [fase, setFase] = useState("");

  const analisar = async () => {
    const t = ticker.toUpperCase().trim();
    if (!t) { setErro("Digite um ticker"); return; }
    setErro(""); setLoading(true); setResultado(null);
    try {
      setFase("🔍 Buscando dados de " + t + "...");
      const prompt = `Você é analista financeiro do mercado brasileiro. Hoje é ${new Date().toLocaleDateString("pt-BR")}.

PASSO 1 — Use Google Search para buscar dados atuais de ${t} na B3:
- Pesquise: "${t} cotação hoje preço"
- Pesquise: "${t} dividend yield P/L ROE fundamentos"
- Pesquise: "${t} resultado trimestral receita lucro"

PASSO 2 — Faça análise fundamentalista completa do ativo.

PASSO 3 — Retorne APENAS este JSON (sem markdown):
{
  "ticker": "${t}",
  "nome": "Nome completo da empresa",
  "tipo": "Ação|FII|ETF|BDR",
  "setor": "Setor principal",
  "preco": 49.08,
  "fontePreco": "Status Invest / Investing.com / etc",
  "variacaoDia": 1.2,
  "variacaoAno": 60.5,
  "indicadores": {
    "dy": 5.18,
    "pl": 5.5,
    "pvp": 1.2,
    "roe": 18.5,
    "margemLiquida": 22.3,
    "divEbitda": 0.8,
    "min52": 30.71,
    "max52": 51.20,
    "canal52": 72
  },
  "fundamentos": "Análise dos fundamentos em 2-3 parágrafos: receita, lucro, dívida, geração de caixa, vantagens competitivas",
  "tese": {
    "tipo": "comprar|aguardar|evitar",
    "score": 80,
    "argumentos_positivos": ["ponto 1", "ponto 2", "ponto 3"],
    "argumentos_negativos": ["ponto 1", "ponto 2"],
    "preco_alvo": 55.0,
    "horizonte": "12 meses"
  },
  "comparaveis": ["TICKER1", "TICKER2", "TICKER3"],
  "ultimoDividendo": {
    "valor": 0.48,
    "data": "2026-03-15"
  },
  "resumo": "Resumo final em 2 frases sobre se vale a pena ou não no momento atual",
  "aviso": "Análise gerada com dados públicos via Google Search. Não é recomendação financeira profissional."
}

Use APENAS números reais encontrados na busca. Se não encontrar algum dado, omita o campo.`;

      setFase("🧠 Gemini analisando " + t + "...");
      const r = await chamarIAComSearch(prompt);
      setResultado(r);
    } catch (e) {
      setErro(e.message || "Erro na análise");
    } finally {
      setLoading(false);
      setFase("");
    }
  };

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
            style={{flex:1,background:"#000",border:"1px solid #252535",borderRadius:8,padding:"12px 16px",fontSize:16,color:"#fff",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,letterSpacing:1}}
          />
          <button onClick={analisar} disabled={loading} style={{background:loading?"#1a1a25":"linear-gradient(135deg,#7b61ff,#5540dd)",border:"none",borderRadius:8,padding:"12px 24px",color:"#fff",fontWeight:700,fontSize:13,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:8}}>
            {loading ? <Loader2 size={15} className="spin"/> : <Sparkles size={15} strokeWidth={2.5}/>}
            {loading ? fase || "Analisando..." : "Analisar"}
          </button>
        </div>
        {erro && <div style={{marginTop:10,background:"#ff4d6d10",border:"1px solid #ff4d6d30",borderRadius:8,padding:"10px 14px",color:"#ff6b85",fontSize:12,display:"flex",alignItems:"center",gap:8}}><AlertCircle size={14}/>{erro}</div>}
      </Card>

      {resultado && (
        <>
          {/* Header do ativo */}
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:14}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:54,height:54,borderRadius:12,background:"#1a1a25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#7b61ff"}}>{resultado.ticker.slice(0,4)}</div>
                <div>
                  <div style={{fontSize:22,fontWeight:800,color:"#fff",marginBottom:4}}>{resultado.ticker}</div>
                  <div style={{fontSize:13,color:"#a8a8b8"}}>{resultado.nome} · {resultado.setor}</div>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:28,fontWeight:800,color:"#fff",fontFamily:"'JetBrains Mono',monospace"}}>{fmtBRL(resultado.preco)}</div>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
                  {resultado.variacaoDia != null && <Badge val={resultado.variacaoDia}/>}
                  {resultado.variacaoAno != null && <span style={{fontSize:11,color:resultado.variacaoAno>=0?"#00e5a0":"#ff4d6d",fontWeight:600}}>Ano: {resultado.variacaoAno>=0?"+":""}{fmt(resultado.variacaoAno,1)}%</span>}
                </div>
                {resultado.fontePreco && <div style={{fontSize:10,color:"#5a5a6a",marginTop:4}}>Fonte: {resultado.fontePreco}</div>}
              </div>
            </div>
          </Card>

          {/* Indicadores */}
          {resultado.indicadores && (
            <Card>
              <STitle>INDICADORES FUNDAMENTALISTAS</STitle>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
                {resultado.indicadores.dy != null && <Stat label="DIVIDEND YIELD" value={fmt(resultado.indicadores.dy,2)+"%"} color="#ffd60a" mono/>}
                {resultado.indicadores.pl != null && <Stat label="P/L" value={fmt(resultado.indicadores.pl,2)} color="#7b61ff" mono/>}
                {resultado.indicadores.pvp != null && <Stat label="P/VP" value={fmt(resultado.indicadores.pvp,2)} color="#7b61ff" mono/>}
                {resultado.indicadores.roe != null && <Stat label="ROE" value={fmt(resultado.indicadores.roe,1)+"%"} color="#00e5a0" mono/>}
                {resultado.indicadores.margemLiquida != null && <Stat label="MARGEM LÍQ." value={fmt(resultado.indicadores.margemLiquida,1)+"%"} mono/>}
                {resultado.indicadores.divEbitda != null && <Stat label="DÍV/EBITDA" value={fmt(resultado.indicadores.divEbitda,2)} mono/>}
                {resultado.indicadores.min52 != null && <Stat label="MÍN 52S" value={fmtBRL(resultado.indicadores.min52)} color="#ff4d6d" mono/>}
                {resultado.indicadores.max52 != null && <Stat label="MÁX 52S" value={fmtBRL(resultado.indicadores.max52)} color="#00e5a0" mono/>}
                {resultado.indicadores.canal52 != null && <Stat label="CANAL 52S" value={resultado.indicadores.canal52+"%"} color={resultado.indicadores.canal52<=30?"#00e5a0":resultado.indicadores.canal52<=70?"#ffd60a":"#ff4d6d"} mono/>}
              </div>
            </Card>
          )}

          {/* Tese */}
          {resultado.tese && (
            <Card style={{border:`1px solid ${resultado.tese.tipo==="comprar"?"#00e5a040":resultado.tese.tipo==="aguardar"?"#ffd60a40":"#ff4d6d40"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{
                    fontSize:11,fontWeight:800,letterSpacing:1.5,padding:"5px 12px",borderRadius:6,
                    background:resultado.tese.tipo==="comprar"?"#00e5a020":resultado.tese.tipo==="aguardar"?"#ffd60a20":"#ff4d6d20",
                    color:resultado.tese.tipo==="comprar"?"#00e5a0":resultado.tese.tipo==="aguardar"?"#ffd60a":"#ff4d6d"
                  }}>{resultado.tese.tipo.toUpperCase()}</span>
                  {resultado.tese.score && <span style={{fontSize:11,color:"#a8a8b8"}}>Score <b style={{color:"#fff"}}>{resultado.tese.score}/100</b></span>}
                </div>
                {resultado.tese.preco_alvo && (
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:10,color:"#7a7a8a",fontWeight:700,letterSpacing:1}}>PREÇO ALVO ({resultado.tese.horizonte || "12m"})</div>
                    <div style={{fontSize:18,fontWeight:800,color:"#7b61ff",fontFamily:"'JetBrains Mono',monospace"}}>{fmtBRL(resultado.tese.preco_alvo)}</div>
                    <div style={{fontSize:11,color:resultado.tese.preco_alvo>resultado.preco?"#00e5a0":"#ff4d6d",fontWeight:600}}>
                      {resultado.tese.preco_alvo>resultado.preco?"+":""}{fmt((resultado.tese.preco_alvo-resultado.preco)/resultado.preco*100,1)}%
                    </div>
                  </div>
                )}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {resultado.tese.argumentos_positivos?.length>0 && (
                  <div>
                    <div style={{fontSize:10,color:"#00e5a0",fontWeight:700,letterSpacing:1,marginBottom:8,display:"flex",alignItems:"center",gap:6}}><CheckCircle2 size={12}/>PONTOS POSITIVOS</div>
                    {resultado.tese.argumentos_positivos.map((arg,i) => (
                      <div key={i} style={{fontSize:12,color:"#a8a8b8",marginBottom:6,paddingLeft:14,position:"relative",lineHeight:1.5}}>
                        <span style={{position:"absolute",left:0,color:"#00e5a0"}}>+</span>{arg}
                      </div>
                    ))}
                  </div>
                )}
                {resultado.tese.argumentos_negativos?.length>0 && (
                  <div>
                    <div style={{fontSize:10,color:"#ff4d6d",fontWeight:700,letterSpacing:1,marginBottom:8,display:"flex",alignItems:"center",gap:6}}><AlertCircle size={12}/>PONTOS DE ATENÇÃO</div>
                    {resultado.tese.argumentos_negativos.map((arg,i) => (
                      <div key={i} style={{fontSize:12,color:"#a8a8b8",marginBottom:6,paddingLeft:14,position:"relative",lineHeight:1.5}}>
                        <span style={{position:"absolute",left:0,color:"#ff4d6d"}}>−</span>{arg}
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
              <div style={{fontSize:13,color:"#a8a8b8",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{resultado.fundamentos}</div>
            </Card>
          )}

          {/* Resumo + comparáveis */}
          <div style={{display:"grid",gridTemplateColumns:resultado.comparaveis?.length?"2fr 1fr":"1fr",gap:14}}>
            {resultado.resumo && (
              <Card accent>
                <STitle>RESUMO</STitle>
                <div style={{fontSize:14,color:"#fff",lineHeight:1.6,fontWeight:500}}>{resultado.resumo}</div>
                {resultado.ultimoDividendo && (
                  <div style={{marginTop:12,padding:"10px 14px",background:"#ffd60a10",border:"1px solid #ffd60a25",borderRadius:8,display:"flex",alignItems:"center",gap:10}}>
                    <Coins size={16} color="#ffd60a"/>
                    <div style={{fontSize:12,color:"#a8a8b8"}}>Último provento: <b style={{color:"#ffd60a"}}>{fmtBRL(resultado.ultimoDividendo.valor)}</b> em {resultado.ultimoDividendo.data}</div>
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
                      background:"#1a1a25",border:"1px solid #252535",borderRadius:6,padding:"8px 12px",
                      color:"#7b61ff",fontWeight:700,fontSize:12,cursor:"pointer",textAlign:"left",
                      fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"center",justifyContent:"space-between"
                    }}>
                      {t} <ChevronRight size={14}/>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {resultado.aviso && <div style={{background:"#ffd60a08",border:"1px solid #ffd60a18",borderRadius:10,padding:"12px 14px",fontSize:11,color:"#ffd60a99",lineHeight:1.6,display:"flex",gap:8,alignItems:"flex-start"}}><AlertTriangle size={14} strokeWidth={2.2} style={{flexShrink:0,marginTop:1,color:"#ffd60a"}}/>{resultado.aviso}</div>}
        </>
      )}

      {!resultado && !loading && (
        <Card style={{textAlign:"center",padding:"40px 20px",border:"1px dashed #252535"}}>
          <FileSearch size={36} color="#3a3a4a" strokeWidth={1.5} style={{margin:"0 auto 14px"}}/>
          <div style={{color:"#7a7a8a",fontSize:13,marginBottom:8}}>Análise profunda de qualquer ticker da B3</div>
          <div style={{color:"#5a5a6a",fontSize:12,lineHeight:1.7}}>
            Digite um ticker acima e o Gemini busca preço atual,<br/>
            indicadores, fundamentos e gera tese de investimento completa.
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
      setFase("🔍 Comparando " + ts.join(", "));
      const prompt = `Você é analista financeiro do mercado brasileiro. Hoje é ${new Date().toLocaleDateString("pt-BR")}.

PASSO 1 — Use Google Search para buscar dados atuais de cada ticker:
${ts.map(t => `- "${t} cotação dividend yield P/L ROE fundamentos"`).join("\\n")}

PASSO 2 — Faça comparação completa lado a lado.

PASSO 3 — Retorne APENAS este JSON:
{
  "tickers": ["${ts.join('","')}"],
  "ativos": [
    {
      "ticker": "${ts[0]}",
      "nome": "Nome",
      "setor": "Setor",
      "preco": 49.08,
      "dy": 5.18,
      "pl": 5.5,
      "pvp": 1.2,
      "roe": 18.5,
      "score": 80,
      "ponto_forte": "principal vantagem em uma frase curta",
      "ponto_fraco": "principal risco em uma frase curta"
    }
  ],
  "comparativo": "Análise comparativa em 2-3 parágrafos: quem é melhor para renda, quem é melhor para crescimento, qual o trade-off de cada um",
  "vencedor": {
    "ticker": "TICKER",
    "motivo": "Por que esse é a melhor opção considerando o conjunto"
  },
  "ranking": [
    {"ticker":"TICKER","posicao":1,"justificativa":"motivo"}
  ],
  "aviso": "Análise comparativa via Google Search."
}`;

      setFase("🧠 Comparando ativos...");
      const r = await chamarIAComSearch(prompt);
      setResultado(r);
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
        <div style={{fontSize:12,color:"#a8a8b8",marginBottom:12,lineHeight:1.6}}>
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
              style={{background:"#000",border:"1px solid #252535",borderRadius:8,padding:"12px 14px",fontSize:14,color:"#fff",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,letterSpacing:1}}
            />
          ))}
        </div>
        <button onClick={comparar} disabled={loading} style={{width:"100%",background:loading?"#1a1a25":"linear-gradient(135deg,#7b61ff,#5540dd)",border:"none",borderRadius:8,padding:"13px",color:"#fff",fontWeight:700,fontSize:14,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          {loading ? <><Loader2 size={15} className="spin"/>{fase || "Comparando..."}</> : <><GitCompare size={15} strokeWidth={2.5}/>Comparar Ativos</>}
        </button>
        {erro && <div style={{marginTop:10,background:"#ff4d6d10",border:"1px solid #ff4d6d30",borderRadius:8,padding:"10px 14px",color:"#ff6b85",fontSize:12,display:"flex",alignItems:"center",gap:8}}><AlertCircle size={14}/>{erro}</div>}
      </Card>

      {resultado && (
        <>
          {/* Vencedor */}
          {resultado.vencedor && (
            <Card accent style={{background:"linear-gradient(135deg,#7b61ff10,#00e5a005)"}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:48,height:48,borderRadius:12,background:"linear-gradient(135deg,#7b61ff,#00e5a0)",display:"flex",alignItems:"center",justifyContent:"center"}}><Sparkles size={22} color="#000" strokeWidth={2.5}/></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:"#7b61ff",fontWeight:700,letterSpacing:1.5,marginBottom:4}}>VENCEDOR DA COMPARAÇÃO</div>
                  <div style={{fontSize:24,fontWeight:800,color:"#fff",marginBottom:6}}>{resultado.vencedor.ticker}</div>
                  <div style={{fontSize:13,color:"#a8a8b8",lineHeight:1.6}}>{resultado.vencedor.motivo}</div>
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
                    <tr style={{borderBottom:"1px solid #252535"}}>
                      <th style={{textAlign:"left",padding:"10px 8px",color:"#7a7a8a",fontWeight:700,fontSize:10,letterSpacing:1}}>ATIVO</th>
                      <th style={{textAlign:"right",padding:"10px 8px",color:"#7a7a8a",fontWeight:700,fontSize:10,letterSpacing:1}}>PREÇO</th>
                      <th style={{textAlign:"right",padding:"10px 8px",color:"#7a7a8a",fontWeight:700,fontSize:10,letterSpacing:1}}>DY</th>
                      <th style={{textAlign:"right",padding:"10px 8px",color:"#7a7a8a",fontWeight:700,fontSize:10,letterSpacing:1}}>P/L</th>
                      <th style={{textAlign:"right",padding:"10px 8px",color:"#7a7a8a",fontWeight:700,fontSize:10,letterSpacing:1}}>P/VP</th>
                      <th style={{textAlign:"right",padding:"10px 8px",color:"#7a7a8a",fontWeight:700,fontSize:10,letterSpacing:1}}>ROE</th>
                      <th style={{textAlign:"right",padding:"10px 8px",color:"#7a7a8a",fontWeight:700,fontSize:10,letterSpacing:1}}>SCORE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.ativos.map((a,i) => (
                      <tr key={i} style={{borderBottom:"1px solid #1a1a25"}}>
                        <td style={{padding:"12px 8px"}}>
                          <div style={{fontWeight:700,color:a.ticker===resultado.vencedor?.ticker?"#7b61ff":"#fff"}}>{a.ticker}</div>
                          <div style={{fontSize:10,color:"#7a7a8a"}}>{a.setor}</div>
                        </td>
                        <td style={{textAlign:"right",padding:"12px 8px",fontFamily:"'JetBrains Mono',monospace",color:"#fff",fontWeight:600}}>{fmtBRL(a.preco)}</td>
                        <td style={{textAlign:"right",padding:"12px 8px",fontFamily:"'JetBrains Mono',monospace",color:"#ffd60a",fontWeight:600}}>{a.dy?fmt(a.dy,2)+"%":"–"}</td>
                        <td style={{textAlign:"right",padding:"12px 8px",fontFamily:"'JetBrains Mono',monospace",color:"#fff"}}>{a.pl?fmt(a.pl,2):"–"}</td>
                        <td style={{textAlign:"right",padding:"12px 8px",fontFamily:"'JetBrains Mono',monospace",color:"#fff"}}>{a.pvp?fmt(a.pvp,2):"–"}</td>
                        <td style={{textAlign:"right",padding:"12px 8px",fontFamily:"'JetBrains Mono',monospace",color:"#00e5a0",fontWeight:600}}>{a.roe?fmt(a.roe,1)+"%":"–"}</td>
                        <td style={{textAlign:"right",padding:"12px 8px"}}>
                          <span style={{
                            padding:"4px 10px",borderRadius:6,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",
                            background:a.score>=70?"#00e5a020":a.score>=50?"#ffd60a20":"#ff4d6d20",
                            color:a.score>=70?"#00e5a0":a.score>=50?"#ffd60a":"#ff4d6d"
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
                  <div style={{fontWeight:800,fontSize:15,color:"#fff",marginBottom:10}}>{a.ticker}</div>
                  {a.ponto_forte && (
                    <div style={{marginBottom:8,fontSize:12,color:"#a8a8b8",display:"flex",gap:8}}>
                      <CheckCircle2 size={14} color="#00e5a0" style={{flexShrink:0,marginTop:2}}/>
                      <div>{a.ponto_forte}</div>
                    </div>
                  )}
                  {a.ponto_fraco && (
                    <div style={{fontSize:12,color:"#a8a8b8",display:"flex",gap:8}}>
                      <AlertCircle size={14} color="#ff4d6d" style={{flexShrink:0,marginTop:2}}/>
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
              <div style={{fontSize:13,color:"#a8a8b8",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{resultado.comparativo}</div>
            </Card>
          )}

          {resultado.aviso && <div style={{background:"#ffd60a08",border:"1px solid #ffd60a18",borderRadius:10,padding:"12px 14px",fontSize:11,color:"#ffd60a99",display:"flex",gap:8,alignItems:"flex-start"}}><AlertTriangle size={14} strokeWidth={2.2} style={{flexShrink:0,marginTop:1,color:"#ffd60a"}}/>{resultado.aviso}</div>}
        </>
      )}

      {!resultado && !loading && (
        <Card style={{textAlign:"center",padding:"40px 20px",border:"1px dashed #252535"}}>
          <GitCompare size={36} color="#3a3a4a" strokeWidth={1.5} style={{margin:"0 auto 14px"}}/>
          <div style={{color:"#7a7a8a",fontSize:13}}>Compare ativos lado a lado e descubra a melhor escolha</div>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Histórico de Análises ───────────────────────────────────────────────
function TabHistorico({ userId }) {
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

  if (loading) return <Card style={{textAlign:"center",padding:"40px"}}><Loader2 size={24} className="spin" color="#7b61ff" style={{margin:"0 auto"}}/></Card>;

  if (!analises.length) return (
    <Card style={{textAlign:"center",padding:"40px 20px",border:"1px dashed #252535"}}>
      <History size={36} color="#3a3a4a" strokeWidth={1.5} style={{margin:"0 auto 14px"}}/>
      <div style={{color:"#7a7a8a",fontSize:13}}>Nenhuma análise no histórico ainda</div>
      <div style={{color:"#5a5a6a",fontSize:12,marginTop:6}}>Rode uma análise IA e ela aparecerá aqui automaticamente</div>
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
                <div style={{width:42,height:42,borderRadius:10,background:a.tipo==="carteira"?"#7b61ff20":"#00e5a020",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {a.tipo==="carteira" ? <Briefcase size={18} color="#7b61ff"/> : <Brain size={18} color="#00e5a0"/>}
                </div>
                <div>
                  <div style={{fontWeight:700,color:"#fff",fontSize:14,marginBottom:2}}>
                    Análise {a.tipo === "carteira" ? "de carteira" : "de mercado"}
                    {a.aporte && <span style={{color:"#7a7a8a",fontWeight:500,fontSize:12,marginLeft:8}}>· {fmtBRL(a.aporte)}</span>}
                  </div>
                  <div style={{fontSize:11,color:"#7a7a8a",display:"flex",alignItems:"center",gap:10}}>
                    <span style={{display:"inline-flex",alignItems:"center",gap:4}}><Clock size={11}/>{data.toLocaleDateString("pt-BR")} {data.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span>
                    {a.perfil && <span>· {a.perfil}</span>}
                    {a.foco && <span>· {a.foco}</span>}
                    {a.resultado?.recomendacoes?.length && <span>· {a.resultado.recomendacoes.length} recomendações</span>}
                  </div>
                </div>
              </div>
              <ChevronRight size={16} color="#7a7a8a" style={{transform:isOpen?"rotate(90deg)":"rotate(0)",transition:"transform .2s"}}/>
            </div>

            {isOpen && (
              <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #1a1a25"}}>
                {a.resultado?.diagnostico && (
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10,color:"#7b61ff",fontWeight:700,letterSpacing:1,marginBottom:6}}>DIAGNÓSTICO</div>
                    <div style={{fontSize:13,color:"#a8a8b8",lineHeight:1.6}}>{a.resultado.diagnostico}</div>
                  </div>
                )}
                {a.resultado?.recomendacoes?.length > 0 && (
                  <div>
                    <div style={{fontSize:10,color:"#7b61ff",fontWeight:700,letterSpacing:1,marginBottom:8}}>RECOMENDAÇÕES</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                      {a.resultado.recomendacoes.map((r,i) => (
                        <div key={i} style={{background:"#000",border:"1px solid #1a1a25",borderRadius:8,padding:"10px 12px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                            <span style={{fontWeight:700,color:"#fff",fontSize:13}}>{r.ticker}</span>
                            <span style={{fontSize:11,color:"#7b61ff",fontWeight:700}}>{r.alocacao}%</span>
                          </div>
                          {r.precoReal && <div style={{fontSize:11,color:"#00e5a0",fontFamily:"'JetBrains Mono',monospace"}}>{fmtBRL(r.precoReal)}</div>}
                          {r.dy && <div style={{fontSize:10,color:"#ffd60a"}}>DY {fmt(r.dy)}%</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─── Tab: Proventos ───────────────────────────────────────────────────────────
function TabProventos({ userId }) {
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
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id) => {
    if (!confirm("Remover este provento?")) return;
    try {
      await removerProvento(id);
      setProventos(p => p.filter(x => x.id !== id));
    } catch (e) { alert("Erro: " + e.message); }
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
          <STitle color="#ffd60a"><span style={{display:"inline-flex",alignItems:"center",gap:6}}><Coins size={12} strokeWidth={2.5}/>REGISTRAR PROVENTO</span></STitle>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <input type="text" placeholder="Ticker (ex: TAEE11)" value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} style={{background:"#000",border:"1px solid #252535",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#fff",fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}/>
            <select value={tipo} onChange={e=>setTipo(e.target.value)} style={{background:"#000",border:"1px solid #252535",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#fff"}}>
              <option value="dividendo">Dividendo</option>
              <option value="jcp">JCP</option>
              <option value="rendimento">Rendimento (FII)</option>
              <option value="bonificacao">Bonificação</option>
            </select>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <input type="number" step="0.01" placeholder="Valor R$" value={valor} onChange={e=>setValor(e.target.value)} style={{background:"#000",border:"1px solid #252535",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#fff",fontFamily:"'JetBrains Mono',monospace"}}/>
              <input type="date" value={data} onChange={e=>setData(e.target.value)} style={{background:"#000",border:"1px solid #252535",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#fff"}}/>
            </div>
            <input type="text" placeholder="Observação (opcional)" value={obs} onChange={e=>setObs(e.target.value)} style={{background:"#000",border:"1px solid #252535",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#fff"}}/>
            <button onClick={adicionar} disabled={salvando || !ticker || !valor || !data} style={{background:salvando?"#1a1a25":"linear-gradient(135deg,#ffd60a,#f77f00)",border:"none",borderRadius:8,padding:"11px",color:"#000",fontWeight:700,fontSize:13,cursor:salvando?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              {salvando ? <Loader2 size={14} className="spin"/> : <Plus size={14} strokeWidth={2.5}/>}
              Registrar
            </button>
          </div>
        </Card>

        <Card>
          <STitle>RESUMO</STitle>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <Stat label="ESTE MÊS" value={fmtBRL(totalMes)} color="#00e5a0" mono/>
            <Stat label="ESTE ANO" value={fmtBRL(totalAno)} color="#ffd60a" mono/>
            <Stat label="TOTAL ACUMULADO" value={fmtBRL(totalGeral)} color="#7b61ff" mono/>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a25"/>
                <XAxis dataKey="mes" tick={{fill:"#7a7a8a",fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"#7a7a8a",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${v}`}/>
                <Tooltip content={<TTip/>}/>
                <Bar dataKey="valor" name="Proventos" fill="#ffd60a" radius={[4,4,0,0]}/>
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
                      <span style={{fontWeight:700,color:"#fff",fontSize:13}}>{t}</span>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",color:"#ffd60a",fontWeight:700,fontSize:13}}>{fmtBRL(v)}</span>
                    </div>
                    <div style={{background:"#1a1a25",borderRadius:4,height:6,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#ffd60a,#f77f00)",borderRadius:4}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {loading ? <Card><Loader2 size={24} className="spin" color="#7b61ff" style={{margin:"20px auto",display:"block"}}/></Card> : proventos.length === 0 ? (
          <Card style={{textAlign:"center",padding:"40px 20px",border:"1px dashed #252535"}}>
            <Coins size={36} color="#3a3a4a" strokeWidth={1.5} style={{margin:"0 auto 14px"}}/>
            <div style={{color:"#7a7a8a",fontSize:13,marginBottom:6}}>Nenhum provento registrado</div>
            <div style={{color:"#5a5a6a",fontSize:12,lineHeight:1.6}}>Adicione seus dividendos, JCP e rendimentos<br/>recebidos para acompanhar sua renda passiva.</div>
          </Card>
        ) : (
          <Card>
            <STitle>HISTÓRICO ({proventos.length})</STitle>
            <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:500,overflowY:"auto"}}>
              {proventos.map(p => (
                <div key={p.id} style={{background:"#000",border:"1px solid #1a1a25",borderRadius:8,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:32,height:32,borderRadius:8,background:"#ffd60a15",display:"flex",alignItems:"center",justifyContent:"center"}}><Coins size={14} color="#ffd60a"/></div>
                    <div>
                      <div style={{fontWeight:700,color:"#fff",fontSize:13}}>{p.ticker} <span style={{fontSize:10,color:"#7a7a8a",fontWeight:500,marginLeft:4,textTransform:"uppercase"}}>{p.tipo}</span></div>
                      <div style={{fontSize:11,color:"#7a7a8a"}}>{new Date(p.data_pagamento).toLocaleDateString("pt-BR")}{p.observacao && ` · ${p.observacao}`}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:"#ffd60a",fontSize:14}}>{fmtBRL(p.valor)}</span>
                    <button onClick={()=>remover(p.id)} style={{background:"#ff4d6d15",border:"1px solid #ff4d6d30",borderRadius:6,padding:"5px 7px",color:"#ff4d6d",cursor:"pointer",display:"flex"}}><Trash2 size={12}/></button>
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

      setFase("🔍 Gemini buscando cotações no Google Finance...");

      const carteiraInfo = temCarteira
        ? `\nCARTEIRA ATUAL DO INVESTIDOR:\n${carteira.map(a=>`- ${a.ticker}: ${a.qtd} cotas${a.pm?`, PM R$${a.pm}`:""}`).join("\n")}`
        : "";

      // Tickers para buscar cotações
      const focoTickers = {
        acoes: "PETR4, VALE3, ITUB4, BBDC4, WEGE3, BBAS3, SUZB3, RADL3, EQTL3, EGIE3, TAEE11, ABEV3, RENT3",
        fiis: "MXRF11, HGLG11, XPML11, KNRI11, BTLG11, VISC11, PVBI11, RBRF11, IRDM11, BCFF11, CPTS11",
        misto: "PETR4, VALE3, ITUB4, BBAS3, TAEE11, EGIE3, MXRF11, HGLG11, XPML11, KNRI11, BTLG11"
      }[foco];

      const tickersCarteira = carteira.map(a => a.ticker).join(", ");
      const todosOsTickers = [...new Set([
        ...(tickersCarteira ? tickersCarteira.split(", ") : []),
        ...focoTickers.split(", ")
      ])].join(", ");

      const prompt = `Você é um analista financeiro sênior do mercado brasileiro. Hoje é ${new Date().toLocaleDateString("pt-BR")}.

PASSO 1 — USE web_search para buscar cotações reais agora:
Pesquise: "cotações B3 hoje ${todosOsTickers.split(", ").slice(0,6).join(" ")}"
Depois pesquise: "cotações B3 hoje ${todosOsTickers.split(", ").slice(6,12).join(" ")}"
${temCarteira && tickersCarteira ? `Também pesquise: "cotações hoje ${tickersCarteira}"` : ""}

PASSO 2 — Com os preços REAIS encontrados, faça análise completa:
${temCarteira
  ? `Analise a carteira abaixo e recomende como alocar R$ ${v.toFixed(2)} para perfil ${perfilDesc}, foco em ${focoDesc}.${carteiraInfo}`
  : `Recomende as melhores oportunidades de ${focoDesc} para R$ ${v.toFixed(2)}, perfil ${perfilDesc}.`
}

PASSO 3 — Retorne APENAS este JSON (sem markdown, sem texto antes ou depois):
{
  "diagnostico": "2-3 frases com contexto real do mercado hoje e justificativa das escolhas",
  "alertas": [{"tipo":"perigo|atencao|ok","titulo":"...","descricao":"..."}],
  "recomendacoes": [
    {
      "ticker":"PETR4",
      "nome":"Petrobras PN",
      "tipo":"Ação",
      "setor":"Petróleo",
      "acao":"Comprar",
      "nova":${!temCarteira},
      "alocacao":30,
      "precoReal":48.50,
      "precoEstimado":48.50,
      "dy":12.5,
      "pl":4.2,
      "score":82,
      "canal52":35,
      "fontePreco":"Google Finance",
      "justificativa":"Análise citando o preço real encontrado, DY atual, P/L, contexto do dia"
    }
  ],
  "vender": ${temCarteira ? `[{"ticker":"XXXX3","motivo":"motivo com dados reais"}]` : "[]"},
  "aviso": "Dados buscados em tempo real via web search. Confirme na sua corretora antes de operar."
}

Regras OBRIGATÓRIAS:
- SEMPRE use web_search antes de responder para ter preços reais do dia
- Soma de alocacao = 100
- precoReal = preço encontrado na busca (não invente, use o que encontrou)
- 3 a 5 recomendações
- Retorne SOMENTE o JSON final`;

      setFase("🧠 Gemini 2.5 Pro analisando...");
      const analise = await chamarIAComSearch(prompt, 3000);

      // Enriquecer recomendações com unidades calculadas
      const recsEnriquecidas = (analise.recomendacoes || []).map(r => ({
        ...r,
        unidades: r.precoEstimado ? Math.floor(v * (r.alocacao/100) / r.precoEstimado) : null
      }));

      // Montar posições da carteira com dados da IA
      let posicoes = [];
      if (temCarteira) {
        setFase("📊 Calculando posições...");
        const tickersCarteira = carteira.map(a => a.ticker).join(",");

        const promptPosicoes = `Use web_search para buscar as cotações atuais de hoje na B3 para: ${tickersCarteira}
Pesquise "cotações B3 hoje ${tickersCarteira}" e retorne os preços reais encontrados.
Retorne APENAS JSON (sem markdown):
{"ativos":[{"ticker":"PETR4","preco":48.50,"dy":12.5,"pl":4.2,"setor":"Petróleo","tipo":"Ação","canal52":35}]}`;

        try {
          setFase("📈 Buscando cotações reais da carteira...");
          const dadosAtivos = await chamarIAComSearch(promptPosicoes, 1000);
          const mapa = {};
          (dadosAtivos.ativos || []).forEach(a => { mapa[a.ticker] = a; });

          posicoes = carteira.map(a => {
            const info = mapa[a.ticker] || {};
            const preco = info.preco || a.pm || 0;
            const valorAtual = preco * a.qtd;
            return {
              ticker: a.ticker, qtd: a.qtd, pm: a.pm, preco,
              valorAtual, dy: info.dy || 0, pl: info.pl || null,
              setor: info.setor || "–", tipo: info.tipo || "Ação",
              canal52: info.canal52 || null, historico: [],
            };
          });
        } catch(_) {
          posicoes = carteira.map(a => ({
            ticker: a.ticker, qtd: a.qtd, pm: a.pm,
            preco: a.pm || 0, valorAtual: (a.pm||0) * a.qtd,
            dy: 0, setor: "–", tipo: "Ação", canal52: null,
          }));
        }
      }

      const totalCarteira = posicoes.reduce((s,p) => s + p.valorAtual, 0);
      const posicoesComPeso = posicoes.map(p => ({
        ...p, peso: totalCarteira > 0 ? (p.valorAtual/totalCarteira)*100 : 0
      }));

      // Atualizar watchlist com preços estimados da IA
      if (watchlist.length > 0) {
        const wTickers = watchlist.map(w => w.ticker).join(",");
        try {
          const promptWatch = `Use web_search para buscar cotações reais de hoje na B3 para: ${wTickers}
Retorne APENAS JSON: {"ativos":[{"ticker":"XXXX3","preco":10.50}]}`;
          const wData = await chamarIAComSearch(promptWatch, 600);
          const wMapa = {};
          (wData.ativos||[]).forEach(a => { wMapa[a.ticker] = a.preco; });
          setWatchlist(prev => prev.map(w => ({ ...w, precoIA: wMapa[w.ticker] || w.precoIA })));
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
      }

    } catch(e) {
      console.error("Erro análise:", e);
      setErro(`Erro: ${e.message || "Tente novamente."}`);
      setTab("carteira");
    } finally {
      setLoading(false);
      setFase("");
    }
  }, [carteira, watchlist, aporte, foco, perfil]);

  const TABS = [
    {k:"carteira",icon:Briefcase,label:"Carteira"},
    {k:"graficos",icon:BarChart3,label:"Gráficos"},
    {k:"analise",icon:Brain,label:"Análise IA"},
    {k:"ticker",icon:FileSearch,label:"Analisar Ticker"},
    {k:"comparador",icon:GitCompare,label:"Comparador"},
    {k:"historico",icon:History,label:"Histórico"},
    {k:"proventos",icon:Coins,label:"Proventos"},
    {k:"watchlist",icon:Eye,label:"Watchlist"},
    {k:"meta",icon:Target,label:"1º Milhão"},
    {k:"cenarios",icon:TrendingUp,label:"Cenários"},
    {k:"ir",icon:Receipt,label:"IR"},
  ];

  // Métricas para a barra superior
  const metricaCarteira = dados?.totalCarteira || 0;
  const metricaPosicoes = dados?.posicoes?.length || 0;
  const metricaDY = dados?.posicoes?.length ? (dados.posicoes.reduce((s,p)=>s+(p.dy||0)*(p.peso/100),0)) : 0;
  const horaAtual = new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});

  return (
    <div style={{minHeight:"100vh",background:"#000000",fontFamily:"'Inter','Segoe UI',sans-serif",color:"#ffffff"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#000000}
        ::-webkit-scrollbar{width:8px;height:8px}
        ::-webkit-scrollbar-track{background:#000000}
        ::-webkit-scrollbar-thumb{background:#252535;border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:#3a3a45}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes shimmer{0%{background-position:-1000px 0}100%{background-position:1000px 0}}
        .anim{animation:fadeUp .35s ease both}
        .spin{animation:spin .9s linear infinite}
        .blink{animation:blink 2s ease infinite}
        input,select,button,textarea{outline:none;font-family:inherit}
        input:focus,select:focus{border-color:#7b61ff!important;box-shadow:0 0 0 3px rgba(123,97,255,0.15)}
        button:hover:not(:disabled){filter:brightness(1.1)}
        .tab-btn{transition:all .15s ease}
        .tab-btn:hover{background:#1a1a25!important;color:#a0a0c0!important}
        .card-hover{transition:border-color .2s ease,transform .2s ease}
        .card-hover:hover{border-color:#3a3a45!important;transform:translateY(-1px)}
      `}</style>

      {/* TOP BAR - Estilo TradingView */}
      <div style={{
        position:"sticky",top:0,zIndex:100,
        background:"rgba(0,0,0,0.92)",backdropFilter:"blur(20px)",
        borderBottom:"1px solid #1a1a25"
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
              color:"#000000"
            }}><Sparkles size={20} strokeWidth={2.5}/></div>
            <div>
              <div style={{fontSize:14,fontWeight:800,letterSpacing:-0.3}}>
                InvestIA <span style={{color:"#7b61ff"}}>Pro</span>
              </div>
              <div style={{fontSize:9,color:"#7a7a8a",fontWeight:600,letterSpacing:1.5}}>B3 · BRASIL</div>
            </div>
          </div>

          {/* Métricas centralizadas */}
          <div style={{display:"flex",alignItems:"center",gap:32,flex:1,justifyContent:"center"}}>
            <Metric label="PATRIMÔNIO" value={metricaCarteira>0?fmtK(metricaCarteira):"—"} accent={metricaCarteira>0?"#00e5a0":null}/>
            <Metric label="POSIÇÕES" value={metricaPosicoes||"—"}/>
            <Metric label="DY MÉDIO" value={metricaPosicoes?`${fmt(metricaDY,2)}%`:"—"} accent={metricaDY>5?"#ffd60a":null}/>
            <Metric label="WATCHLIST" value={watchlist.length||"—"}/>
          </div>

          {/* Status à direita */}
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#7a7a8a"}}>
              <span className="blink" style={{width:6,height:6,borderRadius:"50%",background:"#00e5a0"}}/>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{horaAtual}</span>
            </div>
            {savedMsg && (
              <span style={{fontSize:11,color:"#00e5a0",fontWeight:600}}>{savedMsg}</span>
            )}
            <div style={{
              display:"flex",alignItems:"center",gap:8,
              background:"#0a0a0f",border:"1px solid #252535",borderRadius:6,
              padding:"7px 12px"
            }}>
              <User size={13} color="#7b61ff"/>
              <span style={{fontSize:11,color:"#c5c5d0",fontWeight:600,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{userEmail}</span>
            </div>
            <button onClick={onLogout} title="Sair" style={{
              background:"#0a0a0f",border:"1px solid #252535",borderRadius:6,
              padding:"8px 10px",color:"#ff6b85",cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center"
            }}><LogOut size={14}/></button>
          </div>
        </div>

        {/* Linha 2: Tabs */}
        <div style={{display:"flex",padding:"0 24px",gap:2,borderTop:"1px solid #1a1a25"}}>
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.k} onClick={()=>setTab(t.k)} className="tab-btn"
                style={{
                  background:"transparent",border:"none",cursor:"pointer",
                  padding:"12px 18px",fontSize:13,fontWeight:600,
                  color:tab===t.k?"#ffffff":"#9090a0",
                  borderBottom:`2px solid ${tab===t.k?"#7b61ff":"transparent"}`,
                  display:"flex",alignItems:"center",gap:8
                }}>
                <Icon size={15} strokeWidth={2}/>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <div style={{padding:"20px 24px",maxWidth:1600,margin:"0 auto"}}>
        {/* PAINEL DE ANÁLISE - Horizontal */}
        <div className="anim" style={{
          background:"#0a0a0f",border:"1px solid #252535",borderRadius:12,
          padding:"16px 20px",marginBottom:20,
          display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"
        }}>
          <div style={{flex:"1 1 200px",minWidth:160}}>
            <div style={{fontSize:10,color:"#7a7a8a",fontWeight:700,letterSpacing:1,marginBottom:6}}>VALOR DO APORTE</div>
            <input type="text" placeholder="R$ 0,00" value={aporte} onChange={handleAporte}
              style={{width:"100%",background:"#000000",border:"1px solid #252535",borderRadius:8,
                padding:"10px 14px",fontSize:18,color:"#ffffff",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}/>
            <div style={{display:"flex",gap:5,marginTop:7}}>
              {[500,1000,2000,5000].map(vv => (
                <button key={vv} onClick={()=>setAporte(vv.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}))}
                  style={{flex:1,background:"#000000",border:"1px solid #252535",borderRadius:5,
                    padding:"5px 0",fontSize:10,color:"#9090a0",cursor:"pointer",
                    fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>
                  {fmtK(vv)}
                </button>
              ))}
            </div>
          </div>

          <div style={{width:1,alignSelf:"stretch",background:"#1a1a25"}}/>

          <div style={{flex:"1 1 160px",minWidth:140}}>
            <div style={{fontSize:10,color:"#7a7a8a",fontWeight:700,letterSpacing:1,marginBottom:6}}>PERFIL</div>
            <select value={perfil} onChange={e=>setPerfil(e.target.value)}
              style={{width:"100%",background:"#000000",border:"1px solid #252535",borderRadius:8,
                padding:"10px 12px",fontSize:13,color:"#ffffff",cursor:"pointer",fontWeight:600}}>
              <option value="conservador">Conservador</option>
              <option value="moderado">Moderado</option>
              <option value="arrojado">Arrojado</option>
            </select>
          </div>

          <div style={{flex:"1 1 160px",minWidth:140}}>
            <div style={{fontSize:10,color:"#7a7a8a",fontWeight:700,letterSpacing:1,marginBottom:6}}>FOCO</div>
            <select value={foco} onChange={e=>setFoco(e.target.value)}
              style={{width:"100%",background:"#000000",border:"1px solid #252535",borderRadius:8,
                padding:"10px 12px",fontSize:13,color:"#ffffff",cursor:"pointer",fontWeight:600}}>
              <option value="acoes">Ações</option>
              <option value="fiis">FIIs</option>
              <option value="misto">Misto</option>
            </select>
          </div>

          <div style={{flex:"2 1 280px",minWidth:240}}>
            <div style={{fontSize:10,color:"#7a7a8a",fontWeight:700,letterSpacing:1,marginBottom:6}}>&nbsp;</div>
            <button onClick={analisar} disabled={loading}
              style={{
                width:"100%",
                background:loading?"#1a1a25":"linear-gradient(135deg,#7b61ff,#5540dd)",
                border:"none",borderRadius:8,padding:"12px 18px",color:"#ffffff",
                fontWeight:700,fontSize:13,cursor:loading?"not-allowed":"pointer",
                boxShadow:loading?"none":"0 4px 14px rgba(123,97,255,0.35)",
                display:"flex",alignItems:"center",justifyContent:"center",gap:10
              }}>
              {loading
                ? <>
                    <span className="spin" style={{width:14,height:14,borderRadius:"50%",border:"2px solid #7b61ff44",borderTopColor:"#7b61ff",display:"inline-block"}}/>
                    <span style={{fontSize:12,color:"#c5c5d0"}}>{fase||"Analisando..."}</span>
                  </>
                : <><Sparkles size={16} strokeWidth={2.5}/> <span>Analisar{carteira.length>0?` carteira (${carteira.length})`:" mercado"}</span></>
              }
            </button>
          </div>
        </div>

        {erro && (
          <div style={{
            background:"#ff4d6d10",border:"1px solid #ff4d6d30",borderRadius:8,
            padding:"10px 14px",color:"#ff6b85",fontSize:12,marginBottom:16,
            display:"flex",alignItems:"center",gap:8
          }}><AlertCircle size={14} strokeWidth={2.2}/>{erro}</div>
        )}

        {/* ÁREA DE CONTEÚDO - Tab atual */}
        <div className="anim">
          {tab==="carteira" && <TabCarteira carteira={carteira} setCarteira={setCarteira} historico={historico} setHistorico={setHistorico} dados={dados} onSave={salvar} userId={userId} carteiraId={carteiraId}/>}
          {tab==="graficos" && <TabGraficos dados={dados}/>}
          {tab==="analise" && <TabAnalise dados={dados} aporte={aporteNum()} perfil={perfil} loading={loading} fase={fase}/>}
          {tab==="ticker" && <TabTicker userId={userId} chamarIAComSearch={chamarIAComSearch}/>}
          {tab==="comparador" && <TabComparador chamarIAComSearch={chamarIAComSearch}/>}
          {tab==="historico" && <TabHistorico userId={userId}/>}
          {tab==="proventos" && <TabProventos userId={userId}/>}
          {tab==="meta" && <TabMeta dados={dados}/>}
          {tab==="cenarios" && <TabCenarios dados={dados}/>}
          {tab==="watchlist" && <TabWatchlist watchlist={watchlist} setWatchlist={setWatchlist} dados={dados} onSave={salvar} userId={userId}/>}
          {tab==="ir" && <TabIR dados={dados}/>}
        </div>

        {/* Footer */}
        <div style={{
          marginTop:40,padding:"20px 0",borderTop:"1px solid #1a1a25",
          textAlign:"center",fontSize:11,color:"#5a5a6a"
        }}>
          Powered by <span style={{color:"#7b61ff",fontWeight:700}}>Gemini 2.5 Pro</span> + Google Search · 
          Cotações em tempo real · Confirme preços na sua corretora antes de operar
        </div>
      </div>
    </div>
  );
}

// Componente Metric para a barra superior
function Metric({ label, value, accent }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2}}>
      <div style={{fontSize:9,color:"#5a5a6a",fontWeight:700,letterSpacing:1.5}}>{label}</div>
      <div style={{
        fontSize:14,fontWeight:700,color:accent||"#ffffff",
        fontFamily:"'JetBrains Mono',monospace"
      }}>{value}</div>
    </div>
  );
}
