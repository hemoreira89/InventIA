-- Hardening do trigger de signup: cast de data à prova de valor malformado.
-- (aplicada em produção em 2026-06-15 via Supabase MCP)
--
-- Antes: (raw_user_meta_data ->> 'data_nascimento')::date — um valor inválido no
-- metadata lançaria erro e ABORTARIA o signup (trigger AFTER INSERT faz rollback).
-- Agora: só converte se casar com o formato YYYY-MM-DD; senão grava null.

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
    case
      when (new.raw_user_meta_data ->> 'data_nascimento') ~ '^\d{4}-\d{2}-\d{2}$'
        then (new.raw_user_meta_data ->> 'data_nascimento')::date
      else null
    end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
