// Landing page de vendas (visitante deslogado). Tema dark fixo, estética de
// terminal de mercado: grade sutil, ticker tape, números em JetBrains Mono e
// um mockup do dashboard feito 100% em CSS/SVG (sem imagens externas).
// Preços/planos vêm de lib/plano.js — fonte única (vitalício é interno e
// nunca aparece aqui).

import { useEffect, useState } from "react";
import {
  Brain, TrendingUp, Shield, Scale, Coins, Receipt, Sparkles,
  ArrowRight, ArrowUp, ArrowDown, Check, Crown, ChevronDown, Zap,
  CreditCard, RefreshCw, Lock
} from "lucide-react";
import { PLANOS, TRIAL_DIAS, CONTATO_EMAIL } from "./lib/plano";

// Dados ilustrativos do ticker tape (estáticos de propósito — é vitrine, não cotação)
const TAPE = [
  ["PETR4", "38,42", +1.24], ["VALE3", "61,80", -0.62], ["ITUB4", "34,15", +0.88],
  ["BBAS3", "28,91", +2.10], ["WEGE3", "52,33", +0.45], ["TAEE11", "35,70", +0.31],
  ["MXRF11", "10,42", +0.19], ["HGLG11", "162,10", -0.27], ["KNRI11", "144,55", +0.52],
  ["BBSE3", "33,68", +1.05], ["EGIE3", "41,22", -0.14], ["VISC11", "118,30", +0.40],
];

const FEATURES = [
  { icon: Brain, titulo: "Análise com IA de verdade", texto: "O Gemini analisa sua carteira inteira — tese, riscos e sugestões de alocação para o seu perfil — em menos de um minuto." },
  { icon: TrendingUp, titulo: "Cotações ao vivo", texto: "Preços da B3 atualizados a cada 60 segundos, com variação do dia em cada posição da carteira." },
  { icon: Shield, titulo: "Raio-X de risco", texto: "Concentração por ativo e setor, índice HHI e um score de saúde da carteira que aponta exatamente onde você está exposto." },
  { icon: Scale, titulo: "Rebalanceamento guiado", texto: "Compare a carteira atual com a ideal e receba o plano de compras para voltar ao alvo — incluindo simulação de aporte." },
  { icon: Coins, titulo: "Renda passiva projetada", texto: "Quanto vai pingar por mês em 5, 10, 20 anos? Projeção com sazonalidade real de dividendos da B3." },
  { icon: Receipt, titulo: "IR sem dor de cabeça", texto: "Calculadora de imposto sobre vendas com a regra de isenção de R$ 20 mil e apuração mês a mês." },
];

const PASSOS = [
  { n: "01", titulo: "Cadastre sua carteira", texto: "Adicione seus ativos em segundos com autocomplete de 1.400+ tickers da B3. Ações, FIIs, BDRs e ETFs." },
  { n: "02", titulo: "Peça a análise", texto: "Um clique e a IA cruza seus dados com fundamentos e cotações reais para montar a tese da sua carteira." },
  { n: "03", titulo: "Decida com confiança", texto: "Siga o plano de rebalanceamento, acompanhe o risco e veja seu patrimônio evoluir contra o CDI." },
];

const FAQ = [
  { q: "Preciso de cartão de crédito para testar?", a: `Não. O teste de ${TRIAL_DIAS} dias é completo e não pede cartão. Se não assinar, sua conta apenas pausa — seus dados ficam salvos.` },
  { q: "Meus dados ficam seguros?", a: "Sim. Cada usuário só acessa os próprios dados (isolamento por RLS no banco), a conexão é criptografada e não pedimos senha de corretora — você informa apenas os ativos e quantidades." },
  { q: "A IA dá recomendação de compra?", a: "A IA monta análises e cenários educacionais a partir dos seus dados e de fundamentos públicos. Não é recomendação de investimento — a decisão final é sempre sua." },
  { q: "Funciona com FIIs e BDRs?", a: "Sim. O catálogo cobre 1.400+ tickers da B3: ações, FIIs, BDRs, ETFs e units, com fundamentos atualizados semanalmente." },
  { q: "Posso cancelar quando quiser?", a: "Pode. O plano mensal não tem fidelidade e o anual vale por 12 meses sem renovação automática escondida." },
];

