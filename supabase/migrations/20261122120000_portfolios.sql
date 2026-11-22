-- Jalon 3 : portefeuilles simulés et transactions.
--
-- Le schéma sert déjà le partage (portefeuille partagé, rôles owner / editor / viewer), mais seul le
-- portefeuille personnel est exposé par l'application pour l'instant.
--
-- Règles de sécurité :
--  * aucune écriture directe : achats, ventes et remise à zéro passent par des fonctions qui lisent
--    le prix dans la table prices (jamais envoyé par le client) et verrouillent le portefeuille ;
--  * lecture réservée aux membres du portefeuille ;
--  * une transaction n'est jamais modifiée ni supprimée : le cash et les positions se calculent
--    depuis les transactions, il n'y a pas de solde stocké qui puisse se désynchroniser.

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  kind text not null default 'personal' check (kind in ('personal', 'shared')),
  initial_cash numeric not null default 10000 check (initial_cash > 0),
  -- frais simulés, indicatifs ; chaque transaction mémorise les frais réellement appliqués
  fee_rate numeric not null default 0.005 check (fee_rate >= 0 and fee_rate < 0.1),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.portfolio_members (
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  primary key (portfolio_id, user_id)
);

create table public.transactions (
  id bigint generated always as identity primary key,
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  -- auteur ; devient null si le compte est supprimé, la transaction reste pour garder le cash exact
  user_id uuid references public.profiles (id) on delete set null,
  side text not null check (side in ('buy', 'sell')),
  coin_id text not null references public.coins (coin_id),
  quantity numeric not null check (quantity > 0),
  price_eur numeric not null check (price_eur > 0),
  fee_eur numeric not null check (fee_eur >= 0),
  -- mouvement de cash : achat = montant payé (frais compris), vente = montant net reçu
  total_eur numeric not null check (total_eur > 0),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create index transactions_portfolio_idx on public.transactions (portfolio_id, id);
create index portfolio_members_user_idx on public.portfolio_members (user_id);

-- Rôle de l'utilisateur connecté dans un portefeuille (null s'il n'en est pas membre).
create function public.member_role(p_portfolio uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.portfolio_members
  where portfolio_id = p_portfolio and user_id = auth.uid()
$$;

alter table public.portfolios enable row level security;
alter table public.portfolio_members enable row level security;
alter table public.transactions enable row level security;

create policy portfolios_read on public.portfolios
  for select to authenticated using (public.member_role(id) is not null);
create policy portfolio_members_read on public.portfolio_members
  for select to authenticated using (public.member_role(portfolio_id) is not null);
create policy transactions_read on public.transactions
  for select to authenticated using (public.member_role(portfolio_id) is not null);

revoke all on public.portfolios, public.portfolio_members, public.transactions
  from anon, authenticated;
grant select on public.portfolios, public.portfolio_members, public.transactions
  to authenticated;

-- Portefeuille personnel d'un compte (10 000 €), appelé à l'inscription et pour les comptes existants.
create function public.create_personal_portfolio(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  insert into public.portfolios (name, kind) values ('Mon portefeuille', 'personal')
    returning id into v_id;
  insert into public.portfolio_members (portfolio_id, user_id, role) values (v_id, p_user, 'owner');
  return v_id;
end;
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, pseudo)
  values (
    new.id,
    left(coalesce(nullif(split_part(new.email, '@', 1), ''), 'Membre'), 40)
  );
  perform public.create_personal_portfolio(new.id);
  return new;
end;
$$;

select public.create_personal_portfolio(p.id)
from public.profiles p
where not exists (
  select 1 from public.portfolio_members m
  join public.portfolios f on f.id = m.portfolio_id
  where m.user_id = p.id and f.kind = 'personal'
);

-- Cash d'un portefeuille : capital de départ + ventes nettes − achats. Sans contrôle d'accès :
-- réservé aux autres fonctions de ce fichier.
create function public.internal_cash(p_portfolio uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select f.initial_cash + coalesce((
    select sum(case t.side when 'sell' then t.total_eur else -t.total_eur end)
    from public.transactions t where t.portfolio_id = f.id
  ), 0)
  from public.portfolios f where f.id = p_portfolio
$$;

create function public.internal_held(p_portfolio uuid, p_coin text) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case side when 'buy' then quantity else -quantity end), 0)
  from public.transactions where portfolio_id = p_portfolio and coin_id = p_coin
$$;

create function public.portfolio_cash(p_portfolio uuid) returns numeric
language plpgsql stable security definer set search_path = public as $$
begin
  if public.member_role(p_portfolio) is null then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return public.internal_cash(p_portfolio);
end;
$$;

-- Positions ouvertes. Prix d'achat moyen pondéré : une vente ne le change pas ; une position
-- soldée repart de zéro. Calculé dans l'ordre des transactions.
create function public.portfolio_positions(p_portfolio uuid)
returns table (coin_id text, quantity numeric, avg_buy_price_eur numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  t record;
  q jsonb := '{}';
  a jsonb := '{}';
  cq numeric;
  ca numeric;
begin
  if public.member_role(p_portfolio) is null then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  for t in
    select x.coin_id, x.side, x.quantity, x.price_eur
    from public.transactions x where x.portfolio_id = p_portfolio order by x.id
  loop
    cq := coalesce((q ->> t.coin_id)::numeric, 0);
    ca := coalesce((a ->> t.coin_id)::numeric, 0);
    if t.side = 'buy' then
      ca := (cq * ca + t.quantity * t.price_eur) / (cq + t.quantity);
      cq := cq + t.quantity;
    else
      cq := cq - t.quantity;
      if cq < 0.0000000001 then
        cq := 0;
        ca := 0;
      end if;
    end if;
    q := jsonb_set(q, array[t.coin_id], to_jsonb(cq));
    a := jsonb_set(a, array[t.coin_id], to_jsonb(ca));
  end loop;
  return query
    select k, (q ->> k)::numeric, (a ->> k)::numeric
    from jsonb_object_keys(q) as k
    where (q ->> k)::numeric > 0
    order by k;
end;
$$;

create function public.buy_coin(
  p_portfolio uuid, p_coin text, p_eur numeric, p_note text default null
) returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.member_role(p_portfolio);
  f public.portfolios;
  pr public.prices;
  v_fee numeric;
  v_qty numeric;
  t public.transactions;
begin
  if v_role is null then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if v_role = 'viewer' then
    raise exception 'Ce portefeuille est en lecture seule' using errcode = '42501';
  end if;
  select * into f from public.portfolios where id = p_portfolio for update;
  if f.archived_at is not null then
    raise exception 'Ce portefeuille est archivé';
  end if;
  if p_eur is null or p_eur <= 0 or round(p_eur, 2) <> p_eur then
    raise exception 'Montant invalide (en euros, 2 décimales au plus)';
  end if;
  select p.* into pr
  from public.prices p join public.coins c on c.coin_id = p.coin_id
  where p.coin_id = p_coin and c.active;
  if not found then
    raise exception 'Cryptomonnaie indisponible : %', p_coin;
  end if;
  if pr.updated_at < now() - interval '30 minutes' then
    raise exception 'Prix trop ancien pour acheter, réessaie dans quelques minutes';
  end if;
  if p_eur > public.internal_cash(p_portfolio) then
    raise exception 'Solde insuffisant';
  end if;
  v_fee := round(p_eur * f.fee_rate, 2);
  v_qty := round((p_eur - v_fee) / pr.price_eur, 12);
  if v_qty <= 0 then
    raise exception 'Montant trop faible';
  end if;
  insert into public.transactions
    (portfolio_id, user_id, side, coin_id, quantity, price_eur, fee_eur, total_eur, note)
  values
    (p_portfolio, auth.uid(), 'buy', p_coin, v_qty, pr.price_eur, v_fee, p_eur, nullif(p_note, ''))
  returning * into t;
  return t;
end;
$$;

create function public.sell_coin(
  p_portfolio uuid, p_coin text, p_quantity numeric, p_note text default null
) returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.member_role(p_portfolio);
  f public.portfolios;
  pr public.prices;
  v_held numeric;
  v_qty numeric := p_quantity;
  v_gross numeric;
  v_fee numeric;
  t public.transactions;
begin
  if v_role is null then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if v_role = 'viewer' then
    raise exception 'Ce portefeuille est en lecture seule' using errcode = '42501';
  end if;
  select * into f from public.portfolios where id = p_portfolio for update;
  if f.archived_at is not null then
    raise exception 'Ce portefeuille est archivé';
  end if;
  if v_qty is null or v_qty <= 0 or round(v_qty, 12) <> v_qty then
    raise exception 'Quantité invalide';
  end if;
  v_held := public.internal_held(p_portfolio, p_coin);
  if v_held <= 0 then
    raise exception 'Vous ne détenez pas cette cryptomonnaie';
  end if;
  if v_qty > v_held + 0.0000000001 then
    raise exception 'Quantité insuffisante en portefeuille';
  end if;
  v_qty := least(v_qty, v_held);
  select p.* into pr
  from public.prices p join public.coins c on c.coin_id = p.coin_id
  where p.coin_id = p_coin;
  if not found then
    raise exception 'Cryptomonnaie indisponible : %', p_coin;
  end if;
  if pr.updated_at < now() - interval '30 minutes' then
    raise exception 'Prix trop ancien pour vendre, réessaie dans quelques minutes';
  end if;
  v_gross := round(v_qty * pr.price_eur, 2);
  v_fee := round(v_gross * f.fee_rate, 2);
  if v_gross - v_fee <= 0 then
    raise exception 'Quantité trop faible';
  end if;
  insert into public.transactions
    (portfolio_id, user_id, side, coin_id, quantity, price_eur, fee_eur, total_eur, note)
  values
    (p_portfolio, auth.uid(), 'sell', p_coin, v_qty, pr.price_eur, v_fee, v_gross - v_fee,
     nullif(p_note, ''))
  returning * into t;
  return t;
end;
$$;

-- Remise à zéro : l'ancien portefeuille est archivé (rien n'est supprimé) et un neuf repart au
-- capital de départ, avec les mêmes membres. Réservée au propriétaire.
create function public.reset_portfolio(p_portfolio uuid) returns uuid
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
  insert into public.portfolios (name, kind, initial_cash, fee_rate)
  values (f.name, f.kind, f.initial_cash, f.fee_rate)
  returning id into v_new;
  insert into public.portfolio_members (portfolio_id, user_id, role)
  select v_new, user_id, role from public.portfolio_members where portfolio_id = p_portfolio;
  return v_new;
end;
$$;

-- Les fonctions internes ne sont pas appelables depuis l'application.
revoke all on function public.create_personal_portfolio(uuid) from public, anon, authenticated;
revoke all on function public.internal_cash(uuid) from public, anon, authenticated;
revoke all on function public.internal_held(uuid, text) from public, anon, authenticated;
revoke all on function public.member_role(uuid) from public, anon;
revoke all on function public.portfolio_cash(uuid) from public, anon;
revoke all on function public.portfolio_positions(uuid) from public, anon;
revoke all on function public.buy_coin(uuid, text, numeric, text) from public, anon;
revoke all on function public.sell_coin(uuid, text, numeric, text) from public, anon;
revoke all on function public.reset_portfolio(uuid) from public, anon;
grant execute on function public.member_role(uuid) to authenticated;
grant execute on function public.portfolio_cash(uuid) to authenticated;
grant execute on function public.portfolio_positions(uuid) to authenticated;
grant execute on function public.buy_coin(uuid, text, numeric, text) to authenticated;
grant execute on function public.sell_coin(uuid, text, numeric, text) to authenticated;
grant execute on function public.reset_portfolio(uuid) to authenticated;
