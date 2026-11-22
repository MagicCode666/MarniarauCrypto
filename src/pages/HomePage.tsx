import { useEffect, useState } from 'react'
import { CoinCard } from '../components/CoinCard'
import { CoinModal } from '../components/CoinModal'
import { useMarket } from '../hooks/useMarket'
import { formatAge } from '../lib/format'
import { supabase } from '../lib/supabase'

const STALE_AFTER_MIN = 30

function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(t)
  }, [everyMs])
  return now
}

export function HomePage() {
  const state = useMarket()
  const now = useNow()
  const [openId, setOpenId] = useState<string | null>(null)

  const market = state.market
  const open = market?.coins.find((c) => c.coinId === openId) ?? null
  const stale =
    market?.updatedAt != null &&
    now.getTime() - new Date(market.updatedAt).getTime() > STALE_AFTER_MIN * 60_000

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">MarniarauCrypto</h1>
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="rounded border border-line px-3 py-1 text-sm"
        >
          Se déconnecter
        </button>
      </header>

      <p className="text-sm text-muted" role="status">
        {market?.updatedAt
          ? `Prix mis à jour ${formatAge(market.updatedAt, now)}`
          : state.status === 'loading'
            ? 'Chargement des prix…'
            : 'Aucun prix pour l’instant'}
        {stale && (
          <strong className="ml-2 text-down">
            ⚠ Données anciennes : la collecte semble interrompue.
          </strong>
        )}
        {state.status === 'error' && (
          <strong className="ml-2 text-down">
            ⚠ Actualisation impossible, dernières valeurs connues affichées.
          </strong>
        )}
      </p>

      {market && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {market.coins.map((coin) => (
            <li key={coin.coinId}>
              <CoinCard coin={coin} onOpen={() => setOpenId(coin.coinId)} />
            </li>
          ))}
        </ul>
      )}

      {state.status === 'error' && !market && (
        <p className="text-sm text-down">
          Impossible de charger les prix. Vérifie ta connexion puis réessaie.
        </p>
      )}

      {open && <CoinModal coin={open} onClose={() => setOpenId(null)} />}

      <footer className="mt-auto flex flex-col gap-1 text-xs text-muted">
        <p>
          MarniarauCrypto est un outil éducatif. Les signaux et simulations ne constituent pas des
          conseils financiers.
        </p>
        <p>
          Données de prix :{' '}
          <a
            className="underline"
            href="https://www.coingecko.com"
            target="_blank"
            rel="noreferrer"
          >
            CoinGecko
          </a>
          . v{__APP_VERSION__} ({__APP_COMMIT__})
        </p>
      </footer>
    </main>
  )
}
