import { toPolyline } from '../lib/chart'
import { formatEur } from '../lib/format'
import type { HistoryPoint } from '../lib/market'

const W = 560
const H = 220

function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })
}

/** Courbe des clôtures quotidiennes avec repères de min, max et dates. */
export function LineChart({ points }: { points: HistoryPoint[] }) {
  if (points.length < 2) {
    return <p className="py-10 text-center text-sm text-muted">Pas encore assez d’historique.</p>
  }
  const values = points.map((p) => p.close)
  const min = Math.min(...values)
  const max = Math.max(...values)
  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full text-accent"
        role="img"
        aria-label={`Courbe de ${points.length} jours, de ${formatEur(values[0])} à ${formatEur(values[values.length - 1])}, plus bas ${formatEur(min)}, plus haut ${formatEur(max)}`}
      >
        <polyline
          points={toPolyline(values, W, H, 6)}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <figcaption className="flex flex-wrap justify-between gap-x-4 text-xs text-muted">
        <span>{dayLabel(points[0].day)}</span>
        <span>
          Plus bas {formatEur(min)} · Plus haut {formatEur(max)}
        </span>
        <span>{dayLabel(points[points.length - 1].day)}</span>
      </figcaption>
    </figure>
  )
}
