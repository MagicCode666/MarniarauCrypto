import httpx
from datetime import datetime, timedelta

FEE = 0.001
WARMUP_DAYS = 65


def _calc_rsi_series(prices: list[float], period: int = 14) -> list[float]:
    n = len(prices)
    if n < period + 1:
        return [50.0] * n

    deltas = [prices[i] - prices[i - 1] for i in range(1, n)]
    gains  = [max(d, 0.0) for d in deltas]
    losses = [max(-d, 0.0) for d in deltas]

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    def _rsi(ag, al):
        if al == 0:
            return 100.0
        return 100.0 - 100.0 / (1 + ag / al)

    series = [50.0] * period
    series.append(_rsi(avg_gain, avg_loss))

    for i in range(period, n - 1):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        series.append(_rsi(avg_gain, avg_loss))

    return series  # len == n


def _calc_ema_series(prices: list[float], period: int) -> list[float]:
    if not prices:
        return []
    k = 2.0 / (period + 1)
    ema = [prices[0]]
    for p in prices[1:]:
        ema.append(p * k + ema[-1] * (1 - k))
    return ema  # len == len(prices)


async def _fetch_daily(coin: str, days: int) -> list[dict]:
    """Fetch up to `days` days of daily data using the free-tier endpoint."""
    url = (
        f"https://api.coingecko.com/api/v3/coins/{coin}/market_chart"
        f"?vs_currency=eur&days={days}"
    )
    async with httpx.AsyncClient(timeout=25.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        raw = resp.json()

    # Deduplicate to one point per calendar day (first occurrence)
    daily: dict[str, dict] = {}
    for ts_ms, price in raw.get("prices", []):
        ts = int(ts_ms / 1000)
        date_key = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
        if date_key not in daily:
            daily[date_key] = {"timestamp": ts, "price": price, "date": date_key}

    return sorted(daily.values(), key=lambda x: x["timestamp"])


async def run_backtest(
    coin: str,
    strategy: str,
    start_date: str,
    end_date: str,
    initial_capital_eur: float,
) -> dict:
    start_dt  = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt    = datetime.strptime(end_date,   "%Y-%m-%d")
    warmup_dt = start_dt - timedelta(days=WARMUP_DAYS)
    today     = datetime.utcnow()

    # days=N returns data from N days ago to now — free tier, no API key needed
    days_to_fetch = min((today - warmup_dt).days + 1, 365)

    try:
        all_points = await _fetch_daily(coin, days_to_fetch)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            return {"status": "error", "message": "Limite de taux CoinGecko atteinte. Veuillez patienter 60 secondes."}
        return {"status": "error", "message": f"Erreur CoinGecko ({e.response.status_code})."}
    except Exception:
        return {"status": "error", "message": "CoinGecko est actuellement indisponible."}

    # Keep only points up to end_date
    points = [p for p in all_points if p["date"] <= end_date]

    if len(points) < 5:
        return {"status": "error", "message": "Données insuffisantes pour cette période."}

    prices = [p["price"] for p in points]
    dates  = [p["date"]  for p in points]

    # First index inside [start_date, end_date]
    start_idx = next((i for i, d in enumerate(dates) if d >= start_date), len(dates))
    if start_idx >= len(dates):
        return {"status": "error", "message": "Aucune donnée disponible pour la période demandée."}

    # Pre-compute indicator series over all points (warmup + period)
    if strategy == "rsi":
        rsi_series = _calc_rsi_series(prices, 14)
    elif strategy == "golden_cross":
        ema20_series = _calc_ema_series(prices, 20)
        ema50_series = _calc_ema_series(prices, 50)
    else:
        return {"status": "error", "message": f"Stratégie inconnue : {strategy}"}

    # --- Simulation ---
    cash         = initial_capital_eur
    position_qty = 0.0
    buy_price    = 0.0
    in_position  = False

    trades     = []
    chart_data = []

    win_count   = 0
    total_sells = 0
    peak_value  = initial_capital_eur
    max_drawdown = 0.0

    # Buy-and-hold reference: buy at first simulation day
    hold_price = prices[start_idx]
    hold_qty   = (initial_capital_eur * (1 - FEE)) / hold_price if hold_price > 0 else 0.0

    for i in range(start_idx, len(prices)):
        price    = prices[i]
        date_str = dates[i]

        buy_signal = sell_signal = False

        if strategy == "rsi":
            rsi = rsi_series[i]
            if not in_position and rsi < 30:
                buy_signal = True
            elif in_position and rsi > 70:
                sell_signal = True

        elif strategy == "golden_cross" and i > 0:
            ema20  = ema20_series[i];     ema50  = ema50_series[i]
            prev20 = ema20_series[i - 1]; prev50 = ema50_series[i - 1]
            if not in_position and prev20 <= prev50 and ema20 > ema50:
                buy_signal = True
            elif in_position and prev20 >= prev50 and ema20 < ema50:
                sell_signal = True

        if buy_signal:
            qty          = (cash * (1 - FEE)) / price
            position_qty = qty
            buy_price    = price
            in_position  = True
            cash         = 0.0
            trades.append({
                "date": date_str, "type": "buy",
                "price_eur": round(price, 2),
                "quantity": round(qty, 8),
                "portfolio_value_eur": round(qty * price, 2),
            })
        elif sell_signal:
            sell_qty   = position_qty
            received   = sell_qty * price * (1 - FEE)
            if price > buy_price:
                win_count += 1
            total_sells += 1
            cash         = received
            position_qty = 0.0
            in_position  = False
            trades.append({
                "date": date_str, "type": "sell",
                "price_eur": round(price, 2),
                "quantity": round(sell_qty, 8),
                "portfolio_value_eur": round(cash, 2),
            })

        current_value = cash + position_qty * price

        if current_value > peak_value:
            peak_value = current_value
        drawdown = (peak_value - current_value) / peak_value * 100 if peak_value > 0 else 0.0
        if drawdown > max_drawdown:
            max_drawdown = drawdown

        chart_data.append({
            "date": date_str,
            "strategy_value": round(current_value, 2),
            "hold_value": round(hold_qty * price, 2),
        })

    # Final value: open position valued at last price (no closing fee — unrealised)
    final_value = cash + position_qty * prices[-1]
    return_pct  = (final_value - initial_capital_eur) / initial_capital_eur * 100
    win_rate    = (win_count / total_sells * 100) if total_sells > 0 else 0.0

    return {
        "status": "ok",
        "trades": trades,
        "final_value_eur": round(final_value, 2),
        "return_pct": round(return_pct, 2),
        "max_drawdown_pct": round(max_drawdown, 2),
        "win_rate_pct": round(win_rate, 2),
        "chart_data": chart_data,
    }
