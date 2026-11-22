import { describe, expect, it } from 'vitest'
import fixture from './indicators.fixture.json'
import {
  analyze,
  changePoints,
  ema,
  levelOf,
  macd,
  macdPoints,
  MIN_CLOSES,
  rsi,
  rsiPoints,
} from './indicators'

const range = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i))

describe('ema', () => {
  it('démarre avec la moyenne simple des premières valeurs, puis lisse', () => {
    // période 3 : graine = (1+2+3)/3 = 2 ; k = 0,5 ; puis 4×0,5 + 2×0,5 = 3 ; 5×0,5 + 3×0,5 = 4
    expect(ema([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4])
  })

  it('renvoie null partout s’il manque de données', () => {
    expect(ema([1, 2], 3)).toEqual([null, null])
    expect(ema([], 3)).toEqual([])
  })
})

describe('rsi', () => {
  it('vaut 50 quand hausses et baisses se compensent exactement', () => {
    // 14 variations alternées +1 / −1 : gain moyen = perte moyenne
    expect(rsi(range(15, (i) => 10 + (i % 2)))).toBe(50)
  })

  it('calcule la formule de Wilder à la main', () => {
    // 13 hausses de 1 et une baisse de 2 : RS = (13/14) / (2/14) = 6,5 → RSI = 100 − 100/7,5
    const closes = [10]
    for (let i = 0; i < 13; i++) closes.push(closes[closes.length - 1] + 1)
    closes.push(closes[closes.length - 1] - 2)
    expect(rsi(closes)).toBe(86.67)
  })

  it('vaut 100 sans aucune baisse, et reste proche de 0 sans aucune hausse', () => {
    expect(rsi(range(30, (i) => 10 + i))).toBe(100)
    expect(rsi(range(30, (i) => 100 - i))).toBe(0)
  })

  it('est non défini quand le prix n’a pas bougé, ou sans assez de données', () => {
    expect(rsi(range(30, () => 5))).toBeNull()
    expect(rsi(range(14, (i) => i))).toBeNull()
    expect(rsi(range(15, (i) => i))).not.toBeNull()
  })

  it('retrouve le RSI de pandas sur une série de 300 jours', () => {
    expect(Math.abs(rsi(fixture.closes)! - fixture.last.rsi)).toBeLessThan(0.006)
  })
})

describe('macd', () => {
  it('est nul sur un prix constant', () => {
    const m = macd(range(60, () => 42))!
    expect(m.macd).toBeCloseTo(0, 12)
    expect(m.signalLine).toBeCloseTo(0, 12)
    expect(m.histogram).toBeCloseTo(0, 12)
  })

  it('tend vers 7 sur une hausse linéaire (décalage de (26−1)/2 − (12−1)/2)', () => {
    const m = macd(range(300, (i) => i))!
    expect(m.macd).toBeCloseTo(7, 6)
    expect(m.signalLine!).toBeCloseTo(7, 6)
  })

  it('demande 26 clôtures pour le MACD et 34 pour sa ligne de signal', () => {
    expect(macd(range(25, (i) => i))).toBeNull()
    const m26 = macd(range(26, (i) => i))!
    expect(m26.signalLine).toBeNull()
    expect(m26.histogram).toBeNull()
    expect(macd(range(33, (i) => i))!.signalLine).toBeNull()
    expect(macd(range(34, (i) => i))!.signalLine).not.toBeNull()
  })

  it('retrouve le MACD, le signal et l’histogramme de pandas sur 300 jours', () => {
    const m = macd(fixture.closes)!
    expect(m.macd).toBeCloseTo(fixture.last.macd, 6)
    expect(m.signalLine!).toBeCloseTo(fixture.last.signalLine, 6)
    expect(m.histogram!).toBeCloseTo(fixture.last.histogram, 6)
  })

  it('garde le signe du MACD pour les très petits prix (pas d’arrondi qui l’annulerait)', () => {
    // prix autour de 0,0001 € : un arrondi à 4 décimales ferait croire à un MACD nul
    const m = macd(range(60, (i) => 0.0001 + i * 0.000001))!
    expect(m.macd).toBeGreaterThan(0)
  })
})

describe('points du score (règles du prototype)', () => {
  it('RSI : seuils 30, 45, 55, 70', () => {
    const pts = (v: number) => rsiPoints(v).points
    expect(pts(10)).toBe(2)
    expect(pts(29.99)).toBe(2)
    expect(pts(30)).toBe(1)
    expect(pts(44.99)).toBe(1)
    expect(pts(45)).toBe(0)
    expect(pts(50)).toBe(0)
    expect(pts(55)).toBe(0)
    expect(pts(55.01)).toBe(-1)
    expect(pts(70)).toBe(-1)
    expect(pts(70.01)).toBe(-2)
    expect(pts(95)).toBe(-2)
  })

  it('MACD : le signe de la ligne MACD, pas sa position par rapport au signal', () => {
    expect(macdPoints(0.0001).points).toBe(1)
    expect(macdPoints(-0.0001).points).toBe(-1)
    expect(macdPoints(0).points).toBe(0)
  })

  it('variation 24 h : au-delà de ±5 % strictement', () => {
    expect(changePoints(5.01).points).toBe(1)
    expect(changePoints(5).points).toBe(0)
    expect(changePoints(-5).points).toBe(0)
    expect(changePoints(-5.01).points).toBe(-1)
    expect(changePoints(null).points).toBe(0)
  })

  it('niveaux : ≥3, ≥1, entre, ≤−1, ≤−3', () => {
    expect([4, 3, 2, 1, 0, -1, -2, -3, -4].map(levelOf)).toEqual([
      'strong_buy',
      'strong_buy',
      'buy',
      'buy',
      'neutral',
      'sell',
      'sell',
      'strong_sell',
      'strong_sell',
    ])
  })

  it('les explications citent les valeurs réelles', () => {
    expect(rsiPoints(28.04).reason).toContain('28,0')
    expect(rsiPoints(28.04).reason).toContain('survendu')
    expect(changePoints(-6.5).reason).toContain('−6,50 %')
  })
})

describe('analyze', () => {
  it('refuse d’inventer un signal sans assez de clôtures', () => {
    const a = analyze(
      range(MIN_CLOSES - 1, (i) => i + 1),
      1,
    )
    expect(a).toEqual({ status: 'insufficient', closes: MIN_CLOSES - 1, needed: MIN_CLOSES })
  })

  it('additionne les trois contributions et en déduit le niveau', () => {
    // hausse continue : RSI 100 (−2), MACD positif (+1), 24 h à +6 % (+1) → score 0 : neutre
    const a = analyze(
      range(60, (i) => 10 + i),
      6,
    )
    if (a.status !== 'ok') throw new Error('attendu : ok')
    expect(a.rsi).toBe(100)
    expect(a.contributions.map((c) => c.points)).toEqual([-2, 1, 1])
    expect(a.score).toBe(0)
    expect(a.level).toBe('neutral')
  })

  it('cumule les signaux baissiers vers « fort signal baissier »', () => {
    // baisse continue : RSI 0 (+2), MACD négatif (−1), 24 h −8 % (−1) → +0 ; avec RSI haut ce serait −
    const a = analyze(
      range(60, (i) => 200 - i),
      -8,
    )
    if (a.status !== 'ok') throw new Error('attendu : ok')
    expect(a.contributions.map((c) => c.points)).toEqual([2, -1, -1])
    expect(a.level).toBe('neutral')
    const b = analyze(
      range(60, (i) => 10 + i),
      0,
    )
    if (b.status !== 'ok') throw new Error('attendu : ok')
    expect(b.score).toBe(-1)
    expect(b.level).toBe('sell')
  })

  it('signale un RSI non défini sur un prix constant sans bloquer le reste', () => {
    const a = analyze(
      range(60, () => 5),
      null,
    )
    if (a.status !== 'ok') throw new Error('attendu : ok')
    expect(a.rsi).toBeNull()
    expect(a.contributions[0].reason).toContain('non défini')
    expect(a.level).toBe('neutral')
  })
})
