// Webhook do bot Telegram do InventIA.
// Usa REST API do Supabase diretamente (sem SDK) para evitar problemas de configuração.

export const config = { maxDuration: 30 };

const SUPABASE_URL = "https://bjghaqtyijvlnwlesrst.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZ2hhcXR5aWp2bG53bGVzcnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTQwOTUsImV4cCI6MjA5MzMzMDA5NX0.wugciBsGln_K5kkWi479M6KpFV32e8Vyd51bjkhc2vE";
const CODE_PATTERN = /^INV-[A-Z0-9]{6}$/i;

// ─── Supabase REST helpers ────────────────────────────────────────────────────

function supaHeaders(key) {
  return {
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function supaGet(table, query, key) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?${query}`,
      { headers: supaHeaders(key), signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[TELEGRAM] GET ${table} HTTP ${res.status}:`, body.slice(0, 200));
      return null;
    }
    const data = await res.json();
    return Array.isArray(data) ? data[0] ?? null : data;
  } catch (e) {
    console.error(`[TELEGRAM] GET ${table} falhou:`, e.message);
    return null;
  }
}

async function supaList(table, query, key) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?${query}`,
      { headers: supaHeaders(key), signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error(`[TELEGRAM] LIST ${table} falhou:`, e.message);
    return [];
  }
}

async function supaPatch(table, query, body, key) {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?${query}`,
      { method: "PATCH", headers: { ...supaHeaders(key), "Prefer": "return=minimal" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) }
    );
  } catch (e) {
    console.error(`[TELEGRAM] PATCH ${table} falhou:`, e.message);
  }
}

async function supaUpsert(table, body, onConflict, key) {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/${table}`,
      { method: "POST", headers: { ...supaHeaders(key), "Prefer": `resolution=merge-duplicates,return=minimal` }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) }
    );
  } catch (e) {
    console.error(`[TELEGRAM] UPSERT ${table} falhou:`, e.message);
  }
}

// ─── Telegram helper ──────────────────────────────────────────────────────────

async function enviarMensagem(chatId, texto, token) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: "Markdown", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000)
    });
  } catch (e) {
    console.error("[TELEGRAM] sendMessage falhou:", e.message);
  }
}

// ─── Domínio ──────────────────────────────────────────────────────────────────

async function buscarCotacoes(tickers, brapiToken) {
  if (!tickers.length || !brapiToken) return {};
  // Plano free da brapi: 1 ticker por request — paraleliza as chamadas
  const promessas = tickers.map(async (t) => {
    try {
      const res = await fetch(`https://brapi.dev/api/quote/${t}?token=${brapiToken}`, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return null;
      const data = await res.json();
      const item = data.results?.[0];
      return item ? { symbol: item.symbol, preco: item.regularMarketPrice } : null;
    } catch { return null; }
  });
  const respostas = await Promise.all(promessas);
  const r = {};
  for (const item of respostas) if (item?.preco != null) r[item.symbol] = item.preco;
  return r;
}

function construirContexto(ativos, cotacoes) {
  if (!ativos?.length) return "Carteira vazia — nenhum ativo cadastrado.";
  let total = 0;
  const posicoes = ativos.map(a => {
    const preco = cotacoes[a.ticker] ?? a.pm ?? 0;
    const valor = preco * (a.qtd || 0);
    total += valor;
    const varPM = a.pm && preco ? ((preco / a.pm - 1) * 100).toFixed(1) : null;
    return { ...a, preco, valor, varPM };
  }).sort((a, b) => b.valor - a.valor);
  const fmt = v => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const linhas = posicoes.map(p => {
    const pct = total > 0 ? (p.valor / total * 100).toFixed(1) : "0";
    const var_ = p.varPM !== null ? ` | var PM: ${p.varPM}%` : "";
    return `${p.ticker}: ${p.qtd} un | PM R$${p.pm ? fmt(p.pm) : "?"} | Atual R$${fmt(p.preco)} | ${pct}%${var_}`;
  });
  return `Patrimônio total: R$ ${fmt(total)}\nAtivos: ${ativos.length}\n\nPosições:\n${linhas.join("\n")}`;
}

