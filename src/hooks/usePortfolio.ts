import { useCallback, useEffect, useState } from 'react'
import type { Transaction } from '../lib/portfolio'
import { loadPortfolio, loadTransactions, PAGE_SIZE, type PortfolioData } from '../lib/portfolioApi'

export type PortfolioState = {
  /** « error » garde les dernières données connues : jamais d'écran vide si on a déjà tout vu. */
  status: 'loading' | 'ready' | 'error'
  data: PortfolioData | null
  transactions: Transaction[]
  hasMore: boolean
}

export type PortfolioApi = PortfolioState & {
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
}

/** Portefeuille personnel : cash, positions et transactions, lus depuis la base (source de vérité). */
export function usePortfolio(): PortfolioApi {
  const [state, setState] = useState<PortfolioState>({
    status: 'loading',
    data: null,
    transactions: [],
    hasMore: false,
  })
  const [page, setPage] = useState(0)

  const refresh = useCallback(
    (): Promise<void> =>
      loadPortfolio()
        .then(async (data) => ({
          data,
          transactions: data ? await loadTransactions(data.portfolio.id, 0) : [],
        }))
        .then(
          ({ data, transactions }) => {
            setPage(0)
            setState({
              status: 'ready',
              data,
              transactions,
              hasMore: transactions.length === PAGE_SIZE,
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

  return { ...state, refresh, loadMore }
}
