-- Atribuição de marketing (tráfego pago): origem do cadastro + dedup do CAPI.
-- (aplicada em produção em 2026-06-16 via Supabase MCP)
--
-- 1) Colunas de atribuição em profiles (first-touch, vindas do signup).
-- 2) checkout_event_id: id do evento de compra gerado no client, guardado na
--    criação do checkout, pra o webhook mandar o Purchase do CAPI com o MESMO
--    id e o Meta deduplicar contra o Purchase do Pixel do navegador.
-- 3) Trigger grava as UTM no profile.
-- 4) admin_metrics ganha `origens` (cadastros e pagantes por utm_source).

alter table public.profiles
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists checkout_event_id text;

-- Trigger: nome + nascimento (já existentes) + UTM first-touch do metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    user_id, email, nome, data_nascimento,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term
  )
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'nome', ''),
    case
      when (new.raw_user_meta_data ->> 'data_nascimento') ~ '^\d{4}-\d{2}-\d{2}$'
        then (new.raw_user_meta_data ->> 'data_nascimento')::date
      else null
    end,
    nullif(new.raw_user_meta_data ->> 'utm_source', ''),
    nullif(new.raw_user_meta_data ->> 'utm_medium', ''),
    nullif(new.raw_user_meta_data ->> 'utm_campaign', ''),
    nullif(new.raw_user_meta_data ->> 'utm_content', ''),
    nullif(new.raw_user_meta_data ->> 'utm_term', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- admin_metrics: idem versão do reembolso + chave `origens` (CAC por origem).
create or replace function public.admin_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_email constant text := 'hemoreira@outlook.com.br';
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
    'receita_mes',      (select coalesce(sum(valor),0) from public.pagamentos where pago_em >= mes_inicio and reembolsado_em is null),
    'receita_12m',      (select coalesce(sum(valor),0) from public.pagamentos where pago_em >= now() - interval '12 months' and reembolsado_em is null),
    'pagamentos_mes',   (select count(*) from public.pagamentos where pago_em >= mes_inicio and reembolsado_em is null),
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
        ) f), '{}'::jsonb),
    'origens',          coalesce((
        select jsonb_agg(row_to_json(o) order by o.cadastros desc) from (
          select
            coalesce(nullif(utm_source,''), '(direto)') as source,
            count(*) as cadastros,
            count(*) filter (where plano in ('mensal','anual')) as pagantes
          from public.profiles
          group by 1
        ) o), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;
