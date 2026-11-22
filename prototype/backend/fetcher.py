import httpx
import time
from database import get_watched_coins

PRICES_TTL = 60
HISTORY_TTL = 1800

_cache: dict = {}


def _cache_get(key: str):
    entry = _cache.get(key)
    if entry and time.time() - entry["ts"] < entry["ttl"]:
        return entry["value"]
    return None


def _cache_set(key: str, value, ttl: int = PRICES_TTL):
    _cache[key] = {"ts": time.time(), "ttl": ttl, "value": value}


def _error_response(message: str) -> dict:
    return {"status": "error", "message": message}


async def get_prices() -> dict:
    cached = _cache_get("prices")
    if cached:
        return cached
    coins = get_watched_coins()
    coin_ids = ",".join(c["coin_id"] for c in coins)
    url = (
        f"https://api.coingecko.com/api/v3/simple/price"
        f"?ids={coin_ids}"
        f"&vs_currencies=eur"
        f"&include_24hr_change=true"
        f"&include_market_cap=true"
        f"&include_24hr_vol=true"
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            result = {"status": "ok", "data": response.json()}
            _cache_set("prices", result, ttl=PRICES_TTL)
            return result
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            return _error_response("Limite de taux CoinGecko atteinte. Veuillez patienter 60 secondes avant de réessayer.")
        return _error_response(f"Erreur CoinGecko ({e.response.status_code}). Veuillez réessayer dans quelques instants.")
    except Exception:
        return _error_response("CoinGecko est actuellement indisponible. Veuillez réessayer dans quelques instants.")


async def get_history(coin: str, days: int = 30) -> dict:
    cache_key = f"history:{coin}:{days}"
    cached = _cache_get(cache_key)
    if cached:
        return cached
    url = (
        f"https://api.coingecko.com/api/v3/coins/{coin}/market_chart"
        f"?vs_currency=eur&days={days}"
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            raw = response.json()
            points = [
                {"timestamp": int(ts / 1000), "price": price}
                for ts, price in raw.get("prices", [])
            ]
            result = {"status": "ok", "coin": coin, "data": points}
            _cache_set(cache_key, result, ttl=HISTORY_TTL)
            return result
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            return _error_response("Limite de taux CoinGecko atteinte. Veuillez patienter 60 secondes avant de réessayer.")
        return _error_response(f"Erreur CoinGecko ({e.response.status_code}). Veuillez réessayer dans quelques instants.")
    except Exception:
        return _error_response("CoinGecko est actuellement indisponible. Veuillez réessayer dans quelques instants.")


# Mapping des catégories CoinGecko vers nos 6 familles
_CATEGORY_MAP = {
    "smart contract platform": "Smart contracts",
    "layer 1 (l1)": "Smart contracts",
    "layer 1": "Smart contracts",
    "layer-1": "Smart contracts",
    "decentralized finance (defi)": "DeFi",
    "defi": "DeFi",
    "yield farming": "DeFi",
    "decentralized exchange (dex)": "DeFi",
    "decentralized exchange": "DeFi",
    "lending & borrowing": "DeFi",
    "lending/borrowing": "DeFi",
    "liquid staking tokens": "DeFi",
    "exchange-based tokens": "Exchange tokens",
    "centralized exchange (cex) tokens": "Exchange tokens",
    "cex token": "Exchange tokens",
    "payments": "Paiement & transfert",
    "payment solutions": "Paiement & transfert",
    "cross-chain communication": "Paiement & transfert",
    "remittance": "Paiement & transfert",
    "store of value": "Réserve de valeur",
    "meme token": "Memecoins",
    "meme": "Memecoins",
    "dog-themed": "Memecoins",
    "dog-themed coins": "Memecoins",
    "cat-themed": "Memecoins",
    "cat-themed coins": "Memecoins",
    "frog-themed": "Memecoins",
    "frog-themed coins": "Memecoins",
    "ai meme coins": "Memecoins",
    "4chan-themed": "Memecoins",
    "elon musk-inspired": "Memecoins",
}


async def fetch_coin_categories(coin_id: str) -> list:
    url = (
        f"https://api.coingecko.com/api/v3/coins/{coin_id}"
        "?localization=false&tickers=false&market_data=false"
        "&community_data=false&developer_data=false&sparkline=false"
    )
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            raw_cats = response.json().get("categories", [])
        seen = set()
        result = []
        for cat in raw_cats:
            mapped = _CATEGORY_MAP.get(cat.lower())
            if mapped and mapped not in seen:
                seen.add(mapped)
                result.append(mapped)
        return result
    except Exception:
        return []


async def search_coins(query: str) -> list:
    url = f"https://api.coingecko.com/api/v3/search?query={query}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            coins = data.get("coins", [])[:8]
            return [
                {
                    "coin_id": c["id"],
                    "symbol": c["symbol"].upper(),
                    "name": c["name"],
                    "thumb": c.get("thumb", ""),
                }
                for c in coins
            ]
    except Exception:
        return []
