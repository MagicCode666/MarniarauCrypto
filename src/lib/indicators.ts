// Indicateurs techniques et signal composite. Calculs purs, sans réseau, testés dans
// indicators.test.ts (référence pandas pour le RSI et le MACD).
//
// Les séries sont des clôtures quotidiennes, de la plus ancienne à la plus récente.

export const RSI_PERIOD = 14
export const MACD_FAST = 12
export const MACD_SLOW = 26
export const MACD_SIGNAL = 9

/** Nombre minimal de clôtures pour calculer un signal (le MACD en demande 26, le RSI 15). */
export const MIN_CLOSES = MACD_SLOW

/**
 * Moyenne mobile exponentielle standard : initialisée avec la moyenne simple des `period`
 * premières valeurs, puis lissée avec k = 2 / (period + 1). Les `period - 1` premières cases
 * (pas assez de données) valent null.
 */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = values.map(() => null)
  if (values.length < period) return out
  const k = 2 / (period + 1)
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  out[period - 1] = prev
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

/**
 * RSI de Wilder sur `period` jours. Null s'il manque de données (moins de period + 1 clôtures) ou
 * si le prix n'a pas bougé du tout (RSI non défini). Arrondi à 2 décimales, comme le prototype.
 */
export function rsi(closes: number[], period = RSI_PERIOD): number | null {
  if (closes.length < period + 1) return null
  const gains: number[] = []
  const losses: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    gains.push(Math.max(d, 0))
    losses.push(Math.max(-d, 0))
  }
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
  }
  if (avgGain === 0 && avgLoss === 0) return null
  if (avgLoss === 0) return 100
  return Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100
}

export type Macd = {
  /** EMA 12 − EMA 26, dernière valeur (non arrondie : le signe compte pour les petits prix). */
  macd: number
  /** Ligne de signal (EMA 9 du MACD) ; null tant qu'il y a moins de 34 clôtures. */
  signalLine: number | null
  /** MACD − ligne de signal ; null en même temps que la ligne de signal. */
  histogram: number | null
}

/** MACD 12 / 26 / 9. Null s'il y a moins de 26 clôtures. */
export function macd(closes: number[]): Macd | null {
  const fast = ema(closes, MACD_FAST)
  const slow = ema(closes, MACD_SLOW)
  const line: number[] = []
  for (let i = 0; i < closes.length; i++) {
    const f = fast[i]
    const s = slow[i]
    if (f !== null && s !== null) line.push(f - s)
  }
  if (line.length === 0) return null
  const last = line[line.length - 1]
  const signal = ema(line, MACD_SIGNAL)
  const sig = signal[signal.length - 1]
  return { macd: last, signalLine: sig, histogram: sig === null ? null : last - sig }
}

export type SignalLevel = 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell'

export type Contribution = {
  key: 'rsi' | 'macd' | 'change24h'
  points: number
  /** Explication en clair, affichée telle quelle. */
  reason: string
}

const fr1 = (v: number) =>
  v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fr2 = (v: number) =>
  v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function rsiPoints(value: number): Contribution {
  let points = 0
  let zone = 'zone neutre'
  if (value < 30) {
    points = 2
    zone = 'survendu'
  } else if (value < 45) {
    points = 1
    zone = 'plutôt bas'
  } else if (value > 70) {
    points = -2
    zone = 'suracheté'
  } else if (value > 55) {
    points = -1
    zone = 'plutôt haut'
  }
  return { key: 'rsi', points, reason: `RSI à ${fr1(value)} : ${zone}` }
}

export function macdPoints(value: number): Contribution {
  if (value > 0)
    return { key: 'macd', points: 1, reason: 'MACD positif : tendance haussière à court terme' }
  if (value < 0)
    return { key: 'macd', points: -1, reason: 'MACD négatif : tendance baissière à court terme' }
  return { key: 'macd', points: 0, reason: 'MACD nul : pas de tendance' }
}

export function changePoints(pct: number | null): Contribution {
  if (pct === null) {
    return { key: 'change24h', points: 0, reason: 'Variation sur 24 h indisponible' }
  }
  const text = `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${fr2(Math.abs(pct))} %`
  if (pct > 5)
    return {
      key: 'change24h',
      points: 1,
      reason: `Variation sur 24 h de ${text} : hausse de plus de 5 %`,
    }
  if (pct < -5)
    return {
      key: 'change24h',
      points: -1,
      reason: `Variation sur 24 h de ${text} : baisse de plus de 5 %`,
    }
  return {
    key: 'change24h',
    points: 0,
    reason: `Variation sur 24 h de ${text} : moins de 5 %, sans effet`,
  }
}

export function levelOf(score: number): SignalLevel {
  if (score >= 3) return 'strong_buy'
  if (score >= 1) return 'buy'
  if (score <= -3) return 'strong_sell'
  if (score <= -1) return 'sell'
  return 'neutral'
}

export type Analysis =
  | { status: 'insufficient'; closes: number; needed: number }
  | {
      status: 'ok'
      closes: number
      rsi: number | null
      macd: Macd
      score: number
      level: SignalLevel
      contributions: Contribution[]
    }

/**
 * Analyse complète d'une crypto : RSI, MACD, puis score composite (règles du prototype).
 * Sans assez de clôtures, aucun signal n'est inventé : le résultat dit « données insuffisantes ».
 */
export function analyze(closes: number[], change24hPct: number | null): Analysis {
  const m = macd(closes)
  if (m === null) return { status: 'insufficient', closes: closes.length, needed: MIN_CLOSES }
  const r = rsi(closes)
  const contributions: Contribution[] = [
    r === null
      ? { key: 'rsi', points: 0, reason: 'RSI non défini : le prix n’a pas bougé' }
      : rsiPoints(r),
    macdPoints(m.macd),
    changePoints(change24hPct),
  ]
  const score = contributions.reduce((sum, c) => sum + c.points, 0)
  return {
    status: 'ok',
    closes: closes.length,
    rsi: r,
    macd: m,
    score,
    level: levelOf(score),
    contributions,
  }
}
