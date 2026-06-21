#!/usr/bin/env python3
"""Gera 4 variantes do post do Instagram pro Cauril, cada uma testando um
gatilho psicológico diferente. Logo embedado em base64 (arquivo único)."""

import base64, pathlib

ROOT = pathlib.Path(__file__).parent
LOGO_PATH = ROOT.parent / "public/icons/icon-192.png"
LOGO_B64 = base64.b64encode(LOGO_PATH.read_bytes()).decode("ascii")
LOGO_DATA = f"data:image/png;base64,{LOGO_B64}"

# ─── Variantes ──────────────────────────────────────────────────────────────
# Cada variante testa um ângulo psicológico distinto. Comparar via utm_content.
VARIANTS = [
    dict(
        slug="v1-curiosidade",
        utm_content="v1_curiosidade",
        pill_color="red",      # red | gold | green | blue
        pill_text="Lançamento · vagas limitadas",
        kicker="Diagnóstico de carteira por IA",
        headline_html='Sua carteira<br/>tem <em>3 riscos</em><br/>que você não vê.',
        sub_html='A IA do Cauril cruza seus ativos com <b>cotações ao vivo</b> e <b>fundamentos reais</b> da B3 e te mostra <b>onde você está exposto</b> — em 60 segundos, sem planilha.',
        insight_color="red",   # red | green | gold | blue
        insight_tag="Alerta da IA · agora",
        insight_html='<b>29% da carteira</b> está concentrada em bancos. Sugestão: aporte em utilities ou FIIs.',
        feat=[
            ("shield", "Vê o risco escondido",      "Concentração por setor, HHI e ativos críticos da sua carteira."),
            ("chart",  "Plano de rebalanceamento", "A IA mostra exatamente onde aportar para voltar ao alvo."),
            ("coin",   "Quanto vai pingar",        "Projeção real de renda passiva com sazonalidade da B3."),
        ],
        cta_text="Quero analisar minha carteira",
        cta_sub="7 dias grátis · sem cartão · cauril.com.br",
    ),
    dict(
        slug="v2-prova",
        utm_content="v2_prova",
        pill_color="gold",
        pill_text="Beta · 1.430 tickers B3",
        kicker="Análise de carteira com IA",
        headline_html='Sua carteira<br/>vs. <em>CDI</em>:<br/>+6,2pp acima.',
        sub_html='Cotações ao vivo, fundamentos auditáveis e <b>análise da IA em 60s</b> sobre seus ativos reais — não é planilha, não é achismo.',
        insight_color="green",
        insight_tag="Análise concluída · 11 ativos",
        insight_html='Carteira <b>sólida com viés de dividendos</b>. Diversificação setorial acima da média.',
        feat=[
            ("signal", "Cotações ao vivo",   "Atualização a cada 60s, direto da B3."),
            ("brain",  "Fundamentos reais",  "Cruzamento com dados oficiais (CVM, bolsai)."),
            ("check",  "Análise auditável",  "Toda recomendação com os números que a geraram."),
        ],
        cta_text="Quero ver minha análise",
        cta_sub="7 dias grátis · sem cartão · cauril.com.br",
    ),
    dict(
        slug="v3-pergunta",
        utm_content="v3_pergunta",
        pill_color="gold",
        pill_text="Teste 7 dias grátis",
        kicker="Pergunta do mês",
        headline_html='Quanto da<br/>sua carteira está<br/>em <em>1 só setor</em>?',
        sub_html='A maioria dos investidores PF brasileiros tem <b>29% em bancos</b> sem perceber. A IA do Cauril te mostra a sua composição real — em 60 segundos.',
        insight_color="gold",
        insight_tag="Insight da IA",
        insight_html='Média B3: <b>29% de concentração</b> num único setor. E a sua?',
        feat=[
            ("shield", "Vê sua concentração",  "Por ativo, por setor, por tipo. Tudo em um gráfico claro."),
            ("chart",  "Plano de aporte",      "Saiba exatamente onde colocar seu próximo aporte."),
            ("coin",   "Renda projetada",      "Quanto vai pingar em 1, 5, 10 anos."),
        ],
        cta_text="Descobrir agora",
        cta_sub="grátis · sem cartão · cauril.com.br",
    ),
    dict(
        slug="v4-valor",
        utm_content="v4_valor",
        pill_color="green",
        pill_text="Análise completa · R$ 0",
        kicker="Análise de carteira com IA",
        headline_html='Análise que<br/>custaria <em>R$ 300</em><br/>numa corretora.',
        sub_html='Aqui é em <b>60 segundos</b>, com cotações ao vivo, IA real e zero custo no teste — sem cartão, sem pegadinha.',
        insight_color="blue",
        insight_tag="Hoje · 47 análises geradas",
        insight_html='IA processou <b>1.430 tickers da B3</b> em segundos. Sua vez.',
        feat=[
            ("brain",  "IA + dados reais",    "Gemini cruza seus ativos com fundamentos oficiais da B3."),
            ("signal", "Resultado em 60s",    "Análise completa enquanto você toma um café."),
            ("check",  "Sem cartão, sem dor", "Use 7 dias, sem digitar cartão. Cancele com 1 clique."),
        ],
        cta_text="Quero minha análise grátis",
        cta_sub="cauril.com.br · 7 dias grátis · sem cartão",
    ),
]

