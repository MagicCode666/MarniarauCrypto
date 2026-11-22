# Architecture

MarniarauCrypto est une PWA familiale (PC et mobile) de suivi, d'analyse et de simulation crypto.
Outil éducatif : les signaux et simulations ne sont pas des conseils financiers.

```
Dépôt privé MagicCode666/MarniarauCrypto (code, CI, migrations SQL)
   │ build + publication (.github/workflows/deploy.yml)
   ▼
Dépôt public MarniarauCrypto-dist ──► PWA servie par GitHub Pages (mise à jour automatique)
                                          │
Collecteur (Cloudflare Worker, cron) ──► CoinGecko        ▼
        │                              Supabase (projet dédié)
        └─ écrit prix et historique ──► auth, prix, portefeuilles (RLS)
```

## Principes

- **Pas de serveur applicatif.** L'application est statique ; Supabase porte les données et les règles
  d'accès (RLS) ; les calculs (RSI, MACD, signaux, backtest) se font côté client, en TypeScript, avec tests.
- **Un seul appelant CoinGecko** (le collecteur), pour respecter la limite de l'offre gratuite pour
  toute la famille. Les clients lisent la base : l'app marche même si CoinGecko est en panne
  (dernière valeur affichée avec son horodatage).
- **Keep-alive.** L'offre gratuite de Supabase met le projet en pause après 7 jours sans activité :
  le collecteur écrit en continu, et un ping quotidien (GitHub Actions) sert de filet.
- **Un compte par personne.** Un portefeuille perso (10 000 €) est créé à l'inscription.
- **Portefeuille partagé** : `portfolios`, `portfolio_members` (rôle `owner`, `editor` ou `viewer`) et
  `transactions` (positions et cash calculés depuis les transactions). Achat et vente passent par une
  fonction SQL atomique qui lit le prix dans la table `prices`.
- **Catalogue de cryptos commun et fermé** (une vingtaine au plus), géré par l'administrateur ;
  chacun choisit ses favorites dedans.
- **Accessibilité** : palette Okabe-Ito ; hausse et baisse portent toujours un symbole (▲ ▼) et un
  libellé, jamais la couleur seule.

## Jalons

0. Fondations : projet Supabase, structure, CI, dépôt de distribution, coque PWA, connexion.
1. Prix en direct : collecteur, table `prices`, tableau de bord.
2. Indicateurs et signaux en TypeScript.
3. Portefeuille personnel et transactions.
4. Portefeuille partagé : invitations et rôles.
5. Backtest.
6. Mes cryptos, Lexique, finitions PWA (hors-ligne, suppression de compte).

## Dépôt

- `src/` : l'application (React, TypeScript, Tailwind).
- `supabase/migrations/` : le schéma SQL ; `supabase/tests/` rejoue les migrations sur PGlite.
- `prototype/` : l'ancien prototype (FastAPI + React), conservé comme référence des règles métier
  (indicateurs, backtest, catégories). Il n'est plus lancé.
