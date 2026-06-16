-- CAUSA RAIZ do webhook do MP não ativar planos: o role `service_role` estava
-- SEM privilégios DML (INSERT/UPDATE/SELECT/DELETE) nas tabelas de public
-- (setup atípico do projeto) — toda escrita do /api/mp-webhook dava 403.
-- Concede DML ao service_role e fixa default privileges p/ tabelas futuras.
-- (aplicada em produção em 2026-06-16 via Supabase MCP)

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
