-- ─── Tabela: screening_catalogo ─────────────────────────────────────────────
-- Catálogo de tickers da B3 atualizado diariamente via cron.
-- Permite Tab Oportunidades filtrar entre os ~750 ativos sem depender da IA
-- chutar tickers de cabeça.
--
-- Atualização: 1x/dia via /api/cron-screening (Vercel Cron, 6h UTC).
-- Última atualização: 2026-05-03

CREATE TABLE IF NOT EXISTS screening_catalogo (
  ticker         TEXT PRIMARY KEY,
  nome           TEXT,
  setor          TEXT,
  tipo           TEXT NOT NULL CHECK (tipo IN ('stock', 'fund', 'bdr', 'etf')),
  preco          NUMERIC(12, 2),
  market_cap     BIGINT,
  volume         BIGINT,
  variacao_pct   NUMERIC(8, 4),
  atualizado_em  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para queries comuns da Tab Oportunidades
CREATE INDEX IF NOT EXISTS idx_screening_tipo       ON screening_catalogo(tipo);
CREATE INDEX IF NOT EXISTS idx_screening_setor      ON screening_catalogo(setor);
CREATE INDEX IF NOT EXISTS idx_screening_volume     ON screening_catalogo(volume DESC);
CREATE INDEX IF NOT EXISTS idx_screening_market_cap ON screening_catalogo(market_cap DESC);

-- ─── Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE screening_catalogo ENABLE ROW LEVEL SECURITY;

-- Leitura pública: catálogo é dado público da B3, qualquer um (mesmo deslogado)
-- pode consultar
DROP POLICY IF EXISTS "Catalogo público para leitura" ON screening_catalogo;
CREATE POLICY "Catalogo público para leitura"
  ON screening_catalogo
  FOR SELECT
  USING (true);

-- Escrita: apenas via service_role (server-side com chave secreta).
-- O cron usa CRON_SECRET no header e o endpoint usa supabase com anon key
-- mas como RLS bloqueia escrita pública, na prática só o service_role escreve.
-- Para escrever via anon, precisaríamos de policy permissiva (não recomendado).
-- Usaremos service_role no endpoint cron.

-- ─── Tabela auxiliar: log de atualizações ───────────────────────────────────
CREATE TABLE IF NOT EXISTS screening_catalogo_log (
  id            BIGSERIAL PRIMARY KEY,
  executado_em  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tickers_total INTEGER NOT NULL,
  acoes_total   INTEGER NOT NULL,
  fiis_total    INTEGER NOT NULL,
  duracao_ms    INTEGER,
  erro          TEXT
);

ALTER TABLE screening_catalogo_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Log público para leitura" ON screening_catalogo_log;
CREATE POLICY "Log público para leitura"
  ON screening_catalogo_log
  FOR SELECT
  USING (true);

-- ─── Permissões explícitas ──────────────────────────────────────────────────
-- service_role precisa de GRANT pra ler/escrever (mesmo bypassando RLS).
-- anon/authenticated só leem (RLS já restringe escrita por padrão).

GRANT SELECT, INSERT, UPDATE, DELETE ON screening_catalogo TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON screening_catalogo_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE screening_catalogo_log_id_seq TO service_role;

GRANT SELECT ON screening_catalogo TO anon, authenticated;
GRANT SELECT ON screening_catalogo_log TO anon, authenticated;
