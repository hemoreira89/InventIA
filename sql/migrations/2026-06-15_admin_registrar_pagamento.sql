-- Amarra registro de pagamento → ativação do plano do cliente (atômico, só dono)
-- (aplicada em produção em 2026-06-15 via Supabase MCP)
--
-- O dono não consegue alterar profiles de outro usuário via RLS; esta função
-- security definer faz tudo numa transação: valida o dono, grava o pagamento e
-- ativa/renova o plano do cliente. Renovação estende a partir do vencimento atual
-- (greatest(plano_expira_em, now())) para não "perder" dias de quem renova antes.

create or replace function public.admin_registrar_pagamento(
  p_email text,
  p_plano text,
  p_valor numeric,
  p_metodo text default null,
  p_referencia text default null,
  p_pago_em timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_email constant text := 'hemoreira@outlook.com.br';
  v_user_id uuid;
  v_cur_expira timestamptz;
  v_expira timestamptz;
  v_plano_ativado boolean := false;
  v_pag public.pagamentos;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> owner_email then
    raise exception 'forbidden';
  end if;
  if p_valor is null or p_valor < 0 then
    raise exception 'valor invalido';
  end if;

  -- localiza o cliente pelo e-mail (case-insensitive), se existir
  select user_id, plano_expira_em
    into v_user_id, v_cur_expira
    from public.profiles
   where lower(email) = lower(p_email)
   limit 1;

  insert into public.pagamentos (user_id, email, plano, valor, metodo, referencia, pago_em)
  values (v_user_id, p_email, p_plano, p_valor, p_metodo, p_referencia, coalesce(p_pago_em, now()))
  returning * into v_pag;

  -- ativa/renova o plano do cliente (só se o usuário existe e o plano é pago)
  if v_user_id is not null and p_plano in ('mensal', 'anual', 'vitalicio') then
    if p_plano = 'mensal' then
      v_expira := greatest(coalesce(v_cur_expira, now()), now()) + interval '1 month';
    elsif p_plano = 'anual' then
      v_expira := greatest(coalesce(v_cur_expira, now()), now()) + interval '1 year';
    else
      v_expira := null; -- vitalicio nunca expira
    end if;

    update public.profiles
       set plano = p_plano,
           plano_expira_em = v_expira,
           updated_at = now()
     where user_id = v_user_id;
    v_plano_ativado := true;
  end if;

  return jsonb_build_object(
    'pagamento', to_jsonb(v_pag),
    'usuario_encontrado', v_user_id is not null,
    'plano_ativado', v_plano_ativado,
    'plano_expira_em', v_expira
  );
end;
$$;

grant execute on function public.admin_registrar_pagamento(text, text, numeric, text, text, timestamptz) to authenticated;
revoke execute on function public.admin_registrar_pagamento(text, text, numeric, text, text, timestamptz) from public, anon;
