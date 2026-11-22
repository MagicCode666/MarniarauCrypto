import { useState, type FormEvent } from 'react'
import { inviteLink, type PortfolioInfo } from '../lib/portfolio'
import { createInvitation, errorMessage } from '../lib/portfolioApi'
import { Modal } from './Modal'
import { PseudoNotice } from './PseudoNotice'

const DAYS = [1, 7, 14, 30] as const

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle')
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <span className="flex gap-2">
        <input
          readOnly
          value={value}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded border border-line bg-bg p-2 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => void copyText(value).then((ok) => setState(ok ? 'ok' : 'fail'))}
          className="whitespace-nowrap rounded border border-line px-3 text-sm"
        >
          Copier
        </button>
      </span>
      {state === 'ok' && <span className="text-xs text-muted">Copié.</span>}
      {state === 'fail' && (
        <span className="text-xs text-down">
          Copie impossible : sélectionne le texte à la main.
        </span>
      )}
    </div>
  )
}

/** Génère un code d'invitation. Il n'est affiché qu'une fois : seule son empreinte est conservée. */
export function InviteModal({
  portfolio,
  pseudo,
  onEditPseudo,
  onClose,
  onCreated,
}: {
  portfolio: PortfolioInfo
  pseudo: string | null
  onEditPseudo: () => void
  onClose: () => void
  onCreated: () => void
}) {
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [days, setDays] = useState<number>(7)
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setToken(await createInvitation(portfolio.id, role, days))
      onCreated()
    } catch (err) {
      setError(errorMessage(err))
    }
    setBusy(false)
  }

  return (
    <Modal title={`Inviter dans « ${portfolio.name} »`} onClose={onClose}>
      {token === null ? (
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
          <PseudoNotice pseudo={pseudo} onEdit={onEditPseudo} />
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1">Rôle de la personne invitée</legend>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="role"
                checked={role === 'editor'}
                onChange={() => setRole('editor')}
              />
              <span>
                <strong>Éditeur</strong> : consulte, achète et vend avec le cash commun.
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="role"
                checked={role === 'viewer'}
                onChange={() => setRole('viewer')}
              />
              <span>
                <strong>Lecteur</strong> : consulte seulement.
              </span>
            </label>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm">
            Validité du code
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded border border-line bg-bg p-2"
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d === 1 ? '1 jour' : `${d} jours`}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p role="alert" className="text-sm text-down">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-accent p-2 font-medium text-bg disabled:opacity-60"
          >
            {busy ? 'Génération…' : 'Générer l’invitation'}
          </button>
        </form>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <p role="status" className="rounded border border-line bg-bg p-3 text-sm">
            Invitation créée. <strong>Copie-la maintenant</strong> : ce code ne sera plus affichable
            une fois cette fenêtre fermée (tu pourras en générer un autre). Il ne sert qu’une fois
            et expire dans {days === 1 ? '1 jour' : `${days} jours`}.
          </p>
          <CopyRow
            label="Lien d’invitation"
            value={inviteLink(token, window.location.origin, import.meta.env.BASE_URL)}
          />
          <CopyRow label="Code" value={token} />
          <p className="text-xs text-muted">
            Transmets-le toi-même (message, SMS, de vive voix) à la personne. Elle se connecte avec
            son propre compte, puis ouvre le lien ou colle le code.
          </p>
          <button type="button" onClick={onClose} className="rounded border border-line px-4 py-2">
            Terminé
          </button>
        </div>
      )}
    </Modal>
  )
}
