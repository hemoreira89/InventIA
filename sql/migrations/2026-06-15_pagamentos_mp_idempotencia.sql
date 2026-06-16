-- Idempotência do webhook do Mercado Pago: um pagamento (id do MP) só pode ser
-- registrado uma vez. Índice único parcial sobre referencia quando metodo='mercadopago'
-- (pagamentos manuais não são afetados).
-- (aplicada em produção em 2026-06-15 via Supabase MCP)

create unique index if not exists pagamentos_mp_ref_uk
  on public.pagamentos (referencia)
  where metodo = 'mercadopago';
