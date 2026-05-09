-- Integração Telegram: vínculo entre conta InventIA e chat do Telegram
-- Aplicar no Supabase SQL Editor

-- Adiciona campo telegram_chat_id na tabela de perfis
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT UNIQUE;

-- Índice para lookup rápido: bot busca usuário pelo chat_id
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id
  ON profiles(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- Tabela de códigos de vínculo temporários (uso único, TTL 10 min)
CREATE TABLE IF NOT EXISTS telegram_link_codes (
  code        TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: usuários não precisam acessar esta tabela pelo frontend
-- O bot usa service_role key que bypassa RLS
ALTER TABLE telegram_link_codes ENABLE ROW LEVEL SECURITY;
