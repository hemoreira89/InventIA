// Gera páginas ESTÁTICAS de SEO por ticker (uma por ativo), o hub /ativos,
// o sitemap.xml e o robots.txt — tudo a partir do catálogo que já temos
// (zero IA, zero rede). Roda DEPOIS do `vite build` (escreve em dist/).
//
// Blindado: qualquer erro é capturado e o processo sai com 0 — NUNCA derruba
// o build de produção por causa do SEO.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const BASE = "https://invent-ia.vercel.app";

// Piloto: tickers mais buscados. Os que não existirem no catálogo são ignorados.
const PILOTO = [
  "PETR4", "PETR3", "VALE3", "ITUB4", "BBAS3", "BBDC4", "ITSA4", "B3SA3", "BBSE3",
  "ABEV3", "WEGE3", "MGLU3", "TAEE11", "EGIE3", "EQTL3", "SUZB3", "RENT3", "RADL3",
  "PRIO3", "KLBN11", "MXRF11", "HGLG11", "KNRI11", "XPML11", "VISC11", "HGLG11",
];

const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function paginaTicker(t, todos) {
  const tipoLabel = t.tipo === "fii" ? "Fundo Imobiliário (FII)" : "Ação";
  const titulo = `${t.ticker} (${t.nome}) — cotação, dividendos e análise com IA | InvestIA Pro`;
  const desc = `${t.ticker} — ${t.nome}, do setor de ${t.setor}. Veja ${t.ticker} na sua carteira com análise por IA, risco, dividendos e rebalanceamento. Teste grátis 7 dias, sem cartão.`;
  const url = `${BASE}/ativo/${t.ticker}`;
  const relacionados = todos.filter(x => x.ticker !== t.ticker).slice(0, 8);

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "InvestIA Pro", item: BASE },
      { "@type": "ListItem", position: 2, name: "Ativos da B3", item: `${BASE}/ativos` },
      { "@type": "ListItem", position: 3, name: t.ticker, item: url },
    ],
  };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}"/>
