import { useCallback, useEffect, useState } from 'react'
import { loadMarket, type Market } from '../lib/market'

export type MarketState =
  | { status: 'loading'; market: null }
  | { status: 'ready'; market: Market }
  // En cas d'échec on garde les dernières données connues : jamais d'écran vide si on a déjà vu des prix
  | { status: 'error'; market: Market | null }

const POLL_MS = 60_000

/** Lit le marché depuis Supabase : au montage, toutes les 60 s, et au retour sur l'onglet. */
export function useMarket(): MarketState {
  const [state, setState] = useState<MarketState>({ status: 'loading', market: null })

  const refresh = useCallback(() => {
    loadMarket().then(
      (market) => setState({ status: 'ready', market }),
      () => setState((prev) => ({ status: 'error', market: prev.market })),
    )
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  return state
}
