-- Trava de proteção: impede exclusão das contas críticas (dono + E2E/CI).
-- (aplicada em produção em 2026-06-15 via Supabase MCP)
--
-- Um trigger BEFORE DELETE em auth.users aborta a remoção dessas contas — protege
-- contra exclusão acidental (SQL, dashboard, scripts). Para excluir de propósito
-- no futuro, desabilite o trigger antes:
--   alter table auth.users disable trigger protect_critical_users_trg;

create or replace function public.protect_critical_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email in ('hemoreira@outlook.com.br', 'e2e-test@inventia.app') then
    raise exception 'Conta protegida não pode ser excluída: %', old.email
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_critical_users_trg on auth.users;
create trigger protect_critical_users_trg
  before delete on auth.users
  for each row execute function public.protect_critical_users();
