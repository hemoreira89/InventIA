// Gera um código de vínculo temporário (INV-XXXXXX) para o usuário autenticado.
// O bot do Telegram detecta esse padrão e vincula o chat_id ao perfil.

import { createClient } from "@supabase/supabase-js";

export const config = { maxDuration: 10 };

const SUPABASE_URL = "https://bjghaqtyijvlnwlesrst.supabase.co";
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I (evita confusão)

function gerarCodigo() {
  let code = "INV-";
  for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const supaKey = process.env.SUPABASE_SERVICE_ROLE;
  if (!supaKey) return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE não configurado" });

  const token = req.headers.authorization?.slice(7);
  if (!token) return res.status(401).json({ error: "Token de autenticação obrigatório" });

  const supabase = createClient(SUPABASE_URL, supaKey, { auth: { persistSession: false } });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Token inválido" });

  try {
    // Remove códigos não-utilizados anteriores do mesmo usuário
    await supabase
      .from("telegram_link_codes")
      .delete()
      .eq("user_id", user.id)
      .eq("used", false);

    const code = gerarCodigo();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from("telegram_link_codes")
      .insert({ code, user_id: user.id, expires_at: expiresAt });

    if (error) throw error;

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "InvestIA_AppBot";
    return res.status(200).json({
      code,
      botUrl: `https://t.me/${botUsername}`,
      expiresAt
    });
  } catch (err) {
    console.error("[TELEGRAM-LINK]", err);
    return res.status(500).json({ error: err.message || "Erro interno" });
  }
}
