import type { MarketState } from '../hooks/useMarket'
import { useNow } from '../hooks/useNow'
import { formatAge } from '../lib/format'

const STALE_AFTER_MIN = 30

/** Fraîcheur des prix, avec avertissement si la collecte semble interrompue ou si la lecture échoue. */
export function MarketStatus({ state }: { state: MarketState }) {
  const now = useNow()
  const market = state.market
  const stale =
    market?.updatedAt != null &&
    now.getTime() - new Date(market.updatedAt).getTime() > STALE_AFTER_MIN * 60_000

  return (
    <>
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
      {state.status === 'error' && !market && (
        <p className="text-sm text-down">
          Impossible de charger les prix. Vérifie ta connexion puis réessaie.
        </p>
      )}
    </>
  )
}
