import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Décor minimal de Supabase (schéma auth, rôles, auth.uid()) pour rejouer les migrations sur PGlite.
// Aucun secret, aucun réseau.
export const STUB = `
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

export function migrationFiles(): string[] {
  return readdirSync(dir)
    .filter((n) => n.endsWith('.sql'))
    .sort()
}

/** Crée une base avec le décor Supabase et les migrations (jusqu'à `until` inclus, si précisé). */
export async function newDb(until?: string): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(STUB)
  for (const f of migrationFiles()) {
    if (until && f > until) break
    await db.exec(readFileSync(join(dir, f), 'utf8'))
  }
  return db
}

export async function applyMigration(db: PGlite, file: string): Promise<void> {
  await db.exec(readFileSync(join(dir, file), 'utf8'))
}

/** Exécute une requête avec le rôle `authenticated` et l'identité d'un utilisateur. */
export async function asUser<T extends Record<string, unknown> = Record<string, unknown>>(
  db: PGlite,
  userId: string,
  sql: string,
  params: unknown[] = [],
) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`,
  )
  try {
    return await db.query<T>(sql, params)
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}

export async function asAnon(db: PGlite, sql: string, params: unknown[] = []) {
  await db.exec(`set role anon`)
  try {
    return await db.query(sql, params)
  } finally {
    await db.exec(`reset role`)
  }
}
