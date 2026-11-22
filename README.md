# MarniarauCrypto

PWA familiale de suivi, d'analyse et de simulation d'investissement crypto, pour apprendre.
**Outil éducatif : les signaux et simulations ne constituent pas des conseils financiers.**

Architecture et jalons : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Mise en route : [docs/MISE-EN-ROUTE.md](docs/MISE-EN-ROUTE.md).

## Développement

```bash
npm install
cp .env.example .env.local   # puis renseigner l'URL et la clé anon du projet Supabase
npm run dev                  # http://localhost:5173
npm run lint && npm run typecheck && npm test && npm run build
```

Commits au format Conventional Commits (vérifié par commitlint).
