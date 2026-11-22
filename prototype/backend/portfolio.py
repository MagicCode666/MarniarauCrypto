import sqlite3
import time
from database import get_connection
from fetcher import get_prices, _cache_get

FEE = 0.001  # 0.1 %


def _current_prices() -> dict:
    cached = _cache_get("prices")
    if cached and cached.get("status") == "ok":
        return {k: v.get("eur", 0.0) for k, v in cached["data"].items()}
    return {}


async def get_portfolio() -> dict:
    prices = _current_prices()
    if not prices:
        result = await get_prices()
        if result.get("status") == "ok":
            prices = {k: v.get("eur", 0.0) for k, v in result["data"].items()}

    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT cash_eur FROM portfolio WHERE id=1").fetchone()
        cash_eur = dict(row)["cash_eur"] if row else 10000.0

        holdings_rows = conn.execute("SELECT * FROM holdings").fetchall()
        holdings = []
        total_invested = 0.0
        total_current = 0.0

        for r in [dict(x) for x in holdings_rows]:
            current_price = prices.get(r["coin"], r["avg_buy_price_eur"])
            current_value = r["quantity"] * current_price
            invested_value = r["quantity"] * r["avg_buy_price_eur"]
            pnl_eur = current_value - invested_value
            pnl_pct = (pnl_eur / invested_value * 100) if invested_value > 0 else 0.0
            holdings.append({
                "coin": r["coin"],
                "quantity": r["quantity"],
                "avg_buy_price_eur": r["avg_buy_price_eur"],
                "current_price_eur": current_price,
                "current_value_eur": current_value,
                "pnl_eur": pnl_eur,
                "pnl_pct": pnl_pct,
            })
            total_invested += invested_value
            total_current += current_value

    pnl_total = total_current - total_invested
    return {
        "status": "ok",
        "cash_eur": cash_eur,
        "holdings": holdings,
        "total_value_eur": cash_eur + total_current,
        "total_invested_eur": total_invested,
        "total_pnl_eur": pnl_total,
        "total_pnl_pct": (pnl_total / total_invested * 100) if total_invested > 0 else 0.0,
    }


async def buy(coin: str, eur_amount: float, note: str = "") -> dict:
    if eur_amount <= 0:
        return {"status": "error", "message": "Montant invalide"}

    prices = _current_prices()
    if not prices:
        result = await get_prices()
        if result.get("status") != "ok":
            return {"status": "error", "message": result.get("message", "Prix indisponibles")}
        prices = {k: v.get("eur", 0.0) for k, v in result["data"].items()}

    price = prices.get(coin)
    if not price:
        return {"status": "error", "message": f"Cryptomonnaie inconnue : {coin}"}

    quantity = (eur_amount * (1 - FEE)) / price

    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT cash_eur FROM portfolio WHERE id=1").fetchone()
        if not row or dict(row)["cash_eur"] < eur_amount:
            return {"status": "error", "message": "Solde insuffisant"}

        conn.execute("UPDATE portfolio SET cash_eur = cash_eur - ? WHERE id=1", (eur_amount,))

        existing = conn.execute(
            "SELECT quantity, avg_buy_price_eur FROM holdings WHERE coin=?", (coin,)
        ).fetchone()
        if existing:
            e = dict(existing)
            new_qty = e["quantity"] + quantity
            new_avg = (e["quantity"] * e["avg_buy_price_eur"] + quantity * price) / new_qty
            conn.execute(
                "UPDATE holdings SET quantity=?, avg_buy_price_eur=?, updated_at=? WHERE coin=?",
                (new_qty, new_avg, int(time.time()), coin),
            )
        else:
            conn.execute(
                "INSERT INTO holdings (coin, quantity, avg_buy_price_eur, updated_at) VALUES (?,?,?,?)",
                (coin, quantity, price, int(time.time())),
            )

        conn.execute(
            "INSERT INTO transactions (type, coin, quantity, price_at_trade_eur, total_eur, timestamp, note)"
            " VALUES (?,?,?,?,?,?,?)",
            ("buy", coin, quantity, price, eur_amount, int(time.time()), note),
        )
        conn.commit()

    return {"status": "ok", "message": f"Achat de {quantity:.8f} {coin} effectué"}


async def sell(coin: str, quantity: float, note: str = "") -> dict:
    if quantity <= 0:
        return {"status": "error", "message": "Quantité invalide"}

    prices = _current_prices()
    if not prices:
        result = await get_prices()
        if result.get("status") != "ok":
            return {"status": "error", "message": result.get("message", "Prix indisponibles")}
        prices = {k: v.get("eur", 0.0) for k, v in result["data"].items()}

    price = prices.get(coin)
    if not price:
        return {"status": "error", "message": f"Cryptomonnaie inconnue : {coin}"}

    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        existing = conn.execute("SELECT quantity FROM holdings WHERE coin=?", (coin,)).fetchone()
        if not existing:
            return {"status": "error", "message": "Vous ne détenez pas cette cryptomonnaie"}
        held = dict(existing)["quantity"]
        if held < quantity - 1e-10:
            return {"status": "error", "message": "Quantité insuffisante en portefeuille"}

        total_eur = quantity * price * (1 - FEE)
        conn.execute("UPDATE portfolio SET cash_eur = cash_eur + ? WHERE id=1", (total_eur,))

        remaining = held - quantity
        if remaining < 1e-10:
            conn.execute("DELETE FROM holdings WHERE coin=?", (coin,))
        else:
            conn.execute(
                "UPDATE holdings SET quantity=?, updated_at=? WHERE coin=?",
                (remaining, int(time.time()), coin),
            )

        conn.execute(
            "INSERT INTO transactions (type, coin, quantity, price_at_trade_eur, total_eur, timestamp, note)"
            " VALUES (?,?,?,?,?,?,?)",
            ("sell", coin, quantity, price, total_eur, int(time.time()), note),
        )
        conn.commit()

    return {"status": "ok", "message": f"Vente de {quantity:.8f} {coin} effectuée"}


def get_transactions(limit: int = 50) -> list:
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


def reset_portfolio() -> dict:
    with get_connection() as conn:
        conn.execute("UPDATE portfolio SET cash_eur=10000.0 WHERE id=1")
        conn.execute("DELETE FROM holdings")
        conn.execute("DELETE FROM transactions")
        conn.commit()
    return {"status": "ok", "message": "Portefeuille remis à zéro (10 000 €)"}
