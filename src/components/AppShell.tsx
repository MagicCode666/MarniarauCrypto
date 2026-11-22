import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useMarket, type MarketState } from '../hooks/useMarket'
import { usePseudo } from '../hooks/usePseudo'
import { pendingJoinCode } from '../lib/pendingJoin'
import { DISCLAIMER } from '../lib/signalTexts'
import { supabase } from '../lib/supabase'
import { PseudoModal } from './PseudoModal'

const TABS = [
  { to: '/', label: 'Prix', end: true },
  { to: '/signaux', label: 'Signaux', end: false },
  { to: '/portefeuille', label: 'Portefeuille', end: false },
] as const

/** Cadre commun des écrans connectés : titre, onglets, pseudo, déconnexion, pied de page. */
export function AppShell() {
  const state = useMarket()
  const { pseudo, userId, reload } = usePseudo()
  const [editingPseudo, setEditingPseudo] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Un lien d'invitation ouvert avant la connexion : on propose maintenant de rejoindre.
  useEffect(() => {
    if (pathname !== '/rejoindre' && pendingJoinCode()) navigate('/rejoindre', { replace: true })
  }, [pathname, navigate])

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 p-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">MarniarauCrypto</h1>
          <div className="flex items-center gap-2">
            {pseudo !== null && (
              <button
                type="button"
                onClick={() => setEditingPseudo(true)}
                title="Modifier mon pseudo"
                className="rounded border border-line px-3 py-1 text-sm"
              >
                {pseudo}
              </button>
            )}
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="rounded border border-line px-3 py-1 text-sm"
            >
              Se déconnecter
            </button>
          </div>
        </div>
        <nav aria-label="Sections" className="flex gap-2 border-b border-line">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `-mb-px border-b-2 px-3 py-2 text-sm ${isActive ? 'border-accent font-semibold text-accent' : 'border-transparent text-muted'}`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <Outlet context={state satisfies MarketState} />

      {editingPseudo && userId && pseudo !== null && (
        <PseudoModal
          userId={userId}
          current={pseudo}
          onClose={() => setEditingPseudo(false)}
          onSaved={() => {
            setEditingPseudo(false)
            reload()
          }}
        />
      )}

      <footer className="mt-auto flex flex-col gap-1 text-xs text-muted">
        <p>{DISCLAIMER}</p>
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
    </div>
  )
}
