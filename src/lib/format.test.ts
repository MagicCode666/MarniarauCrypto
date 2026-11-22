import { describe, expect, it } from 'vitest'
import { formatChange, formatEur, trendOf } from './format'

describe('format', () => {
  it('détermine la tendance', () => {
    expect(trendOf(0.1)).toBe('up')
    expect(trendOf(-0.1)).toBe('down')
    expect(trendOf(0)).toBe('flat')
  })

  it('affiche la variation avec symbole et signe, pas la couleur seule', () => {
    expect(formatChange(2.5)).toEqual({ text: '▲ +2,50 %', trend: 'up', label: 'hausse' })
    expect(formatChange(-1.234)).toEqual({ text: '▼ −1,23 %', trend: 'down', label: 'baisse' })
    expect(formatChange(0).text).toBe('■ 0,00 %')
  })

  it('formate les euros en français', () => {
    expect(formatEur(1234.5).replace(/\s/g, ' ')).toBe('1 234,50 €')
  })
})
