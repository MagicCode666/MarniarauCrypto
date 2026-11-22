import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortfolioInfo } from '../lib/portfolio'

const api = vi.hoisted(() => ({ createInvitation: vi.fn() }))
vi.mock('../lib/portfolioApi', () => ({
  ...api,
  errorMessage: (e: unknown) => (e as Error).message,
}))

import { InviteModal } from './InviteModal'

const portfolio: PortfolioInfo = {
  id: 'pf2',
  name: 'Famille',
  kind: 'shared',
  role: 'owner',
  initialCash: 10000,
  feeRate: 0.005,
  memberCount: 1,
}

const TOKEN = 'a'.repeat(64)

function renderModal() {
  const onCreated = vi.fn()
  const onClose = vi.fn()
  const onEditPseudo = vi.fn()
  render(
    <InviteModal
      portfolio={portfolio}
      pseudo="Nico"
      onEditPseudo={onEditPseudo}
      onClose={onClose}
      onCreated={onCreated}
    />,
  )
  return { onCreated, onClose, onEditPseudo }
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  })
})

describe('InviteModal', () => {
  it('propose éditeur par défaut, 7 jours, et rappelle le pseudo visible', () => {
    renderModal()
    expect((screen.getByLabelText(/Éditeur/) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText(/Validité du code/) as HTMLSelectElement).value).toBe('7')
    expect(screen.getByText(/« Nico »/)).toBeTruthy()
  })

  it('génère le code avec le rôle et la durée choisis, et l’affiche avec un lien', async () => {
    api.createInvitation.mockResolvedValue(TOKEN)
    const { onCreated } = renderModal()
    fireEvent.click(screen.getByLabelText(/Lecteur/))
    fireEvent.change(screen.getByLabelText(/Validité du code/), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Générer l’invitation' }))
    await waitFor(() => expect(api.createInvitation).toHaveBeenCalledWith('pf2', 'viewer', 30))
    expect(onCreated).toHaveBeenCalled()
    expect(await screen.findByText(/Copie-la maintenant/)).toBeTruthy()
    expect((screen.getByLabelText('Code') as HTMLInputElement).value).toBe(TOKEN)
    const link = (screen.getByLabelText('Lien d’invitation') as HTMLInputElement).value
    expect(link).toMatch(new RegExp(`#/rejoindre\\?code=${TOKEN}$`))
    expect(link.startsWith('http')).toBe(true)
  })

  it('copie le code et confirme', async () => {
    api.createInvitation.mockResolvedValue(TOKEN)
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Générer l’invitation' }))
    await screen.findByText(/Copie-la maintenant/)
    const row = screen.getByLabelText('Code').closest('div')!
    fireEvent.click(within(row).getByRole('button', { name: 'Copier' }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(TOKEN))
    expect(await within(row).findByText('Copié.')).toBeTruthy()
  })

  it('signale une copie impossible au lieu de la taire', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('refusé')) },
      configurable: true,
    })
    api.createInvitation.mockResolvedValue(TOKEN)
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Générer l’invitation' }))
    await screen.findByText(/Copie-la maintenant/)
    const row = screen.getByLabelText('Code').closest('div')!
    fireEvent.click(within(row).getByRole('button', { name: 'Copier' }))
    expect(await within(row).findByText(/Copie impossible/)).toBeTruthy()
  })

  it('affiche l’erreur de la base (trop d’invitations) sans générer de code', async () => {
    api.createInvitation.mockRejectedValue(new Error('Trop d’invitations en attente (20 au plus)'))
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Générer l’invitation' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText(/Trop d’invitations/)).toBeTruthy()
    expect(screen.queryByText(/Copie-la maintenant/)).toBeNull()
  })

  it('« Modifier » le pseudo appelle le rappel prévu', () => {
    const { onEditPseudo } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    expect(onEditPseudo).toHaveBeenCalled()
  })
})
