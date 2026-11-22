import { useState, type FormEvent } from 'react'
import { errorMessage, joinPortfolio } from '../lib/portfolioApi'
import { PseudoNotice } from './PseudoNotice'

/** Saisie d'un code d'invitation. Rejoindre est toujours un geste explicite, jamais automatique. */
export function JoinForm({
  initialCode = '',
  pseudo,
  onEditPseudo,
  onJoined,
}: {
  initialCode?: string
  pseudo: string | null
  onEditPseudo: () => void
  onJoined: (portfolioId: string) => void
}) {
  const [code, setCode] = useState(initialCode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (code.trim() === '') return
    setBusy(true)
    setError(null)
    try {
      onJoined(await joinPortfolio(code.trim()))
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <PseudoNotice pseudo={pseudo} onEdit={onEditPseudo} />
      <label className="flex flex-col gap-1 text-sm">
        Code d’invitation
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="rounded border border-line bg-bg p-2 font-mono text-xs"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-down">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || code.trim() === ''}
        className="rounded bg-accent p-2 font-medium text-bg disabled:opacity-60"
      >
        {busy ? 'Connexion…' : 'Rejoindre'}
      </button>
    </form>
  )
}
