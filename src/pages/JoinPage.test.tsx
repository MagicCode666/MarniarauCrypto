import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../hooks/usePseudo', () => ({
  usePseudo: () => ({ pseudo: 'Nico', userId: 'u1', reload: vi.fn() }),
}))
const api = vi.hoisted(() => ({ joinPortfolio: vi.fn(), savePseudo: vi.fn() }))
vi.mock('../lib/portfolioApi', () => ({
  ...api,
  PAGE_SIZE: 50,
  errorMessage: (e: unknown) => (e as Error).message,
}))

import { JoinPage } from './JoinPage'

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/rejoindre" element={<JoinPage />} />
        <Route path="/portefeuille" element={<p>ÉCRAN PORTEFEUILLE</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const code = () => screen.getByLabelText(/Code d’invitation/) as HTMLInputElement

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})

describe('JoinPage', () => {
  it('préremplit le code du lien, rappelle le pseudo, et ne rejoint jamais automatiquement', () => {
    renderAt('/rejoindre?code=abc123')
    expect(code().value).toBe('abc123')
    expect(screen.getByText(/« Nico »/)).toBeTruthy()
    expect(api.joinPortfolio).not.toHaveBeenCalled()
  })

  it('reprend le code gardé pendant la connexion quand l’adresse n’en contient plus', () => {
    sessionStorage.setItem('marniarau:join-code', 'garde')
    renderAt('/rejoindre')
    expect(code().value).toBe('garde')
  })

  it('rejoint au clic, mémorise le portefeuille, efface le code gardé et ouvre le portefeuille', async () => {
    api.joinPortfolio.mockResolvedValue('pf2')
    sessionStorage.setItem('marniarau:join-code', 'garde')
    renderAt('/rejoindre?code=abc123')
    fireEvent.click(screen.getByRole('button', { name: 'Rejoindre' }))
    await waitFor(() => expect(api.joinPortfolio).toHaveBeenCalledWith('abc123'))
    expect(await screen.findByText('ÉCRAN PORTEFEUILLE')).toBeTruthy()
    expect(localStorage.getItem('marniarau:portfolio')).toBe('pf2')
    expect(sessionStorage.getItem('marniarau:join-code')).toBeNull()
  })

  it('affiche le message de la base et reste sur la page en cas d’échec', async () => {
    api.joinPortfolio.mockRejectedValue(new Error('Code invalide ou expiré'))
    renderAt('/rejoindre?code=mauvais')
    fireEvent.click(screen.getByRole('button', { name: 'Rejoindre' }))
    expect(await screen.findByText('Code invalide ou expiré')).toBeTruthy()
    expect(screen.queryByText('ÉCRAN PORTEFEUILLE')).toBeNull()
  })

  it('ne propose pas de rejoindre sans code', () => {
    renderAt('/rejoindre')
    expect((screen.getByRole('button', { name: 'Rejoindre' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })
})
