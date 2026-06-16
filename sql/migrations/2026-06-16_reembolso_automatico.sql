-- Reembolso automático no cancelamento dentro de 7 dias (arrependimento, CDC).
-- Marca o pagamento como reembolsado e a receita do Painel passa a excluí-lo.
-- (aplicada em produção em 2026-06-16 via Supabase MCP)

alter table public.pagamentos add column if not exists reembolsado_em timestamptz;

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
        ) f), '{}'::jsonb)
  ) into result;

  return result;
end;
$$;
