import sqlite3
import os
import time

DB_PATH = os.path.join(os.path.dirname(__file__), "marniarau.db")


def get_connection():
    return sqlite3.connect(DB_PATH)


def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS prices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                coin TEXT NOT NULL,
                price REAL NOT NULL,
                change_24h REAL,
                market_cap REAL,
                volume_24h REAL,
                timestamp INTEGER NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS portfolio (
                id INTEGER PRIMARY KEY,
                cash_eur REAL NOT NULL DEFAULT 10000.0,
                created_at INTEGER NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS holdings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                coin TEXT NOT NULL UNIQUE,
                quantity REAL NOT NULL,
                avg_buy_price_eur REAL NOT NULL,
                updated_at INTEGER
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                coin TEXT NOT NULL,
                quantity REAL NOT NULL,
                price_at_trade_eur REAL NOT NULL,
                total_eur REAL NOT NULL,
                timestamp INTEGER NOT NULL,
                note TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS watched_coins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                coin_id TEXT NOT NULL UNIQUE,
                symbol TEXT NOT NULL,
                name TEXT NOT NULL,
                color TEXT NOT NULL,
                added_at INTEGER NOT NULL
            )
        """)
        existing = conn.execute("SELECT id FROM portfolio WHERE id=1").fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO portfolio (id, cash_eur, created_at) VALUES (1, 10000.0, ?)",
                (int(time.time()),)
            )
        # Migration : ajouter la colonne categories si elle n'existe pas encore
        try:
            conn.execute("ALTER TABLE watched_coins ADD COLUMN categories TEXT")
        except Exception:
            pass

        watched_count = conn.execute("SELECT COUNT(*) FROM watched_coins").fetchone()[0]
        if watched_count == 0:
            now = int(time.time())
            defaults = [
                ("bitcoin",     "BTC", "Bitcoin",  "#F7931A", '["Réserve de valeur"]'),
                ("ethereum",    "ETH", "Ethereum", "#627EEA", '["Smart contracts","DeFi"]'),
                ("solana",      "SOL", "Solana",   "#9945FF", '["Smart contracts","DeFi"]'),
                ("binancecoin", "BNB", "BNB",      "#F3BA2F", '["Exchange tokens","Smart contracts"]'),
                ("ripple",      "XRP", "XRP",      "#00AAE4", '["Paiement & transfert"]'),
                ("cardano",     "ADA", "Cardano",  "#0033AD", '["Smart contracts"]'),
            ]
            conn.executemany(
                "INSERT INTO watched_coins (coin_id, symbol, name, color, added_at, categories) VALUES (?, ?, ?, ?, ?, ?)",
                [(c[0], c[1], c[2], c[3], now, c[4]) for c in defaults]
            )
        else:
            # Backfill synchrone pour les coins connus (sans appel API)
            backfill = {
                "bitcoin":       '["Réserve de valeur"]',
                "ethereum":      '["Smart contracts","DeFi"]',
                "solana":        '["Smart contracts","DeFi"]',
                "binancecoin":   '["Exchange tokens","Smart contracts"]',
                "ripple":        '["Paiement & transfert"]',
                "cardano":       '["Smart contracts"]',
                "tether":        '[]',
                "usd-coin":      '[]',
                "dai":           '[]',
                "tron":          '["Smart contracts"]',
                "dogecoin":      '["Memecoins"]',
                "shiba-inu":     '["Memecoins"]',
                "litecoin":      '["Paiement & transfert"]',
                "polkadot":      '["Smart contracts"]',
                "avalanche-2":   '["Smart contracts","DeFi"]',
                "matic-network": '["Smart contracts","DeFi"]',
                "chainlink":     '["DeFi"]',
                "uniswap":       '["DeFi"]',
                "aave":          '["DeFi"]',
                "cosmos":        '["Smart contracts"]',
                "stellar":       '["Paiement & transfert"]',
                "near":          '["Smart contracts","DeFi"]',
                "aptos":         '["Smart contracts"]',
                "sui":           '["Smart contracts"]',
                "pepe":          '["Memecoins"]',
                "bonk":          '["Memecoins"]',
                "floki":         '["Memecoins"]',
                "okb":           '["Exchange tokens"]',
                "crypto-com-chain": '["Exchange tokens"]',
            }
            for coin_id, cats in backfill.items():
                conn.execute(
                    "UPDATE watched_coins SET categories = ? WHERE coin_id = ? AND categories IS NULL",
                    (cats, coin_id)
                )
        conn.commit()


def insert_prices(data: dict, timestamp: int):
    with get_connection() as conn:
        for coin, values in data.items():
            conn.execute(
                "INSERT INTO prices (coin, price, change_24h, market_cap, volume_24h, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    coin,
                    values.get("eur"),
                    values.get("eur_24h_change"),
                    values.get("eur_market_cap"),
                    values.get("eur_24h_vol"),
                    timestamp,
                ),
            )
        conn.commit()


def get_latest_prices() -> list:
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""
            SELECT p.coin, p.price, p.change_24h, p.market_cap, p.volume_24h, p.timestamp
            FROM prices p
            INNER JOIN (
                SELECT coin, MAX(timestamp) AS max_ts
                FROM prices
                GROUP BY coin
            ) latest ON p.coin = latest.coin AND p.timestamp = latest.max_ts
        """).fetchall()
        return [dict(row) for row in rows]


def get_watched_coins() -> list:
    import json
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM watched_coins ORDER BY added_at ASC"
        ).fetchall()
        result = []
        for row in rows:
            d = dict(row)
            raw = d.get("categories")
            d["categories"] = json.loads(raw) if raw else []
            result.append(d)
        return result


def add_watched_coin(coin_id: str, symbol: str, name: str, color: str, categories: list) -> dict:
    import json
    with get_connection() as conn:
        count = conn.execute("SELECT COUNT(*) FROM watched_coins").fetchone()[0]
        if count >= 20:
            return {"success": False, "error": "max_reached"}
        existing = conn.execute(
            "SELECT id FROM watched_coins WHERE coin_id = ?", (coin_id,)
        ).fetchone()
        if existing:
            return {"success": False, "error": "already_exists"}
        conn.execute(
            "INSERT INTO watched_coins (coin_id, symbol, name, color, added_at, categories) VALUES (?, ?, ?, ?, ?, ?)",
            (coin_id, symbol, name, color, int(time.time()), json.dumps(categories))
        )
        conn.commit()
        return {"success": True}


def remove_watched_coin(coin_id: str) -> dict:
    with get_connection() as conn:
        count = conn.execute("SELECT COUNT(*) FROM watched_coins").fetchone()[0]
        if count <= 1:
            return {"success": False, "error": "last_coin"}
        result = conn.execute(
            "DELETE FROM watched_coins WHERE coin_id = ?", (coin_id,)
        ).rowcount
        conn.commit()
        if result == 0:
            return {"success": False, "error": "not_found"}
        return {"success": True}