async function chamarGemini(apiKey, contexto, pergunta) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const prompt = `Você é o assistente financeiro do InventIA, especializado em carteiras da B3.

INSTRUÇÕES: responda em português, de forma concisa (máx 200 palavras). Use apenas *negrito* e _itálico_ do Telegram. NÃO use ### headers nem blocos de código.

CARTEIRA (${hoje}):
${contexto}

PERGUNTA: ${pergunta}`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.4,
            thinkingConfig: { thinkingBudget: 0 } // desabilita raciocínio interno (consome tokens do output)
          }
        }),
        signal: AbortSignal.timeout(20000)
      }
    );
    if (!res.ok) return "Não consegui gerar uma resposta agora. Tente novamente.";
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim() || "Não consegui gerar uma resposta. Tente novamente.";
  } catch (e) {
    console.error("[TELEGRAM] Gemini falhou:", e.message);
    return "Não consegui gerar uma resposta agora. Tente novamente.";
  }
}

async function handleVinculo(chatId, code, serviceKey, botToken) {
  // Usa service_role direto no header REST — bypassa RLS sem depender do SDK
  const key = serviceKey || SUPABASE_ANON_KEY;
  const link = await supaGet(
    "telegram_link_codes",
    `code=eq.${encodeURIComponent(code.toUpperCase())}&select=user_id,expires_at,used&limit=1`,
    key
  );

  if (!link) {
    await enviarMensagem(chatId, "❌ Código inválido. Gere um novo código no app InventIA.", botToken);
    return;
  }
  if (link.used) {
    await enviarMensagem(chatId, "❌ Este código já foi utilizado. Gere um novo código no app.", botToken);
    return;
  }
  if (new Date(link.expires_at) < new Date()) {
    await enviarMensagem(chatId, "❌ Código expirado. Gere um novo código no app InventIA.", botToken);
    return;
  }

  await Promise.all([
    supaPatch("telegram_link_codes", `code=eq.${encodeURIComponent(code.toUpperCase())}`, { used: true }, key),
    supaUpsert("telegram_links", { user_id: link.user_id, chat_id: chatId }, "user_id", key)
  ]);

  await enviarMensagem(
    chatId,
    "✅ *Conta vinculada com sucesso!*\n\n" +
    "Agora é só me perguntar qualquer coisa sobre sua carteira:\n\n" +
    "• _Como está minha carteira hoje?_\n" +
    "• _Vale a pena comprar mais MXRF11?_\n" +
    "• _Qual meu ativo com melhor desempenho?_",
    botToken
  );
}

// ─── Handler principal ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
  const geminiKey = process.env.GEMINI_API_KEY;
  const brapiToken = process.env.BRAPI_TOKEN;

  if (!botToken || !geminiKey) {
    console.error("[TELEGRAM] Variáveis obrigatórias ausentes");
    return res.status(200).json({ ok: true });
  }

  // Para tabelas de vínculo Telegram, usa sempre anon key + políticas abertas.
  // service_role só é usado para carteiras/ativos (bypassa RLS de outros usuários).
  const dbKey = SUPABASE_ANON_KEY;

  try {
    const { message } = req.body || {};
    if (!message?.text || !message?.chat?.id) return res.status(200).json({ ok: true });

    const chatId = message.chat.id;
    const texto = message.text.trim();

    if (CODE_PATTERN.test(texto)) {
      await handleVinculo(chatId, texto, dbKey, botToken);
      return res.status(200).json({ ok: true });
    }

    // Busca usuário pelo chat_id
    const linkData = await supaGet("telegram_links", `chat_id=eq.${chatId}&select=user_id&limit=1`, dbKey);

    if (!linkData?.user_id) {
      await enviarMensagem(
        chatId,
        "👋 Olá! Para usar o assistente do InventIA, primeiro vincule sua conta.\n\nAbra o app, clique no ícone do Telegram no canto superior direito e envie o código que aparecer aqui.",
        botToken
      );
      return res.status(200).json({ ok: true });
    }

    // Carteira e ativos (service_role necessário para bypasear RLS de outros usuários)
    // Carteiras e ativos precisam de service_role para bypasear RLS de outros usuários
    const adminKey = serviceKey || SUPABASE_ANON_KEY;
    const carteira = await supaGet("carteiras", `user_id=eq.${linkData.user_id}&select=id&order=created_at&limit=1`, adminKey);
    let ativos = [];
    if (carteira?.id) {
      ativos = await supaList("ativos", `carteira_id=eq.${carteira.id}&select=ticker,qtd,pm`, adminKey);
    }

    const cotacoes = await buscarCotacoes(ativos.map(a => a.ticker), brapiToken);
    const contexto = construirContexto(ativos, cotacoes);
    const resposta = await chamarGemini(geminiKey, contexto, texto);

    await enviarMensagem(chatId, resposta, botToken);
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("[TELEGRAM] Erro não tratado:", err);
    return res.status(200).json({ ok: true });
  }
}
