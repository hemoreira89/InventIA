-- Painel v2: listagem de usuários para o dono (nome, plano, datas, último acesso)
-- (aplicada em produção em 2026-06-15 via Supabase MCP)
--
-- security definer + guard pelo e-mail do dono (lê auth.users, ignora RLS).

create or replace function public.admin_usuarios(p_limite int default 200)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_email constant text := 'hemoreira@outlook.com.br';
  result jsonb;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> owner_email then
    raise exception 'forbidden';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into result
  from (
    select
      u.email,
      p.nome,
      extract(year from age(p.data_nascimento))::int as idade,
      p.plano,
      p.trial_fim,
      p.plano_expira_em,
      u.created_at,
      u.last_sign_in_at
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    order by u.created_at desc
    limit greatest(1, least(p_limite, 1000))
  ) t;

  return result;
end;
$$;

grant execute on function public.admin_usuarios(int) to authenticated;
revoke execute on function public.admin_usuarios(int) from public, anon;
