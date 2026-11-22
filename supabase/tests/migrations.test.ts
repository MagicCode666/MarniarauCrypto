import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

// Rejoue toutes les migrations sur une base PGlite, avec un décor minimal de Supabase
// (schéma auth, rôles, auth.uid()). Aucun secret, aucun réseau.
const STUB = `
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
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
