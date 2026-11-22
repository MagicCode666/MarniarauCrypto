import { describe, expect, it } from 'vitest'
import { collect, type Deps } from './collector'

const ENV = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'cle-de-test' }
const NOW = new Date('2026-11-22T12:00:00Z')

type Call = { url: string; method: string; body?: unknown; headers: Record<string, string> }

function fakeNetwork(opts: {
  coins: { coin_id: string; history_loaded_at: string | null }[]
  markets?: () => Response
  chart?: (id: string) => Response
}) {
  const calls: Call[] = []
  const sleeps: number[] = []
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({
      url,
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
    })
    if (url.startsWith('https://db.test/rest/v1/coins?select')) return json(opts.coins)
    if (url.startsWith('https://db.test/')) return new Response(null, { status: 201 })
    if (url.includes('/coins/markets')) {
      return (
        opts.markets?.() ??
        json(
          opts.coins.map((c, i) => ({ id: c.coin_id, current_price: 100 + i, last_updated: null })),
        )
      )
    }
    const m = url.match(/coins\/([^/]+)\/market_chart/)
    if (m) {
      return (
        opts.chart?.(m[1]) ??
        json({
          prices: [
            [Date.parse('2026-11-20T10:00:00Z'), 90],
            [Date.parse('2026-11-21T10:00:00Z'), 95],
            [Date.parse('2026-11-22T10:00:00Z'), 99],
          ],
        })
      )
    }
    return new Response('inattendu', { status: 500 })
  }) as typeof fetch
  const deps: Deps = { fetch: f, now: () => NOW, sleep: async (ms) => void sleeps.push(ms) }
  return { calls, sleeps, deps }
}

describe('collect', () => {
  it('écrit les prix et la clôture du jour avec la clé service, en un seul appel CoinGecko', async () => {
    const net = fakeNetwork({
      coins: [
        { coin_id: 'bitcoin', history_loaded_at: '2026-11-01T00:00:00Z' },
        { coin_id: 'ethereum', history_loaded_at: '2026-11-01T00:00:00Z' },
      ],
    })
    const report = await collect(ENV, net.deps)
    expect(report).toEqual({ coins: 2, prices: 2, backfilled: [], coingeckoError: null })
    expect(net.calls.filter((c) => c.url.includes('coingecko'))).toHaveLength(1)
    const prices = net.calls.find((c) => c.url.includes('/rest/v1/prices'))!
    expect(prices.method).toBe('POST')
    expect(prices.url).toContain('on_conflict=coin_id')
    expect(prices.headers.apikey).toBe('cle-de-test')
    expect(prices.headers.prefer).toContain('merge-duplicates')
    const hist = net.calls.find((c) => c.url.includes('/rest/v1/price_history'))!
    expect(hist.body).toEqual([
      { coin_id: 'bitcoin', day: '2026-11-22', close_eur: 100 },
      { coin_id: 'ethereum', day: '2026-11-22', close_eur: 101 },
    ])
  })

  it('rattrape l’historique de 2 cryptos au plus, espacées de 6 s, sans écraser le jour courant', async () => {
    const net = fakeNetwork({
      coins: ['a', 'b', 'c'].map((id) => ({ coin_id: id, history_loaded_at: null })),
    })
    const report = await collect(ENV, net.deps)
    expect(report.backfilled).toEqual(['a', 'b'])
    expect(net.sleeps).toEqual([6000])
    const histWrites = net.calls.filter(
      (c) => c.url.includes('/rest/v1/price_history') && Array.isArray(c.body),
    )
    // 1re écriture : clôture du jour ; ensuite une écriture d'historique par crypto rattrapée
    expect(histWrites).toHaveLength(3)
    expect((histWrites[1].body as { day: string }[]).map((r) => r.day)).toEqual([
      '2026-11-20',
      '2026-11-21',
    ])
    const marked = net.calls.filter((c) => c.method === 'PATCH')
    expect(marked.map((c) => c.url)).toEqual([
      'https://db.test/rest/v1/coins?coin_id=eq.a',
      'https://db.test/rest/v1/coins?coin_id=eq.b',
    ])
  })

  it('en cas de limite CoinGecko (429), n’écrit rien et le signale', async () => {
    const net = fakeNetwork({
      coins: [{ coin_id: 'bitcoin', history_loaded_at: null }],
      markets: () => new Response('too many', { status: 429 }),
    })
    const report = await collect(ENV, net.deps)
    expect(report.coingeckoError).toBe(429)
    expect(report.prices).toBe(0)
    expect(net.calls.some((c) => c.method !== 'GET')).toBe(false)
  })

  it('arrête le rattrapage si CoinGecko refuse, sans marquer la crypto comme chargée', async () => {
    const net = fakeNetwork({
      coins: [
        { coin_id: 'a', history_loaded_at: null },
        { coin_id: 'b', history_loaded_at: null },
      ],
      chart: () => new Response('limite', { status: 429 }),
    })
    const report = await collect(ENV, net.deps)
    expect(report.coingeckoError).toBe(429)
    expect(report.backfilled).toEqual([])
    expect(net.calls.some((c) => c.method === 'PATCH')).toBe(false)
    expect(net.calls.filter((c) => c.url.includes('market_chart'))).toHaveLength(1)
  })

  it('ne fait rien si le catalogue est vide', async () => {
    const net = fakeNetwork({ coins: [] })
    expect(await collect(ENV, net.deps)).toEqual({
      coins: 0,
      prices: 0,
      backfilled: [],
      coingeckoError: null,
    })
    expect(net.calls).toHaveLength(1)
  })

  it('échoue bruyamment si Supabase refuse l’écriture (clé invalide)', async () => {
    const net = fakeNetwork({
      coins: [{ coin_id: 'a', history_loaded_at: '2026-11-01T00:00:00Z' }],
    })
    const original = net.deps.fetch
    net.deps.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('/rest/v1/prices')
        ? new Response('unauthorized', { status: 401 })
        : original(input, init)) as typeof fetch
    await expect(collect(ENV, net.deps)).rejects.toThrow(/401/)
  })
})
