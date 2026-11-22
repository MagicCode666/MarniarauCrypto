import { useEffect, useState } from 'react'
import {
  invitationStatus,
  ROLE_LABEL,
  type Invitation,
  type Member,
  type PortfolioInfo,
} from '../lib/portfolio'
import {
  archivePortfolio,
  errorMessage,
  leavePortfolio,
  listInvitations,
  removeMember,
  revokeInvitation,
  setMemberRole,
} from '../lib/portfolioApi'
import { Modal } from './Modal'

const dateFr = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

/** Action dangereuse en deux temps : un premier clic demande confirmation. */
function Confirm({
  label,
  confirmLabel,
  onConfirm,
  disabled,
}: {
  label: string
  confirmLabel: string
  onConfirm: () => void
  disabled?: boolean
}) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAsking(true)}
        className="rounded border border-line px-3 py-1 text-xs disabled:opacity-60"
      >
        {label}
      </button>
    )
  }
  return (
    <span className="flex gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={onConfirm}
        className="rounded bg-down px-3 py-1 text-xs font-medium text-bg"
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setAsking(false)}
        className="rounded border border-line px-3 py-1 text-xs"
      >
        Annuler
      </button>
    </span>
  )
}

const STATUS_LABEL = {
  pending: 'en attente',
  used: 'utilisée',
  revoked: 'révoquée',
  expired: 'expirée',
} as const

/** Membres d'un portefeuille partagé : rôles, retraits, invitations, départ et archivage. */
export function MembersModal({
  portfolio,
  members,
  currentUserId,
  onClose,
  onInvite,
  onChanged,
  onGone,
}: {
  portfolio: PortfolioInfo
  members: Member[]
  currentUserId: string | null
  onClose: () => void
  onInvite: () => void
  /** Rôle, retrait ou invitation modifiés : recharger. */
  onChanged: () => void
  /** On a quitté ou archivé le portefeuille : il n'est plus consultable. */
  onGone: () => void
}) {
  const isOwner = portfolio.role === 'owner'
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOwner) return
    let cancelled = false
    listInvitations(portfolio.id).then(
      (list) => !cancelled && setInvitations(list),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [isOwner, portfolio.id, members])

  async function run(action: () => Promise<void>, after: () => void) {
    setBusy(true)
    setError(null)
    try {
      await action()
      after()
    } catch (err) {
      setError(errorMessage(err))
    }
    setBusy(false)
  }

  const now = new Date()
  const pending = invitations.filter((i) => invitationStatus(i, now) === 'pending')

  return (
    <Modal title={`Membres de « ${portfolio.name} »`} onClose={onClose}>
      <ul className="mt-4 flex flex-col gap-2">
        {members.map((m) => (
          <li
            key={m.userId}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-line p-2 text-sm"
          >
            <span>
              <strong>{m.pseudo}</strong>
              {m.userId === currentUserId && <span className="text-muted"> (toi)</span>}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {isOwner && m.role !== 'owner' ? (
                <select
                  aria-label={`Rôle de ${m.pseudo}`}
                  value={m.role}
                  disabled={busy}
                  onChange={(e) =>
                    void run(
                      () =>
                        setMemberRole(
                          portfolio.id,
                          m.userId,
                          e.target.value as 'editor' | 'viewer',
                        ),
                      onChanged,
                    )
                  }
                  className="rounded border border-line bg-bg p-1 text-xs"
                >
                  <option value="editor">{ROLE_LABEL.editor}</option>
                  <option value="viewer">{ROLE_LABEL.viewer}</option>
                </select>
              ) : (
                <span className="text-xs text-muted">{ROLE_LABEL[m.role]}</span>
              )}
              {isOwner && m.role !== 'owner' && (
                <Confirm
                  label="Retirer"
                  confirmLabel={`Retirer ${m.pseudo}`}
                  disabled={busy}
                  onConfirm={() => void run(() => removeMember(portfolio.id, m.userId), onChanged)}
                />
              )}
            </span>
          </li>
        ))}
      </ul>

      {isOwner && (
        <section className="mt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Invitations en attente</h3>
            <button
              type="button"
              onClick={onInvite}
              className="rounded bg-accent px-3 py-1 text-sm font-medium text-bg"
            >
              Inviter
            </button>
          </div>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Aucune invitation en attente.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {pending.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-line p-2 text-sm"
                >
                  <span>
                    {ROLE_LABEL[i.role]} · {STATUS_LABEL[invitationStatus(i, now)]}, expire le{' '}
                    {dateFr(i.expiresAt)}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => revokeInvitation(i.id), onChanged)}
                    className="rounded border border-line px-3 py-1 text-xs"
                  >
                    Révoquer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-down">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2 border-t border-line pt-4 text-sm">
        {isOwner ? (
          <>
            <p className="text-muted">
              Archiver ferme définitivement ce portefeuille : il disparaît de ta liste et celle des
              membres, les invitations en cours sont révoquées. Rien n’est supprimé en base.
            </p>
            <Confirm
              label="Archiver ce portefeuille"
              confirmLabel="Archiver définitivement"
              disabled={busy}
              onConfirm={() => void run(() => archivePortfolio(portfolio.id), onGone)}
            />
          </>
        ) : (
          <Confirm
            label="Quitter ce portefeuille"
            confirmLabel="Quitter"
            disabled={busy}
            onConfirm={() => void run(() => leavePortfolio(portfolio.id), onGone)}
          />
        )}
      </div>
    </Modal>
  )
}
