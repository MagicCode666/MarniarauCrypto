import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fetcher import get_prices, get_history, search_coins, fetch_coin_categories, _cache_get, _cache_set, _cache, HISTORY_TTL
from database import init_db, get_latest_prices, get_watched_coins, add_watched_coin, remove_watched_coin
from indicators import calc_rsi, calc_macd, get_signal
import portfolio as pf
import backtest as bt

HISTORY_DELAY = 6.0


async def history_cache_loop(days: int = 30):
    while True:
        coins_list = [c["coin_id"] for c in get_watched_coins()]
        missing = [c for c in coins_list if not _cache_get(f"history:{c}:{days}")]
        if missing:
            for i, coin in enumerate(missing):
                if i > 0:
                    await asyncio.sleep(HISTORY_DELAY)
                await get_history(coin, days)

        result = {}
        for coin in coins_list:
            entry = _cache_get(f"history:{coin}:{days}")
            if entry:
                result[coin] = entry["data"]

        if len(result) == len(coins_list) and len(coins_list) > 0:
            payload = {"status": "ok", "data": result}
            _cache_set(f"history:all:{days}", payload, ttl=HISTORY_TTL)
            # Dormir en tranches de 60s pour détecter rapidement les nouvelles cryptos ajoutées
            slept = 0
            new_coin_detected = False
            while slept < HISTORY_TTL - 30:
                await asyncio.sleep(60)
                slept += 60
                cur = [c["coin_id"] for c in get_watched_coins()]
                if any(not _cache_get(f"history:{c}:{days}") for c in cur):
                    _cache.pop(f"history:all:{days}", None)
                    new_coin_detected = True
                    break
            if not new_coin_detected:
                cur = [c["coin_id"] for c in get_watched_coins()]
                for coin in cur:
                    _cache.pop(f"history:{coin}:{days}", None)
                _cache.pop(f"history:all:{days}", None)
        else:
            await asyncio.sleep(30)


def _build_analysis(coin: str) -> dict | None:
    entry = _cache_get(f"history:{coin}:30")
    if not entry:
        return None
    prices_list = [p["price"] for p in entry["data"]]
    rsi = calc_rsi(prices_list)
    macd_data = calc_macd(prices_list)
    prices_entry = _cache_get("prices")
    coin_data = prices_entry["data"].get(coin, {}) if prices_entry else {}
    change_24h = coin_data.get("eur_24h_change", 0.0)
    price = coin_data.get("eur", 0.0)
    signal = get_signal(rsi, macd_data["macd"], change_24h)
    return {
        "rsi": rsi,
        "macd": macd_data["macd"],
        "signal_line": macd_data["signal_line"],
        "histogram": macd_data["histogram"],
        "signal": signal,
        "price": price,
        "change_24h": change_24h,
    }


async def backfill_categories():
    import json
    from database import get_connection
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT coin_id FROM watched_coins WHERE categories IS NULL"
        ).fetchall()
        coins_to_fill = [r["coin_id"] for r in rows]
    for coin_id in coins_to_fill:
        cats = await fetch_coin_categories(coin_id)
        with get_connection() as conn:
            conn.execute(
                "UPDATE watched_coins SET categories = ? WHERE coin_id = ?",
                (json.dumps(cats), coin_id)
            )
            conn.commit()
        await asyncio.sleep(6)  # respecter le rate limit CoinGecko


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    asyncio.create_task(history_cache_loop())
    asyncio.create_task(backfill_categories())
    yield


