import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }))
const useAuth = vi.fn()
vi.mock('./auth/AuthProvider', () => ({ useAuth: () => useAuth() }))

import { AppRoutes } from './App'

describe('routes', () => {
  it('envoie un visiteur non connecté vers la connexion', () => {
    useAuth.mockReturnValue({ session: null, loading: false })
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy()
  })

  it('affiche l’accueil et l’avertissement éducatif à un utilisateur connecté', () => {
    useAuth.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false })
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(screen.getByText(/outil éducatif/)).toBeTruthy()
  })
})
