-- Performance da tabela pagamentos (advisors):
--  1. RLS initplan: usar (select auth.jwt()) para avaliar uma vez por query.
--  2. Índice na FK user_id.
-- (aplicada em produção em 2026-06-15 via Supabase MCP)

drop policy if exists "pagamentos: dono total" on public.pagamentos;
create policy "pagamentos: dono total" on public.pagamentos
  for all
  using (((select auth.jwt()) ->> 'email') = 'hemoreira@outlook.com.br')
  with check (((select auth.jwt()) ->> 'email') = 'hemoreira@outlook.com.br');

create index if not exists pagamentos_user_id_idx on public.pagamentos (user_id);
