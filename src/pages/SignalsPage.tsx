import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Change } from '../components/Change'
import { MarketStatus } from '../components/MarketStatus'
import { SignalBadge } from '../components/SignalBadge'
import { SignalModal } from '../components/SignalModal'
import { useCloses } from '../hooks/useCloses'
import type { MarketState } from '../hooks/useMarket'
import { formatEur, formatSigned } from '../lib/format'
import { analyze, type Analysis } from '../lib/indicators'
import type { CoinView } from '../lib/market'
import { DISCLAIMER, rsiZone, SIGNAL_RANK } from '../lib/signalTexts'

type SortKey = 'name' | 'price' | 'change' | 'rsi' | 'macd' | 'signal'
type Sort = { key: SortKey; dir: 'asc' | 'desc' }

type Row = { coin: CoinView; analysis: Analysis | 'loading' | 'error' }

function sortValue(row: Row, key: SortKey): number | string {
  const a = row.analysis
  const ok = typeof a === 'object' && a.status === 'ok' ? a : null
  switch (key) {
    case 'name':
      return row.coin.name
    case 'price':
      return row.coin.priceEur ?? -Infinity
    case 'change':
      return row.coin.change24hPct ?? -Infinity
    case 'rsi':
      return ok?.rsi ?? -Infinity
    case 'macd':
      return ok?.macd.macd ?? -Infinity
    case 'signal':
      // Sans signal (données insuffisantes ou en cours), la ligne passe après les autres
      return ok ? ok.score + SIGNAL_RANK[ok.level] / 10 : -Infinity
  }
}

function compare(a: Row, b: Row, sort: Sort): number {
  const va = sortValue(a, sort.key)
  const vb = sortValue(b, sort.key)
  const base =
    typeof va === 'string' || typeof vb === 'string'
      ? String(va).localeCompare(String(vb))
      : va === vb
        ? 0
        : va < vb
          ? -1
          : 1
  const dir = sort.dir === 'asc' ? base : -base
  return dir || a.coin.name.localeCompare(b.coin.name)
}

function Header({
  label,
  sortKey,
  sort,
  onSort,
  align = 'right',
}: {
  label: string
  sortKey: SortKey
  sort: Sort
  onSort: (k: SortKey) => void
  align?: 'left' | 'right'
}) {
  const active = sort.key === sortKey
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-3 py-2 text-xs font-medium uppercase tracking-wide ${align === 'left' ? 'text-left' : 'text-right'}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`whitespace-nowrap ${active ? 'text-text' : 'text-muted'}`}
      >
        {label} {active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
      </button>
    </th>
  )
}

function SignalCell({ analysis }: { analysis: Row['analysis'] }) {
  if (analysis === 'loading') return <span className="text-muted">Calcul…</span>
  if (analysis === 'error') return <span className="text-down">Historique indisponible</span>
  if (analysis.status === 'insufficient') {
    return (
      <span className="text-xs text-muted">
        Données insuffisantes ({analysis.closes}/{analysis.needed} jours)
      </span>
    )
  }
  return <SignalBadge level={analysis.level} />
}

/** Écran « Signaux » : RSI, MACD et signal composite par crypto, détail du score en modale. */
export function SignalsPage() {
  const state = useOutletContext<MarketState>()
  const coins = useMemo(() => state.market?.coins ?? [], [state.market])
  const closes = useCloses(useMemo(() => coins.map((c) => c.coinId), [coins]))
  const [sort, setSort] = useState<Sort>({ key: 'signal', dir: 'desc' })
  const [openId, setOpenId] = useState<string | null>(null)

  const rows: Row[] = useMemo(
    () =>
      coins
        .map((coin): Row => {
          const c = closes[coin.coinId]
          return {
            coin,
            analysis:
              c === undefined ? 'loading' : c === 'error' ? 'error' : analyze(c, coin.change24hPct),
          }
        })
        .sort((a, b) => compare(a, b, sort)),
    [coins, closes, sort],
  )

  const onSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' },
    )

  const open = rows.find((r) => r.coin.coinId === openId)

  return (
    <main className="flex flex-col gap-5">
      <p className="border-l-4 border-line pl-3 text-sm text-muted">{DISCLAIMER}</p>
      <MarketStatus state={state} />

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface">
            <tr>
              <Header label="Crypto" sortKey="name" sort={sort} onSort={onSort} align="left" />
              <Header label="Prix" sortKey="price" sort={sort} onSort={onSort} />
              <Header label="24 h" sortKey="change" sort={sort} onSort={onSort} />
              <Header label="RSI" sortKey="rsi" sort={sort} onSort={onSort} />
              <Header label="MACD" sortKey="macd" sort={sort} onSort={onSort} />
              <Header label="Signal" sortKey="signal" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ coin, analysis }) => {
              const ok = typeof analysis === 'object' && analysis.status === 'ok' ? analysis : null
              return (
                <tr
                  key={coin.coinId}
                  className="cursor-pointer border-t border-line hover:bg-surface"
                  onClick={() => setOpenId(coin.coinId)}
                >
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className="text-left font-semibold"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenId(coin.coinId)
                      }}
                    >
                      {coin.name}
                    </button>{' '}
                    <span className="text-xs text-muted">{coin.symbol}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                    {coin.priceEur === null ? '—' : formatEur(coin.priceEur)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <Change pct={coin.change24hPct} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                    {ok?.rsi == null ? (
                      '—'
                    ) : (
                      <>
                        {ok.rsi.toLocaleString('fr-FR', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}{' '}
                        <span className="text-xs text-muted">{rsiZone(ok.rsi)}</span>
                      </>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                    {ok === null ? (
                      '—'
                    ) : (
                      <span className={ok.macd.macd >= 0 ? 'text-up' : 'text-down'}>
                        <span aria-hidden="true">{ok.macd.macd >= 0 ? '▲' : '▼'} </span>
                        {formatSigned(ok.macd.macd)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <SignalCell analysis={analysis} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {open && typeof open.analysis === 'object' && (
        <SignalModal coin={open.coin} analysis={open.analysis} onClose={() => setOpenId(null)} />
      )}
    </main>
  )
}
