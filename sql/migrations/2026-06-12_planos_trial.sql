-- Monetização: planos + teste grátis de 7 dias
-- (aplicada em produção em 2026-06-12 via Supabase MCP)
--
-- profiles: 1 linha por usuário, criada automaticamente no signup (trigger).
-- O usuário só LÊ o próprio perfil (RLS). Mudança de plano = service role/SQL:
--
--   -- Ativar assinatura mensal para um usuário:
--   update public.profiles
--      set plano = 'mensal', plano_expira_em = now() + interval '1 month', updated_at = now()
--    where email = 'cliente@email.com';
--
--   -- Ativar assinatura anual:
--   update public.profiles
--      set plano = 'anual', plano_expira_em = now() + interval '1 year', updated_at = now()
--    where email = 'cliente@email.com';
--
--   -- Estender trial de um usuário em mais 7 dias:
--   update public.profiles
--      set trial_fim = now() + interval '7 days', updated_at = now()
--    where email = 'cliente@email.com';

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plano text not null default 'trial' check (plano in ('trial','mensal','anual','vitalicio')),
  trial_fim timestamptz not null default (now() + interval '7 days'),
  plano_expira_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "perfil: select proprio" on public.profiles;
create policy "perfil: select proprio" on public.profiles
  for select using ((select auth.uid()) = user_id);
-- Sem policies de INSERT/UPDATE/DELETE de propósito: cliente não altera plano.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuários existentes (dono + usuário de teste E2E) ganham acesso vitalício
insert into public.profiles (user_id, email, plano)
select id, email, 'vitalicio' from auth.users
on conflict (user_id) do nothing;
