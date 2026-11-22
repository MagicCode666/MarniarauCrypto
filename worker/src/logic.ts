// Logique pure du collecteur (sans réseau), testée dans logic.test.ts.

export type PriceRow = {
  coin_id: string
  price_eur: number
  change_24h_pct: number | null
  market_cap_eur: number | null
  volume_24h_eur: number | null
  updated_at: string
}

export type HistoryRow = { coin_id: string; day: string; close_eur: number }

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Convertit la réponse de /coins/markets. Ignore toute entrée sans prix valide. */
export function parseMarkets(json: unknown, now: Date): PriceRow[] {
  if (!Array.isArray(json)) return []
  const rows: PriceRow[] = []
  for (const item of json) {
    if (typeof item !== 'object' || item === null) continue
    const c = item as Record<string, unknown>
    const price = num(c.current_price)
    if (typeof c.id !== 'string' || price === null || price <= 0) continue
    // Heure de la donnée chez CoinGecko si elle est plausible, sinon heure du relevé
    const reported = typeof c.last_updated === 'string' ? new Date(c.last_updated) : null
    const at = reported && !Number.isNaN(reported.getTime()) && reported <= now ? reported : now
    rows.push({
      coin_id: c.id,
      price_eur: price,
      change_24h_pct: num(c.price_change_percentage_24h),
      market_cap_eur: num(c.market_cap),
      volume_24h_eur: num(c.total_volume),
      updated_at: at.toISOString(),
    })
  }
  return rows
}

export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Clôture du jour (UTC) = dernier prix relevé aujourd'hui. */
export function todayHistory(prices: PriceRow[], now: Date): HistoryRow[] {
  return prices.map((p) => ({ coin_id: p.coin_id, day: utcDay(now), close_eur: p.price_eur }))
}

/** Réduit la série de /market_chart à une clôture par jour UTC (le dernier point du jour). */
export function toDailyCloses(coinId: string, json: unknown): HistoryRow[] {
  const points = (json as { prices?: unknown } | null)?.prices
  if (!Array.isArray(points)) return []
  const byDay = new Map<string, HistoryRow>()
  for (const p of points) {
    if (!Array.isArray(p)) continue
    const ts = num(p[0])
    const price = num(p[1])
    if (ts === null || price === null || price <= 0) continue
    const day = utcDay(new Date(ts))
    byDay.set(day, { coin_id: coinId, day, close_eur: price })
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
}

export type CoinStatus = { coin_id: string; history_loaded_at: string | null }

/** Cryptos dont l'historique n'est pas chargé, par lots pour respecter la limite de CoinGecko. */
export function pickBackfill(coins: CoinStatus[], max: number): string[] {
  return coins
    .filter((c) => c.history_loaded_at === null)
    .slice(0, max)
    .map((c) => c.coin_id)
}
