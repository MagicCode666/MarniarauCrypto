import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

// Rejoue toutes les migrations sur une base PGlite, avec un décor minimal de Supabase
// (schéma auth, rôles, auth.uid()). Aucun secret, aucun réseau.
const STUB = `
  create role anon nologin; create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
`

const dir = join(import.meta.dirname, '..', 'migrations')
let db: PGlite
const ids = { a: '', b: '' }

async function asUser(id: string, sql: string) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`,
  )
  try {
    return await db.query<Record<string, unknown>>(sql)
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(STUB)
  for (const f of readdirSync(dir)
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'))
  }
  const a = await db.query<{ id: string }>(
    `insert into auth.users (email) values ('alice@example.org') returning id`,
  )
  const b = await db.query<{ id: string }>(
    `insert into auth.users (email) values ('bob@example.org') returning id`,
  )
  ids.a = a.rows[0].id
  ids.b = b.rows[0].id
})

describe('profiles', () => {
  it('crée un profil à l’inscription, pseudo tiré de l’email', async () => {
    const r = await db.query<{ pseudo: string }>(
      `select pseudo from public.profiles order by pseudo`,
    )
    expect(r.rows.map((x) => x.pseudo)).toEqual(['alice', 'bob'])
  })

  it('chacun ne voit que son profil', async () => {
    const r = await asUser(ids.a, `select pseudo from public.profiles`)
    expect(r.rows).toEqual([{ pseudo: 'alice' }])
  })

  it('on peut changer son pseudo mais pas celui d’un autre', async () => {
    await asUser(ids.a, `update public.profiles set pseudo = 'Alice' where id = '${ids.a}'`)
    await asUser(ids.a, `update public.profiles set pseudo = 'pirate' where id = '${ids.b}'`)
    const r = await db.query<{ pseudo: string }>(
      `select pseudo from public.profiles order by pseudo`,
    )
    expect(r.rows.map((x) => x.pseudo)).toEqual(['Alice', 'bob'])
  })

  it('un visiteur anonyme n’a aucun accès', async () => {
    await db.exec(`set role anon`)
    await expect(db.query(`select * from public.profiles`)).rejects.toThrow(/permission denied/)
    await db.exec(`reset role`)
  })

  it('on ne peut pas modifier la date de création ni insérer à la main', async () => {
    await expect(
      asUser(ids.a, `update public.profiles set created_at = now() where id = '${ids.a}'`),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(ids.a, `insert into public.profiles (id, pseudo) values (gen_random_uuid(), 'x')`),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('catalogue, prix et historique', () => {
  it('contient les 9 cryptos de départ', async () => {
    const r = await db.query<{ n: number }>(`select count(*)::int as n from public.coins`)
    expect(r.rows[0].n).toBe(9)
  })

  it('un compte connecté lit le catalogue, les prix et l’historique', async () => {
    await db.exec(`
      insert into public.prices (coin_id, price_eur, updated_at) values ('bitcoin', 50000, now());
      insert into public.price_history (coin_id, day, close_eur) values ('bitcoin', '2026-11-01', 49000);
    `)
    const c = await asUser(ids.a, `select count(*)::int as n from public.coins`)
    const p = await asUser(ids.a, `select price_eur from public.prices`)
    const h = await asUser(ids.a, `select close_eur from public.price_history`)
    expect(c.rows[0].n).toBe(9)
    expect(Number(p.rows[0].price_eur)).toBe(50000)
    expect(Number(h.rows[0].close_eur)).toBe(49000)
  })

  it('un visiteur anonyme ne lit rien', async () => {
    for (const t of ['coins', 'prices', 'price_history']) {
      await db.exec(`set role anon`)
      await expect(db.query(`select * from public.${t}`)).rejects.toThrow(/permission denied/)
      await db.exec(`reset role`)
    }
  })

  it('un compte connecté ne peut rien écrire (catalogue, prix, historique)', async () => {
    await expect(
      asUser(ids.a, `update public.prices set price_eur = 1 where coin_id = 'bitcoin'`),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(ids.a, `insert into public.price_history values ('bitcoin', '2026-11-02', 1)`),
    ).rejects.toThrow(/permission denied/)
    await expect(
      asUser(ids.a, `insert into public.coins (coin_id, symbol, name) values ('x', 'X', 'X')`),
    ).rejects.toThrow(/permission denied/)
  })

  it('refuse un prix nul ou négatif', async () => {
    await expect(
      db.query(`update public.prices set price_eur = 0 where coin_id = 'bitcoin'`),
    ).rejects.toThrow(/check/)
  })

  it('limite le catalogue à 20 cryptos actives', async () => {
    for (let i = 0; i < 11; i++) {
      await db.query(`insert into public.coins (coin_id, symbol, name) values ($1, $2, $2)`, [
        `test-${i}`,
        `T${i}`,
      ])
    }
    await expect(
      db.query(`insert into public.coins (coin_id, symbol, name) values ('test-trop', 'TT', 'TT')`),
    ).rejects.toThrow(/limité à 20/)
    // une crypto désactivée ne compte pas
    await db.query(`update public.coins set active = false where coin_id = 'test-0'`)
    await db.query(
      `insert into public.coins (coin_id, symbol, name) values ('test-ok', 'OK', 'OK')`,
    )
  })
})

describe('collecteur (service_role)', () => {
  async function asService(sql: string) {
    await db.exec(`set role service_role`)
    try {
      return await db.query<Record<string, unknown>>(sql)
    } finally {
      await db.exec(`reset role`)
    }
  }

  async function execAsService(sql: string) {
    await db.exec(`set role service_role`)
    try {
      await db.exec(sql)
    } finally {
      await db.exec(`reset role`)
    }
  }

  it('lit le catalogue, écrit les prix et l’historique, marque l’historique chargé', async () => {
    const c = await asService(`select count(*)::int as n from public.coins where active`)
    expect(c.rows[0].n).toBeGreaterThan(0)
    await execAsService(`
      insert into public.prices (coin_id, price_eur, updated_at) values ('ethereum', 2000, now())
        on conflict (coin_id) do update set price_eur = excluded.price_eur;
      insert into public.price_history (coin_id, day, close_eur) values ('ethereum', '2026-11-03', 1900)
        on conflict (coin_id, day) do update set close_eur = excluded.close_eur;
      update public.coins set history_loaded_at = now() where coin_id = 'ethereum';
    `)
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from public.coins where history_loaded_at is not null`,
    )
    expect(r.rows[0].n).toBe(1)
  })

  it('ne peut pas modifier ni supprimer le catalogue lui-même', async () => {
    await expect(asService(`update public.coins set active = false`)).rejects.toThrow(
      /permission denied/,
    )
    await expect(asService(`delete from public.coins`)).rejects.toThrow(/permission denied/)
    await expect(
      asService(`insert into public.coins (coin_id, symbol, name) values ('z', 'Z', 'Z')`),
    ).rejects.toThrow(/permission denied/)
  })
})
