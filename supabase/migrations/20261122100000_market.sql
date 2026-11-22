-- Jalon 1 : catalogue commun de cryptos, dernier prix et historique quotidien.
-- Lecture pour les comptes connectés seulement ; l'écriture est réservée au collecteur
-- (clé service_role, qui contourne la RLS) et à l'administrateur (SQL).

create table public.coins (
  coin_id text primary key check (coin_id ~ '^[a-z0-9-]+$'),
  symbol text not null,
  name text not null,
  categories text[] not null default '{}',
  active boolean not null default true,
  -- renseigné par le collecteur une fois les 365 jours d'historique chargés
  history_loaded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.prices (
  coin_id text primary key references public.coins (coin_id) on delete cascade,
  price_eur numeric not null check (price_eur > 0),
  change_24h_pct numeric,
  market_cap_eur numeric,
  volume_24h_eur numeric,
  updated_at timestamptz not null
);

create table public.price_history (
  coin_id text not null references public.coins (coin_id) on delete cascade,
  day date not null,
  close_eur numeric not null check (close_eur > 0),
  primary key (coin_id, day)
);

-- Le collecteur ne peut suivre qu'un nombre limité de cryptos (limite de l'offre gratuite).
create function public.limit_active_coins() returns trigger
language plpgsql as $$
begin
  if new.active and (
    select count(*) from public.coins where active and coin_id <> new.coin_id
  ) >= 20 then
    raise exception 'Le catalogue est limité à 20 cryptos actives';
  end if;
  return new;
end;
$$;

create trigger coins_limit before insert or update on public.coins
  for each row execute function public.limit_active_coins();

alter table public.coins enable row level security;
alter table public.prices enable row level security;
alter table public.price_history enable row level security;

create policy coins_read on public.coins for select to authenticated using (true);
create policy prices_read on public.prices for select to authenticated using (true);
create policy price_history_read on public.price_history for select to authenticated using (true);

revoke all on public.coins, public.prices, public.price_history from anon, authenticated;
grant select on public.coins, public.prices, public.price_history to authenticated;

insert into public.coins (coin_id, symbol, name, categories) values
  ('bitcoin', 'BTC', 'Bitcoin', '{"Réserve de valeur"}'),
  ('ethereum', 'ETH', 'Ethereum', '{"Smart contracts","DeFi"}'),
  ('solana', 'SOL', 'Solana', '{"Smart contracts","DeFi"}'),
  ('binancecoin', 'BNB', 'BNB', '{"Exchange tokens","Smart contracts"}'),
  ('ripple', 'XRP', 'XRP', '{"Paiement & transfert"}'),
  ('cardano', 'ADA', 'Cardano', '{"Smart contracts"}'),
  ('tether', 'USDT', 'Tether', '{}'),
  ('tron', 'TRX', 'TRON', '{"Smart contracts"}'),
  ('dogecoin', 'DOGE', 'Dogecoin', '{"Memecoins"}');
