import { describe, expect, it } from 'vitest'
import { parseMarkets, pickBackfill, todayHistory, toDailyCloses } from './logic'

const NOW = new Date('2026-11-22T12:00:00Z')

describe('parseMarkets', () => {
  it('convertit une réponse CoinGecko', () => {
    const rows = parseMarkets(
      [
        {
          id: 'bitcoin',
          current_price: 55463,
          price_change_percentage_24h: 0.94,
          market_cap: 1.1e12,
          total_volume: 2.9e10,
          last_updated: '2026-11-22T11:58:00Z',
        },
      ],
      NOW,
    )
    expect(rows).toEqual([
      {
        coin_id: 'bitcoin',
        price_eur: 55463,
        change_24h_pct: 0.94,
        market_cap_eur: 1.1e12,
        volume_24h_eur: 2.9e10,
        updated_at: '2026-11-22T11:58:00.000Z',
      },
    ])
  })

  it('ignore les entrées sans prix valide et garde les champs absents à null', () => {
    const rows = parseMarkets(
      [
        { id: 'a', current_price: null },
        { id: 'b', current_price: 0 },
        { id: 'c', current_price: -3 },
        { current_price: 5 },
        'nimporte quoi',
        { id: 'd', current_price: 2 },
      ],
      NOW,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      coin_id: 'd',
      change_24h_pct: null,
      market_cap_eur: null,
      volume_24h_eur: null,
      updated_at: NOW.toISOString(),
    })
  })

  it('n’accepte pas une heure de mise à jour dans le futur', () => {
    const rows = parseMarkets(
      [{ id: 'a', current_price: 1, last_updated: '2030-01-01T00:00:00Z' }],
      NOW,
    )
    expect(rows[0].updated_at).toBe(NOW.toISOString())
  })

  it('renvoie une liste vide si la réponse n’est pas un tableau', () => {
    expect(parseMarkets({ error: 'rate limit' }, NOW)).toEqual([])
  })
})

describe('toDailyCloses', () => {
  it('garde le dernier point de chaque jour UTC, trié', () => {
    const d = (iso: string) => new Date(iso).getTime()
    const rows = toDailyCloses('bitcoin', {
      prices: [
        [d('2026-11-02T00:00:00Z'), 20],
        [d('2026-11-01T00:00:00Z'), 10],
        [d('2026-11-01T23:00:00Z'), 11],
        [d('2026-11-02T10:00:00Z'), 25],
      ],
    })
    expect(rows).toEqual([
      { coin_id: 'bitcoin', day: '2026-11-01', close_eur: 11 },
      { coin_id: 'bitcoin', day: '2026-11-02', close_eur: 25 },
    ])
  })

  it('ignore les points invalides et les réponses mal formées', () => {
    expect(toDailyCloses('x', null)).toEqual([])
    expect(toDailyCloses('x', { prices: 'non' })).toEqual([])
    expect(toDailyCloses('x', { prices: [[1, 0], [1, null], 'a', [NaN, 3]] })).toEqual([])
  })
})

describe('todayHistory et pickBackfill', () => {
  it('pose la clôture du jour UTC à partir du dernier prix', () => {
    const prices = parseMarkets([{ id: 'a', current_price: 7 }], NOW)
    expect(todayHistory(prices, NOW)).toEqual([{ coin_id: 'a', day: '2026-11-22', close_eur: 7 }])
  })

  it('choisit au plus N cryptos sans historique', () => {
    const coins = [
      { coin_id: 'a', history_loaded_at: '2026-11-01T00:00:00Z' },
      { coin_id: 'b', history_loaded_at: null },
      { coin_id: 'c', history_loaded_at: null },
      { coin_id: 'd', history_loaded_at: null },
    ]
    expect(pickBackfill(coins, 2)).toEqual(['b', 'c'])
    expect(pickBackfill([coins[0]], 2)).toEqual([])
  })
})
