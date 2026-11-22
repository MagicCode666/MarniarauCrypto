import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { estimateBuy, estimateSell } from '../../src/lib/portfolio'

// Les estimations affichées dans l'interface (TypeScript) doivent donner les mêmes chiffres que le
// calcul réel de la base (numeric, arrondi au centime). On compare sur de nombreux cas aléatoires.
let db: PGlite

beforeAll(async () => {
  db = new PGlite()
}, 60_000)

function rng(seed: number) {
  let s = seed
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
}

describe('estimations de l’interface = calcul de la base', () => {
  it('achat : frais au centime et quantité à 12 décimales, sur 300 cas', async () => {
    const r = rng(7)
    for (let i = 0; i < 300; i++) {
      const cents = 1 + Math.floor(r() * 2_000_000) // de 0,01 € à 20 000 €
      const eur = cents / 100
      const price = Math.round((0.01 + r() * 90000) * 10000) / 10000
      const rate = [0.005, 0.001, 0.0025, 0][Math.floor(r() * 4)]
      const sql = await db.query<{ fee: string; qty: string }>(
        `select round($1::numeric * $3::numeric, 2)::text as fee,
                round(($1::numeric - round($1::numeric * $3::numeric, 2)) / $2::numeric, 12)::text as qty`,
        [eur, price, rate],
      )
      const ts = estimateBuy(eur, price, rate)
      expect(ts.fee, `frais ${eur} × ${rate}`).toBe(Number(sql.rows[0].fee))
      expect(ts.quantity, `quantité ${eur} / ${price}`).toBeCloseTo(Number(sql.rows[0].qty), 10)
    }
  }, 60_000)

  it('vente : brut, frais et net au centime, sur 300 cas', async () => {
    const r = rng(11)
    for (let i = 0; i < 300; i++) {
      const qty = Math.round((0.0001 + r() * 50) * 1e8) / 1e8
      const price = Math.round((0.01 + r() * 90000) * 100) / 100
      const rate = [0.005, 0.001, 0.0025, 0][Math.floor(r() * 4)]
      const sql = await db.query<{ gross: string; fee: string }>(
        `select round($1::numeric * $2::numeric, 2)::text as gross,
                round(round($1::numeric * $2::numeric, 2) * $3::numeric, 2)::text as fee`,
        [qty, price, rate],
      )
      const ts = estimateSell(qty, price, rate)
      const gross = Number(sql.rows[0].gross)
      const fee = Number(sql.rows[0].fee)
      expect(ts.gross, `brut ${qty} × ${price}`).toBe(gross)
      expect(ts.fee, `frais ${gross} × ${rate}`).toBe(fee)
      expect(ts.net).toBeCloseTo(gross - fee, 9)
    }
  }, 60_000)

  it('cas limites des demi-centimes (0,5 % de 1 €, de 3 €, de 100,10 €)', async () => {
    for (const eur of [1, 3, 100.1, 0.01, 0.99, 200.2]) {
      const sql = await db.query<{ fee: string }>(
        `select round($1::numeric * 0.005, 2)::text as fee`,
        [eur],
      )
      expect(estimateBuy(eur, 100, 0.005).fee, `frais de ${eur} €`).toBe(Number(sql.rows[0].fee))
    }
  })
})
