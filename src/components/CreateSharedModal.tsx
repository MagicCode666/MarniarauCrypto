import { useState, type FormEvent } from 'react'
import { createSharedPortfolio, errorMessage } from '../lib/portfolioApi'
import { Modal } from './Modal'
import { PseudoNotice } from './PseudoNotice'

export function CreateSharedModal({
  pseudo,
  onEditPseudo,
  onClose,
  onCreated,
}: {
  pseudo: string | null
  onEditPseudo: () => void
  onClose: () => void
  onCreated: (portfolioId: string) => void
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = name.trim()
  const invalid = trimmed.length < 1 || trimmed.length > 60

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (invalid) return
    setBusy(true)
    setError(null)
    try {
      onCreated(await createSharedPortfolio(trimmed))
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="Nouveau portefeuille partagé" onClose={onClose}>
      <p className="mt-3 text-sm text-muted">
        Un portefeuille commun de 10 000 € : toutes les personnes que tu invites achètent et vendent
        avec le même cash (ou consultent seulement, selon le rôle que tu leur donnes).
      </p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <PseudoNotice pseudo={pseudo} onEdit={onEditPseudo} />
        <label className="flex flex-col gap-1 text-sm">
          Nom du portefeuille
          <input
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Famille"
            className="rounded border border-line bg-bg p-2"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-down">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || invalid}
          className="rounded bg-accent p-2 font-medium text-bg disabled:opacity-60"
        >
          {busy ? 'Création…' : 'Créer'}
        </button>
      </form>
    </Modal>
  )
}
