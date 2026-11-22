import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))

import { buildMarket } from './market'

const coin = (id: string) => ({ coin_id: id, symbol: id.toUpperCase(), name: id, categories: [] })

describe('buildMarket', () => {
  it('assemble prix et clôtures, classe par capitalisation décroissante', () => {
    const m = buildMarket(
      [coin('small'), coin('big')],
      [
        {
          coin_id: 'small',
          price_eur: 1,
          change_24h_pct: -2,
          market_cap_eur: 10,
          volume_24h_eur: 1,
          updated_at: '2026-11-22T10:00:00Z',
        },
        {
          coin_id: 'big',
          price_eur: 100,
          change_24h_pct: 1,
          market_cap_eur: 1000,
          volume_24h_eur: 5,
          updated_at: '2026-11-22T10:05:00Z',
        },
      ],
      [
        { coin_id: 'big', day: '2026-11-02', close_eur: 90 },
        { coin_id: 'big', day: '2026-11-01', close_eur: 80 },
      ],
    )
    expect(m.coins.map((c) => c.coinId)).toEqual(['big', 'small'])
    expect(m.coins[0].recent).toEqual([80, 90])
    expect(m.coins[1].recent).toEqual([])
    expect(m.coins[0].priceEur).toBe(100)
  })

  it('garde une crypto sans prix (collecteur pas encore passé) et la place en dernier', () => {
    const m = buildMarket(
      [coin('nouveau'), coin('vieux')],
      [
        {
          coin_id: 'vieux',
          price_eur: 5,
          change_24h_pct: null,
          market_cap_eur: 5,
          volume_24h_eur: null,
          updated_at: '2026-11-22T10:00:00Z',
        },
      ],
      [],
    )
    expect(m.coins.map((c) => c.coinId)).toEqual(['vieux', 'nouveau'])
    expect(m.coins[1].priceEur).toBeNull()
    expect(m.coins[0].change24hPct).toBeNull()
  })

  it('prend comme fraîcheur la donnée la plus ancienne, null sans prix', () => {
    const price = (id: string, at: string) => ({
      coin_id: id,
      price_eur: 1,
      change_24h_pct: 0,
      market_cap_eur: 1,
      volume_24h_eur: 1,
      updated_at: at,
    })
    const m = buildMarket(
      [coin('a'), coin('b')],
      [price('a', '2026-11-22T10:05:00Z'), price('b', '2026-11-22T09:00:00Z')],
      [],
    )
    expect(m.updatedAt).toBe('2026-11-22T09:00:00Z')
    expect(buildMarket([coin('a')], [], []).updatedAt).toBeNull()
  })
})
