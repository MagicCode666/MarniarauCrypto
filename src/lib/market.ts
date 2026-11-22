import { supabase } from './supabase'

export type CoinView = {
  coinId: string
  symbol: string
  name: string
  categories: string[]
  priceEur: number | null
  change24hPct: number | null
  marketCapEur: number | null
  volume24hEur: number | null
  updatedAt: string | null
  /** Clôtures quotidiennes des 30 derniers jours, de la plus ancienne à la plus récente. */
  recent: number[]
}

export type Market = { coins: CoinView[]; updatedAt: string | null }

export type HistoryPoint = { day: string; close: number }

type CoinRow = { coin_id: string; symbol: string; name: string; categories: string[] }
type PriceRow = {
  coin_id: string
  price_eur: number
  change_24h_pct: number | null
  market_cap_eur: number | null
  volume_24h_eur: number | null
  updated_at: string
}
type HistRow = { coin_id: string; day: string; close_eur: number }

/** Assemble catalogue, derniers prix et clôtures récentes. Classement par capitalisation. */
export function buildMarket(coins: CoinRow[], prices: PriceRow[], history: HistRow[]): Market {
  const priceById = new Map(prices.map((p) => [p.coin_id, p]))
  const histById = new Map<string, HistRow[]>()
  for (const h of history) {
    const list = histById.get(h.coin_id) ?? []
    list.push(h)
    histById.set(h.coin_id, list)
  }
  const views: CoinView[] = coins.map((c) => {
    const p = priceById.get(c.coin_id)
    const recent = (histById.get(c.coin_id) ?? [])
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((h) => Number(h.close_eur))
    return {
      coinId: c.coin_id,
      symbol: c.symbol,
      name: c.name,
      categories: c.categories,
      priceEur: p ? Number(p.price_eur) : null,
      change24hPct: p?.change_24h_pct == null ? null : Number(p.change_24h_pct),
      marketCapEur: p?.market_cap_eur == null ? null : Number(p.market_cap_eur),
      volume24hEur: p?.volume_24h_eur == null ? null : Number(p.volume_24h_eur),
      updatedAt: p?.updated_at ?? null,
      recent,
    }
  })
  views.sort(
    (a, b) => (b.marketCapEur ?? -1) - (a.marketCapEur ?? -1) || a.name.localeCompare(b.name),
  )
  const dates = views.map((v) => v.updatedAt).filter((d): d is string => d !== null)
  // La fraîcheur de l'ensemble est celle de la donnée la plus ancienne
  const updatedAt = dates.length === 0 ? null : dates.reduce((a, b) => (a < b ? a : b))
  return { coins: views, updatedAt }
}

function since(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
}

export async function loadMarket(): Promise<Market> {
  const [coins, prices, history] = await Promise.all([
    supabase.from('coins').select('coin_id,symbol,name,categories').eq('active', true),
    supabase.from('prices').select('*'),
    supabase
      .from('price_history')
      .select('coin_id,day,close_eur')
      .gte('day', since(30))
      .order('day', { ascending: true }),
  ])
  if (coins.error) throw coins.error
  if (prices.error) throw prices.error
  if (history.error) throw history.error
  return buildMarket(coins.data, prices.data, history.data)
}

export async function loadHistory(coinId: string, days: number): Promise<HistoryPoint[]> {
  const { data, error } = await supabase
    .from('price_history')
    .select('day,close_eur')
    .eq('coin_id', coinId)
    .gte('day', since(days))
    .order('day', { ascending: true })
  if (error) throw error
  return data.map((r) => ({ day: r.day, close: Number(r.close_eur) }))
}
