-- Jalon 4 : portefeuilles partagés, invitations et gestion des membres.
--
-- Invitation par code : le propriétaire génère un code aléatoire de 64 caractères, affiché une seule
-- fois ; seule son empreinte SHA-256 est stockée. Le code est à usage unique, expire (7 jours par
-- défaut) et peut être révoqué. Tous les échecs (inconnu, expiré, révoqué, déjà utilisé, portefeuille
-- archivé) renvoient le même message, pour ne rien révéler à qui devine.
--
-- Confidentialité : les membres d'un même portefeuille voient le pseudo les uns des autres (et
-- seulement lui). Les nouveaux comptes reçoivent un pseudo neutre, non tiré de l'adresse email.

-- Pseudo neutre à l'inscription ; le portefeuille personnel est toujours créé.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, pseudo)
  values (new.id, 'Membre-' || lpad((floor(random() * 10000))::int::text, 4, '0'));
  perform public.create_personal_portfolio(new.id);
  return new;
end;
$$;

alter table public.profiles
  add constraint profiles_pseudo_trim check (pseudo = btrim(pseudo));

-- Deux comptes qui partagent au moins un portefeuille.
create function public.shares_portfolio(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.portfolio_members a
    join public.portfolio_members b on b.portfolio_id = a.portfolio_id
    where a.user_id = auth.uid() and b.user_id = p_user
  )
$$;

drop policy profiles_select_own on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_portfolio(id));

-- Seuls l'identifiant et le pseudo sont lisibles (pas la date de création).
revoke select on public.profiles from authenticated;
grant select (id, pseudo) on public.profiles to authenticated;

