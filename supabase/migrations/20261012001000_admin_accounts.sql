create or replace function public.create_admin(
  p_email text,
  p_password text,
  p_full_name text,
  p_role_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text := trim(coalesce(p_full_name, ''));
  v_user_id uuid;
  v_role_names text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.auth_is_super_admin() then
    raise exception 'Only super admin can create admins';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Invalid email';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;
  if v_name = '' then
    raise exception 'Name is required';
  end if;
  if p_role_ids is null or cardinality(p_role_ids) = 0 then
    raise exception 'Choose a role';
  end if;
  if exists (
    select 1
    from unnest(p_role_ids) as requested(role_id)
    where not exists (select 1 from public.roles r where r.id = requested.role_id)
  ) then
    raise exception 'Role not found';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Email is already registered';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    extensions.gen_random_uuid(),
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  returning id into v_user_id;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    extensions.gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  insert into public.user_roles (user_id, role_id)
  select v_user_id, requested.role_id
  from unnest(p_role_ids) as requested(role_id)
  on conflict do nothing;

  select string_agg(r.name, ', ' order by r.name)
  into v_role_names
  from public.roles r
  where r.id = any(p_role_ids);

  insert into public.activity_logs (actor_id, action, entity_type, entity_id, summary)
  values (
    auth.uid(),
    'create_admin',
    'profiles',
    v_user_id,
    v_email || ' (' || coalesce(v_role_names, '') || ')'
  );
  return v_user_id;
end;
$$;

create or replace function public.change_super_admin_password(
  p_new_password text,
  p_confirmation text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.auth_is_super_admin() then
    raise exception 'Only super admin can change this password';
  end if;
  if p_confirmation is distinct from 'dodo' then
    raise exception 'Confirmation word is incorrect';
  end if;
  if length(coalesce(p_new_password, '')) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;
  update auth.users
  set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = auth.uid();
  if not found then
    raise exception 'User not found';
  end if;
  insert into public.activity_logs (actor_id, action, entity_type, entity_id, summary)
  values (auth.uid(), 'change_password', 'profiles', auth.uid(), 'Super admin password changed');
end;
$$;

grant execute on function public.create_admin(text, text, text, uuid[]) to authenticated;
grant execute on function public.change_super_admin_password(text, text) to authenticated;