app = FastAPI(title="MarniarauCrypto API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)


class BuyRequest(BaseModel):
    coin: str
    eur_amount: float
    note: str = ""


class SellRequest(BaseModel):
    coin: str
    quantity: float
    note: str = ""


class BacktestRequest(BaseModel):
    coin: str
    strategy: str
    start_date: str
    end_date: str
    initial_capital_eur: float


class WatchedCoinRequest(BaseModel):
    coin_id: str
    symbol: str
    name: str
    color: str


@app.get("/api/prices")
async def prices():
    return await get_prices()


@app.get("/api/prices/stored")
def prices_stored():
    rows = get_latest_prices()
    return {"status": "ok", "data": rows}


# Routes fixes AVANT les routes paramétrées
@app.get("/api/history/all")
async def history_all(days: int = Query(default=30, ge=1, le=365)):
    cache_key = f"history:all:{days}"
    cached = _cache_get(cache_key)
    if cached:
        return cached
    coins_list = [c["coin_id"] for c in get_watched_coins()]
    partial = {}
    for coin in coins_list:
        entry = _cache_get(f"history:{coin}:{days}")
        if entry:
            partial[coin] = entry["data"]
    return {"status": "loading", "data": partial}


@app.get("/api/analysis/all")
def analysis_all():
    coins_list = [c["coin_id"] for c in get_watched_coins()]
    results = {}
    for coin in coins_list:
        data = _build_analysis(coin)
        if data:
            results[coin] = data
    status = "ok" if len(results) == len(coins_list) else "loading"
    return {"status": status, "data": results}


@app.get("/api/history/{coin}")
async def history(coin: str, days: int = Query(default=30, ge=1, le=365)):
    return await get_history(coin, days)


@app.get("/api/analysis/{coin}")
def analysis_coin(coin: str):
    data = _build_analysis(coin)
    if not data:
        return {"status": "loading", "message": "Historique en cours de chargement"}
    return {"status": "ok", **data}


@app.get("/api/portfolio")
async def portfolio_get():
    return await pf.get_portfolio()


@app.post("/api/trade/buy")
async def trade_buy(req: BuyRequest):
    return await pf.buy(req.coin, req.eur_amount, req.note)


@app.post("/api/trade/sell")
async def trade_sell(req: SellRequest):
    return await pf.sell(req.coin, req.quantity, req.note)


@app.get("/api/transactions")
def transactions_get():
    return {"status": "ok", "data": pf.get_transactions()}


@app.post("/api/portfolio/reset")
def portfolio_reset():
    return pf.reset_portfolio()


@app.post("/api/backtest")
async def backtest_run(req: BacktestRequest):
    try:
        start_dt = datetime.strptime(req.start_date, "%Y-%m-%d")
        end_dt   = datetime.strptime(req.end_date,   "%Y-%m-%d")
    except ValueError:
        return {"status": "error", "message": "Format de date invalide (YYYY-MM-DD requis)."}

    today_dt = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    delta = (end_dt - start_dt).days
    days_since_end = (today_dt - end_dt).days

    if delta < 1:
        return {"status": "error", "message": "La date de fin doit être postérieure à la date de début."}
    if delta > 365:
        return {"status": "error", "message": "La période ne peut pas dépasser 365 jours (limite API gratuite)."}
    if days_since_end > 364:
        return {"status": "error", "message": "La date de fin ne peut pas être antérieure à il y a 365 jours (limite API gratuite)."}
    if end_dt >= today_dt:
        return {"status": "error", "message": "La date de fin doit être antérieure à aujourd'hui."}
    if req.initial_capital_eur <= 0:
        return {"status": "error", "message": "Le capital initial doit être positif."}

    watched = [c["coin_id"] for c in get_watched_coins()]
    if req.coin not in watched:
        return {"status": "error", "message": f"Crypto non supportée : {req.coin}"}
    if req.strategy not in ("rsi", "golden_cross"):
        return {"status": "error", "message": f"Stratégie inconnue : {req.strategy}"}

    return await bt.run_backtest(
        req.coin, req.strategy, req.start_date, req.end_date, req.initial_capital_eur
    )


@app.get("/api/watched-coins")
def watched_coins_get():
    return {"status": "ok", "data": get_watched_coins()}


@app.post("/api/watched-coins")
async def watched_coins_add(req: WatchedCoinRequest):
    categories = await fetch_coin_categories(req.coin_id)
    result = add_watched_coin(req.coin_id, req.symbol, req.name, req.color, categories)
    if not result["success"]:
        if result["error"] == "max_reached":
            raise HTTPException(status_code=400, detail="Tu suis déjà 20 cryptos, retire-en une d'abord.")
        if result["error"] == "already_exists":
            raise HTTPException(status_code=400, detail="Cette crypto est déjà dans ta liste.")
    _cache.pop("prices", None)
    _cache.pop("history:all:30", None)
    return {"status": "ok"}


@app.delete("/api/watched-coins/{coin_id}")
def watched_coins_remove(coin_id: str):
    result = remove_watched_coin(coin_id)
    if not result["success"]:
        if result["error"] == "last_coin":
            raise HTTPException(status_code=400, detail="Tu dois garder au moins une crypto dans ta liste.")
        if result["error"] == "not_found":
            raise HTTPException(status_code=404, detail="Crypto non trouvée dans ta liste.")
    _cache.pop("prices", None)
    _cache.pop("history:all:30", None)
    return {"status": "ok"}


@app.get("/api/coins/search")
async def coins_search(query: str = Query(default="", min_length=1)):
    results = await search_coins(query)
    return {"status": "ok", "data": results}
