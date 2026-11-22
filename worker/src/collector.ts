import {
  parseMarkets,
  pickBackfill,
  todayHistory,
  toDailyCloses,
  type CoinStatus,
  type HistoryRow,
  type PriceRow,
} from './logic'

export type Env = { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string }

export type Deps = {
  fetch: typeof fetch
  now: () => Date
  sleep: (ms: number) => Promise<void>
}

export type Report = {
  coins: number
  prices: number
  backfilled: string[]
  coingeckoError: number | null
}

const COINGECKO = 'https://api.coingecko.com/api/v3'
const BACKFILL_PER_RUN = 2
const BACKFILL_SPACING_MS = 6000
const HEADERS = { accept: 'application/json', 'user-agent': 'MarniarauCrypto-collector/1.0' }

function supabase(env: Env, f: typeof fetch) {
  const base = `${env.SUPABASE_URL}/rest/v1`
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
  }
  async function check(res: Response, what: string) {
    if (!res.ok) throw new Error(`Supabase ${what} : ${res.status} ${await res.text()}`)
  }
  return {
    async activeCoins(): Promise<CoinStatus[]> {
      const res = await f(`${base}/coins?select=coin_id,history_loaded_at&active=eq.true`, {
        headers,
      })
      await check(res, 'lecture du catalogue')
      return (await res.json()) as CoinStatus[]
    },
    async upsert(table: string, conflict: string, rows: PriceRow[] | HistoryRow[]) {
      if (rows.length === 0) return
      const res = await f(`${base}/${table}?on_conflict=${conflict}`, {
        method: 'POST',
        headers: { ...headers, prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      })
      await check(res, `écriture ${table}`)
    },
    async markLoaded(coinId: string, at: Date) {
      const res = await f(`${base}/coins?coin_id=eq.${encodeURIComponent(coinId)}`, {
        method: 'PATCH',
        headers: { ...headers, prefer: 'return=minimal' },
        body: JSON.stringify({ history_loaded_at: at.toISOString() }),
      })
      await check(res, 'marquage historique')
    },
  }
}

/** Un passage du collecteur : prix du jour pour tout le catalogue, puis rattrapage de l'historique. */
export async function collect(env: Env, deps: Deps): Promise<Report> {
  const db = supabase(env, deps.fetch)
  const report: Report = { coins: 0, prices: 0, backfilled: [], coingeckoError: null }

  const coins = await db.activeCoins()
  report.coins = coins.length
  if (coins.length === 0) return report

  const ids = coins.map((c) => c.coin_id).join(',')
  const markets = await deps.fetch(
    `${COINGECKO}/coins/markets?vs_currency=eur&ids=${ids}&per_page=250&sparkline=false&price_change_percentage=24h`,
    { headers: HEADERS },
  )
  if (!markets.ok) {
    // Limite atteinte ou panne : on garde les dernières valeurs et on réessaie au prochain passage
    report.coingeckoError = markets.status
    return report
  }
  const now = deps.now()
  const prices = parseMarkets(await markets.json(), now)
  await db.upsert('prices', 'coin_id', prices)
  const today = todayHistory(prices, now)
  await db.upsert('price_history', 'coin_id,day', today)
  report.prices = prices.length

  const known = new Set(prices.map((p) => p.coin_id))
  const todo = pickBackfill(coins, BACKFILL_PER_RUN).filter((id) => known.has(id))
  for (const [i, id] of todo.entries()) {
    if (i > 0) await deps.sleep(BACKFILL_SPACING_MS)
    const res = await deps.fetch(
      `${COINGECKO}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=eur&days=365`,
      { headers: HEADERS },
    )
    if (!res.ok) {
      report.coingeckoError = res.status
      break
    }
    const rows = toDailyCloses(id, await res.json())
    if (rows.length === 0) continue
    // Ne pas écraser la clôture du jour déjà relevée par le collecteur : on retire le jour courant
    const day = today[0]?.day
    await db.upsert(
      'price_history',
      'coin_id,day',
      rows.filter((r) => r.day !== day),
    )
    await db.markLoaded(id, now)
    report.backfilled.push(id)
  }
  return report
}
