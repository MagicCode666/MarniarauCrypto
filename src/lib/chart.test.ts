import { describe, expect, it } from 'vitest'
import { changeOver, toPoints, toPolyline } from './chart'

describe('chart', () => {
  it('place la valeur max en haut et la valeur min en bas', () => {
    const pts = toPoints([10, 20, 15], 100, 50, 0)
    expect(pts[0]).toEqual({ x: 0, y: 50 })
    expect(pts[1]).toEqual({ x: 50, y: 0 })
    expect(pts[2].x).toBe(100)
    expect(pts[2].y).toBe(25)
  })

  it('trace une série plate au milieu et gère un seul point ou aucun', () => {
    expect(toPoints([5, 5], 100, 50, 0).map((p) => p.y)).toEqual([25, 25])
    expect(toPoints([5], 100, 50, 0)).toEqual([{ x: 50, y: 25 }])
    expect(toPoints([], 100, 50)).toEqual([])
  })

  it('produit un attribut points de polyligne', () => {
    expect(toPolyline([1, 2], 10, 10, 0)).toBe('0.0,10.0 10.0,0.0')
  })

  it('calcule la variation sur la période', () => {
    expect(changeOver([100, 110])).toBeCloseTo(10)
    expect(changeOver([100, 50])).toBeCloseTo(-50)
    expect(changeOver([100])).toBeNull()
    expect(changeOver([0, 5])).toBeNull()
  })
})
