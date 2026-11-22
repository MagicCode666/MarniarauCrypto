import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ savePseudo: vi.fn() }))
vi.mock('../lib/portfolioApi', () => ({
  ...api,
  errorMessage: (e: unknown) => (e as Error).message,
}))

import { PseudoModal } from './PseudoModal'

function renderModal(current = 'Membre-4821') {
  const onSaved = vi.fn()
  const onClose = vi.fn()
  render(<PseudoModal userId="u1" current={current} onClose={onClose} onSaved={onSaved} />)
  return { onSaved, onClose }
}

const input = () => screen.getByLabelText(/Pseudo/) as HTMLInputElement
const save = () => screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement

beforeEach(() => {
  vi.clearAllMocks()
  api.savePseudo.mockResolvedValue(undefined)
})

describe('PseudoModal', () => {
  it('explique que seul le pseudo est partagé', () => {
    renderModal()
    expect(screen.getByText(/ni ton email ni aucune autre information/)).toBeTruthy()
  })

  it('enregistre le pseudo sans les espaces autour', async () => {
    const { onSaved } = renderModal()
    fireEvent.change(input(), { target: { value: '  Nico  ' } })
    fireEvent.click(save())
    await waitFor(() => expect(api.savePseudo).toHaveBeenCalledWith('u1', 'Nico'))
    expect(onSaved).toHaveBeenCalled()
  })

  it('bloque un pseudo vide, ou inchangé', () => {
    renderModal('Nico')
    expect(save().disabled).toBe(true) // inchangé
    fireEvent.change(input(), { target: { value: '   ' } })
    expect(save().disabled).toBe(true) // vide
    fireEvent.change(input(), { target: { value: 'Nicolas' } })
    expect(save().disabled).toBe(false)
  })

  it('affiche l’erreur de la base et ne ferme pas', async () => {
    api.savePseudo.mockRejectedValue(new Error('erreur de base'))
    const { onSaved } = renderModal()
    fireEvent.change(input(), { target: { value: 'Nico' } })
    fireEvent.click(save())
    expect(await screen.findByText('erreur de base')).toBeTruthy()
    expect(onSaved).not.toHaveBeenCalled()
  })
})
