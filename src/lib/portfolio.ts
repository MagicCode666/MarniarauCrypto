// Calculs du portefeuille (purs, sans réseau). Les règles de référence sont celles de la base
// (supabase/migrations/20261122120000_portfolios.sql) : ici on ne fait que des estimations
// d'affichage et la valorisation aux prix du moment.

export type PortfolioInfo = {
  id: string
  name: string
  initialCash: number
  feeRate: number
}

export type Position = { coinId: string; quantity: number; avgBuyPriceEur: number }

export type Transaction = {
  id: number
  coinId: string
  side: 'buy' | 'sell'
  quantity: number
  priceEur: number
  feeEur: number
  totalEur: number
  note: string | null
  createdAt: string
}

const round = (v: number, decimals: number) => {
  const f = 10 ** decimals
  return Math.round((v + Number.EPSILON * Math.sign(v)) * f) / f
}

/** Estimation d'un achat de `eur` euros : frais arrondis au centime, quantité à 12 décimales. */
export function estimateBuy(eur: number, priceEur: number, feeRate: number) {
  const fee = round(eur * feeRate, 2)
  return { fee, quantity: round((eur - fee) / priceEur, 12) }
}

/** Estimation d'une vente de `quantity` unités : brut au centime, frais au centime, net reçu. */
export function estimateSell(quantity: number, priceEur: number, feeRate: number) {
  const gross = round(quantity * priceEur, 2)
  const fee = round(gross * feeRate, 2)
  return { gross, fee, net: round(gross - fee, 2) }
}

export type ValuedPosition = {
  coinId: string
  quantity: number
  avgBuyPriceEur: number
  priceEur: number
  /** Vrai si le prix actuel est inconnu : la valeur est alors calculée au prix d'achat moyen. */
  priceMissing: boolean
  valueEur: number
  investedEur: number
  pnlEur: number
  pnlPct: number | null
}

export type PortfolioValuation = {
  positions: ValuedPosition[]
  cashEur: number
  positionsValueEur: number
  totalValueEur: number
  investedEur: number
  /** Gain ou perte latent sur les positions ouvertes (règle du prototype, hors frais). */
  pnlEur: number
  pnlPct: number | null
  /** Depuis le départ : valeur totale − capital initial, frais et ventes compris. */
  performanceEur: number
  performancePct: number
  anyPriceMissing: boolean
}

export function valuePortfolio(
  cashEur: number,
  initialCash: number,
  positions: Position[],
  prices: Record<string, number | null | undefined>,
): PortfolioValuation {
  const valued: ValuedPosition[] = positions.map((p) => {
    const current = prices[p.coinId]
    const priceMissing = current == null
    const priceEur = priceMissing ? p.avgBuyPriceEur : current
    const valueEur = p.quantity * priceEur
    const investedEur = p.quantity * p.avgBuyPriceEur
    const pnlEur = valueEur - investedEur
    return {
      coinId: p.coinId,
      quantity: p.quantity,
      avgBuyPriceEur: p.avgBuyPriceEur,
      priceEur,
      priceMissing,
      valueEur,
      investedEur,
      pnlEur,
      pnlPct: investedEur > 0 ? (pnlEur / investedEur) * 100 : null,
    }
  })
  const positionsValueEur = valued.reduce((s, p) => s + p.valueEur, 0)
  const investedEur = valued.reduce((s, p) => s + p.investedEur, 0)
  const pnlEur = positionsValueEur - investedEur
  const totalValueEur = cashEur + positionsValueEur
  return {
    positions: valued,
    cashEur,
    positionsValueEur,
    totalValueEur,
    investedEur,
    pnlEur,
    pnlPct: investedEur > 0 ? (pnlEur / investedEur) * 100 : null,
    performanceEur: totalValueEur - initialCash,
    performancePct: ((totalValueEur - initialCash) / initialCash) * 100,
    anyPriceMissing: valued.some((p) => p.priceMissing),
  }
}

/**
 * Lit un montant ou une quantité saisis (virgule ou point). Renvoie null si le texte n'est pas un
 * nombre positif avec au plus `maxDecimals` décimales.
 */
export function parseDecimal(text: string, maxDecimals: number): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const decimals = t.includes('.') ? t.split('.')[1].length : 0
  if (decimals > maxDecimals) return null
  const v = Number(t)
  return v > 0 && Number.isFinite(v) ? v : null
}