function CTAButton({ children, onClick, grande }) {
  return (
    <button onClick={onClick} className="lp-cta" style={{
      fontSize: grande ? 16 : 14,
      padding: grande ? "16px 32px" : "11px 22px",
    }}>
      {children}
      <ArrowRight size={grande ? 18 : 15} strokeWidth={2.5}/>
    </button>
  );
}

// Mockup do dashboard em CSS/SVG puro
function DashboardMock() {
  return (
    <div className="lp-mock anim-d3">
      {/* Barra de título */}
      <div className="lp-mock-bar">
        <span className="lp-dot" style={{background:"#ff5f57"}}/>
        <span className="lp-dot" style={{background:"#febc2e"}}/>
        <span className="lp-dot" style={{background:"#28c840"}}/>
        <span style={{marginLeft:10,fontSize:10,color:"#5b5b76",fontFamily:"'JetBrains Mono',monospace"}}>invent-ia.vercel.app</span>
      </div>

      {/* Métricas */}
      <div className="lp-mock-metrics">
        {[
          ["PATRIMÔNIO", "R$ 248,3k", "#00e5a0"],
          ["RENTAB. 12M", "+18,4%", "#00e5a0"],
          ["DY MÉDIO", "9,2%", "#7b61ff"],
          ["RISCO", "SAUDÁVEL", "#4dabff"],
        ].map(([l, v, c]) => (
          <div key={l}>
            <div style={{fontSize:8,letterSpacing:1.2,color:"#5b5b76",fontWeight:800,marginBottom:3}}>{l}</div>
            <div style={{fontSize:15,fontWeight:800,color:c,fontFamily:"'JetBrains Mono',monospace"}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Gráfico de área (SVG) */}
      <div className="lp-mock-chart">
        <svg viewBox="0 0 300 80" preserveAspectRatio="none" style={{width:"100%",height:"100%",display:"block"}}>
          <defs>
            <linearGradient id="lpGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00e5a0" stopOpacity="0.35"/>
              <stop offset="100%" stopColor="#00e5a0" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path className="lp-chart-line" d="M0,62 C20,58 35,64 50,55 C70,43 85,52 100,46 C120,38 135,44 150,36 C170,26 185,34 200,28 C220,20 240,26 260,16 C275,9 290,12 300,8"
            fill="none" stroke="#00e5a0" strokeWidth="2"/>
          <path d="M0,62 C20,58 35,64 50,55 C70,43 85,52 100,46 C120,38 135,44 150,36 C170,26 185,34 200,28 C220,20 240,26 260,16 C275,9 290,12 300,8 L300,80 L0,80 Z"
            fill="url(#lpGrad)"/>
          <path d="M0,66 C30,64 60,63 90,60 C140,56 200,52 300,44" fill="none" stroke="#3a3a52" strokeWidth="1.5" strokeDasharray="4 4"/>
        </svg>
        <div style={{position:"absolute",top:8,left:10,fontSize:9,color:"#8b8ba3",fontWeight:700,letterSpacing:1}}>
          PATRIMÔNIO <span style={{color:"#00e5a0"}}>vs CDI</span>
        </div>
      </div>

      {/* Card da IA */}
      <div className="lp-mock-ia">
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:7}}>
          <Sparkles size={11} color="#7b61ff"/>
          <span style={{fontSize:9,fontWeight:800,letterSpacing:1.2,color:"#7b61ff"}}>ANÁLISE DA IA</span>
          <span className="lp-pulse" style={{marginLeft:"auto",fontSize:8,color:"#00e5a0",fontWeight:700}}>● AO VIVO</span>
        </div>
        <div style={{fontSize:10.5,lineHeight:1.65,color:"#b8b8cc"}}>
          Carteira sólida com viés de dividendos. Concentração em bancos está
          <b style={{color:"#ffb347"}}> 6,2pp acima do alvo</b> — o rebalanceamento sugere
          direcionar o próximo aporte para <b style={{color:"#00e5a0"}}>energia e FIIs de tijolo</b>…
        </div>
      </div>

      {/* Posições */}
      <div className="lp-mock-pos">
        {[["BBAS3","+2,10%",1],["TAEE11","+0,31%",1],["MXRF11","+0,19%",1],["VALE3","−0,62%",0]].map(([t,v,up]) => (
          <div key={t} className="lp-mock-pos-row">
            <span style={{fontWeight:700,color:"#e8e8f2"}}>{t}</span>
            <span style={{color: up ? "#00e5a0" : "#ff4d6d",display:"inline-flex",alignItems:"center",gap:3}}>
              {up ? <ArrowUp size={9} strokeWidth={3}/> : <ArrowDown size={9} strokeWidth={3}/>}{v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Landing({ onEntrar, onComecar }) {
  const [faqAberta, setFaqAberta] = useState(-1);
  useEffect(() => {
    document.title = "InvestIA Pro — sua carteira da B3 analisada por IA";
  }, []);

  const irParaPlanos = () => document.getElementById("lp-planos")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="lp-root">
      <style>{LANDING_CSS}</style>

      {/* NAV */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src="/icons/icon-192.png" alt="" width={34} height={34} style={{borderRadius:8}}/>
            <span style={{fontWeight:800,fontSize:15,letterSpacing:-0.3}}>
              InvestIA <span style={{color:"#7b61ff"}}>Pro</span>
            </span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button className="lp-ghost" onClick={onEntrar}>Entrar</button>
            <CTAButton onClick={onComecar}>Teste grátis</CTAButton>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="lp-hero">
        <div className="lp-hero-grid">
          <div>
            <div className="lp-badge anim-d1">
              <Zap size={12}/> {TRIAL_DIAS} DIAS GRÁTIS · SEM CARTÃO
            </div>
            <h1 className="lp-h1 anim-d1">
              Sua carteira da B3,<br/>
              <span className="lp-h1-accent">analisada por IA</span><br/>
              em 60 segundos.
            </h1>
            <p className="lp-sub anim-d2">
              Tese de investimento, risco, rebalanceamento e projeção de renda
              passiva — tudo calculado sobre <b>seus ativos reais</b>, com
              cotações ao vivo e fundamentos atualizados.
            </p>
            <div className="anim-d2" style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
              <CTAButton grande onClick={onComecar}>Começar teste grátis</CTAButton>
              <button className="lp-ghost" onClick={irParaPlanos} style={{fontSize:14,padding:"15px 22px"}}>
                Ver planos <ChevronDown size={15}/>
              </button>
            </div>
            <div className="anim-d3" style={{display:"flex",gap:18,marginTop:26,flexWrap:"wrap"}}>
              {[["1.400+","tickers B3"],["16","ferramentas"],["60s","p/ análise completa"]].map(([n,l]) => (
                <div key={l}>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:800,fontSize:20,color:"#e8e8f2"}}>{n}</div>
                  <div style={{fontSize:11,color:"#8b8ba3"}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <DashboardMock/>
        </div>
      </header>

      {/* TICKER TAPE */}
      <div className="lp-tape">
        <div className="lp-tape-track">
          {[...TAPE, ...TAPE].map(([t, p, v], i) => (
            <span key={i} className="lp-tape-item">
              <b style={{color:"#e8e8f2"}}>{t}</b>
              <span style={{color:"#8b8ba3"}}>R$ {p}</span>
              <span style={{color: v >= 0 ? "#00e5a0" : "#ff4d6d"}}>
                {v >= 0 ? "▲" : "▼"} {Math.abs(v).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
        <div className="lp-tape-note">dados ilustrativos</div>
      </div>

      {/* FEATURES */}
      <section className="lp-section">
        <div className="lp-kicker">FERRAMENTAS</div>
        <h2 className="lp-h2">Um analista completo<br/>trabalhando para a sua carteira</h2>
        <div className="lp-feat-grid">
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <div key={f.titulo} className="lp-feat">
                <div className="lp-feat-icon"><Icon size={18} strokeWidth={2}/></div>
                <div style={{fontWeight:800,fontSize:15,marginBottom:8,color:"#e8e8f2"}}>{f.titulo}</div>
                <div style={{fontSize:13,lineHeight:1.7,color:"#8b8ba3"}}>{f.texto}</div>
              </div>
            );
          })}
        </div>
        <div style={{textAlign:"center",marginTop:18,fontSize:12.5,color:"#5b5b76"}}>
          E mais: patrimônio vs CDI · comparador de ativos · buscador de oportunidades · watchlist com preço-alvo ·
          proventos · simulador do 1º milhão · alertas no Telegram
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="lp-section" style={{paddingTop:0}}>
        <div className="lp-kicker">COMO FUNCIONA</div>
        <h2 className="lp-h2">Do zero à primeira análise<br/>em menos de 5 minutos</h2>
        <div className="lp-passos">
          {PASSOS.map(p => (
            <div key={p.n} className="lp-passo">
              <div className="lp-passo-n">{p.n}</div>
              <div style={{fontWeight:800,fontSize:16,marginBottom:8,color:"#e8e8f2"}}>{p.titulo}</div>
              <div style={{fontSize:13,lineHeight:1.7,color:"#8b8ba3"}}>{p.texto}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="lp-section" id="lp-planos">
        <div className="lp-kicker">PLANOS</div>
        <h2 className="lp-h2">Menos que um lanche por mês.<br/>Decisões de milhares de reais.</h2>
        <p style={{textAlign:"center",color:"#8b8ba3",fontSize:14,marginTop:-26,marginBottom:40}}>
          Comece com {TRIAL_DIAS} dias grátis. Sem cartão, sem pegadinha.
        </p>
        <div className="lp-pricing">
          {PLANOS.map(p => (
            <div key={p.id} className={`lp-price-card${p.destaque ? " destaque" : ""}`}>
              {p.destaque && <div className="lp-price-tag"><Crown size={11}/> MELHOR VALOR</div>}
              <div style={{fontSize:12,fontWeight:800,letterSpacing:1.5,color:"#8b8ba3",marginBottom:12}}>{p.nome.toUpperCase()}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:5,marginBottom:4}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:38,fontWeight:800,color:"#e8e8f2"}}>
                  {p.preco.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
                </span>
                <span style={{fontSize:14,color:"#5b5b76",fontWeight:600}}>{p.periodo}</span>
              </div>
              <div style={{fontSize:12.5,color:"#8b8ba3",marginBottom:22,minHeight:20}}>
                {p.precoMensalEquiv
                  ? <>equivale a <b style={{color:"#00e5a0"}}>{p.precoMensalEquiv.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}/mês</b> · {p.descricao}</>
                  : p.descricao}
              </div>
              <div style={{display:"grid",gap:9,marginBottom:24}}>
                {["Todas as 16 ferramentas","Análises com IA ilimitadas","Cotações em tempo real","Alertas no Telegram"].map(b => (
                  <div key={b} style={{display:"flex",gap:8,alignItems:"center",fontSize:13,color:"#b8b8cc"}}>
                    <Check size={14} color="#00e5a0" strokeWidth={3}/>{b}
                  </div>
                ))}
              </div>
              <CTAButton grande onClick={onComecar}>Testar {TRIAL_DIAS} dias grátis</CTAButton>
              <div style={{fontSize:11,color:"#5b5b76",marginTop:10,textAlign:"center"}}>assine só se gostar</div>
            </div>
          ))}
        </div>

        {/* Faixa de confiança — reforço de baixo risco na decisão */}
        <div className="lp-trust">
          <span><CreditCard size={14}/> Sem cartão no teste</span>
          <span><RefreshCw size={14}/> Cancele quando quiser</span>
          <span><Shield size={14}/> Dados isolados por RLS</span>
          <span><Lock size={14}/> Conexão criptografada</span>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section" style={{maxWidth:720}}>
        <div className="lp-kicker">DÚVIDAS</div>
        <h2 className="lp-h2">Perguntas frequentes</h2>
        <div style={{display:"grid",gap:10}}>
          {FAQ.map((f, i) => (
            <div key={f.q} className="lp-faq" onClick={() => setFaqAberta(faqAberta === i ? -1 : i)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,cursor:"pointer"}}>
                <span style={{fontWeight:700,fontSize:14,color:"#e8e8f2"}}>{f.q}</span>
                <ChevronDown size={16} color="#7b61ff" style={{
                  flexShrink:0, transition:"transform .25s ease",
                  transform: faqAberta === i ? "rotate(180deg)" : "none"
                }}/>
              </div>
              {faqAberta === i && (
                <div style={{fontSize:13,lineHeight:1.75,color:"#8b8ba3",marginTop:10}}>{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="lp-final">
        <h2 className="lp-h2" style={{marginBottom:14}}>Sua carteira merece<br/>mais que planilha.</h2>
        <p style={{color:"#8b8ba3",fontSize:14,marginBottom:28}}>
          {TRIAL_DIAS} dias grátis, completos, sem cartão. Cancele com um clique.
        </p>
        <div style={{display:"flex",justifyContent:"center"}}>
          <CTAButton grande onClick={onComecar}>Criar minha conta grátis</CTAButton>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",marginBottom:12}}>
          <img src="/icons/icon-192.png" alt="" width={22} height={22} style={{borderRadius:5}}/>
          <span style={{fontWeight:800,fontSize:13}}>InvestIA <span style={{color:"#7b61ff"}}>Pro</span></span>
        </div>
        <div style={{fontSize:11,color:"#5b5b76",maxWidth:640,margin:"0 auto",lineHeight:1.8}}>
          O InvestIA Pro é uma ferramenta educacional de organização e análise de carteira.
          As análises geradas por IA não constituem recomendação de investimento, oferta ou
          solicitação de compra de ativos. Rentabilidade passada não garante resultados futuros.
          Dúvidas: <a href={`mailto:${CONTATO_EMAIL}`} style={{color:"#7b61ff"}}>{CONTATO_EMAIL}</a>
        </div>
        <div style={{fontSize:10,color:"#3a3a52",marginTop:14}}>
          © {new Date().getFullYear()} InvestIA Pro · Feito no Brasil para a B3
        </div>
      </footer>
    </div>
  );
}

const LANDING_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700;800&display=swap');
.lp-root{
  min-height:100vh;background:#06060f;color:#e8e8f2;
  font-family:'Inter',sans-serif;overflow-x:clip;position:relative;
}
.lp-root::before{
  content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:linear-gradient(rgba(123,97,255,0.04) 1px,transparent 1px),
    linear-gradient(90deg,rgba(123,97,255,0.04) 1px,transparent 1px);
  background-size:48px 48px;
  mask-image:radial-gradient(ellipse 90% 70% at 50% 0%,#000 30%,transparent 75%);
  -webkit-mask-image:radial-gradient(ellipse 90% 70% at 50% 0%,#000 30%,transparent 75%);
}
.lp-root *{box-sizing:border-box;margin:0;padding:0}
.lp-root button{font-family:inherit;outline:none}

@keyframes lpFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes lpMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes lpDraw{from{stroke-dashoffset:600}to{stroke-dashoffset:0}}
@keyframes lpPulse{0%,100%{opacity:1}50%{opacity:.35}}
.anim-d1{animation:lpFadeUp .6s ease both}
.anim-d2{animation:lpFadeUp .6s .15s ease both}
.anim-d3{animation:lpFadeUp .6s .3s ease both}
.lp-pulse{animation:lpPulse 2s ease infinite}

.lp-nav{position:sticky;top:0;z-index:50;background:rgba(6,6,15,0.8);backdrop-filter:blur(12px);border-bottom:1px solid #16162a}
.lp-nav-inner{max-width:1120px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between}

.lp-cta{
  display:inline-flex;align-items:center;gap:8px;border:none;border-radius:10px;cursor:pointer;
  background:linear-gradient(135deg,#7b61ff,#5540dd);color:#fff;font-weight:800;
  box-shadow:0 4px 24px rgba(123,97,255,0.4);transition:transform .15s ease,box-shadow .15s ease;
}
.lp-cta:hover{transform:translateY(-1px);box-shadow:0 6px 32px rgba(123,97,255,0.55)}
.lp-ghost{
  display:inline-flex;align-items:center;gap:6px;background:transparent;border:1px solid #2a2a42;
  border-radius:10px;padding:10px 18px;color:#b8b8cc;font-weight:700;font-size:13;cursor:pointer;
  transition:border-color .15s ease,color .15s ease;font-size:13px;
}
.lp-ghost:hover{border-color:#7b61ff;color:#e8e8f2}

.lp-hero{position:relative;z-index:1;max-width:1120px;margin:0 auto;padding:clamp(48px,9vh,96px) 24px clamp(40px,7vh,72px)}
.lp-hero-grid{display:grid;grid-template-columns:1.05fr 0.95fr;gap:48px;align-items:center}
@media(max-width:880px){.lp-hero-grid{grid-template-columns:1fr;gap:40px}}
.lp-badge{
  display:inline-flex;align-items:center;gap:7px;font-family:'JetBrains Mono',monospace;
  font-size:11px;font-weight:700;letter-spacing:1px;color:#00e5a0;
  border:1px solid rgba(0,229,160,0.3);background:rgba(0,229,160,0.07);
  border-radius:99px;padding:7px 14px;margin-bottom:22px;
}
.lp-h1{
  font-family:'JetBrains Mono',monospace;font-size:clamp(30px,4.6vw,52px);
  font-weight:800;line-height:1.12;letter-spacing:-1.5px;margin-bottom:20px;
}
.lp-h1-accent{
  color:#7b61ff;
  text-shadow:0 0 40px rgba(123,97,255,0.45);
}
.lp-sub{font-size:clamp(14px,1.6vw,16.5px);line-height:1.75;color:#8b8ba3;max-width:480px;margin-bottom:28px}
.lp-sub b{color:#e8e8f2}

.lp-mock{
  background:#0b0b1a;border:1px solid #1f1f36;border-radius:16px;padding:0 0 14px;
  box-shadow:0 24px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(123,97,255,0.08),0 0 120px rgba(123,97,255,0.12);
  transform:perspective(1400px) rotateY(-4deg) rotateX(2deg);
}
@media(max-width:880px){.lp-mock{transform:none}}
.lp-mock-bar{display:flex;align-items:center;gap:6px;padding:12px 14px;border-bottom:1px solid #16162a}
.lp-dot{width:9px;height:9px;border-radius:50%;display:inline-block}
.lp-mock-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:14px 16px 10px}
.lp-mock-chart{position:relative;height:96px;margin:4px 16px 10px;background:#0e0e20;border:1px solid #16162a;border-radius:10px;overflow:hidden;padding-top:22px}
.lp-chart-line{stroke-dasharray:600;animation:lpDraw 2.4s .5s ease both}
.lp-mock-ia{margin:0 16px 10px;background:rgba(123,97,255,0.06);border:1px solid rgba(123,97,255,0.25);border-radius:10px;padding:12px 14px}
.lp-mock-pos{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin:0 16px}
.lp-mock-pos-row{
  display:flex;justify-content:space-between;align-items:center;
  background:#0e0e20;border:1px solid #16162a;border-radius:8px;padding:7px 10px;
  font-family:'JetBrains Mono',monospace;font-size:10px;
}

.lp-tape{position:relative;border-top:1px solid #16162a;border-bottom:1px solid #16162a;background:#08081400;overflow:hidden;padding:10px 0;
  mask-image:linear-gradient(90deg,transparent,#000 60px,#000 calc(100% - 60px),transparent);
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 60px,#000 calc(100% - 60px),transparent);}
.lp-tape-track{display:inline-flex;gap:36px;white-space:nowrap;animation:lpMarquee 38s linear infinite;will-change:transform}
.lp-tape:hover .lp-tape-track{animation-play-state:paused}
.lp-tape-item{display:inline-flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600}
.lp-tape-note{position:absolute;right:8px;bottom:1px;font-size:8px;color:#3a3a52;letter-spacing:0.5px}

.lp-section{position:relative;z-index:1;max-width:1120px;margin:0 auto;padding:clamp(56px,9vh,96px) 24px}
.lp-kicker{font-family:'JetBrains Mono',monospace;text-align:center;font-size:11px;font-weight:700;letter-spacing:3px;color:#7b61ff;margin-bottom:14px}
.lp-h2{text-align:center;font-size:clamp(24px,3.4vw,36px);font-weight:900;letter-spacing:-0.8px;line-height:1.25;margin-bottom:44px}

.lp-feat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.lp-feat{
  background:#0b0b1a;border:1px solid #1f1f36;border-radius:14px;padding:22px;
  transition:border-color .2s ease,transform .2s ease;
}
.lp-feat:hover{border-color:rgba(123,97,255,0.5);transform:translateY(-3px)}
.lp-feat-icon{
  width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;
  background:rgba(123,97,255,0.12);color:#7b61ff;margin-bottom:14px;
}

.lp-passos{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.lp-passo{background:#0b0b1a;border:1px solid #1f1f36;border-radius:14px;padding:24px;position:relative}
.lp-passo-n{
  font-family:'JetBrains Mono',monospace;font-size:30px;font-weight:800;color:transparent;
  -webkit-text-stroke:1px #7b61ff;margin-bottom:14px;opacity:0.9;
}

.lp-pricing{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;max-width:720px;margin:0 auto}
.lp-price-card{background:#0b0b1a;border:1px solid #1f1f36;border-radius:18px;padding:28px;position:relative;display:flex;flex-direction:column}
.lp-price-card .lp-cta{width:100%;justify-content:center;margin-top:auto}
.lp-price-card.destaque{border:2px solid #7b61ff;box-shadow:0 0 60px rgba(123,97,255,0.18)}
.lp-price-tag{
  position:absolute;top:-12px;left:50%;transform:translateX(-50%);white-space:nowrap;
  background:linear-gradient(135deg,#7b61ff,#5540dd);color:#fff;border-radius:99px;
  font-size:10px;font-weight:800;letter-spacing:1px;padding:5px 14px;display:flex;align-items:center;gap:5px;
}

.lp-trust{display:flex;flex-wrap:wrap;justify-content:center;gap:14px 28px;margin-top:34px;font-size:12.5px;color:#8b8ba3}
.lp-trust span{display:inline-flex;align-items:center;gap:7px}
.lp-trust svg{color:#00e5a0}

.lp-faq{background:#0b0b1a;border:1px solid #1f1f36;border-radius:12px;padding:18px 20px;transition:border-color .2s ease}
.lp-faq:hover{border-color:rgba(123,97,255,0.4)}

.lp-final{position:relative;z-index:1;text-align:center;padding:clamp(56px,10vh,110px) 24px;
  background:radial-gradient(ellipse 60% 80% at 50% 100%,rgba(123,97,255,0.13),transparent)}
.lp-footer{border-top:1px solid #16162a;text-align:center;padding:36px 24px 28px;position:relative;z-index:1}
`;
