// ─── /api/cron-alertas — Radar de eventos fortes → alertas no Telegram ────────
// Roda algumas vezes ao dia (via GitHub Actions, dias úteis em horário de pregão).
// Para cada usuário com Telegram vinculado e alertas ativos:
//   1. lê carteira + watchlist + cotações (com variação do dia)
//   2. pede ao Gemini (com Google Search) os EVENTOS FORTES e acionáveis
//   3. filtra severidade "alta", deduplica (não repete a mesma notícia)
//   4. envia um resumo no Telegram e registra o que enviou
//
// "Só evento forte": nada de spam — se não há nada relevante, não manda nada.
//
// ENV: TELEGRAM_BOT_TOKEN, SUPABASE_SERVICE_ROLE, GEMINI_API_KEY, BRAPI_TOKEN, CRON_SECRET
// Auth: Authorization: Bearer {CRON_SECRET}

export const config = { maxDuration: 60 };

const SUPABASE_URL = "https://bjghaqtyijvlnwlesrst.supabase.co";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const GEMINI_TIMEOUT_MS = 35000; // Google Search é lento; precisa caber no teto de 60s da função
const MAX_USUARIOS = 25;       // teto defensivo por execução
const DEDUP_HORAS = 72;        // não repetir a mesma notícia por 3 dias

// ─── Supabase REST ────────────────────────────────────────────────────────────
function supaHeaders(key) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
async function supaList(table, query, key) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: supaHeaders(key), signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d) ? d : [];
  } catch (e) { console.error(`[ALERTAS] LIST ${table}:`, e.message); return []; }
}
async function supaGet(table, query, key) {
  const d = await supaList(table, query, key);
  return d[0] ?? null;
}
async function supaInsert(table, rows, key) {
  if (!rows.length) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...supaHeaders(key), Prefer: "return=minimal" },
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) { console.error(`[ALERTAS] INSERT ${table}:`, e.message); }
}

// ─── Telegram ──────────────────────────────────────────────────────────────────
async function enviarMensagem(chatId, texto, token) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: "Markdown", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) { console.error("[ALERTAS] sendMessage:", e.message); }
}

// ─── Cotações (preço + variação do dia) ─────────────────────────────────────────
async function buscarCotacoes(tickers, brapiToken) {
  if (!tickers.length || !brapiToken) return {};
  const proms = tickers.map(async (t) => {
    try {
      const r = await fetch(`https://brapi.dev/api/quote/${t}?token=${brapiToken}`, { signal: AbortSignal.timeout(6000) });
      if (!r.ok) return null;
      const d = await r.json();
      const i = d.results?.[0];
      return i ? { symbol: i.symbol, preco: i.regularMarketPrice, varPct: i.regularMarketChangePercent } : null;
    } catch { return null; }
  });
  const out = {};
  for (const it of await Promise.all(proms)) if (it?.preco != null) out[it.symbol] = it;
  return out;
}

// ─── Gemini com Google Search (cascata) ─────────────────────────────────────────
async function chamarGeminiSearch(apiKey, prompt) {
  // Uma única tentativa com Search: a busca demora ~20-35s e a função tem teto
  // de 60s. Sem cascata (2x30s estourava). Se falhar, o próximo run agendado tenta.
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { maxOutputTokens: 4096, temperature: 0.3, responseMimeType: "text/plain" },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
    if (!r.ok) { console.warn(`[ALERTAS] ${GEMINI_MODEL} HTTP ${r.status}`); return null; }
    const d = await r.json();
    return d.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim() || null;
  } catch (e) {
    console.error(`[ALERTAS] ${GEMINI_MODEL}:`, e.message);
    return null;
  }
}

function extrairJSONArray(texto) {
  const limpo = texto.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  const m = limpo.match(/\[[\s\S]*\]/);
  if (!m) return [];
  for (const cand of [m[0], m[0].replace(/,\s*([}\]])/g, "$1")]) {
    try { const v = JSON.parse(cand); if (Array.isArray(v)) return v; } catch { /* tenta o próximo */ }
  }
  return [];
}

