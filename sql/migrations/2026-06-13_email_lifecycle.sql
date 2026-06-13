-- Dedup do ciclo de emails de trial: garante que cada ETAPA é enviada no
-- máximo 1x por usuário. Apenas o service role (cron) acessa — RLS sem policy
-- de cliente (ninguém além do backend lê/escreve).
create table if not exists public.emails_lifecycle (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  etapa       text not null,   -- boas_vindas | valor | urgencia | ultima_chance | winback
  enviado_em  timestamptz not null default now(),
  unique (user_id, etapa)
);

alter table public.emails_lifecycle enable row level security;
-- Sem policies: cliente não acessa; o cron usa a service role (bypassa RLS).