# ─── SVGs dos ícones ────────────────────────────────────────────────────────
ICONS = {
    "shield": '<path d="M12 3 4 6v5c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-3z"/><path d="M12 8v4"/><circle cx="12" cy="15.5" r=".8" fill="currentColor"/>',
    "chart":  '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
    "coin":   '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    "signal": '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    "brain":  '<path d="M9.5 3a2.5 2.5 0 0 0-2.5 2.5v.5a2.5 2.5 0 0 0-1.5 4.6A2.5 2.5 0 0 0 6.5 15v.5A2.5 2.5 0 0 0 9 18h.5V3z"/><path d="M14.5 3A2.5 2.5 0 0 1 17 5.5v.5a2.5 2.5 0 0 1 1.5 4.6A2.5 2.5 0 0 1 17.5 15v.5a2.5 2.5 0 0 1-2.5 2.5h-.5V3z"/>',
    "check":  '<path d="M4 12l5 5L20 6"/>',
}

# ─── Cores pra pílulas e insight ────────────────────────────────────────────
ACCENT_COLORS = {
    "red":   dict(border="rgba(248,113,113,.35)", bg="rgba(248,113,113,.06)", text="#fca5a5", dot="#f87171", glow="rgba(248,113,113,.18)"),
    "gold":  dict(border="rgba(201,168,76,.40)",  bg="rgba(201,168,76,.07)",  text="#d9bb6a", dot="#c9a84c", glow="rgba(201,168,76,.22)"),
    "green": dict(border="rgba(74,222,128,.35)",  bg="rgba(74,222,128,.06)",  text="#86efac", dot="#4ade80", glow="rgba(74,222,128,.18)"),
    "blue":  dict(border="rgba(96,165,250,.35)",  bg="rgba(96,165,250,.06)",  text="#93c5fd", dot="#60a5fa", glow="rgba(96,165,250,.18)"),
}

