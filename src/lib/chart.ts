export type Point = { x: number; y: number }

/**
 * Convertit une série de valeurs en points d'une zone width × height (l'axe y est inversé :
 * la valeur la plus haute est en haut). Une série plate est tracée au milieu.
 */
export function toPoints(values: number[], width: number, height: number, pad = 2): Point[] {
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  return values.map((v, i) => ({
    x: pad + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW),
    y: pad + (span === 0 ? innerH / 2 : (1 - (v - min) / span) * innerH),
  }))
}

/** Attribut `points` d'une polyligne SVG. */
export function toPolyline(values: number[], width: number, height: number, pad = 2): string {
  return toPoints(values, width, height, pad)
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')
}

/** Variation en pourcent entre la première et la dernière valeur (null si indéfinie). */
export function changeOver(values: number[]): number | null {
  if (values.length < 2 || values[0] <= 0) return null
  return ((values[values.length - 1] - values[0]) / values[0]) * 100
}