<link rel="canonical" href="${url}"/>
<meta name="robots" content="index,follow"/>
<link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="InvestIA Pro"/>
<meta property="og:title" content="${esc(titulo)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:url" content="${url}"/>
<meta property="og:image" content="${BASE}/og-image.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#06060f;color:#e8e8f2;line-height:1.6}
a{color:#9a86ff;text-decoration:none}
.wrap{max-width:760px;margin:0 auto;padding:24px 20px 64px}
.nav{display:flex;align-items:center;gap:10px;margin-bottom:28px}
.nav b{font-size:16px;font-weight:800}
.crumb{font-size:12px;color:#5b5b76;margin-bottom:14px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 20px}
.chip{font-size:12px;font-weight:700;color:#b8b8cc;background:#0e0e20;border:1px solid #1f1f36;border-radius:99px;padding:5px 12px}
h1{font-size:34px;font-weight:800;letter-spacing:-1px}
.sub{font-size:16px;color:#8b8ba3;margin-top:4px}
h2{font-size:18px;margin:28px 0 10px}
p{color:#b8b8cc;margin:10px 0}
ul{margin:10px 0 10px 18px;color:#b8b8cc}
li{margin:6px 0}
.cta{background:#0b0b1a;border:1px solid #2a2150;border-radius:16px;padding:24px;margin:28px 0;text-align:center}
.cta .b{display:inline-block;background:linear-gradient(135deg,#7b61ff,#5540dd);color:#fff;font-weight:800;padding:14px 28px;border-radius:10px;margin-top:8px}
.muted{font-size:12px;color:#5b5b76}
.rel{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.rel a{font-size:13px;background:#0e0e20;border:1px solid #1f1f36;border-radius:8px;padding:6px 12px}
.foot{margin-top:40px;padding-top:18px;border-top:1px solid #1f1f36;font-size:11px;color:#5b5b76}
</style>
</head>
<body>
<div class="wrap">
  <div class="nav"><img src="/icons/icon-192.png" alt="" width="30" height="30" style="border-radius:7px"/><b>InvestIA <span style="color:#7b61ff">Pro</span></b></div>
  <div class="crumb"><a href="/">Início</a> › <a href="/ativos">Ativos da B3</a> › ${esc(t.ticker)}</div>
  <h1>${esc(t.ticker)}</h1>
  <div class="sub">${esc(t.nome)}</div>
  <div class="chips"><span class="chip">${esc(tipoLabel)}</span><span class="chip">${esc(t.setor)}</span><span class="chip">B3</span></div>

  <p>${esc(t.ticker)} (${esc(t.nome)}) é um ativo da B3 no segmento de <b>${esc(t.setor)}</b>${t.setorDesc ? ` — ${esc(t.setorDesc)}` : ""}. No InvestIA Pro você acompanha ${esc(t.ticker)} dentro da <b>sua</b> carteira: cotação ao vivo, dividendos, indicadores fundamentalistas e uma tese de investimento gerada por IA, no contexto dos seus aportes e do seu perfil.</p>

  <h2>O que o InvestIA mostra sobre ${esc(t.ticker)}</h2>
  <ul>
    <li><b>Tese com IA</b> — análise qualitativa de ${esc(t.ticker)} cruzando fundamentos e cotações reais.</li>
    <li><b>Dividendos e DY</b> — histórico de proventos e projeção de renda passiva.</li>
    <li><b>Risco</b> — quanto ${esc(t.ticker)} concentra a sua carteira (por ativo e por setor).</li>
    <li><b>Preço-alvo e watchlist</b> — acompanhe e seja avisado quando atingir o seu alvo.</li>
    <li><b>Rebalanceamento</b> — quanto comprar de ${esc(t.ticker)} no próximo aporte para voltar ao alvo.</li>
  </ul>

  <div class="cta">
    <div style="font-size:19px;font-weight:800">Quer a análise completa de ${esc(t.ticker)} na sua carteira?</div>
    <p class="muted" style="margin:8px 0 0">Teste grátis por 7 dias · sem cartão · cancele quando quiser</p>
    <a class="b" href="/?ref=seo">Analisar com IA grátis →</a>
  </div>

  <h2>Outros ativos</h2>
  <div class="rel">${relacionados.map(r => `<a href="/ativo/${r.ticker}">${esc(r.ticker)}</a>`).join("")}</div>
  <p style="margin-top:14px"><a href="/ativos">Ver todos os ativos →</a></p>

  <div class="foot">Conteúdo educacional de organização e análise de carteira. Não é recomendação de investimento, oferta ou solicitação de compra de ativos. Rentabilidade passada não garante resultados futuros. Dados sujeitos a atraso. © ${new Date().getFullYear()} InvestIA Pro.</div>
</div>
</body>
</html>`;
}

function paginaHub(todos) {
  const itens = todos.map(t => `<li><a href="/ativo/${t.ticker}">${esc(t.ticker)}</a> — ${esc(t.nome)} <span style="color:#5b5b76">(${esc(t.setor)})</span></li>`).join("");
  return `<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Ativos da B3 — ações e FIIs analisados por IA | InvestIA Pro</title>
<meta name="description" content="Lista de ações e FIIs da B3 com análise por IA, dividendos, risco e rebalanceamento no InvestIA Pro. Teste grátis 7 dias."/>
<link rel="canonical" href="${BASE}/ativos"/><meta name="robots" content="index,follow"/>
<link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png"/>
<style>body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#06060f;color:#e8e8f2;line-height:1.7}a{color:#9a86ff;text-decoration:none}.wrap{max-width:760px;margin:0 auto;padding:24px 20px 64px}h1{font-size:30px;font-weight:800}ul{margin:18px 0 0 18px}li{margin:8px 0;color:#b8b8cc}</style>
</head><body><div class="wrap">
<p><a href="/">← InvestIA Pro</a></p>
<h1>Ativos da B3</h1>
<p style="color:#8b8ba3">Ações e FIIs com análise por IA, dividendos, risco e rebalanceamento. <a href="/?ref=seo">Teste grátis 7 dias →</a></p>
<ul>${itens}</ul>
</div></body></html>`;
}

try {
  const here = dirname(fileURLToPath(import.meta.url));
  const { CATEGORIAS } = await import(resolve(here, "../src/lib/catalogoB3.js"));

  // Achata o catálogo em mapa ticker → dados.
  const mapa = new Map();
  for (const cat of CATEGORIAS) {
    for (const a of cat.ativos || []) {
      if (!mapa.has(a.ticker)) {
        mapa.set(a.ticker, { ticker: a.ticker, nome: a.nome, setor: cat.nome, setorDesc: cat.descricao, tipo: cat.tipo });
      }
    }
  }

  const dist = resolve(here, "../dist");
  const todos = [...new Set(PILOTO)].map(tk => mapa.get(tk)).filter(Boolean);
  if (!todos.length) { console.warn("[seo] nenhum ticker do piloto encontrado no catálogo"); process.exit(0); }

  mkdirSync(resolve(dist, "ativo"), { recursive: true });
  for (const t of todos) {
    writeFileSync(resolve(dist, "ativo", `${t.ticker}.html`), paginaTicker(t, todos));
  }
  writeFileSync(resolve(dist, "ativos.html"), paginaHub(todos));

  // sitemap.xml
  const urls = [`${BASE}/`, `${BASE}/ativos`, ...todos.map(t => `${BASE}/ativo/${t.ticker}`)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`;
  writeFileSync(resolve(dist, "sitemap.xml"), sitemap);

  // robots.txt
  writeFileSync(resolve(dist, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);

  console.log(`[seo] ✓ ${todos.length} páginas de ativo + hub + sitemap + robots geradas`);
} catch (e) {
  console.warn("[seo] falhou (build segue normalmente):", e?.message);
}
process.exit(0);
