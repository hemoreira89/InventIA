-- Integração Telegram: vínculo entre conta InventIA e chat do Telegram
-- Aplicar no Supabase SQL Editor
-- Versão 2: tabela própria, sem depender da tabela profiles

-- Tabela de vínculo Telegram ↔ usuário InventIA
CREATE TABLE IF NOT EXISTS public.telegram_links (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id    BIGINT      NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: usuário só acessa o próprio vínculo
ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own telegram link" ON public.telegram_links
  FOR ALL USING (auth.uid() = user_id);

-- Índice para lookup rápido do bot (chat_id → user_id)
CREATE INDEX IF NOT EXISTS idx_telegram_links_chat_id ON public.telegram_links(chat_id);

-- Tabela de códigos de vínculo temporários (uso único, TTL 10 min)
CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  code        TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: service_role bypassa (bot usa service key)
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;
