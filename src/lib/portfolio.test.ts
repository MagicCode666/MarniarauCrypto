import { describe, expect, it } from 'vitest'
import { estimateBuy, estimateSell, parseDecimal, valuePortfolio } from './portfolio'

describe('estimateBuy / estimateSell (mêmes chiffres que les tests de la base)', () => {
  it('achat de 1 000 € à 50 000 € avec 0,5 % de frais', () => {
    expect(estimateBuy(1000, 50000, 0.005)).toEqual({ fee: 5, quantity: 0.0199 })
  })

  it('un tout petit achat n’a pas de frais (arrondi au centime)', () => {
    expect(estimateBuy(0.01, 50000, 0.005).fee).toBe(0)
  })

  it('vente de 0,01 à 60 000 € : brut 600, frais 3, net 597', () => {
    expect(estimateSell(0.01, 60000, 0.005)).toEqual({ gross: 600, fee: 3, net: 597 })
  })

  it('sans frais, achat puis vente de la même quantité au même prix se compensent', () => {
    const { quantity } = estimateBuy(10, 20, 0)
    expect(estimateSell(quantity, 20, 0).net).toBe(10)
  })
})

describe('valuePortfolio', () => {
  const positions = [
    { coinId: 'bitcoin', quantity: 0.02, avgBuyPriceEur: 50000 },
    { coinId: 'ethereum', quantity: 1, avgBuyPriceEur: 2000 },
  ]

  it('valorise aux prix actuels et calcule le P&L des positions', () => {
    const v = valuePortfolio(8000, 10000, positions, { bitcoin: 60000, ethereum: 1800 })
    expect(v.positionsValueEur).toBe(1200 + 1800)
    expect(v.totalValueEur).toBe(8000 + 3000)
    expect(v.investedEur).toBe(1000 + 2000)
    expect(v.pnlEur).toBe(0)
    expect(v.positions[0].pnlEur).toBe(200)
    expect(v.positions[0].pnlPct).toBeCloseTo(20)
    expect(v.positions[1].pnlEur).toBe(-200)
    expect(v.anyPriceMissing).toBe(false)
  })

  it('la performance depuis le départ compte tout le capital, pas seulement les positions', () => {
    // 10 000 € → 8 000 de cash + 3 000 de positions = 11 000 : +10 %
    const v = valuePortfolio(8000, 10000, positions, { bitcoin: 60000, ethereum: 1800 })
    expect(v.performanceEur).toBe(1000)
    expect(v.performancePct).toBeCloseTo(10)
  })

  it('montre l’effet des frais : un achat sans variation de prix fait baisser la performance', () => {
    // 1 000 € dépensés avec 5 € de frais : 995 € de crypto, P&L des positions 0, performance −5 €
    const q = estimateBuy(1000, 50000, 0.005).quantity
    const v = valuePortfolio(
      9000,
      10000,
      [{ coinId: 'bitcoin', quantity: q, avgBuyPriceEur: 50000 }],
      {
        bitcoin: 50000,
      },
    )
    expect(v.pnlEur).toBeCloseTo(0, 9)
    expect(v.performanceEur).toBeCloseTo(-5, 9)
  })

  it('signale un prix manquant au lieu de le cacher, et valorise alors au prix moyen', () => {
    const v = valuePortfolio(0, 10000, positions, { bitcoin: 60000 })
    const eth = v.positions.find((p) => p.coinId === 'ethereum')!
    expect(eth.priceMissing).toBe(true)
    expect(eth.valueEur).toBe(2000)
    expect(v.anyPriceMissing).toBe(true)
  })

  it('sans position, le P&L est indéfini et la valeur égale le cash', () => {
    const v = valuePortfolio(10000, 10000, [], {})
    expect(v.pnlPct).toBeNull()
    expect(v.totalValueEur).toBe(10000)
    expect(v.performanceEur).toBe(0)
  })
})

describe('parseDecimal', () => {
  it('accepte virgule ou point et refuse le reste', () => {
    expect(parseDecimal('12,5', 2)).toBe(12.5)
    expect(parseDecimal(' 12.50 ', 2)).toBe(12.5)
    expect(parseDecimal('100', 2)).toBe(100)
    expect(parseDecimal('', 2)).toBeNull()
    expect(parseDecimal('abc', 2)).toBeNull()
    expect(parseDecimal('-5', 2)).toBeNull()
    expect(parseDecimal('0', 2)).toBeNull()
    expect(parseDecimal('1e3', 2)).toBeNull()
    expect(parseDecimal('1,2,3', 2)).toBeNull()
  })

  it('refuse trop de décimales', () => {
    expect(parseDecimal('10,001', 2)).toBeNull()
    expect(parseDecimal('0,000000000001', 12)).toBe(1e-12)
    expect(parseDecimal('0,0000000000001', 12)).toBeNull()
  })
})
