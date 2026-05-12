-- Lockdown das tabelas de vínculo Telegram.
-- Contexto: revisão de segurança identificou que código de vínculo era inserido
-- direto do frontend e que o bot operava com anon key, exigindo políticas
-- permissivas que permitiam a qualquer usuário forjar um vínculo apontando
-- para o user_id de outra pessoa.
-- Correção: backend (/api/telegram-link e /api/telegram) volta a usar
-- service_role, que bypassa RLS. As políticas abaixo travam todo acesso
-- direto via anon/authenticated.
--
-- Aplicar no Supabase SQL Editor.

-- ─── telegram_link_codes ──────────────────────────────────────────────────────
-- Remove qualquer política permissiva criada anteriormente (nomes comuns).
DROP POLICY IF EXISTS "open_select"              ON public.telegram_link_codes;
DROP POLICY IF EXISTS "open_insert"              ON public.telegram_link_codes;
DROP POLICY IF EXISTS "open_update"              ON public.telegram_link_codes;
DROP POLICY IF EXISTS "open_delete"              ON public.telegram_link_codes;
DROP POLICY IF EXISTS "open_all"                 ON public.telegram_link_codes;
DROP POLICY IF EXISTS "anon access"              ON public.telegram_link_codes;
DROP POLICY IF EXISTS "Public access"            ON public.telegram_link_codes;
DROP POLICY IF EXISTS "Allow anon"               ON public.telegram_link_codes;
DROP POLICY IF EXISTS "Users can manage own"     ON public.telegram_link_codes;

-- RLS continua habilitado. Sem políticas → anon/authenticated não conseguem
-- ler/escrever. service_role bypassa RLS por padrão (é assim que o backend opera).
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

-- ─── telegram_links ───────────────────────────────────────────────────────────
-- Recria a política garantindo WITH CHECK (impede UPDATE com user_id alheio).
-- O bot (service_role) bypassa essas regras.
DROP POLICY IF EXISTS "Users can manage own telegram link" ON public.telegram_links;
CREATE POLICY "Users can manage own telegram link" ON public.telegram_links
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;
