"""Génère src/lib/indicators.fixture.json : valeurs de référence calculées avec pandas, une
implémentation indépendante du TypeScript (src/lib/indicators.ts).

Sur une longue série (300 points), la différence d'initialisation des moyennes (pandas part du premier
point, le TypeScript de la moyenne simple des N premiers) devient négligeable : (25/27)^300 ~ 7e-11.

Usage : python scripts/indicator-fixtures.py
"""
import json
import random
from pathlib import Path

import pandas as pd

rng = random.Random(42)
price = 100.0
closes = []
for _ in range(300):
    price = max(1.0, price * (1 + rng.gauss(0.0005, 0.03)))
    closes.append(round(price, 4))

s = pd.Series(closes)

# RSI de Wilder (lissage alpha = 1/14)
delta = s.diff()
gain = delta.clip(lower=0).ewm(alpha=1 / 14, adjust=False).mean()
loss = (-delta.clip(upper=0)).ewm(alpha=1 / 14, adjust=False).mean()
rsi = 100 - 100 / (1 + gain / loss)

# MACD 12 / 26 / 9
macd = s.ewm(span=12, adjust=False).mean() - s.ewm(span=26, adjust=False).mean()
signal = macd.ewm(span=9, adjust=False).mean()

out = {
    "closes": closes,
    "last": {
        "rsi": float(rsi.iloc[-1]),
        "macd": float(macd.iloc[-1]),
        "signalLine": float(signal.iloc[-1]),
        "histogram": float((macd - signal).iloc[-1]),
    },
}
Path("src/lib/indicators.fixture.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
print(out["last"])
