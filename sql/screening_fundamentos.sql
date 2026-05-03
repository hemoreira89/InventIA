-- ─── Tabela: screening_fundamentos ───────────────────────────────────────────
-- Cache pre-populado de fundamentos da bolsai pra todos os ativos da B3.
-- Atualização: 1x/dia via cron-screening (após popular screening_catalogo).
--
-- Permite a Tab Oportunidades fazer screening sobre o universo COMPLETO
-- (1400+ ativos) sem fazer chamadas em runtime à bolsai. Tudo vem do
-- Supabase em uma query só.

CREATE TABLE IF NOT EXISTS screening_fundamentos (
  ticker              TEXT PRIMARY KEY,
  tipo                TEXT NOT NULL CHECK (tipo IN ('FII', 'Ação', 'BDR', 'ETF', 'Outro')),
  nome                TEXT,
  setor_cvm           TEXT,

  -- Indicadores de ações (FIIs deixam null)
  pl                  NUMERIC(10, 2),
  pvp                 NUMERIC(10, 4),
  roe                 NUMERIC(8, 2),
  roic                NUMERIC(8, 2),
  margem_liquida      NUMERIC(8, 2),
  div_ebitda          NUMERIC(8, 2),
  cagr_lucro_5y       NUMERIC(8, 2),
  cagr_receita_5y     NUMERIC(8, 2),
  ev_ebitda           NUMERIC(8, 2),
  vpa                 NUMERIC(10, 4),
  lpa                 NUMERIC(10, 4),

  -- Indicadores de FIIs
  dy                  NUMERIC(6, 2),
  nav                 NUMERIC(10, 2),
  segmento            TEXT,

  -- Metadados qualitativos
  lucros_consistentes BOOLEAN,

  -- Auditoria
  atualizado_em       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fonte               TEXT DEFAULT 'bolsai'  -- pra evolução futura (mais fontes)
);

-- Índices pra screening rápido
CREATE INDEX IF NOT EXISTS idx_fundamentos_tipo  ON screening_fundamentos(tipo);
CREATE INDEX IF NOT EXISTS idx_fundamentos_pl    ON screening_fundamentos(pl) WHERE pl IS NOT NULL AND pl > 0;
CREATE INDEX IF NOT EXISTS idx_fundamentos_pvp   ON screening_fundamentos(pvp) WHERE pvp IS NOT NULL AND pvp > 0;
CREATE INDEX IF NOT EXISTS idx_fundamentos_dy    ON screening_fundamentos(dy) WHERE dy IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fundamentos_roe   ON screening_fundamentos(roe) WHERE roe IS NOT NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE screening_fundamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fundamentos públicos para leitura" ON screening_fundamentos;
CREATE POLICY "Fundamentos públicos para leitura"
  ON screening_fundamentos
  FOR SELECT
  USING (true);

-- service_role precisa de GRANTs explícitos (mesmo bypassando RLS, em
-- versões recentes do Supabase é necessário)
GRANT SELECT, INSERT, UPDATE, DELETE ON screening_fundamentos TO service_role;
GRANT SELECT ON screening_fundamentos TO anon, authenticated;

-- ─── Adiciona coluna no log pra rastrear fundamentos também ─────────────────
ALTER TABLE screening_catalogo_log
  ADD COLUMN IF NOT EXISTS fundamentos_total INTEGER,
  ADD COLUMN IF NOT EXISTS fundamentos_falhas INTEGER;
