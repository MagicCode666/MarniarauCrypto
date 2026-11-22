import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { CoinView } from '../lib/market'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
const closesMock = vi.fn()
vi.mock('../hooks/useCloses', () => ({ useCloses: () => closesMock() }))

import { SignalsPage } from './SignalsPage'

const coin = (id: string, name: string, over: Partial<CoinView> = {}): CoinView => ({
  coinId: id,
  symbol: name.slice(0, 3).toUpperCase(),
  name,
  categories: [],
  priceEur: 100,
  change24hPct: 0,
  marketCapEur: 1,
  volume24hEur: 1,
  updatedAt: new Date().toISOString(),
  recent: [],
  ...over,
})

const rising = (n: number) => Array.from({ length: n }, (_, i) => 10 + i)

function renderPage() {
  const state = {
    status: 'ready' as const,
    market: {
      coins: [coin('solana', 'Solana'), coin('bitcoin', 'Bitcoin'), coin('ethereum', 'Ethereum')],
      updatedAt: new Date().toISOString(),
    },
  }
  return render(
    <MemoryRouter initialEntries={['/signaux']}>
      <Routes>
        <Route element={<Outlet context={state} />}>
          <Route path="signaux" element={<SignalsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const names = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('button')[0].textContent)

describe('SignalsPage', () => {
  function setup() {
    closesMock.mockReturnValue({
      bitcoin: rising(60), // RSI 100 (−2), MACD positif (+1), 24 h 0 : score −1
      ethereum: rising(10), // trop court
      solana: 'error',
    })
    renderPage()
  }

  it('affiche le signal, les données insuffisantes et l’erreur d’historique, avec l’avertissement', () => {
    setup()
    expect(screen.getByText('▼ Signal baissier')).toBeTruthy()
    expect(screen.getByText('Données insuffisantes (10/26 jours)')).toBeTruthy()
    expect(screen.getByText('Historique indisponible')).toBeTruthy()
    expect(screen.getByText(/outil éducatif/)).toBeTruthy()
  })

  it('place par défaut les cryptos avec un signal avant celles qui n’en ont pas', () => {
    setup()
    expect(names()[0]).toBe('Bitcoin')
  })

  it('trie par nom au clic sur l’en-tête, puis inverse au second clic', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /^Crypto/ }))
    expect(names()).toEqual(['Bitcoin', 'Ethereum', 'Solana'])
    fireEvent.click(screen.getByRole('button', { name: /^Crypto/ }))
    expect(names()).toEqual(['Solana', 'Ethereum', 'Bitcoin'])
    expect(screen.getByRole('columnheader', { name: /^Crypto/ }).getAttribute('aria-sort')).toBe(
      'descending',
    )
  })

  it('ouvre le détail du score au clic et le referme', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Bitcoin' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Détail du score')).toBeTruthy()
    expect(within(dialog).getByText('RSI à 100,0 : suracheté')).toBeTruthy()
    expect(within(dialog).getByText('MACD positif : tendance haussière à court terme')).toBeTruthy()
    expect(within(dialog).getByText(/Score total/)).toBeTruthy()
    expect(
      within(dialog).getByText('Les indicateurs suggèrent une légère pression vendeuse.'),
    ).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('explique le manque de données dans la modale au lieu d’inventer un signal', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Ethereum' }))
    expect(
      within(screen.getByRole('dialog')).getByText(/Données insuffisantes : 10 jours/),
    ).toBeTruthy()
    expect(screen.queryByText('Détail du score')).toBeNull()
  })

  it('ferme la modale avec Échap', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Bitcoin' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
