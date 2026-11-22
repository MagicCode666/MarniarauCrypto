# Mise en route (une seule fois)

## 1. Projet Supabase

1. Créer un projet Supabase dédié (nom `marniaraucrypto`, région proche, mot de passe de base fort).
2. Authentication > URL Configuration : `Site URL` = `https://magiccode666.github.io/MarniarauCrypto-dist/`,
   et ajouter `http://localhost:5173` aux URL de redirection.
3. Relever l'URL du projet et la clé publique (anon / publishable). Jamais la clé `service_role` dans le code.
4. Lier et appliquer le schéma :
   ```
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
5. Copier `.env.example` en `.env.local` et y mettre l'URL et la clé publique.

## 2. Dépôt de distribution

1. Créer le dépôt **public** `MagicCode666/MarniarauCrypto-dist` (un fichier d'accueil suffit).
2. Settings > Pages : source = branche `main`, dossier racine.
3. Créer un jeton fine-grained limité à ce dépôt (Contents : lecture et écriture).

## 3. Dépôt privé : variables et secrets GitHub

- Variables : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publiques).
- Secret : `DIST_DEPLOY_TOKEN` (le jeton ci-dessus).
- Protéger `main` (PR obligatoire, CI requise) comme pour BDbyNico.