# ─── Template HTML ──────────────────────────────────────────────────────────
TEMPLATE = '''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Cauril — Instagram post {SLUG}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
  :root{{
    --bg:#0a0a12;--gold:#c9a84c;--gold-soft:#d9bb6a;
    --text:#f4eede;--text-mute:#9a9180;--text-faint:#5b574a;
    --up:#4ade80;--down:#f87171;
    --pill-border:{PILL_BORDER};--pill-bg:{PILL_BG};--pill-text:{PILL_TEXT};--pill-dot:{PILL_DOT};--pill-glow:{PILL_GLOW};
    --insight-border:{INS_BORDER};--insight-text:{INS_TEXT};--insight-glow:{INS_GLOW};
  }}
  html,body{{background:#000;font-family:'Inter',sans-serif;color:var(--text);-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}}
  body{{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow-x:hidden}}
  .stage{{width:1080px;height:1350px;transform-origin:top center;flex-shrink:0}}
  .post{{
    width:1080px;height:1350px;position:relative;
    background:
      radial-gradient(900px 500px at 78% -10%, rgba(201,168,76,.13), transparent 65%),
      radial-gradient(700px 600px at 8% 105%, rgba(201,168,76,.07), transparent 70%),
      linear-gradient(180deg,#0a0a12 0%,#0c0c16 55%,#080810 100%);
    overflow:hidden;border-radius:8px;
  }}
  .post::before{{
    content:"";position:absolute;inset:0;
    background-image:radial-gradient(circle, rgba(255,255,255,.045) 1px, transparent 1px);
    background-size:32px 32px;
    mask-image:linear-gradient(180deg,#000 0%,#000 70%,transparent 100%);
    -webkit-mask-image:linear-gradient(180deg,#000 0%,#000 70%,transparent 100%);
    pointer-events:none;
  }}
  .corner{{position:absolute;width:34px;height:34px;border:1px solid var(--gold);opacity:.35}}
  .corner.tl{{top:18px;left:18px;border-right:0;border-bottom:0}}
  .corner.tr{{top:18px;right:18px;border-left:0;border-bottom:0}}
  .corner.bl{{bottom:18px;left:18px;border-right:0;border-top:0}}
  .corner.br{{bottom:18px;right:18px;border-left:0;border-top:0}}

  .header{{position:absolute;top:48px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;z-index:5}}
  .brand{{display:flex;align-items:center;gap:16px}}
  .brand-mark{{width:54px;height:54px;flex-shrink:0;filter:drop-shadow(0 0 14px rgba(201,168,76,.32))}}
  .brand-mark img{{width:100%;height:100%;display:block;object-fit:contain}}
  .brand-name{{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:36px;letter-spacing:.02em;color:var(--text);line-height:1}}
  .brand-name .accent{{color:var(--gold-soft)}}
  .brand-tag{{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--text-faint);margin-top:4px}}
  .pill{{
    display:inline-flex;align-items:center;gap:10px;
    font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;
    padding:11px 18px;border-radius:999px;
    background:var(--pill-bg);border:1px solid var(--pill-border);color:var(--pill-text);
    box-shadow:0 0 22px var(--pill-glow);
  }}
  .pill::before{{content:"";width:7px;height:7px;border-radius:50%;background:var(--pill-dot);box-shadow:0 0 12px var(--pill-dot);animation:pulse 1.6s ease-in-out infinite}}
  @keyframes pulse{{50%{{opacity:.4}}}}

  .hero{{position:absolute;top:140px;left:64px;right:64px;z-index:4}}
  .kicker{{display:flex;align-items:center;gap:14px;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.32em;text-transform:uppercase;color:var(--text-mute);margin-bottom:24px}}
  .kicker .bar{{width:38px;height:1px;background:var(--gold)}}
  h1.headline{{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:92px;line-height:.98;letter-spacing:-.02em;color:var(--text)}}
  h1.headline em{{font-style:italic;font-weight:500;color:var(--gold);position:relative}}
  h1.headline em::after{{content:"";position:absolute;left:0;right:0;bottom:6px;height:3px;background:linear-gradient(90deg, var(--gold), transparent);border-radius:2px;opacity:.4}}
  .sub{{margin-top:22px;font-size:20px;line-height:1.45;color:var(--text-mute);max-width:780px;font-weight:400}}
  .sub b{{color:var(--text);font-weight:500}}

  .mock-stack{{position:absolute;top:560px;left:64px;right:64px}}
  .mock{{
    background:linear-gradient(180deg,#15151f 0%,#0e0e17 100%);
    border:1px solid rgba(255,255,255,.06);border-radius:16px;
    box-shadow:0 50px 80px -30px rgba(0,0,0,.85),0 0 1px rgba(201,168,76,.2),inset 0 1px 0 rgba(255,255,255,.04);
    overflow:hidden;position:relative;
  }}
  .insight{{
    position:absolute;left:50%;bottom:-22px;transform:translateX(-50%) rotate(-1.5deg);
    background:linear-gradient(180deg,#1a141d 0%,#120c14 100%);
    border:1px solid var(--insight-border);
    border-radius:12px;padding:14px 20px;
    max-width:560px;
    box-shadow:0 18px 40px -10px var(--insight-glow),0 0 0 1px rgba(255,255,255,.04) inset;
    z-index:10;
  }}
  .insight::before{{content:"";position:absolute;top:14px;left:-1px;width:3px;height:calc(100% - 28px);background:var(--insight-text);border-radius:0 2px 2px 0}}
  .insight-tag{{display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--insight-text);margin-bottom:6px}}
  .insight-text{{font-family:'Cormorant Garamond',serif;font-size:19px;line-height:1.25;color:var(--text);font-weight:500}}
  .insight-text b{{color:var(--insight-text);font-weight:600}}

  .mock-bar{{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.05);background:rgba(0,0,0,.25)}}
  .mock-bar .dot{{width:11px;height:11px;border-radius:50%}}
  .mock-bar .dot.r{{background:#ff5f57}}.mock-bar .dot.y{{background:#febc2e}}.mock-bar .dot.g{{background:#28c840}}
  .mock-bar .url{{margin-left:18px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#5b5b76;letter-spacing:.04em}}
  .mock-bar .url::before{{content:"⌘ "}}
  .mock-body{{display:grid;grid-template-columns:1.05fr .95fr;gap:0}}
  .mock-left{{padding:26px 28px;border-right:1px solid rgba(255,255,255,.05)}}
  .mock-right{{padding:26px 28px}}
  .metric-label{{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--text-faint);margin-bottom:10px;display:flex;align-items:center;gap:8px}}
  .metric-label::after{{content:"";flex:1;height:1px;background:rgba(255,255,255,.05)}}
  .patrimonio{{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:52px;color:var(--text);letter-spacing:-.02em;line-height:1}}
  .patrimonio .cents{{font-size:30px;color:var(--text-mute)}}
  .delta-row{{margin-top:12px;display:flex;align-items:center;gap:14px}}
  .delta{{display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;padding:5px 9px;border-radius:6px;color:var(--up);background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.22)}}
  .delta-note{{font-size:11px;color:var(--text-faint)}}
  .chart{{margin-top:18px;height:80px;width:100%;position:relative}}
  .chart svg{{display:block;width:100%;height:100%}}

  .tickers{{list-style:none;display:flex;flex-direction:column}}
  .ticker{{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:11px 0;border-bottom:1px dashed rgba(255,255,255,.05)}}
  .ticker:last-child{{border-bottom:0}}
  .ticker-symbol{{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:14px;color:var(--text);letter-spacing:.04em}}
  .ticker-name{{font-family:'Inter',sans-serif;font-size:11px;color:var(--text-faint)}}
  .ticker-price{{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:13px;text-align:right}}
  .ticker-var{{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:11px;text-align:right;display:block;margin-top:2px}}
  .up{{color:var(--up)}}.down{{color:var(--down)}}

  .features{{position:absolute;top:1010px;left:64px;right:64px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;z-index:4}}
  .feat{{display:flex;flex-direction:column;gap:10px;padding:18px;background:linear-gradient(180deg, rgba(255,255,255,.025), rgba(255,255,255,0));border:1px solid rgba(255,255,255,.06);border-radius:12px;position:relative;overflow:hidden}}
  .feat::before{{content:"";position:absolute;top:0;left:0;width:24px;height:1px;background:var(--gold)}}
  .feat-ico{{width:34px;height:34px;border-radius:8px;flex-shrink:0;background:linear-gradient(180deg, rgba(201,168,76,.18), rgba(201,168,76,.05));border:1px solid rgba(201,168,76,.28);display:flex;align-items:center;justify-content:center;color:var(--gold-soft);box-shadow:0 0 12px rgba(201,168,76,.15), inset 0 1px 0 rgba(255,255,255,.06)}}
  .feat-title{{font-family:'Inter',sans-serif;font-weight:600;font-size:15px;color:var(--text);line-height:1.25}}
  .feat-desc{{font-family:'Inter',sans-serif;font-weight:400;font-size:12px;color:var(--text-mute);line-height:1.4}}

  .cta-wrap{{position:absolute;left:64px;right:64px;bottom:48px;z-index:5;display:flex;flex-direction:column}}
  .cta-divider{{height:1px;width:100%;background:linear-gradient(90deg, transparent, rgba(201,168,76,.32) 50%, transparent);margin-bottom:30px}}
  .cta{{position:relative;display:flex;align-items:center;justify-content:space-between;padding:24px 32px;border-radius:14px;background:linear-gradient(180deg,#d6b766 0%, #c9a84c 50%, #a48732 100%);color:#1a1408;box-shadow:0 20px 60px -10px rgba(201,168,76,.55),0 0 0 1px rgba(255,255,255,.16) inset,0 -2px 0 rgba(0,0,0,.35) inset;overflow:hidden}}
  .cta::after{{content:"";position:absolute;inset:0;background:linear-gradient(115deg, transparent 30%, rgba(255,255,255,.25) 50%, transparent 70%);pointer-events:none}}
  .cta-text{{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:30px;line-height:1;letter-spacing:-.005em}}
  .cta-text small{{display:block;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:rgba(26,20,8,.65);margin-top:6px}}
  .cta-arrow{{width:54px;height:54px;border-radius:50%;background:#1a1408;color:var(--gold-soft);display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(201,168,76,.4)}}
  .footer{{margin-top:14px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--text-faint);opacity:.7}}

  .hint{{width:100%;text-align:center;color:#888;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;margin:14px 0 0 0}}
</style>
</head>
<body>

<div class="stage">
<div class="post" id="post">
  <span class="corner tl"></span><span class="corner tr"></span>
  <span class="corner bl"></span><span class="corner br"></span>

  <header class="header">
    <div class="brand">
      <div class="brand-mark"><img src="{LOGO_DATA}" alt="Cauril"/></div>
      <div>
        <div class="brand-name">Cau<span class="accent">ril</span></div>
        <div class="brand-tag">análise educacional · B3</div>
      </div>
    </div>
    <span class="pill">{PILL_TEXT}</span>
  </header>

  <section class="hero">
    <div class="kicker"><span class="bar"></span><span>{KICKER}</span></div>
    <h1 class="headline">{HEADLINE_HTML}</h1>
    <p class="sub">{SUB_HTML}</p>
  </section>

  <section class="mock-stack">
    <div class="mock">
      <div class="mock-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="url">cauril.com.br/analise/carteira</span>
      </div>
      <div class="mock-body">
        <div class="mock-left">
          <div class="metric-label">Patrimônio · 12m</div>
          <div class="patrimonio">R$ 248,3<span class="cents">k</span></div>
          <div class="delta-row">
            <span class="delta"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 2 L10 8 L2 8 Z" fill="currentColor"/></svg>+18,4%</span>
            <span class="delta-note">vs CDI: <b style="color:var(--text)">+6,2pp</b></span>
          </div>
          <div class="chart">
            <svg viewBox="0 0 360 80" preserveAspectRatio="none">
              <defs>
                <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stop-color="#4ade80" stop-opacity=".35"/>
                  <stop offset="100%" stop-color="#4ade80" stop-opacity="0"/>
                </linearGradient>
                <linearGradient id="g2" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stop-color="#86efac"/><stop offset="100%" stop-color="#4ade80"/>
                </linearGradient>
              </defs>
              <line x1="0" y1="20" x2="360" y2="20" stroke="rgba(255,255,255,.04)" stroke-dasharray="2 4"/>
              <line x1="0" y1="45" x2="360" y2="45" stroke="rgba(255,255,255,.04)" stroke-dasharray="2 4"/>
              <path d="M0 64 L30 60 L60 56 L90 53 L120 44 L150 47 L180 36 L210 33 L240 27 L270 22 L300 18 L330 13 L360 9 L360 80 L0 80 Z" fill="url(#g1)"/>
              <path d="M0 64 L30 60 L60 56 L90 53 L120 44 L150 47 L180 36 L210 33 L240 27 L270 22 L300 18 L330 13 L360 9" stroke="url(#g2)" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="360" cy="9" r="4.5" fill="#4ade80"/>
              <circle cx="360" cy="9" r="9" fill="#4ade80" opacity=".18"/>
            </svg>
          </div>
        </div>
        <div class="mock-right">
          <div class="metric-label">Carteira · hoje</div>
          <ul class="tickers">
            <li class="ticker"><div><div class="ticker-symbol">PETR4</div><div class="ticker-name">Petrobras</div></div><span></span><div><div class="ticker-price">R$ 38,42</div><span class="ticker-var up">▲ +1,24%</span></div></li>
            <li class="ticker"><div><div class="ticker-symbol">VALE3</div><div class="ticker-name">Vale</div></div><span></span><div><div class="ticker-price">R$ 61,80</div><span class="ticker-var down">▼ −0,62%</span></div></li>
            <li class="ticker"><div><div class="ticker-symbol">ITUB4</div><div class="ticker-name">Itaú Unibanco</div></div><span></span><div><div class="ticker-price">R$ 34,15</div><span class="ticker-var up">▲ +0,88%</span></div></li>
            <li class="ticker"><div><div class="ticker-symbol">MXRF11</div><div class="ticker-name">Maxi Renda FII</div></div><span></span><div><div class="ticker-price">R$ 10,42</div><span class="ticker-var up">▲ +0,19%</span></div></li>
          </ul>
        </div>
      </div>
    </div>
    <!-- insight overlay: centralizado embaixo, ocupa toda a largura -->
    <div class="insight">
      <span class="insight-tag">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"><path d="M6 1 L11 11 L1 11 Z"/><circle cx="6" cy="9" r=".8" fill="#0a0a12"/><rect x="5.4" y="4.5" width="1.2" height="3" fill="#0a0a12"/></svg>
        {INSIGHT_TAG}
      </span>
      <div class="insight-text">{INSIGHT_HTML}</div>
    </div>
  </section>

  <section class="features">
{FEATURES_HTML}
  </section>

  <section class="cta-wrap">
    <div class="cta-divider"></div>
    <div class="cta">
      <div class="cta-text">{CTA_TEXT}<small>{CTA_SUB}</small></div>
      <div class="cta-arrow"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></div>
    </div>
    <div class="footer">ferramenta educacional · não é recomendação de investimento</div>
  </section>
</div>
</div>

<div class="hint">post {SLUG} · 1080×1350 (4:5) · F12 → seleciona .post → Capture node screenshot</div>

<script>
  (function(){{
    var stage = document.querySelector('.stage');
    function fit(){{
      var max = Math.min(window.innerWidth - 24, 1080);
      var scale = max / 1080;
      stage.style.transform = 'scale(' + scale + ')';
      stage.style.marginBottom = ((scale - 1) * 1350) + 'px';
    }}
    fit(); window.addEventListener('resize', fit);
  }})();
</script>
</body>
</html>
'''

