-- ─── Tabela: universo_usuario ──────────────────────────────────────────
-- Armazena os tickers que cada usuário escolheu para fazer parte
-- do universo de análise da IA. Permite personalização do que será
-- considerado nas recomendações.

CREATE TABLE IF NOT EXISTS public.universo_usuario (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tickers TEXT[] NOT NULL DEFAULT '{}',
  customizado BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilita RLS (Row Level Security)
ALTER TABLE public.universo_usuario ENABLE ROW LEVEL SECURITY;

-- Política: usuário só vê/edita o próprio universo
CREATE POLICY "users_own_universo" ON public.universo_usuario
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Garante permissões para o role authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.universo_usuario TO authenticated;

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_universo_updated_at ON public.universo_usuario;
CREATE TRIGGER set_universo_updated_at
  BEFORE UPDATE ON public.universo_usuario
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
