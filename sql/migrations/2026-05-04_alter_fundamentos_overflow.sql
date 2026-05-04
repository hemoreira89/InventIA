-- ─── Migration: alarga colunas numéricas que estouravam ────────────────────
-- Data: 2026-05-04
-- Bug: upsert silenciosamente rejeitava linhas com nav > R$ 99.999.999,99.
-- Sintoma: FIIs grandes (MXRF11, GARE11 etc) tinham linha no banco mas com
-- TODOS os campos numéricos = null. Nada aparecia em "FIIs alto DY".
-- Causa: schema antigo usava NUMERIC(10, 2) pra nav (FII grande passa de
-- R$ 1 bilhão facilmente, ex: MXRF11 = R$ 4.316.720.449,78).
--
-- Esta migration alarga 3 colunas suspeitas:
--   nav         — patrimônio líquido (FIIs grandes na casa dos bilhões)
--   pl          — empresas com lucro tiny podem ter P/L > 100 milhões
--   ev_ebitda   — idem (EBITDA tiny gera múltiplos extremos)
--
-- Decisão: usar NUMERIC sem precisão fixa. Custo de storage é negligenciável
-- e elimina toda uma classe de bugs silenciosos no upsert.

ALTER TABLE screening_fundamentos
  ALTER COLUMN nav        TYPE NUMERIC,
  ALTER COLUMN pl         TYPE NUMERIC,
  ALTER COLUMN ev_ebitda  TYPE NUMERIC;

-- Confirmação: roda esse SELECT depois pra checar
-- SELECT column_name, data_type, numeric_precision FROM information_schema.columns
-- WHERE table_name = 'screening_fundamentos' AND column_name IN ('nav', 'pl', 'ev_ebitda');
-- Esperado: data_type=numeric, numeric_precision=NULL pras 3 colunas.
