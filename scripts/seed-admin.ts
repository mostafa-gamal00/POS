import type pg from "pg";

export type AdminCredentials = {
  email: string;
  password: string;
};

export function readAdminCredentials(env: {
  SUPER_ADMIN_EMAIL?: string;
  SUPER_ADMIN_PASSWORD?: string;
}): AdminCredentials {
  const email = env.SUPER_ADMIN_EMAIL?.trim() ?? "";
  const password = env.SUPER_ADMIN_PASSWORD ?? "";
  if (!email) {
    throw new Error(
      "SUPER_ADMIN_EMAIL is missing. Set it in .env before seeding.",
    );
  }
  if (!password) {
    throw new Error(
      "SUPER_ADMIN_PASSWORD is missing. Set it in .env before seeding.",
    );
  }
  if (password.length < 8) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 8 characters.");
  }
  return { email: email.toLowerCase(), password };
}

export async function seedSuperAdmin(
  client: pg.Client,
  credentials: AdminCredentials,
): Promise<void> {
  const existing = await client.query<{ id: string }>(
    "select id from auth.users where lower(email) = lower($1) limit 1",
    [credentials.email],
  );
  let userId = existing.rows[0]?.id;
  if (!userId) {
    const created = await client.query<{ id: string }>(
      `
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
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        $1,
        crypt($2, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', 'Super Admin'),
        now(),
        now(),
        '',
        '',
        '',
        ''
      )
      returning id
      `,
      [credentials.email, credentials.password],
    );
    userId = created.rows[0]?.id;
    if (!userId) {
      throw new Error("Super admin user was not created.");
    }
    console.log(`Created super admin ${credentials.email}`);
  } else {
    console.log(`Super admin ${credentials.email} already exists`);
  }
  await client.query(
    `
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    select
      gen_random_uuid(),
      u.id,
      jsonb_build_object('sub', u.id::text, 'email', $2::text),
      'email',
      u.id::text,
      now(),
      now(),
      now()
    from auth.users u
    where u.id = $1::uuid
      and not exists (
        select 1
        from auth.identities i
        where i.user_id = u.id
          and i.provider = 'email'
      )
    `,
    [userId, credentials.email],
  );
  await client.query(
    `
    insert into public.user_roles (user_id, role_id)
    select $1, r.id
    from public.roles r
    where r.code = 'super_admin'
    on conflict do nothing
    `,
    [userId],
  );
}
