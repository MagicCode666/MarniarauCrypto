# Indicateurs et signaux

Outil éducatif : les signaux ne sont pas des conseils financiers. Les calculs sont faits dans
l'application (`src/lib/indicators.ts`), sur les **clôtures quotidiennes** lues dans `price_history`
(200 jours chargés). La clôture du jour est le dernier prix relevé par le collecteur : le signal peut
donc évoluer au fil de la journée.

## Indicateurs

- **RSI 14 jours**, méthode de Wilder, arrondi à 2 décimales. Non défini si le prix n'a pas bougé.
- **MACD 12 / 26 / 9** : moyennes mobiles exponentielles initialisées avec la moyenne simple des N
  premiers jours. Le MACD n'est **pas arrondi** : un arrondi à 4 décimales annulerait le signe du MACD
  des cryptos à très petit prix.
- Il faut **26 clôtures** pour le MACD (donc pour le signal) et 34 pour sa ligne de signal et son
  histogramme. En dessous, l'écran affiche « Données insuffisantes » : aucun signal n'est inventé.

## Score composite (règles du prototype)

| Critère               | Points |
| --------------------- | ------ |
| RSI < 30              | +2     |
| 30 ≤ RSI < 45         | +1     |
| 45 ≤ RSI ≤ 55         | 0      |
| 55 < RSI ≤ 70         | −1     |
| RSI > 70              | −2     |
| MACD > 0              | +1     |
| MACD < 0              | −1     |
| variation 24 h > +5 % | +1     |
| variation 24 h < −5 % | −1     |

| Score   | Signal                  |
| ------- | ----------------------- |
| ≥ 3     | ▲▲ Fort signal haussier |
| 1 à 2   | ▲ Signal haussier       |
| 0       | ─ Neutre                |
| −1 à −2 | ▼ Signal baissier       |
| ≤ −3    | ▼▼ Fort signal baissier |

La modale d'un signal détaille chaque ligne du score avec les valeurs réelles.

## Vérification

Les tests comparent le RSI et le MACD à **pandas**, une implémentation indépendante, sur une série
de 300 jours (`src/lib/indicators.fixture.json`, régénérable avec `python scripts/indicator-fixtures.py`).
Des cas calculables à la main complètent : EMA de période 3, RSI à 50 et à 86,67, MACD nul sur un
prix constant, MACD tendant vers 7 sur une hausse linéaire.

## Différences avec le prototype

- Moyennes initialisées avec la moyenne simple des premiers jours (standard), et non avec le premier
  prix : les premières valeurs diffèrent légèrement.
- Calcul sur clôtures quotidiennes (le prototype utilisait des points horaires).
- Pas de RSI à 50 ni de « Neutre » par défaut quand l'historique manque.
