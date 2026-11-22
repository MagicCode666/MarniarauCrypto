import { useEffect, useState } from 'react'
import { changeOver } from '../lib/chart'
import { formatCompactEur, formatEur } from '../lib/format'
import { loadHistory, type CoinView, type HistoryPoint } from '../lib/market'
import { Change } from './Change'
import { LineChart } from './LineChart'
import { Modal } from './Modal'

const PERIODS = [30, 90, 365] as const

type Loaded = { coinId: string; days: number; points: HistoryPoint[] | 'error' }

export function CoinModal({ coin, onClose }: { coin: CoinView; onClose: () => void }) {
  const [days, setDays] = useState<number>(30)
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    let cancelled = false
    loadHistory(coin.coinId, days).then(
      (points) => !cancelled && setLoaded({ coinId: coin.coinId, days, points }),
      () => !cancelled && setLoaded({ coinId: coin.coinId, days, points: 'error' }),
    )
    return () => {
      cancelled = true
    }
  }, [coin.coinId, days])

  const current = loaded && loaded.coinId === coin.coinId && loaded.days === days ? loaded : null
  const points = current && current.points !== 'error' ? current.points : null
  const periodChange = points ? changeOver(points.map((p) => p.close)) : null

  return (
    <Modal
      onClose={onClose}
      title={
        <>
          {coin.name} <span className="text-sm font-normal text-muted">{coin.symbol}</span>
        </>
      }
    >
      <p className="text-2xl font-semibold">
        {coin.priceEur === null ? '—' : formatEur(coin.priceEur)}
      </p>
      <Change pct={coin.change24hPct} suffix="24 h" />

      <div className="mt-4 flex gap-2" role="group" aria-label="Période">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={days === p}
            onClick={() => setDays(p)}
            className={`rounded border px-3 py-1 text-sm ${days === p ? 'border-accent text-accent' : 'border-line text-muted'}`}
          >
            {p} j
          </button>
        ))}
      </div>

      <div className="mt-4 min-h-56">
        {current?.points === 'error' ? (
          <p className="py-10 text-center text-sm text-muted">Historique indisponible.</p>
        ) : points ? (
          <>
            <LineChart points={points} />
            {periodChange !== null && (
              <p className="mt-2 text-sm">
                Sur {days} jours : <Change pct={periodChange} />
              </p>
            )}
          </>
        ) : (
          <p className="py-10 text-center text-sm text-muted">Chargement…</p>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted">Capitalisation</dt>
        <dd>{coin.marketCapEur === null ? '—' : formatCompactEur(coin.marketCapEur)}</dd>
        <dt className="text-muted">Volume 24 h</dt>
        <dd>{coin.volume24hEur === null ? '—' : formatCompactEur(coin.volume24hEur)}</dd>
        <dt className="text-muted">Catégories</dt>
        <dd>{coin.categories.length ? coin.categories.join(', ') : '—'}</dd>
      </dl>
    </Modal>
  )
}