// ─── Prompt + mensagem ──────────────────────────────────────────────────────────
const fmt = v => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function montarPrompt(ativos, watch, cot, hoje) {
  const linhaCart = ativos.map(a => {
    const c = cot[a.ticker];
    const atual = c ? `R$${fmt(c.preco)}` : "?";
    const v = c?.varPct != null ? ` (${c.varPct > 0 ? "+" : ""}${c.varPct.toFixed(1)}% dia)` : "";
    return `${a.ticker}: ${a.qtd} un | PM R$${a.pm ? fmt(a.pm) : "?"} | atual ${atual}${v}`;
  }).join("\n") || "(carteira vazia)";

  const linhaWatch = watch.map(w => {
    const c = cot[w.ticker];
    const atual = c ? `R$${fmt(c.preco)}` : "?";
    const v = c?.varPct != null ? ` (${c.varPct > 0 ? "+" : ""}${c.varPct.toFixed(1)}% dia)` : "";
    return `${w.ticker}: referência R$${w.preco_alvo ? fmt(w.preco_alvo) : "?"} | atual ${atual}${v}`;
  }).join("\n") || "(watchlist vazia)";

  return `Hoje é ${hoje}. Você é o RADAR INFORMATIVO do Cauril, focado na B3.
Você NÃO faz recomendação de compra ou venda. Seu papel é apenas RELATAR FATOS RELEVANTES e EVENTOS, com a fonte, para o usuário ficar informado — a decisão é sempre dele.
Use o Google Search para checar NOTÍCIAS e FATOS RELEVANTES das últimas 48h sobre os ativos abaixo.

Reporte SOMENTE eventos FORTES (alta relevância). Ignore ruído, variações normais e notícias genéricas de mercado. NÃO diga para comprar nem vender — apenas relate o fato.

CARTEIRA (posições atuais):
${linhaCart}

WATCHLIST (ativos monitorados — com preço de referência do usuário):
${linhaWatch}

Gatilhos válidos:
- Notícia/fato relevante forte: resultado surpreendente, mudança de guidance, M&A, evento regulatório, problema sério.
- Movimento de preço forte: queda/alta brusca no dia (≈ ≥4%) com motivo identificável.
- Provento relevante: anúncio de dividendo/JCP, data-com próxima.
- Watchlist: se o preço atual chegou ao patamar de referência do usuário → relate como FATO (sem dizer para comprar).

Responda APENAS um array JSON (nada de texto fora dele). Cada item:
{"ticker":"XXXX","tipo":"noticia|preco|provento","categoria":"fato_relevante|evento|atencao","severidade":"alta|media|baixa","motivo":"1-2 frases com o fato concreto e a data, de forma neutra e informativa","fonte":"veículo curto"}

Inclua SOMENTE itens com severidade "alta". Se não houver nada forte, responda exatamente: []`;
}

function rotuloCategoria(categoria, tipo) {
  const c = (categoria || tipo || "").toLowerCase();
  if (c === "provento") return ["💰", "PROVENTO"];
  if (c === "fato_relevante" || c === "noticia") return ["📣", "FATO RELEVANTE"];
  if (c === "evento" || c === "preco") return ["📊", "EVENTO"];
  return ["ℹ️", "ATENÇÃO"];
}

function montarMensagem(alertas, hoje) {
  const blocos = alertas.map(a => {
    const [emoji, rotulo] = rotuloCategoria(a.categoria, a.tipo);
    const fonte = a.fonte ? `\n_fonte: ${a.fonte}_` : "";
    return `${emoji} *${rotulo} · ${a.ticker}*\n${a.motivo}${fonte}`;
  });
  return `⚡ *Radar Cauril* — ${hoje}\n\n${blocos.join("\n\n")}\n\n_Conteúdo informativo e educacional. NÃO é recomendação de investimento. As decisões são suas._\n_Silenciar: /alertas off_`;
}

