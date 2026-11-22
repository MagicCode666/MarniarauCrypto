# Mise en route (une seule fois)

## 1. Projet Supabase

1. Créer un projet Supabase dédié (nom `marniaraucrypto`, région proche, mot de passe de base fort).
2. Authentication > URL Configuration : `Site URL` = `https://magiccode666.github.io/MarniarauCrypto/`,
   et ajouter `http://localhost:5173` aux URL de redirection.
3. Relever l'URL du projet et la clé publique (anon / publishable). Jamais la clé `service_role` dans le code.
4. Lier et appliquer le schéma :
   ```
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
5. Copier `.env.example` en `.env.local` et y mettre l'URL et la clé publique.

## 2. Dépôt GitHub et publication

Le code et le site sont dans **un seul dépôt** : `MagicCode666/MarniarauCrypto`. Il est public : il ne
contient aucun secret (la clé `service_role` est dans le Worker Cloudflare, jamais dans le dépôt ; l'URL
Supabase et la clé « publishable » sont publiques par conception, la sécurité repose sur les règles de la base).

- Settings > Pages : source = **GitHub Actions**.
- Variables du dépôt (Settings > Secrets and variables > Actions > Variables) :
  `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (publiques).
- Un push sur `main` lance `.github/workflows/deploy.yml` : build puis publication sur
  `https://magiccode666.github.io/MarniarauCrypto/`. Aucun jeton n'est nécessaire.
- Protéger `main` (PR obligatoire, CI requise) comme pour BDbyNico.
- Activer le secret scanning et la protection au push (gratuits sur un dépôt public).

Avant de rendre un dépôt public, rechercher des secrets dans **tout l'historique**, pas seulement dans les
fichiers actuels (voir l'historique de cette décision dans les notes du projet).
