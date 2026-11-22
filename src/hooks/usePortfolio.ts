import { useCallback, useEffect, useRef, useState } from 'react'
import type { Member, PortfolioInfo, Transaction } from '../lib/portfolio'
import {
  listPortfolios,
  loadMembers,
  loadPortfolio,
  loadTransactions,
  PAGE_SIZE,
  type PortfolioData,
} from '../lib/portfolioApi'

/** Dernier portefeuille consulté, mémorisé sur l'appareil. */
export const SELECTED_KEY = 'marniarau:portfolio'
const POLL_SHARED_MS = 60_000

export type PortfolioState = {
  /** « error » garde les dernières données connues : jamais d'écran vide si on a déjà tout vu. */
  status: 'loading' | 'ready' | 'error'
  portfolios: PortfolioInfo[]
  data: PortfolioData | null
  transactions: Transaction[]
  members: Member[]
  hasMore: boolean
}

export type PortfolioApi = PortfolioState & {
  /** Recharge ; `id` force la sélection d'un portefeuille (sinon on garde le courant). */
  refresh: (id?: string) => Promise<void>
  loadMore: () => Promise<void>
}

function storedId(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY)
  } catch {
    return null
  }
}

/**
 * Portefeuille consulté (personnel ou partagé) : cash, positions, transactions et membres, lus
 * depuis la base (source de vérité). Un portefeuille partagé est relu toutes les 60 secondes pour
 * voir les opérations des autres membres.
 */
export function usePortfolio(): PortfolioApi {
  const [state, setState] = useState<PortfolioState>({
    status: 'loading',
    portfolios: [],
    data: null,
    transactions: [],
    members: [],
    hasMore: false,
  })
  const [page, setPage] = useState(0)
  const selected = useRef<string | null>(storedId())

  const refresh = useCallback(
    (id?: string): Promise<void> =>
      listPortfolios()
        .then(async (portfolios) => {
          const wanted = id ?? selected.current
          const info = portfolios.find((p) => p.id === wanted) ?? portfolios[0]
          if (!info) return { portfolios, info: null }
          const [data, transactions, members] = await Promise.all([
            loadPortfolio(info),
            loadTransactions(info.id, 0),
            info.kind === 'shared' ? loadMembers(info.id) : Promise.resolve<Member[]>([]),
          ])
          return { portfolios, info, data, transactions, members }
        })
        .then(
          (r) => {
            if (!r.info) {
              setState({
                status: 'ready',
                portfolios: r.portfolios,
                data: null,
                transactions: [],
                members: [],
                hasMore: false,
              })
              return
            }
            selected.current = r.info.id
            try {
              localStorage.setItem(SELECTED_KEY, r.info.id)
            } catch {
              // mémorisation facultative
            }
            setPage(0)
            setState({
              status: 'ready',
              portfolios: r.portfolios,
              data: r.data!,
              transactions: r.transactions!,
              members: r.members!,
              hasMore: r.transactions!.length === PAGE_SIZE,
            })
          },
          () => setState((prev) => ({ ...prev, status: 'error' })),
        ),
    [],
  )

  const loadMore = useCallback((): Promise<void> => {
    const id = state.data?.portfolio.id
    if (!id) return Promise.resolve()
    return loadTransactions(id, page + 1).then(
      (more) => {
        setPage(page + 1)
        setState((prev) => ({
          ...prev,
          transactions: [...prev.transactions, ...more],
          hasMore: more.length === PAGE_SIZE,
        }))
      },
      () => setState((prev) => ({ ...prev, status: 'error' })),
    )
  }, [state.data?.portfolio.id, page])

  useEffect(() => {
    void refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const sharedSelected = state.data?.portfolio.kind === 'shared'
  useEffect(() => {
    if (!sharedSelected) return
    const timer = setInterval(() => void refresh(), POLL_SHARED_MS)
    return () => clearInterval(timer)
  }, [sharedSelected, refresh])

  return { ...state, refresh, loadMore }
}
