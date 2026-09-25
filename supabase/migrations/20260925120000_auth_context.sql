-- One round trip for the signed-in user's name, permissions, and roles.

create or replace function public.auth_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_permissions text[];
  v_roles jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  v_permissions := coalesce(public.auth_my_permissions(), '{}'::text[]);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'code', r.code,
        'name', r.name,
        'description', r.description,
        'is_system', r.is_system,
        'created_at', r.created_at
      )
      order by r.code
    ),
    '[]'::jsonb
  )
  into v_roles
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = v_uid;

  return jsonb_build_object(
    'full_name', coalesce(v_profile.full_name, ''),
    'email', coalesce(v_profile.email, ''),
    'is_super_admin', public.auth_is_super_admin(),
    'permissions', to_jsonb(v_permissions),
    'roles', v_roles
  );
end;
$$;

grant execute on function public.auth_context() to authenticated;
