-- Alertas no Telegram pro dono em cadastros e pagamentos confirmados.
-- Usa pg_net (assíncrono, não bloqueia) e lê o token do Telegram de uma database
-- setting. O chat_id sai direto do vínculo do dono em telegram_links.
--
-- Pré-requisito (rodar UMA VEZ no SQL editor da Supabase, com o token NOVO do bot):
--   alter database postgres set app.telegram_bot_token = 'SEU_TOKEN_NOVO';
--   select pg_reload_conf();
--
-- Como funciona:
--   • signup  → handle_new_user (estendido) → notify_admin_telegram
--   • compra  → trigger on pagamentos insert → notify_admin_telegram
--   • se faltar token, vínculo do dono no Telegram, ou pg_net falhar:
--     vira no-op silencioso, NÃO bloqueia o caller.

-- ── pg_net (idempotente)
create extension if not exists pg_net with schema extensions;

-- ── Função de notificação (security definer pra acessar telegram_links/auth.users)
create or replace function public.notify_admin_telegram(p_message text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_chat_id bigint;
  v_owner_email constant text := 'hemoreira@outlook.com.br';
begin
  begin
    v_token := current_setting('app.telegram_bot_token', true);
  exception when others then
    v_token := null;
  end;
  if coalesce(v_token, '') = '' then return; end if;

  select tl.chat_id into v_chat_id
  from public.telegram_links tl
  join auth.users u on u.id = tl.user_id
  where lower(u.email) = lower(v_owner_email)
  limit 1;
  if v_chat_id is null then return; end if;

  perform net.http_post(
    url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'chat_id', v_chat_id,
      'text', p_message,
      'parse_mode', 'Markdown',
      'disable_web_page_preview', true
    )
  );
exception when others then
  -- nunca bloqueia o caller: falha no Telegram não derruba signup nem pagamento
  return;
end;
$$;

revoke all on function public.notify_admin_telegram(text) from public, anon, authenticated;
grant execute on function public.notify_admin_telegram(text) to service_role;

-- ── Estende handle_new_user pra disparar alerta de cadastro
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origem text;
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

  v_origem := coalesce(nullif(new.raw_user_meta_data ->> 'utm_source', ''), '(direto)');
  perform public.notify_admin_telegram(
    E'🆕 *Novo cadastro Cauril*\n' ||
    E'📧 ' || coalesce(new.email, '?') || E'\n' ||
    E'🌐 Origem: ' || v_origem
  );

  return new;
end;
$$;

-- ── Trigger novo: notifica quando um pagamento entra na tabela
create or replace function public.on_pagamento_insert_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_admin_telegram(
    E'💰 *Nova venda Cauril!*\n' ||
    E'📦 Plano: ' || coalesce(new.plano, '?') || E'\n' ||
    E'💵 Valor: R$ ' || to_char(coalesce(new.valor, 0), 'FM999G990D90') || E'\n' ||
    E'📧 ' || coalesce(new.email, '?') || E'\n' ||
    E'💳 ' || coalesce(new.metodo, '?')
  );
  return new;
end;
$$;

drop trigger if exists on_pagamento_insert_notify on public.pagamentos;
create trigger on_pagamento_insert_notify
  after insert on public.pagamentos
  for each row execute function public.on_pagamento_insert_notify();
