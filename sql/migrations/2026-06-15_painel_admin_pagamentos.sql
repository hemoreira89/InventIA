-- Painel estratégico (somente o dono) + cadastro com nome/nascimento + controle de receita
-- (aplicada em produção em 2026-06-15 via Supabase MCP)
--
-- Conteúdo:
--   1. profiles: colunas nome + data_nascimento (preenchidas no signup)
--   2. trigger handle_new_user lê esses campos do metadata do auth
--   3. tabela pagamentos (caixa real — controle do teto de R$5k do CPF), RLS só dono
--   4. função admin_metrics() (security definer, guardada pelo e-mail do dono)

-- ─── 1. Novos campos de cadastro ────────────────────────────────────────────
alter table public.profiles add column if not exists nome text;
alter table public.profiles add column if not exists data_nascimento date;

-- ─── 2. Trigger captura nome + nascimento do metadata do signup ──────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, nome, data_nascimento)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'nome', ''),
    nullif(new.raw_user_meta_data ->> 'data_nascimento', '')::date
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ─── 3. Tabela de pagamentos (caixa real recebido) ──────────────────────────
-- user_id com ON DELETE SET NULL: preserva o histórico de receita mesmo que o
-- usuário seja excluído. RLS libera tudo apenas para o dono.
create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  plano text check (plano in ('mensal','anual','vitalicio','outro')),
  valor numeric(10,2) not null check (valor >= 0),
  metodo text,        -- pix | cartao | boleto | outro
  referencia text,    -- nota livre (ex: id da transação)
  pago_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.pagamentos enable row level security;

drop policy if exists "pagamentos: dono total" on public.pagamentos;
create policy "pagamentos: dono total" on public.pagamentos
  for all
  using ((select coalesce(auth.jwt() ->> 'email','')) = 'hemoreira89@gmail.com')
  with check ((select coalesce(auth.jwt() ->> 'email','')) = 'hemoreira89@gmail.com');

create index if not exists pagamentos_pago_em_idx on public.pagamentos (pago_em);

-- ─── 4. Métricas estratégicas (somente o dono) ──────────────────────────────
-- security definer: lê auth.users + profiles + pagamentos ignorando RLS, mas o
-- primeiro passo BLOQUEIA quem não for o dono (checa o e-mail do JWT).
create or replace function public.admin_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_email constant text := 'hemoreira89@gmail.com';
  mes_inicio timestamptz := date_trunc('month', now());
  result jsonb;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> owner_email then
    raise exception 'forbidden';
  end if;

  select jsonb_build_object(
    'usuarios_total',   (select count(*) from auth.users),
    'ativos_30d',       (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'inativos_30d',     (select count(*) from auth.users where last_sign_in_at is null or last_sign_in_at <= now() - interval '30 days'),
    'novos_30d',        (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'por_plano',        coalesce((select jsonb_object_agg(plano, n) from (select plano, count(*) n from public.profiles group by plano) s), '{}'::jsonb),
    'trial_ativos',     (select count(*) from public.profiles where plano='trial' and trial_fim > now()),
    'trial_expirados',  (select count(*) from public.profiles where plano='trial' and trial_fim <= now()),
    'pagantes_ativos',  (select count(*) from public.profiles where plano in ('mensal','anual') and (plano_expira_em is null or plano_expira_em > now())),
    'mrr_estimado',     (select coalesce(sum(case when plano='mensal' then 24.90 when plano='anual' then 199.0/12 else 0 end),0)
                          from public.profiles where plano in ('mensal','anual') and (plano_expira_em is null or plano_expira_em > now())),
    'receita_mes',      (select coalesce(sum(valor),0) from public.pagamentos where pago_em >= mes_inicio),
    'receita_12m',      (select coalesce(sum(valor),0) from public.pagamentos where pago_em >= now() - interval '12 months'),
    'pagamentos_mes',   (select count(*) from public.pagamentos where pago_em >= mes_inicio),
    'teto_cpf',         5000,
    'faixas_etarias',   coalesce((
        select jsonb_object_agg(faixa, n) from (
          select case
            when idade is null then 'nao_informado'
            when idade < 25 then '<25'
            when idade < 35 then '25-34'
            when idade < 45 then '35-44'
            when idade < 55 then '45-54'
            else '55+'
          end as faixa, count(*) n
          from (select extract(year from age(data_nascimento))::int idade from public.profiles) a
          group by 1
        ) f), '{}'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_metrics() to authenticated;
-- Reduz a superfície: anon não precisa alcançar a função (o guard por e-mail já
-- bloqueia não-donos, mas anon nem deve poder chamá-la).
revoke execute on function public.admin_metrics() from public, anon;
