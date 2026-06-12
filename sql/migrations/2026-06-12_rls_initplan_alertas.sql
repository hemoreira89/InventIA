-- Advisor auth_rls_initplan (performance): (select auth.uid()) é avaliado
-- 1x por query em vez de 1x por linha. Mantém a semântica original das
-- policies de alertas (somente SELECT; escrita é via service role).
-- (aplicada em produção em 2026-06-12 via Supabase MCP)

drop policy if exists "own alertas_config" on public.alertas_config;
create policy "own alertas_config" on public.alertas_config
  for select using ((select auth.uid()) = user_id);

drop policy if exists "own alertas_enviados" on public.alertas_enviados;
create policy "own alertas_enviados" on public.alertas_enviados
  for select using ((select auth.uid()) = user_id);
