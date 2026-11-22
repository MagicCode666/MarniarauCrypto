import { describe, expect, it } from 'vitest'
import { formatAge, formatChange, formatCompactEur, formatEur, trendOf } from './format'

// Intl met des espaces insécables : on les remplace par « _ » pour comparer lisiblement
const flat = (s: string) => s.normalize('NFKC').replace(/\s/g, '_')

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

  it('ne présente pas comme hausse une variation qui s’affiche 0,00 %', () => {
    expect(formatChange(0.001)).toEqual({ text: '■ 0,00 %', trend: 'flat', label: 'stable' })
    expect(formatChange(-0.004).trend).toBe('flat')
  })

  it('formate les euros en français, avec plus de décimales pour les petits prix', () => {
    expect(flat(formatEur(1234.5))).toBe('1_234,50_€')
    expect(flat(formatEur(0.1234))).toBe('0,1234_€')
    expect(flat(formatEur(0.5))).toBe('0,50_€')
  })

  it('abrège les grands montants', () => {
    expect(flat(formatCompactEur(1.1159e12))).toMatch(/^1,12_(Bn|billions?)_€$/)
  })

  it('exprime l’ancienneté d’une donnée', () => {
    const now = new Date('2026-11-22T12:00:00Z')
    expect(formatAge('2026-11-22T11:59:40Z', now)).toBe('à l’instant')
    expect(formatAge('2026-11-22T11:53:00Z', now)).toBe('il y a 7 min')
    expect(formatAge('2026-11-22T09:00:00Z', now)).toBe('il y a 3 h')
    expect(formatAge('2026-11-18T12:00:00Z', now)).toBe('il y a 4 j')
  })
})
