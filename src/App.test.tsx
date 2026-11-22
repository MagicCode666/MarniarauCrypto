import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }))
const useAuth = vi.fn()
vi.mock('./auth/AuthProvider', () => ({ useAuth: () => useAuth() }))
const useMarket = vi.fn()
vi.mock('./hooks/useMarket', () => ({ useMarket: () => useMarket() }))

import { AppRoutes } from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

const bitcoin = {
  coinId: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  categories: ['Réserve de valeur'],
  priceEur: 55463,
  change24hPct: 0.94,
  marketCapEur: 1.1e12,
  volume24hEur: 2.9e10,
  updatedAt: new Date().toISOString(),
  recent: [50000, 52000, 55463],
}

describe('routes', () => {
  it('envoie un visiteur non connecté vers la connexion', () => {
    useAuth.mockReturnValue({ session: null, loading: false })
    renderAt('/')
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy()
  })

  it('affiche les prix avec symbole de tendance et l’avertissement éducatif', () => {
    useAuth.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false })
    useMarket.mockReturnValue({
      status: 'ready',
      market: { coins: [bitcoin], updatedAt: bitcoin.updatedAt },
    })
    renderAt('/')
    expect(screen.getByText('Bitcoin')).toBeTruthy()
    expect(screen.getByText('▲ +0,94 %')).toBeTruthy()
    expect(screen.getByText(/outil éducatif/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'CoinGecko' })).toBeTruthy()
    expect(screen.queryByText(/Données anciennes/)).toBeNull()
  })

  it('signale des données anciennes quand la collecte est arrêtée', () => {
    useAuth.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false })
    const old = new Date(Date.now() - 2 * 3600_000).toISOString()
    useMarket.mockReturnValue({
      status: 'ready',
      market: { coins: [{ ...bitcoin, updatedAt: old }], updatedAt: old },
    })
    renderAt('/')
    expect(screen.getByText(/Données anciennes/)).toBeTruthy()
  })

  it('garde les dernières valeurs et prévient quand l’actualisation échoue', () => {
    useAuth.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false })
    useMarket.mockReturnValue({
      status: 'error',
      market: { coins: [bitcoin], updatedAt: bitcoin.updatedAt },
    })
    renderAt('/')
    expect(screen.getByText('Bitcoin')).toBeTruthy()
    expect(screen.getByText(/Actualisation impossible/)).toBeTruthy()
  })
})
