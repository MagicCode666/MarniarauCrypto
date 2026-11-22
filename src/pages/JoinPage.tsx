import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { JoinForm } from '../components/JoinForm'
import { PseudoModal } from '../components/PseudoModal'
import { SELECTED_KEY } from '../hooks/usePortfolio'
import { usePseudo } from '../hooks/usePseudo'
import { clearJoinCode, pendingJoinCode } from '../lib/pendingJoin'

/** Arrivée par un lien d'invitation : le code est prérempli, rejoindre reste un clic volontaire. */
export function JoinPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { pseudo, userId, reload } = usePseudo()
  const [editing, setEditing] = useState(false)
  const code = params.get('code') ?? pendingJoinCode() ?? ''

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-semibold">Rejoindre un portefeuille partagé</h2>
      <p className="text-sm text-muted">
        Quelqu’un t’a invité dans un portefeuille de simulation commun. Vérifie le code puis
        rejoins-le.
      </p>
      <JoinForm
        initialCode={code}
        pseudo={pseudo}
        onEditPseudo={() => setEditing(true)}
        onJoined={(id) => {
          clearJoinCode()
          try {
            localStorage.setItem(SELECTED_KEY, id)
          } catch {
            // la sélection sera simplement celle par défaut
          }
          navigate('/portefeuille', { replace: true })
        }}
      />
      {editing && userId && pseudo !== null && (
        <PseudoModal
          userId={userId}
          current={pseudo}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            reload()
          }}
        />
      )}
    </main>
  )
}
