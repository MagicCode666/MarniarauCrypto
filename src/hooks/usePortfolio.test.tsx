import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortfolioInfo } from '../lib/portfolio'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
const api = vi.hoisted(() => ({
  listPortfolios: vi.fn(),
  loadPortfolio: vi.fn(),
  loadTransactions: vi.fn(),
  loadMembers: vi.fn(),
}))
vi.mock('../lib/portfolioApi', () => ({ ...api, PAGE_SIZE: 2 }))

import { usePortfolio } from './usePortfolio'

const info = (over: Partial<PortfolioInfo> = {}): PortfolioInfo => ({
  id: 'p1',
  name: 'Mon portefeuille',
  kind: 'personal',
  role: 'owner',
  initialCash: 10000,
  feeRate: 0.005,
  memberCount: 1,
  ...over,
})
const shared = info({ id: 'p2', name: 'Famille', kind: 'shared', memberCount: 2 })

const tx = (id: number) => ({
  id,
  userId: 'u1',
  coinId: 'bitcoin',
  side: 'buy' as const,
  quantity: 1,
  priceEur: 1,
  feeEur: 0,
  totalEur: 1,
  note: null,
  createdAt: '2026-11-22T10:00:00Z',
})

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  api.listPortfolios.mockResolvedValue([info(), shared])
  api.loadPortfolio.mockImplementation((p: PortfolioInfo) =>
    Promise.resolve({ portfolio: p, cash: 10000, positions: [] }),
  )
  api.loadTransactions.mockResolvedValue([])
  api.loadMembers.mockResolvedValue([{ userId: 'u1', pseudo: 'Nico', role: 'owner' }])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('usePortfolio', () => {
  it('charge le portefeuille personnel par défaut, sans lire de membres', async () => {
    const { result } = renderHook(() => usePortfolio())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.data?.portfolio.id).toBe('p1')
    expect(result.current.portfolios.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(api.loadMembers).not.toHaveBeenCalled()
  })

  it('charge les membres d’un portefeuille partagé et mémorise le choix', async () => {
    const { result } = renderHook(() => usePortfolio())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(() => result.current.refresh('p2'))
    expect(result.current.data?.portfolio.id).toBe('p2')
    expect(api.loadMembers).toHaveBeenCalledWith('p2')
    expect(result.current.members).toHaveLength(1)
    expect(localStorage.getItem('marniarau:portfolio')).toBe('p2')
  })

  it('revient au premier portefeuille quand celui consulté n’est plus dans la liste', async () => {
    localStorage.setItem('marniarau:portfolio', 'p2')
    api.listPortfolios.mockResolvedValue([info(), shared])
    const { result } = renderHook(() => usePortfolio())
    await waitFor(() => expect(result.current.data?.portfolio.id).toBe('p2'))
    api.listPortfolios.mockResolvedValue([info()]) // p2 archivé ou quitté
    await act(() => result.current.refresh())
    expect(result.current.data?.portfolio.id).toBe('p1')
    expect(result.current.members).toEqual([])
  })

  it('un portefeuille partagé est relu toutes les 60 secondes, pas un portefeuille personnel', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    localStorage.setItem('marniarau:portfolio', 'p2')
    const { result } = renderHook(() => usePortfolio())
    await waitFor(() => expect(result.current.data?.portfolio.id).toBe('p2'))
    const before = api.listPortfolios.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(api.listPortfolios.mock.calls.length).toBeGreaterThan(before)
  })

  it('ne relit pas en boucle un portefeuille personnel', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { result } = renderHook(() => usePortfolio())
    await waitFor(() => expect(result.current.data?.portfolio.id).toBe('p1'))
    const before = api.listPortfolios.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000)
    })
    expect(api.listPortfolios.mock.calls.length).toBe(before)
  })

  it('garde les dernières données quand une actualisation échoue', async () => {
    const { result } = renderHook(() => usePortfolio())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    api.listPortfolios.mockRejectedValue(new Error('réseau'))
    await act(() => result.current.refresh())
    expect(result.current.status).toBe('error')
    expect(result.current.data?.portfolio.id).toBe('p1')
  })

  it('pagine les transactions', async () => {
    api.loadTransactions.mockResolvedValueOnce([tx(4), tx(3)]).mockResolvedValueOnce([tx(2)])
    const { result } = renderHook(() => usePortfolio())
    await waitFor(() => expect(result.current.transactions).toHaveLength(2))
    expect(result.current.hasMore).toBe(true) // page pleine
    await act(() => result.current.loadMore())
    expect(result.current.transactions.map((t) => t.id)).toEqual([4, 3, 2])
    expect(result.current.hasMore).toBe(false)
  })

  it('sans aucun portefeuille, signale simplement l’absence de données', async () => {
    api.listPortfolios.mockResolvedValue([])
    const { result } = renderHook(() => usePortfolio())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.data).toBeNull()
  })
})
