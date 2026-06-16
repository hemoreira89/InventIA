-- Assinatura recorrente do Mercado Pago (preapproval).
-- Guarda o id da assinatura ativa do usuário para permitir cancelamento.
-- (aplicada em produção em 2026-06-16 via Supabase MCP)

alter table public.profiles add column if not exists mp_preapproval_id text;
