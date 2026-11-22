import { useState } from 'react'
import { formatEur } from '../lib/format'
import { errorMessage, resetPortfolio } from '../lib/portfolioApi'
import { Modal } from './Modal'

export function ResetModal({
  portfolioId,
  initialCash,
  onClose,
  onDone,
}: {
  portfolioId: string
  initialCash: number
  onClose: () => void
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await resetPortfolio(portfolioId)
      onDone()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="Remettre à zéro" onClose={onClose}>
      <p className="mt-4 text-sm">
        Ton portefeuille actuel est <strong>archivé</strong> : rien n’est supprimé, mais il n’est
        plus modifiable. Un nouveau portefeuille repart avec {formatEur(initialCash)} et aucune
        position.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-down">
          {error}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={busy}
          className="rounded bg-down px-4 py-2 font-medium text-bg disabled:opacity-60"
        >
          {busy ? 'En cours…' : 'Archiver et recommencer'}
        </button>
        <button type="button" onClick={onClose} className="rounded border border-line px-4 py-2">
          Annuler
        </button>
      </div>
    </Modal>
  )
}