def build_features_html(feat_list):
    parts = []
    for icon_key, title, desc in feat_list:
        svg = ICONS[icon_key]
        parts.append(f'''    <div class="feat">
      <div class="feat-ico">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{svg}</svg>
      </div>
      <div class="feat-title">{title}</div>
      <div class="feat-desc">{desc}</div>
    </div>''')
    return "\n".join(parts)

def build(variant):
    pill = ACCENT_COLORS[variant["pill_color"]]
    ins = ACCENT_COLORS[variant["insight_color"]]
    html = TEMPLATE
    replacements = {
        "{SLUG}": variant["slug"],
        "{LOGO_DATA}": LOGO_DATA,
        "{PILL_BORDER}": pill["border"],
        "{PILL_BG}": pill["bg"],
        "{PILL_TEXT}": pill["text"],  # cor (em :root)
        "{PILL_DOT}": pill["dot"],
        "{PILL_GLOW}": pill["glow"],
        "{INS_BORDER}": ins["border"],
        "{INS_TEXT}": ins["text"],
        "{INS_GLOW}": ins["glow"],
        "{KICKER}": variant["kicker"],
        "{HEADLINE_HTML}": variant["headline_html"],
        "{SUB_HTML}": variant["sub_html"],
        "{INSIGHT_TAG}": variant["insight_tag"],
        "{INSIGHT_HTML}": variant["insight_html"],
        "{FEATURES_HTML}": build_features_html(variant["feat"]),
        "{CTA_TEXT}": variant["cta_text"],
        "{CTA_SUB}": variant["cta_sub"],
    }
    # O texto da pílula aparece UMA vez (dentro do <span class="pill">),
    # depois de já termos substituído {PILL_TEXT} pela cor. Trocamos com um
    # marcador diferente:
    html = html.replace("<span class=\"pill\">{PILL_TEXT}</span>", f'<span class="pill">{variant["pill_text"]}</span>')
    for k, v in replacements.items():
        html = html.replace(k, v)
    return html

if __name__ == "__main__":
    for v in VARIANTS:
        out = ROOT / f"instagram-post-{v['slug']}.html"
        out.write_text(build(v), encoding="utf-8")
        print(f"✓ {out.name} ({len(out.read_text())//1024} KB)")
