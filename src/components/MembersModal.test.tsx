import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Invitation, Member, PortfolioInfo, Role } from '../lib/portfolio'

const api = vi.hoisted(() => ({
  listInvitations: vi.fn(),
  revokeInvitation: vi.fn(),
  removeMember: vi.fn(),
  setMemberRole: vi.fn(),
  leavePortfolio: vi.fn(),
  archivePortfolio: vi.fn(),
}))
vi.mock('../lib/portfolioApi', () => ({
  ...api,
  errorMessage: (e: unknown) => (e as Error).message,
}))

import { MembersModal } from './MembersModal'

const portfolio = (role: Role): PortfolioInfo => ({
  id: 'pf2',
  name: 'Famille',
  kind: 'shared',
  role,
  initialCash: 10000,
  feeRate: 0.005,
  memberCount: 3,
})

const members: Member[] = [
  { userId: 'u1', pseudo: 'Nico', role: 'owner' },
  { userId: 'u2', pseudo: 'Paul', role: 'editor' },
  { userId: 'u3', pseudo: 'Quentin', role: 'viewer' },
]

const future = new Date(Date.now() + 3 * 86400000).toISOString()
const past = new Date(Date.now() - 86400000).toISOString()
const inv = (over: Partial<Invitation> = {}): Invitation => ({
  id: 'i1',
  role: 'editor',
  createdAt: past,
  expiresAt: future,
  usedAt: null,
  revokedAt: null,
  ...over,
})

function renderModal(role: Role, currentUserId = 'u1') {
  const handlers = {
    onClose: vi.fn(),
    onInvite: vi.fn(),
    onChanged: vi.fn(),
    onGone: vi.fn(),
  }
  render(
    <MembersModal
      portfolio={portfolio(role)}
      members={members}
      currentUserId={currentUserId}
      {...handlers}
    />,
  )
  return handlers
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listInvitations.mockResolvedValue([])
  for (const f of [
    api.revokeInvitation,
    api.removeMember,
    api.setMemberRole,
    api.leavePortfolio,
    api.archivePortfolio,
  ]) {
    f.mockResolvedValue(undefined)
  }
})

describe('MembersModal : propriétaire', () => {
  it('liste les membres avec leurs rôles et signale « toi »', async () => {
    renderModal('owner')
    expect(await screen.findByText('Nico')).toBeTruthy()
    expect(screen.getByText('(toi)')).toBeTruthy()
    expect(screen.getByText('Propriétaire')).toBeTruthy()
    expect((screen.getByLabelText('Rôle de Paul') as HTMLSelectElement).value).toBe('editor')
    expect((screen.getByLabelText('Rôle de Quentin') as HTMLSelectElement).value).toBe('viewer')
    // pas de menu de rôle ni de bouton « Retirer » pour le propriétaire lui-même
    expect(screen.queryByLabelText('Rôle de Nico')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Retirer' })).toHaveLength(2)
  })

  it('change le rôle d’un membre', async () => {
    const { onChanged } = renderModal('owner')
    fireEvent.change(await screen.findByLabelText('Rôle de Quentin'), {
      target: { value: 'editor' },
    })
    await waitFor(() => expect(api.setMemberRole).toHaveBeenCalledWith('pf2', 'u3', 'editor'))
    expect(onChanged).toHaveBeenCalled()
  })

  it('retire un membre seulement après confirmation', async () => {
    const { onChanged } = renderModal('owner')
    const row = (await screen.findByText('Paul')).closest('li')!
    fireEvent.click(within(row).getByRole('button', { name: 'Retirer' }))
    expect(api.removeMember).not.toHaveBeenCalled() // premier clic : on demande confirmation
    fireEvent.click(within(row).getByRole('button', { name: 'Retirer Paul' }))
    await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith('pf2', 'u2'))
    expect(onChanged).toHaveBeenCalled()
  })

  it('annuler la confirmation ne retire personne', async () => {
    renderModal('owner')
    const row = (await screen.findByText('Paul')).closest('li')!
    fireEvent.click(within(row).getByRole('button', { name: 'Retirer' }))
    fireEvent.click(within(row).getByRole('button', { name: 'Annuler' }))
    expect(api.removeMember).not.toHaveBeenCalled()
    expect(within(row).getByRole('button', { name: 'Retirer' })).toBeTruthy()
  })

  it('liste seulement les invitations en attente et permet de les révoquer', async () => {
    api.listInvitations.mockResolvedValue([
      inv({ id: 'a', role: 'viewer' }),
      inv({ id: 'b', usedAt: past }),
      inv({ id: 'c', revokedAt: past }),
      inv({ id: 'd', expiresAt: past }),
    ])
    const { onChanged } = renderModal('owner')
    expect(await screen.findByText(/Lecteur · en attente/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Révoquer' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Révoquer' }))
    await waitFor(() => expect(api.revokeInvitation).toHaveBeenCalledWith('a'))
    expect(onChanged).toHaveBeenCalled()
  })

  it('indique qu’aucune invitation n’est en attente et ouvre l’invitation', async () => {
    const { onInvite } = renderModal('owner')
    expect(await screen.findByText('Aucune invitation en attente.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Inviter' }))
    expect(onInvite).toHaveBeenCalled()
  })

  it('archive le portefeuille après confirmation et prévient le parent', async () => {
    const { onGone } = renderModal('owner')
    fireEvent.click(await screen.findByRole('button', { name: 'Archiver ce portefeuille' }))
    expect(api.archivePortfolio).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Archiver définitivement' }))
    await waitFor(() => expect(api.archivePortfolio).toHaveBeenCalledWith('pf2'))
    expect(onGone).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Quitter ce portefeuille' })).toBeNull()
  })

  it('affiche l’erreur de la base sans prévenir le parent', async () => {
    api.removeMember.mockRejectedValue(new Error('Le propriétaire ne peut pas être retiré'))
    const { onChanged } = renderModal('owner')
    const row = (await screen.findByText('Paul')).closest('li')!
    fireEvent.click(within(row).getByRole('button', { name: 'Retirer' }))
    fireEvent.click(within(row).getByRole('button', { name: 'Retirer Paul' }))
    expect(await screen.findByText(/ne peut pas être retiré/)).toBeTruthy()
    expect(onChanged).not.toHaveBeenCalled()
  })
})

describe('MembersModal : membre non propriétaire', () => {
  it('voit les membres sans pouvoir les gérer, et peut quitter après confirmation', async () => {
    const { onGone } = renderModal('editor', 'u2')
    expect(await screen.findByText('Paul')).toBeTruthy()
    expect(screen.queryByLabelText(/Rôle de/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retirer' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Inviter' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Archiver ce portefeuille' })).toBeNull()
    expect(api.listInvitations).not.toHaveBeenCalled() // les invitations ne regardent que le propriétaire
    fireEvent.click(screen.getByRole('button', { name: 'Quitter ce portefeuille' }))
    expect(api.leavePortfolio).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Quitter' }))
    await waitFor(() => expect(api.leavePortfolio).toHaveBeenCalledWith('pf2'))
    expect(onGone).toHaveBeenCalled()
  })
})
