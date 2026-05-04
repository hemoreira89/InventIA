-- ─── Migration: adiciona colunas de qualidade ao screening_fundamentos ────
-- Data: 2026-05-04
-- Razão: bolsai já retorna esses 3 campos no /fundamentals/{ticker}, mas
-- o cron os ignorava. São indicadores de qualidade que abrem novos filtros:
--
--   market_cap      Capitalização de mercado (R$). Pra filtros tipo
--                   "Blue chip de verdade" (cap > 10 bi) em vez de
--                   heurísticas como "P/L < 15".
--
--   roa             Return on Assets. Mostra eficiência de uso dos
--                   ativos (vs ROE que mistura com alavancagem).
--                   Empresas com ROA alto não precisam alavancar pra
--                   gerar retorno = qualidade real.
--
--   debt_equity     Dívida bruta sobre patrimônio líquido. Complementa
--                   div_ebitda dando outra visão de alavancagem.
--                   Útil pra setores onde EBITDA é volátil (commodities).
--
-- Custo: zero reqs extras na bolsai (já vinham, eram descartados).
-- Storage: ~24 bytes adicionais por linha × 504 linhas = ~12KB. Desprezível.

ALTER TABLE screening_fundamentos
  ADD COLUMN IF NOT EXISTS market_cap   NUMERIC,         -- bilhões cabem (sem precision)
  ADD COLUMN IF NOT EXISTS roa          NUMERIC(8, 2),   -- % padrão (igual roe)
  ADD COLUMN IF NOT EXISTS debt_equity  NUMERIC(8, 2);   -- % padrão

-- Índice opcional pra filtros futuros por market_cap
CREATE INDEX IF NOT EXISTS idx_fundamentos_market_cap
  ON screening_fundamentos(market_cap)
  WHERE market_cap IS NOT NULL AND market_cap > 0;

-- Confirmação:
-- SELECT column_name, data_type, numeric_precision
-- FROM information_schema.columns
-- WHERE table_name = 'screening_fundamentos'
--   AND column_name IN ('market_cap', 'roa', 'debt_equity');