create table public.portfolio_invitations (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  token_hash bytea not null unique,
  role text not null check (role in ('editor', 'viewer')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz
);

create index portfolio_invitations_portfolio_idx on public.portfolio_invitations (portfolio_id);

alter table public.portfolio_invitations enable row level security;

create policy invitations_owner_read on public.portfolio_invitations
  for select to authenticated using (public.member_role(portfolio_id) = 'owner');

revoke all on public.portfolio_invitations from anon, authenticated;
-- le propriétaire voit ses invitations, jamais l'empreinte du code
grant select (id, portfolio_id, role, created_at, expires_at, used_at, revoked_at)
  on public.portfolio_invitations to authenticated;

create function public.create_shared_portfolio(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'Nom invalide (1 à 60 caractères)';
  end if;
  if (
    select count(*) from public.portfolios f
    join public.portfolio_members m on m.portfolio_id = f.id
    where m.user_id = auth.uid() and m.role = 'owner'
      and f.kind = 'shared' and f.archived_at is null
  ) >= 5 then
    raise exception 'Tu as déjà 5 portefeuilles partagés';
  end if;
  insert into public.portfolios (name, kind) values (v_name, 'shared') returning id into v_id;
  insert into public.portfolio_members (portfolio_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end;
$$;

create function public.create_invitation(p_portfolio uuid, p_role text, p_days int default 7)
returns text
language plpgsql security definer set search_path = public as $$
declare
  f public.portfolios;
  v_token text;
begin
  if public.member_role(p_portfolio) is distinct from 'owner' then
    raise exception 'Seul le propriétaire peut inviter' using errcode = '42501';
  end if;
  select * into f from public.portfolios where id = p_portfolio for update;
  if f.kind <> 'shared' then
    raise exception 'Ce portefeuille n’est pas partageable';
  end if;
  if f.archived_at is not null then
    raise exception 'Ce portefeuille est archivé';
  end if;
  if p_role is null or p_role not in ('editor', 'viewer') then
    raise exception 'Rôle invalide';
  end if;
  if p_days is null or p_days < 1 or p_days > 30 then
    raise exception 'Durée invalide (1 à 30 jours)';
  end if;
  if (
    select count(*) from public.portfolio_invitations
    where portfolio_id = p_portfolio and used_at is null and revoked_at is null
      and expires_at > now()
  ) >= 20 then
    raise exception 'Trop d’invitations en attente (20 au plus)';
  end if;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.portfolio_invitations (portfolio_id, token_hash, role, created_by, expires_at)
  values (p_portfolio, sha256(convert_to(v_token, 'UTF8')), p_role, auth.uid(),
          now() + make_interval(days => p_days));
  return v_token;
end;
$$;

create function public.revoke_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_portfolio uuid;
begin
  select portfolio_id into v_portfolio from public.portfolio_invitations where id = p_invitation;
  if v_portfolio is null or public.member_role(v_portfolio) is distinct from 'owner' then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  update public.portfolio_invitations set revoked_at = now()
  where id = p_invitation and used_at is null and revoked_at is null;
end;
$$;

create function public.join_portfolio(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv public.portfolio_invitations;
  f public.portfolios;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  select * into inv from public.portfolio_invitations
  where token_hash = sha256(convert_to(lower(btrim(coalesce(p_token, ''))), 'UTF8'))
  for update;
  if not found or inv.used_at is not null or inv.revoked_at is not null or inv.expires_at <= now() then
    raise exception 'Code invalide ou expiré';
  end if;
  select * into f from public.portfolios where id = inv.portfolio_id for update;
  if f.archived_at is not null then
    raise exception 'Code invalide ou expiré';
  end if;
  if exists (
    select 1 from public.portfolio_members where portfolio_id = f.id and user_id = auth.uid()
  ) then
    raise exception 'Tu es déjà membre de ce portefeuille';
  end if;
  if (select count(*) from public.portfolio_members where portfolio_id = f.id) >= 10 then
    raise exception 'Ce portefeuille est complet (10 membres au plus)';
  end if;
  insert into public.portfolio_members (portfolio_id, user_id, role)
  values (f.id, auth.uid(), inv.role);
  update public.portfolio_invitations set used_at = now(), used_by = auth.uid() where id = inv.id;
  return f.id;
end;
$$;

create function public.remove_member(p_portfolio uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  if public.member_role(p_portfolio) is distinct from 'owner' then
    raise exception 'Seul le propriétaire peut retirer un membre' using errcode = '42501';
  end if;
  select role into v_role from public.portfolio_members
  where portfolio_id = p_portfolio and user_id = p_user;
  if v_role is null then
    raise exception 'Ce membre n’existe pas dans ce portefeuille';
  end if;
  if v_role = 'owner' then
    raise exception 'Le propriétaire ne peut pas être retiré';
  end if;
  delete from public.portfolio_members where portfolio_id = p_portfolio and user_id = p_user;
end;
$$;

create function public.set_member_role(p_portfolio uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  if public.member_role(p_portfolio) is distinct from 'owner' then
    raise exception 'Seul le propriétaire peut changer les rôles' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('editor', 'viewer') then
    raise exception 'Rôle invalide';
  end if;
  select role into v_role from public.portfolio_members
  where portfolio_id = p_portfolio and user_id = p_user;
  if v_role is null then
    raise exception 'Ce membre n’existe pas dans ce portefeuille';
  end if;
  if v_role = 'owner' then
    raise exception 'Le rôle du propriétaire ne peut pas être changé';
  end if;
  update public.portfolio_members set role = p_role
  where portfolio_id = p_portfolio and user_id = p_user;
end;
$$;

create function public.leave_portfolio(p_portfolio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.member_role(p_portfolio);
begin
  if v_role is null then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if v_role = 'owner' then
    raise exception 'Le propriétaire ne peut pas quitter son portefeuille : il peut l’archiver';
  end if;
  delete from public.portfolio_members where portfolio_id = p_portfolio and user_id = auth.uid();
end;
$$;

-- Fermeture définitive d'un portefeuille partagé (le portefeuille personnel se remet à zéro).
create function public.archive_portfolio(p_portfolio uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  f public.portfolios;
begin
  if public.member_role(p_portfolio) is distinct from 'owner' then
    raise exception 'Seul le propriétaire peut archiver' using errcode = '42501';
  end if;
  select * into f from public.portfolios where id = p_portfolio for update;
  if f.kind <> 'shared' then
    raise exception 'Le portefeuille personnel ne peut pas être archivé : remets-le à zéro';
  end if;
  if f.archived_at is not null then
    raise exception 'Ce portefeuille est déjà archivé';
  end if;
  update public.portfolios set archived_at = now() where id = p_portfolio;
  update public.portfolio_invitations set revoked_at = now()
  where portfolio_id = p_portfolio and used_at is null and revoked_at is null;
end;
$$;

-- La remise à zéro révoque aussi les invitations en cours (elles visaient l'ancien portefeuille).
create or replace function public.reset_portfolio(p_portfolio uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  f public.portfolios;
  v_new uuid;
begin
  if public.member_role(p_portfolio) is distinct from 'owner' then
    raise exception 'Seul le propriétaire peut remettre le portefeuille à zéro'
      using errcode = '42501';
  end if;
  select * into f from public.portfolios where id = p_portfolio for update;
  if f.archived_at is not null then
    raise exception 'Ce portefeuille est déjà archivé';
  end if;
  update public.portfolios set archived_at = now() where id = p_portfolio;
  update public.portfolio_invitations set revoked_at = now()
  where portfolio_id = p_portfolio and used_at is null and revoked_at is null;
  insert into public.portfolios (name, kind, initial_cash, fee_rate)
  values (f.name, f.kind, f.initial_cash, f.fee_rate)
  returning id into v_new;
  insert into public.portfolio_members (portfolio_id, user_id, role)
  select v_new, user_id, role from public.portfolio_members where portfolio_id = p_portfolio;
  return v_new;
end;
$$;

-- Membres d'un portefeuille, avec leur pseudo (seule information de profil partagée).
create function public.list_members(p_portfolio uuid)
returns table (user_id uuid, pseudo text, role text)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.member_role(p_portfolio) is null then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return query
    select m.user_id, p.pseudo, m.role
    from public.portfolio_members m
    join public.profiles p on p.id = m.user_id
    where m.portfolio_id = p_portfolio
    order by (m.role = 'owner') desc, p.pseudo, m.user_id;
end;
$$;

-- Portefeuilles actifs de l'utilisateur : le personnel d'abord, puis les partagés.
create function public.my_portfolios()
returns table (
  id uuid, name text, kind text, role text, initial_cash numeric, fee_rate numeric,
  member_count bigint
)
language sql stable security definer set search_path = public as $$
  select f.id, f.name, f.kind, m.role, f.initial_cash, f.fee_rate,
         (select count(*) from public.portfolio_members x where x.portfolio_id = f.id)
  from public.portfolios f
  join public.portfolio_members m on m.portfolio_id = f.id and m.user_id = auth.uid()
  where f.archived_at is null
  order by (f.kind = 'personal') desc, f.created_at, f.id
$$;

revoke all on function public.shares_portfolio(uuid) from public, anon, authenticated;
revoke all on function public.create_shared_portfolio(text) from public, anon;
revoke all on function public.create_invitation(uuid, text, int) from public, anon;
revoke all on function public.revoke_invitation(uuid) from public, anon;
revoke all on function public.join_portfolio(text) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
revoke all on function public.set_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.leave_portfolio(uuid) from public, anon;
revoke all on function public.archive_portfolio(uuid) from public, anon;
revoke all on function public.list_members(uuid) from public, anon;
revoke all on function public.my_portfolios() from public, anon;
grant execute on function public.shares_portfolio(uuid) to authenticated;
grant execute on function public.create_shared_portfolio(text) to authenticated;
grant execute on function public.create_invitation(uuid, text, int) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.join_portfolio(text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.leave_portfolio(uuid) to authenticated;
grant execute on function public.archive_portfolio(uuid) to authenticated;
grant execute on function public.list_members(uuid) to authenticated;
grant execute on function public.my_portfolios() to authenticated;
