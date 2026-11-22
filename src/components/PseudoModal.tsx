import { useState, type FormEvent } from 'react'
import { errorMessage, savePseudo } from '../lib/portfolioApi'
import { Modal } from './Modal'

/** Le pseudo est ce que voient les autres membres des portefeuilles partagés (et rien d'autre). */
export function PseudoModal({
  userId,
  current,
  onClose,
  onSaved,
}: {
  userId: string
  current: string
  onClose: () => void
  onSaved: () => void
}) {
  const [value, setValue] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = value.trim()
  const invalid = trimmed.length < 1 || trimmed.length > 40

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (invalid) return
    setBusy(true)
    setError(null)
    try {
      await savePseudo(userId, trimmed)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="Mon pseudo" onClose={onClose}>
      <p className="mt-3 text-sm text-muted">
        Les autres membres de tes portefeuilles partagés voient ce pseudo, et seulement lui : ni ton
        email ni aucune autre information.
      </p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Pseudo (1 à 40 caractères)
          <input
            value={value}
            maxLength={40}
            onChange={(e) => setValue(e.target.value)}
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
          disabled={busy || invalid || trimmed === current}
          className="rounded bg-accent p-2 font-medium text-bg disabled:opacity-60"
        >
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </Modal>
  )
}
