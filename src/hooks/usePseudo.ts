import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { loadPseudo } from '../lib/portfolioApi'

/** Pseudo du compte connecté : c'est lui que les membres des portefeuilles partagés voient. */
export function usePseudo(): { pseudo: string | null; userId: string | null; reload: () => void } {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const [pseudo, setPseudo] = useState<string | null>(null)

  const reload = useCallback(() => {
    if (!userId) return
    loadPseudo(userId).then(setPseudo, () => undefined)
  }, [userId])

  useEffect(() => {
    reload()
  }, [reload])

  return { pseudo, userId, reload }
}
