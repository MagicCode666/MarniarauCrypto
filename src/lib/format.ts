const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const eurCompact = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 2,
})

/** Montant en euros, à la française (« 1 234,56 € »). Les petits prix gardent plus de décimales. */
export function formatEur(value: number): string {
  if (value > 0 && value < 1) {
    return value.toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })
  }
  return eur.format(value)
}

/** Grand montant abrégé (« 1,12 Md € »). */
export function formatCompactEur(value: number): string {
  return eurCompact.format(value)
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
  const trend = trendOf(Math.round(pct * 100) / 100)
  const sign = trend === 'up' ? '+' : trend === 'down' ? '−' : ''
  const abs = Math.abs(pct).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return { text: `${SYMBOL[trend]} ${sign}${abs} %`, trend, label: WORD[trend] }
}

/** Ancienneté d'une donnée (« à l'instant », « il y a 7 min », « il y a 3 h »). */
export function formatAge(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `il y a ${hours} h`
  return `il y a ${Math.floor(hours / 24)} j`
}

/** Nombre signé sans unité (« +12,3 », « −0,00123 »), précision adaptée à l'ordre de grandeur. */
export function formatSigned(value: number): string {
  const abs = Math.abs(value)
  const text =
    abs >= 1000
      ? abs.toLocaleString('fr-FR', { maximumFractionDigits: 0 })
      : abs >= 1
        ? abs.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
        : abs.toLocaleString('fr-FR', { maximumSignificantDigits: 3 })
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${text}`
}
