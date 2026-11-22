# MarniarauCrypto

Application de suivi, d'analyse et de simulation d'investissement crypto pour débutants. Outil éducatif : les signaux et simulations ne constituent pas des conseils financiers.

- Backend : Python, FastAPI, SQLite
- Frontend : React, Vite, recharts, Tailwind CSS
- Données : CoinGecko et alternative.me (gratuits, sans clé API)

## Lancement

Backend (http://localhost:8000) :

```bash
cd marniaraucrypto/backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

Frontend (http://localhost:5173) :

```bash
cd marniaraucrypto/frontend
npm install
npm run dev
```

Collecte horaire des prix (optionnelle) : `python collector.py` dans `backend/`.
