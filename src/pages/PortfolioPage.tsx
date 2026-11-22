import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { BuyModal } from '../components/BuyModal'
import { Change } from '../components/Change'
import { MarketStatus } from '../components/MarketStatus'
import { PnlEur } from '../components/PnlEur'
import { ResetModal } from '../components/ResetModal'
import { SellModal } from '../components/SellModal'
import { usePortfolio } from '../hooks/usePortfolio'
import type { MarketState } from '../hooks/useMarket'
import { formatEur, formatQuantity } from '../lib/format'
import { valuePortfolio, type Transaction } from '../lib/portfolio'
import { DISCLAIMER } from '../lib/signalTexts'

type Modal = { kind: 'buy' } | { kind: 'sell'; coinId: string } | { kind: 'reset' } | null

const dateFr = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

function describe(tx: Transaction, symbol: string): string {
  const verb = tx.side === 'buy' ? 'Achat' : 'Vente'
  return `${verb} de ${formatQuantity(tx.quantity)} ${symbol} à ${formatEur(tx.priceEur)} (frais ${formatEur(tx.feeEur)})`
}

function Tile({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">{children}</dd>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

/** Écran « Portefeuille » : simulation à 10 000 €, achats et ventes aux prix du moment. */
export function PortfolioPage() {
  const market = useOutletContext<MarketState>()
  const pf = usePortfolio()
  const [modal, setModal] = useState<Modal>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const coins = useMemo(() => market.market?.coins ?? [], [market.market])
  const byId = useMemo(() => new Map(coins.map((c) => [c.coinId, c])), [coins])
  const prices = useMemo(
    () => Object.fromEntries(coins.map((c) => [c.coinId, c.priceEur])),
    [coins],
  )

  const data = pf.data
  const valuation = useMemo(
    () =>
      data ? valuePortfolio(data.cash, data.portfolio.initialCash, data.positions, prices) : null,
    [data, prices],
  )

  const symbolOf = (coinId: string) => byId.get(coinId)?.symbol ?? coinId.toUpperCase()
  const nameOf = (coinId: string) => byId.get(coinId)?.name ?? coinId

  const afterTrade = (tx: Transaction) => {
    setModal(null)
    setNotice(`${describe(tx, symbolOf(tx.coinId))} : effectué.`)
    void pf.refresh()
  }

  const sellPosition =
    modal?.kind === 'sell' ? valuation?.positions.find((p) => p.coinId === modal.coinId) : undefined

  return (
    <main className="flex flex-col gap-5">
      <p className="border-l-4 border-line pl-3 text-sm text-muted">{DISCLAIMER}</p>
      <MarketStatus state={market} />

      {pf.status === 'loading' && <p className="text-sm text-muted">Chargement du portefeuille…</p>}
      {pf.status === 'error' && (
        <p role="alert" className="text-sm text-down">
          ⚠ Impossible d’actualiser le portefeuille
          {data
            ? ' : dernières valeurs connues affichées.'
            : '. Vérifie ta connexion puis réessaie.'}
        </p>
      )}
      {pf.status === 'ready' && !data && (
        <p className="text-sm text-muted">Aucun portefeuille trouvé pour ce compte.</p>
      )}

      {notice && (
        <p role="status" className="rounded border border-line bg-surface p-3 text-sm">
          {notice}
        </p>
      )}

      {data && valuation && (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Valeur totale">{formatEur(valuation.totalValueEur)}</Tile>
            <Tile label="Cash">{formatEur(valuation.cashEur)}</Tile>
            <Tile
              label="Performance depuis le départ"
              hint={`Valeur totale − ${formatEur(data.portfolio.initialCash)} de départ, frais compris.`}
            >
              <PnlEur value={valuation.performanceEur} />
              <div className="text-sm">
                <Change pct={valuation.performancePct} />
              </div>
            </Tile>
            <Tile
              label="P&L des positions"
              hint="Gain ou perte latent des positions ouvertes, hors frais."
            >
              {valuation.positions.length === 0 ? (
                '—'
              ) : (
                <>
                  <PnlEur value={valuation.pnlEur} />
                  <div className="text-sm">
                    <Change pct={valuation.pnlPct} />
                  </div>
                </>
              )}
            </Tile>
          </dl>

          {valuation.anyPriceMissing && (
            <p role="alert" className="text-sm text-down">
              ⚠ Le prix actuel de certaines cryptos est indisponible : elles sont valorisées à leur
              prix d’achat moyen.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setModal({ kind: 'buy' })}
              className="rounded bg-accent px-4 py-2 font-medium text-bg"
            >
              Acheter
            </button>
            <button
              type="button"
              onClick={() => setModal({ kind: 'reset' })}
              className="rounded border border-line px-4 py-2 text-sm"
            >
              Remise à zéro
            </button>
          </div>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Positions</h2>
            {valuation.positions.length === 0 ? (
              <p className="text-sm text-muted">
                Aucune position. Achète une crypto pour commencer ({formatEur(valuation.cashEur)}{' '}
                disponibles).
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
                    <tr>
                      {[
                        'Crypto',
                        'Quantité',
                        'Prix moyen',
                        'Prix actuel',
                        'Valeur',
                        'P&L €',
                        'P&L %',
                        '',
                      ].map((h, i) => (
                        <th
                          key={h || i}
                          scope="col"
                          className={`px-3 py-2 font-medium ${i === 0 ? 'text-left' : 'text-right'}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {valuation.positions.map((p) => (
                      <tr key={p.coinId} className="border-t border-line">
                        <td className="px-3 py-3">
                          <span className="font-semibold">{nameOf(p.coinId)}</span>{' '}
                          <span className="text-xs text-muted">{symbolOf(p.coinId)}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                          {formatQuantity(p.quantity)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                          {formatEur(p.avgBuyPriceEur)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                          {p.priceMissing ? (
                            <span className="text-down">indisponible</span>
                          ) : (
                            formatEur(p.priceEur)
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                          {formatEur(p.valueEur)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          <PnlEur value={p.pnlEur} />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          <Change pct={p.pnlPct} />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setModal({ kind: 'sell', coinId: p.coinId })}
                            className="rounded border border-line px-3 py-1 text-xs"
                            aria-label={`Vendre ${nameOf(p.coinId)}`}
                          >
                            Vendre
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Transactions</h2>
            {pf.transactions.length === 0 ? (
              <p className="text-sm text-muted">Aucune transaction pour l’instant.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
                    <tr>
                      {['Date', 'Type', 'Crypto', 'Quantité', 'Prix', 'Frais', 'Total', 'Note'].map(
                        (h, i) => (
                          <th
                            key={h}
                            scope="col"
                            className={`px-3 py-2 font-medium ${i < 3 || i === 7 ? 'text-left' : 'text-right'}`}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {pf.transactions.map((tx) => (
                      <tr key={tx.id} className="border-t border-line">
                        <td className="whitespace-nowrap px-3 py-2">{dateFr(tx.createdAt)}</td>
                        <td className="px-3 py-2 font-medium">
                          {tx.side === 'buy' ? 'Achat' : 'Vente'}
                        </td>
                        <td className="px-3 py-2">{symbolOf(tx.coinId)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                          {formatQuantity(tx.quantity)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                          {formatEur(tx.priceEur)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                          {formatEur(tx.feeEur)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                          {formatEur(tx.totalEur)}
                        </td>
                        <td className="px-3 py-2 text-muted">{tx.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pf.hasMore && (
              <button
                type="button"
                onClick={() => void pf.loadMore()}
                className="mt-2 rounded border border-line px-3 py-1 text-sm"
              >
                Voir plus
              </button>
            )}
          </section>

          <p className="text-xs text-muted">
            Frais simulés de {(data.portfolio.feeRate * 100).toLocaleString('fr-FR')} % par achat et
            par vente, indicatifs : une vraie plateforme applique ses propres frais.
          </p>
        </>
      )}

      {data && modal?.kind === 'buy' && (
        <BuyModal
          portfolioId={data.portfolio.id}
          feeRate={data.portfolio.feeRate}
          cash={data.cash}
          coins={coins}
          onClose={() => setModal(null)}
          onDone={afterTrade}
        />
      )}
      {data && sellPosition && (
        <SellModal
          portfolioId={data.portfolio.id}
          feeRate={data.portfolio.feeRate}
          position={sellPosition}
          name={nameOf(sellPosition.coinId)}
          symbol={symbolOf(sellPosition.coinId)}
          onClose={() => setModal(null)}
          onDone={afterTrade}
        />
      )}
      {data && modal?.kind === 'reset' && (
        <ResetModal
          portfolioId={data.portfolio.id}
          initialCash={data.portfolio.initialCash}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null)
            setNotice('Portefeuille archivé : un nouveau repart à zéro.')
            void pf.refresh()
          }}
        />
      )}
    </main>
  )
}