const slug = s => (s || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "").slice(0, 50);

// ─── Handler ────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: "unauthorized" });

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
  const geminiKey = process.env.GEMINI_API_KEY;
  const brapiToken = process.env.BRAPI_TOKEN;
  if (!botToken || !serviceKey || !geminiKey) return res.status(500).json({ error: "env ausente" });

  const inicio = Date.now();
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const links = (await supaList("telegram_links", "select=user_id,chat_id", serviceKey)).slice(0, MAX_USUARIOS);

  let usuarios = 0, enviados = 0;
  for (const link of links) {
    if (Date.now() - inicio > 50000) { console.warn("[ALERTAS] orçamento de tempo esgotado; restantes ficam para o próximo run"); break; }
    try {
      const cfg = await supaGet("alertas_config", `user_id=eq.${link.user_id}&select=ativo&limit=1`, serviceKey);
      if (cfg && cfg.ativo === false) continue;
      usuarios++;

      const carteira = await supaGet("carteiras", `user_id=eq.${link.user_id}&select=id&order=created_at&limit=1`, serviceKey);
      const ativos = carteira?.id ? await supaList("ativos", `carteira_id=eq.${carteira.id}&select=ticker,qtd,pm`, serviceKey) : [];
      const watch = (await supaList("watchlist", `user_id=eq.${link.user_id}&select=ticker,preco_alvo,notificar`, serviceKey)).filter(w => w.notificar !== false);
      if (!ativos.length && !watch.length) continue;

      const tickers = [...new Set([...ativos.map(a => a.ticker), ...watch.map(w => w.ticker)])];
      const cot = await buscarCotacoes(tickers, brapiToken);

      const texto = await chamarGeminiSearch(geminiKey, montarPrompt(ativos, watch, cot, hoje));
      if (!texto) continue;

      let alertas = extrairJSONArray(texto)
        .filter(a => a && a.ticker && a.motivo && (a.severidade || "").toLowerCase() === "alta");
      if (!alertas.length) continue;

      // Dedup: não repetir a mesma notícia nas últimas DEDUP_HORAS
      const desde = encodeURIComponent(new Date(Date.now() - DEDUP_HORAS * 3600 * 1000).toISOString());
      const recentes = await supaList("alertas_enviados", `user_id=eq.${link.user_id}&enviado_em=gte.${desde}&select=assinatura`, serviceKey);
      const jaEnviadas = new Set(recentes.map(r => r.assinatura));

      const novos = [];
      for (const a of alertas) {
        const assinatura = `${a.ticker}|${(a.tipo || "").toLowerCase()}|${slug(a.motivo)}`;
        if (jaEnviadas.has(assinatura)) continue;
        jaEnviadas.add(assinatura);
        novos.push({ ...a, __assinatura: assinatura });
      }
      if (!novos.length) continue;

      await enviarMensagem(link.chat_id, montarMensagem(novos, hoje), botToken);
      await supaInsert("alertas_enviados", novos.map(a => ({
        user_id: link.user_id,
        ticker: a.ticker,
        tipo: (a.tipo || "").toLowerCase(),
        // Coluna "acao" existente reaproveitada para guardar a categoria informativa
        // (fato_relevante|evento|atencao) — sem semântica de comprar/vender.
        acao: (a.categoria || "").toLowerCase(),
        severidade: "alta",
        assinatura: a.__assinatura,
        motivo: (a.motivo || "").slice(0, 500),
      })), serviceKey);
      enviados += novos.length;
    } catch (e) {
      console.error(`[ALERTAS] usuário ${link.user_id}:`, e.message);
    }
  }

  console.log(`[ALERTAS] concluído: ${usuarios} usuário(s), ${enviados} alerta(s) enviado(s)`);
  return res.status(200).json({ ok: true, usuarios, enviados });
}
