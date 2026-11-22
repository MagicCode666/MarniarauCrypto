import { useEffect, useState } from 'react'
import { loadHistory } from '../lib/market'

/** Jours de clôtures chargés : de quoi laisser les moyennes exponentielles se stabiliser. */
export const CLOSES_DAYS = 200

const REFRESH_MS = 5 * 60_000

export type ClosesState = Record<string, number[] | 'error'>

/**
 * Clôtures quotidiennes de chaque crypto, rechargées toutes les 5 minutes (la clôture du jour suit
 * le dernier prix du collecteur) et au retour sur l'onglet. Une requête par crypto : Supabase
 * limite chaque réponse à 1 000 lignes, un chargement groupé serait tronqué sans prévenir.
 */
export function useCloses(coinIds: string[]): ClosesState {
  const [state, setState] = useState<ClosesState>({})
  const key = coinIds.join(',')

  useEffect(() => {
    const ids = key === '' ? [] : key.split(',')
    let cancelled = false

    const refresh = () => {
      for (const id of ids) {
        loadHistory(id, CLOSES_DAYS).then(
          (points) =>
            !cancelled && setState((prev) => ({ ...prev, [id]: points.map((p) => p.close) })),
          // En cas d'échec on garde les dernières clôtures connues, sinon on signale l'erreur
          () => !cancelled && setState((prev) => (prev[id] ? prev : { ...prev, [id]: 'error' })),
        )
      }
    }

    refresh()
    const timer = setInterval(refresh, REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [key])

  return state
}
