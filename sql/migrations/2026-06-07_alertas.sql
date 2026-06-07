-- Alertas proativos via Telegram (cron-alertas): config de opt-out + dedup de envios.
-- Aplicada em produção via Supabase em 2026-06-07.

create table if not exists public.alertas_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);
alter table public.alertas_config enable row level security;
drop policy if exists "own alertas_config" on public.alertas_config;
create policy "own alertas_config" on public.alertas_config
  for select using (auth.uid() = user_id);

create table if not exists public.alertas_enviados (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  tipo text not null,
  acao text,
  severidade text,
  assinatura text not null,
  motivo text,
  enviado_em timestamptz not null default now()
);
alter table public.alertas_enviados enable row level security;
drop policy if exists "own alertas_enviados" on public.alertas_enviados;
create policy "own alertas_enviados" on public.alertas_enviados
  for select using (auth.uid() = user_id);
create index if not exists idx_alertas_enviados_dedup
  on public.alertas_enviados (user_id, assinatura, enviado_em desc);
