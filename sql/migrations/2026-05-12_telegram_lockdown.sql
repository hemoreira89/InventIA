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
-- Remove qualquer política permissiva criada anteriormente (nomes encontrados em prod).
DROP POLICY IF EXISTS "open_select"                  ON public.telegram_link_codes;
DROP POLICY IF EXISTS "open_insert"                  ON public.telegram_link_codes;
DROP POLICY IF EXISTS "open_update"                  ON public.telegram_link_codes;
DROP POLICY IF EXISTS "open_delete"                  ON public.telegram_link_codes;
DROP POLICY IF EXISTS "open_all"                     ON public.telegram_link_codes;
DROP POLICY IF EXISTS "anon access"                  ON public.telegram_link_codes;
DROP POLICY IF EXISTS "Public access"                ON public.telegram_link_codes;
DROP POLICY IF EXISTS "Allow anon"                   ON public.telegram_link_codes;
DROP POLICY IF EXISTS "Users can manage own"         ON public.telegram_link_codes;
DROP POLICY IF EXISTS "Bot can mark code used"       ON public.telegram_link_codes;
DROP POLICY IF EXISTS "Public can read link codes"   ON public.telegram_link_codes;
-- Policy do dono fica (defesa em profundidade para qualquer fluxo client-side futuro).
-- Se não existir ainda, cria.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'telegram_link_codes'
      AND policyname = 'Users can manage own link codes'
  ) THEN
    CREATE POLICY "Users can manage own link codes" ON public.telegram_link_codes
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

-- ─── telegram_links ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Bot can insert telegram links"   ON public.telegram_links;
DROP POLICY IF EXISTS "Bot can update telegram links"   ON public.telegram_links;
DROP POLICY IF EXISTS "Public can read telegram links"  ON public.telegram_links;
DROP POLICY IF EXISTS "Users can manage own telegram link" ON public.telegram_links;
CREATE POLICY "Users can manage own telegram link" ON public.telegram_links
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;
