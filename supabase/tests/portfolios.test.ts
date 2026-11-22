import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { applyMigration, asAnon, asUser, migrationFiles, newDb } from './helpers'

let db: PGlite
const users: Record<string, string> = {}

async function addUser(name: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into auth.users (email) values ($1) returning id`,
    [`${name}@example.org`],
  )
  users[name] = r.rows[0].id
  return r.rows[0].id
}

async function pfOf(name: string, onlyActive = true): Promise<string> {
  const r = await db.query<{ id: string }>(
    `select f.id from public.portfolios f
     join public.portfolio_members m on m.portfolio_id = f.id
     where m.user_id = $1 and f.kind = 'personal' ${onlyActive ? 'and f.archived_at is null' : ''}
     order by f.created_at desc, f.id limit 1`,
    [users[name]],
  )
  return r.rows[0].id
}

const setPrice = (coin: string, price: number, ageMinutes = 0) =>
  db.query(
    `insert into public.prices (coin_id, price_eur, updated_at)
     values ($1, $2, now() - ($3 || ' minutes')::interval)
     on conflict (coin_id) do update
       set price_eur = excluded.price_eur, updated_at = excluded.updated_at`,
    [coin, price, String(ageMinutes)],
  )

const buy = (who: string, pf: string, coin: string, eur: number, note: string | null = null) =>
  asUser(db, users[who], `select * from public.buy_coin($1, $2, $3::numeric, $4)`, [
    pf,
    coin,
    eur,
    note,
  ])

const sell = (who: string, pf: string, coin: string, qty: string | number) =>
  asUser(db, users[who], `select * from public.sell_coin($1, $2, $3::numeric, null)`, [
    pf,
    coin,
    qty,
  ])

async function cash(who: string, pf: string): Promise<number> {
  const r = await asUser(db, users[who], `select public.portfolio_cash($1)::text as c`, [pf])
  return Number(r.rows[0].c)
}

async function positions(who: string, pf: string) {
  const r = await asUser<{ coin_id: string; q: string; a: string }>(
    db,
    users[who],
    `select coin_id, quantity::text as q, avg_buy_price_eur::text as a
     from public.portfolio_positions($1)`,
    [pf],
  )
  return r.rows.map((x) => ({ coin: x.coin_id, qty: Number(x.q), avg: Number(x.a) }))
}

beforeAll(async () => {
  db = await newDb()
  for (const n of ['alice', 'bob', 'carol', 'dan', 'erin', 'frank']) await addUser(n)
  await setPrice('bitcoin', 50000)
  await setPrice('ethereum', 2000)
  await setPrice('cardano', 10)
}, 90_000)

describe('création des portefeuilles', () => {
  it('chaque compte reçoit un portefeuille personnel de 10 000 €, dont il est propriétaire', async () => {
    const r = await db.query<Record<string, unknown>>(
      `select f.name, f.kind, f.initial_cash::text as cash, f.fee_rate::text as fee,
              f.archived_at, m.role
       from public.portfolios f join public.portfolio_members m on m.portfolio_id = f.id
       where m.user_id = $1`,
      [users.alice],
    )
    expect(r.rows).toEqual([
      {
        name: 'Mon portefeuille',
        kind: 'personal',
        cash: '10000',
        fee: '0.005',
        archived_at: null,
        role: 'owner',
      },
    ])
    expect(await cash('alice', await pfOf('alice'))).toBe(10000)
  })
})

describe('achat', () => {
  it('applique 0,5 % de frais, calcule la quantité et le prix moyen, au prix de la base', async () => {
    const pf = await pfOf('alice')
    const r = await buy('alice', pf, 'bitcoin', 1000, 'premier achat')
    const t = r.rows[0] as Record<string, unknown>
    expect(t.side).toBe('buy')
    expect(Number(t.fee_eur)).toBe(5)
    expect(Number(t.quantity)).toBeCloseTo(0.0199, 12) // (1000 − 5) / 50000
    expect(Number(t.price_eur)).toBe(50000)
    expect(Number(t.total_eur)).toBe(1000)
    expect(t.user_id).toBe(users.alice)
    expect(t.note).toBe('premier achat')
    expect(await cash('alice', pf)).toBe(9000)
    expect(await positions('alice', pf)).toEqual([{ coin: 'bitcoin', qty: 0.0199, avg: 50000 }])
  })

  it('calcule un prix d’achat moyen pondéré sur plusieurs achats', async () => {
    const pf = await pfOf('alice')
    await setPrice('bitcoin', 25000)
    await buy('alice', pf, 'bitcoin', 1000) // 0,0398 BTC à 25 000
    const [p] = await positions('alice', pf)
    expect(p.qty).toBeCloseTo(0.0597, 12)
    expect(p.avg).toBeCloseTo((0.0199 * 50000 + 0.0398 * 25000) / 0.0597, 6)
    await setPrice('bitcoin', 50000)
  })

  it('arrondit les frais au centime (un tout petit achat n’a pas de frais)', async () => {
    const pf = await pfOf('alice')
    const r = await buy('alice', pf, 'bitcoin', 0.01)
    expect(Number((r.rows[0] as Record<string, unknown>).fee_eur)).toBe(0)
  })

  it('refuse un montant invalide', async () => {
    const pf = await pfOf('carol')
    for (const bad of [0, -5, 10.001]) {
      await expect(buy('carol', pf, 'bitcoin', bad)).rejects.toThrow(/Montant invalide/)
    }
    expect(await cash('carol', pf)).toBe(10000)
  })

  it('refuse un achat supérieur au cash', async () => {
    const pf = await pfOf('carol')
    await expect(buy('carol', pf, 'bitcoin', 10000.01)).rejects.toThrow(/Solde insuffisant/)
    await buy('carol', pf, 'bitcoin', 10000) // tout le cash : accepté
    expect(await cash('carol', pf)).toBe(0)
    await expect(buy('carol', pf, 'bitcoin', 1)).rejects.toThrow(/Solde insuffisant/)
  })

  it('refuse une crypto inconnue, sans prix ou désactivée', async () => {
    const pf = await pfOf('dan')
    await expect(buy('dan', pf, 'inconnu', 10)).rejects.toThrow(/indisponible/)
    await expect(buy('dan', pf, 'tron', 10)).rejects.toThrow(/indisponible/) // aucun prix
    await setPrice('tron', 0.1)
    await db.query(`update public.coins set active = false where coin_id = 'tron'`)
    await expect(buy('dan', pf, 'tron', 10)).rejects.toThrow(/indisponible/)
    await db.query(`update public.coins set active = true where coin_id = 'tron'`)
  })

  it('refuse d’acheter sur un prix de plus de 30 minutes, l’accepte en dessous', async () => {
    const pf = await pfOf('dan')
    await setPrice('ethereum', 2000, 31)
    await expect(buy('dan', pf, 'ethereum', 10)).rejects.toThrow(/Prix trop ancien/)
    await setPrice('ethereum', 2000, 29)
    await buy('dan', pf, 'ethereum', 10)
    await setPrice('ethereum', 2000)
  })

  it('ne prend jamais le prix du client : la fonction n’a aucun paramètre de prix', async () => {
    const r = await db.query<{ args: string }>(
      `select pg_get_function_arguments(p.oid) as args from pg_proc p
       where p.proname in ('buy_coin', 'sell_coin')`,
    )
    for (const row of r.rows) expect(row.args).not.toMatch(/price|prix/i)
  })
})

describe('vente', () => {
  it('calcule le net reçu après frais et garde le prix d’achat moyen', async () => {
    const pf = await pfOf('erin')
    await buy('erin', pf, 'bitcoin', 2000) // 0,0398 BTC, frais 10
    await setPrice('bitcoin', 60000)
    const r = await sell('erin', pf, 'bitcoin', '0.01')
    const t = r.rows[0] as Record<string, unknown>
    expect(Number(t.fee_eur)).toBe(3) // 0,5 % de 600
    expect(Number(t.total_eur)).toBe(597)
    expect(await cash('erin', pf)).toBe(8597)
    const [p] = await positions('erin', pf)
    expect(p.qty).toBeCloseTo(0.0298, 12)
    expect(p.avg).toBe(50000)
  })

  it('refuse de vendre plus que détenu, ce qu’on ne détient pas, ou une quantité invalide', async () => {
    const pf = await pfOf('erin')
    await expect(sell('erin', pf, 'bitcoin', '0.05')).rejects.toThrow(/Quantité insuffisante/)
    await expect(sell('erin', pf, 'ethereum', '1')).rejects.toThrow(/ne détenez pas/)
    for (const bad of ['0', '-1', '0.0000000000001']) {
      await expect(sell('erin', pf, 'bitcoin', bad)).rejects.toThrow(/Quantité invalide/)
    }
  })

  it('refuse de vendre sur un prix de plus de 30 minutes', async () => {
    const pf = await pfOf('erin')
    await setPrice('bitcoin', 60000, 45)
    await expect(sell('erin', pf, 'bitcoin', '0.001')).rejects.toThrow(/Prix trop ancien/)
    await setPrice('bitcoin', 60000)
  })

  it('solde la position, puis repart d’un prix moyen neuf au rachat', async () => {
    const pf = await pfOf('erin')
    // quantité détenue + 1e-12 : dans la tolérance, ramenée à la quantité réellement détenue
    const r = await sell('erin', pf, 'bitcoin', '0.029800000001')
    expect(Number((r.rows[0] as Record<string, unknown>).quantity)).toBeCloseTo(0.0298, 12)
    expect(await positions('erin', pf)).toEqual([])
    await buy('erin', pf, 'bitcoin', 600) // à 60 000
    const [p] = await positions('erin', pf)
    expect(p.avg).toBe(60000)
    await setPrice('bitcoin', 50000)
  })

  it('moyenne mobile : une vente partielle puis un rachat donne 15 et non la moyenne des achats', async () => {
    const pf = await pfOf('frank')
    await db.query(`update public.portfolios set fee_rate = 0 where id = $1`, [pf])
    await buy('frank', pf, 'cardano', 10) // 1 ADA à 10
    await sell('frank', pf, 'cardano', '0.5') // reste 0,5 à 10
    await setPrice('cardano', 20)
    await buy('frank', pf, 'cardano', 10) // 0,5 à 20
    const [p] = await positions('frank', pf)
    expect(p.qty).toBeCloseTo(1, 12)
    expect(p.avg).toBeCloseTo(15, 12) // (0,5×10 + 0,5×20) / 1 ; la moyenne des achats seuls = 13,33
    await setPrice('cardano', 10)
  })
})

describe('accès et sécurité', () => {
  it('un non-membre ne voit rien et ne peut rien faire', async () => {
    const pf = await pfOf('alice')
    await expect(buy('bob', pf, 'bitcoin', 10)).rejects.toThrow(/Accès refusé/)
    await expect(sell('bob', pf, 'bitcoin', '0.001')).rejects.toThrow(/Accès refusé/)
    await expect(cash('bob', pf)).rejects.toThrow(/Accès refusé/)
    await expect(positions('bob', pf)).rejects.toThrow(/Accès refusé/)
    const tx = await asUser(db, users.bob, `select * from public.transactions`)
    expect(tx.rows).toHaveLength(0)
    const pfs = await asUser<{ id: string }>(db, users.bob, `select id from public.portfolios`)
    expect(pfs.rows.map((r) => r.id)).toEqual([await pfOf('bob')])
  })

  it('un lecteur (viewer) lit mais ne peut pas acheter ni vendre', async () => {
    const pf = await pfOf('alice')
    await db.query(
      `insert into public.portfolio_members (portfolio_id, user_id, role) values ($1, $2, 'viewer')`,
      [pf, users.bob],
    )
    expect(await cash('bob', pf)).toBeGreaterThan(0)
    const tx = await asUser(
      db,
      users.bob,
      `select * from public.transactions where portfolio_id = $1`,
      [pf],
    )
    expect(tx.rows.length).toBeGreaterThan(0)
    await expect(buy('bob', pf, 'bitcoin', 10)).rejects.toThrow(/lecture seule/)
    await expect(sell('bob', pf, 'bitcoin', '0.001')).rejects.toThrow(/lecture seule/)
  })

  it('un éditeur (editor) peut trader, mais pas remettre à zéro ; l’auteur est tracé', async () => {
    const pf = await pfOf('alice')
    await db.query(
      `update public.portfolio_members set role = 'editor' where portfolio_id = $1 and user_id = $2`,
      [pf, users.bob],
    )
    const r = await buy('bob', pf, 'bitcoin', 10)
    expect((r.rows[0] as Record<string, unknown>).user_id).toBe(users.bob)
    await expect(asUser(db, users.bob, `select public.reset_portfolio($1)`, [pf])).rejects.toThrow(
      /Seul le propriétaire/,
    )
  })

  it('un visiteur anonyme ne peut appeler aucune fonction', async () => {
    const pf = await pfOf('alice')
    await expect(
      asAnon(db, `select * from public.buy_coin($1, 'bitcoin', 10, null)`, [pf]),
    ).rejects.toThrow(/permission denied/)
    await expect(asAnon(db, `select public.portfolio_cash($1)`, [pf])).rejects.toThrow(
      /permission denied/,
    )
    await expect(asAnon(db, `select * from public.portfolios`)).rejects.toThrow(/permission denied/)
  })

  it('aucune écriture directe, même sur son propre portefeuille', async () => {
    const pf = await pfOf('alice')
    await expect(
      asUser(
        db,
        users.alice,
        `insert into public.transactions (portfolio_id, side, coin_id, quantity, price_eur, fee_eur, total_eur)
         values ($1, 'sell', 'bitcoin', 1, 1, 0, 1000000)`,
        [pf],
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(db, users.alice, `update public.portfolios set initial_cash = 1e9 where id = $1`, [
        pf,
      ]),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(db, users.alice, `delete from public.transactions where portfolio_id = $1`, [pf]),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(
        db,
        users.alice,
        `insert into public.portfolio_members (portfolio_id, user_id, role) values ($1, $2, 'owner')`,
        [pf, users.carol],
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('les fonctions internes ne sont pas appelables depuis l’application', async () => {
    const pf = await pfOf('alice')
    await expect(asUser(db, users.alice, `select public.internal_cash($1)`, [pf])).rejects.toThrow(
      /permission denied/,
    )
    await expect(
      asUser(db, users.alice, `select public.create_personal_portfolio($1)`, [users.alice]),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('remise à zéro (archivage)', () => {
  it('archive l’ancien portefeuille, en crée un neuf à 10 000 € avec les mêmes membres', async () => {
    const old = await pfOf('alice')
    const r = await asUser<{ id: string }>(
      db,
      users.alice,
      `select public.reset_portfolio($1) as id`,
      [old],
    )
    const fresh = r.rows[0].id
    expect(fresh).not.toBe(old)

    const o = await db.query<{ archived: boolean }>(
      `select archived_at is not null as archived from public.portfolios where id = $1`,
      [old],
    )
    expect(o.rows[0].archived).toBe(true)

    expect(await cash('alice', fresh)).toBe(10000)
    expect(await positions('alice', fresh)).toEqual([])
    const f = await db.query<Record<string, unknown>>(
      `select name, kind, fee_rate::text as fee, archived_at from public.portfolios where id = $1`,
      [fresh],
    )
    expect(f.rows[0]).toEqual({
      name: 'Mon portefeuille',
      kind: 'personal',
      fee: '0.005',
      archived_at: null,
    })
    const m = await db.query<{ user_id: string; role: string }>(
      `select user_id, role from public.portfolio_members where portfolio_id = $1 order by role`,
      [fresh],
    )
    expect(m.rows).toEqual(
      expect.arrayContaining([
        { user_id: users.alice, role: 'owner' },
        { user_id: users.bob, role: 'editor' },
      ]),
    )

    // l'historique de l'ancien portefeuille reste lisible, mais il est figé
    const tx = await asUser(
      db,
      users.alice,
      `select * from public.transactions where portfolio_id = $1`,
      [old],
    )
    expect(tx.rows.length).toBeGreaterThan(0)
    await expect(buy('alice', old, 'bitcoin', 10)).rejects.toThrow(/archivé/)
    await expect(sell('alice', old, 'bitcoin', '0.001')).rejects.toThrow(/archivé/)
    await expect(
      asUser(db, users.alice, `select public.reset_portfolio($1)`, [old]),
    ).rejects.toThrow(/déjà archivé/)
  })

  it('le portefeuille actif de l’utilisateur est désormais le neuf', async () => {
    const pf = await pfOf('alice')
    await buy('alice', pf, 'bitcoin', 100)
    expect(await cash('alice', pf)).toBe(9900)
  })
})

describe('comptes existants avant la migration', () => {
  it('reçoivent leur portefeuille personnel à la migration', async () => {
    const files = migrationFiles()
    const idx = files.findIndex((f) => f.includes('_portfolios'))
    const last = files[idx]
    const previous = files[idx - 1]
    const old = await newDb(previous)
    const u = await old.query<{ id: string }>(
      `insert into auth.users (email) values ('ancien@example.org') returning id`,
    )
    const has = await old.query(
      `select 1 from information_schema.tables where table_name = 'portfolios'`,
    )
    expect(has.rows).toHaveLength(0)
    await applyMigration(old, last)
    const r = await old.query<{ role: string; cash: string }>(
      `select m.role, f.initial_cash::text as cash from public.portfolio_members m
       join public.portfolios f on f.id = m.portfolio_id where m.user_id = $1`,
      [u.rows[0].id],
    )
    expect(r.rows).toEqual([{ role: 'owner', cash: '10000' }])
  }, 90_000)
})

describe('positions : comparaison avec une implémentation de référence', () => {
  it('retrouve, sur 80 transactions aléatoires, la moyenne mobile du prototype', async () => {
    const owner = await addUser('gina')
    const g = await pfOf('gina')
    await db.query(`update public.portfolios set fee_rate = 0 where id = $1`, [g])

    // petit générateur pseudo-aléatoire déterministe
    let seed = 12345
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    const coins = ['bitcoin', 'ethereum', 'cardano']
    const held: Record<string, number> = { bitcoin: 0, ethereum: 0, cardano: 0 }
    const avg: Record<string, number> = { bitcoin: 0, ethereum: 0, cardano: 0 }
    const unit = 10000 // quantités en dix-millièmes

    for (let i = 0; i < 80; i++) {
      const coin = coins[Math.floor(rnd() * coins.length)]
      const price = Math.round((1 + rnd() * 99) * 100) / 100
      const canSell = held[coin] > 0
      if (canSell && rnd() < 0.4) {
        const sellUnits = Math.max(1, Math.floor(rnd() * held[coin]))
        held[coin] -= sellUnits
        if (held[coin] === 0) avg[coin] = 0
        await db.query(
          `insert into public.transactions (portfolio_id, side, coin_id, quantity, price_eur, fee_eur, total_eur)
           values ($1, 'sell', $2, $3::numeric / ${unit}, $4, 0, 1)`,
          [g, coin, sellUnits, price],
        )
      } else {
        const buyUnits = 1 + Math.floor(rnd() * 50000)
        avg[coin] = (held[coin] * avg[coin] + buyUnits * price) / (held[coin] + buyUnits)
        held[coin] += buyUnits
        await db.query(
          `insert into public.transactions (portfolio_id, side, coin_id, quantity, price_eur, fee_eur, total_eur)
           values ($1, 'buy', $2, $3::numeric / ${unit}, $4, 0, 1)`,
          [g, coin, buyUnits, price],
        )
      }
    }

    const got = await asUser<{ coin_id: string; q: string; a: string }>(
      db,
      owner,
      `select coin_id, quantity::text as q, avg_buy_price_eur::text as a
       from public.portfolio_positions($1)`,
      [g],
    )
    const expected = [...coins]
      .sort()
      .filter((c) => held[c] > 0)
      .map((c) => ({ coin: c, qty: held[c] / unit, avg: avg[c] }))
    expect(got.rows.map((r) => r.coin_id)).toEqual(expected.map((e) => e.coin))
    got.rows.forEach((r, i) => {
      expect(Number(r.q)).toBeCloseTo(expected[i].qty, 9)
      expect(Number(r.a)).toBeCloseTo(expected[i].avg, 6)
    })
  }, 60_000)
})
