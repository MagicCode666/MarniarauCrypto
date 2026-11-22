# Collecteur de prix

Un Cloudflare Worker (`worker/`) appelle CoinGecko **toutes les 5 minutes** et écrit dans Supabase.
C'est le seul appelant de CoinGecko : l'application lit uniquement la base.

## Ce qu'il fait à chaque passage

1. Lit le catalogue actif (`coins`).
2. Un seul appel `/coins/markets` pour toutes les cryptos, puis met à jour `prices` (dernier prix) et la
   clôture du jour dans `price_history`.
3. Rattrape l'historique : 2 cryptos au plus par passage (6 s entre les deux), 365 jours de clôtures
   quotidiennes, puis marque `coins.history_loaded_at`. Une crypto ajoutée au catalogue se remplit seule.

Si CoinGecko refuse (limite, panne), rien n'est écrit : l'application garde les dernières valeurs et
affiche leur ancienneté. Écrire toutes les 5 minutes sert aussi de **keep-alive** à la base Supabase.

## Déployer (une seule fois, puis à chaque changement du Worker)

Dans le dossier `worker/` :

```
cd worker
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler deploy
```

- La clé est la clé secrète du projet Supabase (Project Settings > API Keys, clé `service_role` ou
  `secret`). Wrangler la demande à la saisie : elle n'est écrite dans aucun fichier.
- `SUPABASE_URL` est une variable publique de `wrangler.toml`.
- Le Worker n'expose rien en HTTP. Le cron est défini dans `wrangler.toml` (`*/5 * * * *`).

## Clé CoinGecko (nécessaire depuis un Worker)

Sans clé, CoinGecko limite par adresse IP, et les Workers Cloudflare partagent leurs adresses avec
beaucoup d'autres utilisateurs : le collecteur reçoit alors des refus 429 en continu (constaté le
22/11/2026, alors que le même appel passait depuis un PC). Avec une clé **Demo** gratuite, le quota
se compte par clé.

1. Créer un compte gratuit sur coingecko.com, puis Developer Dashboard > Add New Key (offre Demo).
2. `cd worker` puis `npx wrangler secret put COINGECKO_API_KEY` (Wrangler demande la clé à la saisie).

La clé reste côté Worker, jamais dans l'application. Quota Demo : environ 10 000 appels par mois ;
à un passage toutes les 5 minutes, le collecteur en consomme environ 8 700 (un appel par passage,
plus le rattrapage initial de l'historique). Surveiller, et passer à 10 minutes si besoin.

## Surveiller

```
npx wrangler tail
```

Chaque passage journalise une ligne JSON : `{"ok":true,"coins":9,"prices":9,"backfilled":[...],"coingeckoError":null}`.
Un `coingeckoError` répété (429) signale une limite d'appels atteinte.

## Gérer le catalogue

Le catalogue est commun et fermé (20 cryptos actives au plus, imposé par la base). Pour ajouter une
crypto, utiliser son identifiant CoinGecko (visible dans l'URL de sa page) :

```sql
insert into public.coins (coin_id, symbol, name, categories)
values ('chainlink', 'LINK', 'Chainlink', '{"Smart contracts"}');
```

Elle apparaît dans l'application après le prochain passage du collecteur. Pour la retirer sans perdre
son historique : `update public.coins set active = false where coin_id = 'chainlink';`
