def calc_rsi(prices: list[float], period: int = 14) -> float:
    if len(prices) < period + 1:
        return 50.0

    deltas = [prices[i] - prices[i - 1] for i in range(1, len(prices))]
    gains = [max(d, 0.0) for d in deltas]
    losses = [max(-d, 0.0) for d in deltas]

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)


def _ema(prices: list[float], period: int) -> list[float]:
    k = 2 / (period + 1)
    result = [prices[0]]
    for p in prices[1:]:
        result.append(p * k + result[-1] * (1 - k))
    return result


def calc_macd(prices: list[float]) -> dict:
    if len(prices) < 26:
        return {"macd": 0.0, "signal_line": 0.0, "histogram": 0.0}

    ema12 = _ema(prices, 12)
    ema26 = _ema(prices, 26)
    macd_line = [e12 - e26 for e12, e26 in zip(ema12, ema26)]
    signal = _ema(macd_line, 9)

    macd_val = macd_line[-1]
    signal_val = signal[-1]

    return {
        "macd": round(macd_val, 4),
        "signal_line": round(signal_val, 4),
        "histogram": round(macd_val - signal_val, 4),
    }


def get_signal(rsi: float, macd: float, change_24h: float) -> str:
    score = 0

    if rsi < 30:
        score += 2
    elif rsi < 45:
        score += 1
    elif rsi > 70:
        score -= 2
    elif rsi > 55:
        score -= 1

    if macd > 0:
        score += 1
    elif macd < 0:
        score -= 1

    if change_24h > 5:
        score += 1
    elif change_24h < -5:
        score -= 1

    if score >= 3:
        return "strong_buy"
    if score >= 1:
        return "buy"
    if score <= -3:
        return "strong_sell"
    if score <= -1:
        return "sell"
    return "neutral"
