import { toPolyline } from '../lib/chart'

/** Petite courbe sans axes. Décorative : l'information est portée par le texte à côté. */
export function Sparkline({
  values,
  width = 120,
  height = 36,
}: {
  values: number[]
  width?: number
  height?: number
}) {
  if (values.length < 2) {
    return <p className="h-9 text-xs text-muted">Historique en cours de chargement</p>
  }
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="text-accent"
      aria-hidden="true"
    >
      <polyline
        points={toPolyline(values, width, height)}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
