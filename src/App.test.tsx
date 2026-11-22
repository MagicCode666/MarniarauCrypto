import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }))
const useAuth = vi.fn()
vi.mock('./auth/AuthProvider', () => ({ useAuth: () => useAuth() }))
vi.mock('./hooks/usePseudo', () => ({
  usePseudo: () => ({ pseudo: 'Nico', userId: 'u1', reload: vi.fn() }),
}))
vi.mock('./hooks/usePortfolio', () => ({ SELECTED_KEY: 'marniarau:portfolio' }))
const closes = vi.fn()
vi.mock('./hooks/useCloses', () => ({ useCloses: () => closes() }))
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
  beforeEach(() => sessionStorage.clear())
  beforeEach(() =>
    closes.mockReturnValue({ bitcoin: Array.from({ length: 60 }, (_, i) => 10 + i) }),
  )

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

  it('propose les onglets Prix et Signaux et affiche l’écran Signaux', () => {
    useAuth.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false })
    useMarket.mockReturnValue({
      status: 'ready',
      market: { coins: [bitcoin], updatedAt: bitcoin.updatedAt },
    })
    renderAt('/signaux')
    expect(screen.getByRole('link', { name: 'Prix' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Signaux' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('columnheader', { name: /^Signal/ })).toBeTruthy()
  })

  it('renvoie un visiteur non connecté de /signaux vers la connexion', () => {
    useAuth.mockReturnValue({ session: null, loading: false })
    renderAt('/signaux')
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy()
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
  it('lien d’invitation ouvert sans être connecté : le code est gardé et la connexion proposée', () => {
    useAuth.mockReturnValue({ session: null, loading: false })
    renderAt('/rejoindre?code=abc123')
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy()
    expect(sessionStorage.getItem('marniarau:join-code')).toBe('abc123')
  })

  it('après la connexion, un code gardé propose de rejoindre, sans rejoindre automatiquement', () => {
    useAuth.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false })
    useMarket.mockReturnValue({ status: 'ready', market: { coins: [], updatedAt: null } })
    sessionStorage.setItem('marniarau:join-code', 'garde42')
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'Rejoindre un portefeuille partagé' })).toBeTruthy()
    expect((screen.getByLabelText(/Code d’invitation/) as HTMLInputElement).value).toBe('garde42')
  })

  it('affiche le pseudo dans l’en-tête et propose de le modifier', () => {
    useAuth.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false })
    useMarket.mockReturnValue({ status: 'ready', market: { coins: [], updatedAt: null } })
    renderAt('/')
    expect(screen.getByRole('button', { name: 'Nico' })).toBeTruthy()
  })
})
