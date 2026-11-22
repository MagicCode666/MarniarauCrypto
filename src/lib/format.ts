const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

/** Montant en euros, à la française (« 1 234,56 € »). */
export function formatEur(value: number): string {
  return eur.format(value)
}

export type Trend = 'up' | 'down' | 'flat'

export function trendOf(value: number): Trend {
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'flat'
}

const SYMBOL: Record<Trend, string> = { up: '▲', down: '▼', flat: '■' }
const WORD: Record<Trend, string> = { up: 'hausse', down: 'baisse', flat: 'stable' }

/** Variation en pourcent avec un signe et un symbole : jamais la couleur seule (« ▲ +2,50 % »). */
export function formatChange(pct: number): { text: string; trend: Trend; label: string } {
  const trend = trendOf(pct)
  const sign = trend === 'up' ? '+' : trend === 'down' ? '−' : ''
  const abs = Math.abs(pct).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return { text: `${SYMBOL[trend]} ${sign}${abs} %`, trend, label: WORD[trend] }
}
