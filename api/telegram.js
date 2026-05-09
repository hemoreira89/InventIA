// Webhook do bot Telegram do InventIA.
// Recebe mensagens, consulta carteira do usuário e responde via Gemini 2.5 Flash.

import { createClient } from "@supabase/supabase-js";

export const config = { maxDuration: 30 };

const SUPABASE_URL = "https://bjghaqtyijvlnwlesrst.supabase.co";
// Anon key é pública (está no bundle do frontend) — usada para leitura das tabelas de vínculo
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZ2hhcXR5aWp2bG53bGVzcnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTQwOTUsImV4cCI6MjA5MzMzMDA5NX0.wugciBsGln_K5kkWi479M6KpFV32e8Vyd51bjkhc2vE";
const CODE_PATTERN = /^INV-[A-Z0-9]{6}$/i;

async function enviarMensagem(chatId, texto, token) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: "Markdown",
        disable_web_page_preview: true
      }),
      signal: AbortSignal.timeout(5000)
    });
  } catch (e) {
    console.error("[TELEGRAM] sendMessage falhou:", e.message);
  }
}

async function buscarCotacoes(tickers, brapiToken) {
  if (!tickers.length || !brapiToken) return {};
  try {
    const res = await fetch(
      `https://brapi.dev/api/quote/${tickers.join(",")}?token=${brapiToken}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return {};
    const data = await res.json();
    const resultado = {};
    for (const r of data.results || []) resultado[r.symbol] = r.regularMarketPrice;
    return resultado;
  } catch {
    return {};
  }
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

async function chamarGemini(apiKey, contextoCarteira, pergunta) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const prompt = `Você é o assistente financeiro do InventIA, especializado em carteiras da B3.

INSTRUÇÕES OBRIGATÓRIAS:
- Responda em português do Brasil
- Seja direto e conciso (máximo 200 palavras)
- Use apenas formatação Markdown do Telegram: *negrito* e _itálico_
- NÃO use ### headers, NÃO use \`\`\` blocos de código, NÃO use --- separadores
- Se a pergunta mencionar um ativo que não está na carteira, responda com conhecimento geral sobre ele

CARTEIRA DO USUÁRIO (${hoje}):
${contextoCarteira}

PERGUNTA: ${pergunta}`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.4 }
        }),
        signal: AbortSignal.timeout(20000)
      }
    );
    if (!res.ok) return "Desculpe, não consegui gerar uma resposta agora. Tente novamente.";
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim()
      || "Não consegui gerar uma resposta. Tente novamente em alguns segundos.";
  } catch (e) {
    console.error("[TELEGRAM] Gemini falhou:", e.message);
    return "Não consegui gerar uma resposta agora. Tente novamente em alguns segundos.";
  }
}

async function handleVinculo(chatId, code, anonDb, adminDb, botToken) {
  // Leitura com anon key + política SELECT aberta (não depende de service_role)
  const { data: links, error } = await anonDb
    .from("telegram_link_codes")
    .select("user_id, expires_at, used")
    .eq("code", code.toUpperCase())
    .limit(1);

  if (error) {
    console.error("[TELEGRAM] Erro ao buscar código:", JSON.stringify(error));
    await enviarMensagem(chatId, "❌ Erro interno ao verificar o código. Tente novamente.", botToken);
    return;
  }

  const link = links?.[0];
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

  // Escrita com service_role (pode falhar se key estiver errada, mas leitura já passou)
  await Promise.all([
    adminDb.from("telegram_link_codes").update({ used: true }).eq("code", code.toUpperCase()),
    adminDb.from("telegram_links").upsert({ user_id: link.user_id, chat_id: chatId }, { onConflict: "user_id" })
  ]);

  await enviarMensagem(
    chatId,
    "✅ *Conta vinculada com sucesso!*\n\n" +
    "Agora é só me perguntar qualquer coisa sobre sua carteira em linguagem natural:\n\n" +
    "• _Como está minha carteira hoje?_\n" +
    "• _Vale a pena comprar mais MXRF11?_\n" +
    "• _Qual meu ativo com melhor desempenho?_\n" +
    "• _Quando vou receber dividendos?_",
    botToken
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE;
  const geminiKey = process.env.GEMINI_API_KEY;
  const brapiToken = process.env.BRAPI_TOKEN;

  if (!botToken || !geminiKey) {
    console.error("[TELEGRAM] TELEGRAM_BOT_TOKEN ou GEMINI_API_KEY ausentes");
    return res.status(200).json({ ok: true });
  }

  // Cliente anon: leitura das tabelas de vínculo (política SELECT aberta)
  const anonDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  // Cliente admin: escrita e leitura de dados da carteira (bypassa RLS)
  const adminDb = supaKey
    ? createClient(SUPABASE_URL, supaKey, { auth: { persistSession: false } })
    : anonDb;

  try {
    const { message } = req.body || {};
    if (!message?.text || !message?.chat?.id) return res.status(200).json({ ok: true });

    const chatId = message.chat.id;
    const texto = message.text.trim();

    // Detecta código de vínculo (INV-XXXXXX)
    if (CODE_PATTERN.test(texto)) {
      await handleVinculo(chatId, texto, anonDb, adminDb, botToken);
      return res.status(200).json({ ok: true });
    }

    // Busca usuário vinculado ao chat_id (anon key + política SELECT aberta)
    const { data: linkData } = await anonDb
      .from("telegram_links")
      .select("user_id")
      .eq("chat_id", chatId)
      .maybeSingle();

    if (!linkData?.user_id) {
      await enviarMensagem(
        chatId,
        "👋 Olá! Para usar o assistente do InventIA, primeiro vincule sua conta.\n\n" +
        "Abra o app, clique no ícone do Telegram no canto superior direito e envie o código que aparecer aqui.",
        botToken
      );
      return res.status(200).json({ ok: true });
    }

    // Carteira e ativos (requer service_role para bypasear RLS)
    const { data: carteiras } = await adminDb
      .from("carteiras")
      .select("id")
      .eq("user_id", linkData.user_id)
      .order("created_at")
      .limit(1);

    let ativos = [];
    if (carteiras?.[0]?.id) {
      const { data } = await adminDb
        .from("ativos")
        .select("ticker, qtd, pm")
        .eq("carteira_id", carteiras[0].id);
      ativos = data || [];
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
