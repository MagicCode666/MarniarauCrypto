import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { asAnon, asUser, newDb } from './helpers'

let db: PGlite
const u: Record<string, string> = {}

async function addUser(name: string, pseudo = name): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into auth.users (email) values ($1) returning id`,
    [`${name}@example.org`],
  )
  u[name] = r.rows[0].id
  await db.query(`update public.profiles set pseudo = $2 where id = $1`, [u[name], pseudo])
  return u[name]
}

const personal = async (who: string) =>
  (
    await db.query<{ id: string }>(
      `select f.id from public.portfolios f join public.portfolio_members m on m.portfolio_id = f.id
       where m.user_id = $1 and f.kind = 'personal' and f.archived_at is null`,
      [u[who]],
    )
  ).rows[0].id

async function createShared(who: string, name = 'Famille', rotate = true): Promise<string> {
  if (rotate) {
    // reste sous la limite de 5 portefeuilles partagés actifs : on archive les plus anciens
    await db.query(
      `update public.portfolios set archived_at = now() where id in (
         select f.id from public.portfolios f
         join public.portfolio_members m on m.portfolio_id = f.id
         where m.user_id = $1 and m.role = 'owner' and f.kind = 'shared' and f.archived_at is null
         order by f.created_at desc, f.id offset 3)`,
      [u[who]],
    )
  }
  const r = await asUser<{ id: string }>(
    db,
    u[who],
    `select public.create_shared_portfolio($1) as id`,
    [name],
  )
  return r.rows[0].id
}

async function invite(who: string, pf: string, role = 'editor', days = 7): Promise<string> {
  const r = await asUser<{ t: string }>(
    db,
    u[who],
    `select public.create_invitation($1, $2, $3::int) as t`,
    [pf, role, days],
  )
  return r.rows[0].t
}

const join = (who: string, token: string | null) =>
  asUser<{ id: string }>(db, u[who], `select public.join_portfolio($1) as id`, [token])

async function joinAs(who: string, pf: string, role = 'editor'): Promise<void> {
  await join(who, await invite('olga', pf, role))
}

const call = (who: string, sql: string, params: unknown[] = []) => asUser(db, u[who], sql, params)

const roleOf = async (pf: string, who: string) =>
  (
    await db.query<{ role: string }>(
      `select role from public.portfolio_members where portfolio_id = $1 and user_id = $2`,
      [pf, u[who]],
    )
  ).rows[0]?.role

const isRevoked = async (token: string) =>
  (
    await db.query<{ r: boolean }>(
      `select revoked_at is not null as r from public.portfolio_invitations
       where token_hash = sha256(convert_to($1, 'UTF8'))`,
      [token],
    )
  ).rows[0].r

const setPrice = (coin: string, price: number) =>
  db.query(
    `insert into public.prices (coin_id, price_eur, updated_at) values ($1, $2, now())
     on conflict (coin_id) do update set price_eur = excluded.price_eur, updated_at = now()`,
    [coin, price],
  )

const GENERIC = /Code invalide ou expiré/

beforeAll(async () => {
  db = await newDb()
  await addUser('olga', 'Olga')
  await addUser('paul', 'Paul')
  await addUser('quentin', 'Quentin')
  await addUser('rita', 'Rita')
  await addUser('zed', 'Zed')
  await setPrice('bitcoin', 50000)
}, 90_000)

describe('création d’un portefeuille partagé', () => {
  it('crée un portefeuille partagé de 10 000 € dont on est propriétaire, nom nettoyé', async () => {
    const id = await createShared('olga', '  Famille  ')
    const r = await db.query<Record<string, unknown>>(
      `select name, kind, initial_cash::text as cash, fee_rate::text as fee from public.portfolios where id = $1`,
      [id],
    )
    expect(r.rows[0]).toEqual({ name: 'Famille', kind: 'shared', cash: '10000', fee: '0.005' })
    expect(await roleOf(id, 'olga')).toBe('owner')
  })

  it('refuse un nom vide ou trop long', async () => {
    for (const bad of ['', '   ', 'x'.repeat(61)]) {
      await expect(createShared('olga', bad)).rejects.toThrow(/Nom invalide/)
    }
  })

  it('limite à 5 portefeuilles partagés actifs par propriétaire (un archivé ne compte plus)', async () => {
    await addUser('tom')
    const ids: string[] = []
    for (let i = 0; i < 5; i++) ids.push(await createShared('tom', `P${i}`, false))
    await expect(createShared('tom', 'trop', false)).rejects.toThrow(
      /déjà 5 portefeuilles partagés/,
    )
    await call('tom', `select public.archive_portfolio($1)`, [ids[0]])
    await createShared('tom', 'après archivage', false)
  })

  it('un visiteur anonyme ne peut rien créer', async () => {
    await expect(asAnon(db, `select public.create_shared_portfolio('x')`)).rejects.toThrow(
      /permission denied/,
    )
  })
})

describe('invitations', () => {
  let pf: string

  it('seul le propriétaire invite', async () => {
    pf = await createShared('olga', 'Invitations')
    await joinAs('paul', pf, 'editor')
    await joinAs('quentin', pf, 'viewer')
    for (const who of ['paul', 'quentin', 'rita']) {
      await expect(invite(who, pf)).rejects.toThrow(/Seul le propriétaire peut inviter/)
    }
  })

  it('refuse d’inviter dans un portefeuille personnel', async () => {
    await expect(invite('olga', await personal('olga'))).rejects.toThrow(/pas partageable/)
  })

  it('refuse un rôle ou une durée invalides (jamais « owner »)', async () => {
    for (const role of ['owner', 'admin', '']) {
      await expect(invite('olga', pf, role)).rejects.toThrow(/Rôle invalide/)
    }
    for (const days of [0, -1, 31]) {
      await expect(invite('olga', pf, 'editor', days)).rejects.toThrow(/Durée invalide/)
    }
  })

  it('génère un code de 64 caractères et ne stocke que son empreinte', async () => {
    const token = await invite('olga', pf, 'viewer')
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    const hashed = await db.query<{ ok: boolean }>(
      `select token_hash = sha256(convert_to($1, 'UTF8')) as ok from public.portfolio_invitations
       where token_hash = sha256(convert_to($1, 'UTF8'))`,
      [token],
    )
    expect(hashed.rows).toEqual([{ ok: true }])
    // le code n'apparaît dans aucune colonne
    const leak = await db.query<{ n: number }>(
      `select count(*)::int as n from public.portfolio_invitations t where t::text like '%' || $1 || '%'`,
      [token],
    )
    expect(leak.rows[0].n).toBe(0)
  })

  it('le propriétaire liste ses invitations sans jamais voir l’empreinte, les autres ne voient rien', async () => {
    const mine = await call(
      'olga',
      `select id, role, expires_at, used_at from public.portfolio_invitations where portfolio_id = $1`,
      [pf],
    )
    expect(mine.rows.length).toBeGreaterThan(0)
    await expect(
      call('olga', `select token_hash from public.portfolio_invitations`),
    ).rejects.toThrow(/permission denied/)
    for (const who of ['paul', 'quentin', 'rita']) {
      const r = await call(who, `select id from public.portfolio_invitations`)
      expect(r.rows).toHaveLength(0)
    }
  })

  it('limite à 20 invitations en attente', async () => {
    const big = await createShared('olga', 'Beaucoup')
    for (let i = 0; i < 20; i++) await invite('olga', big)
    await expect(invite('olga', big)).rejects.toThrow(/Trop d’invitations/)
  })

  it('révocation : réservée au propriétaire, et le code ne marche plus', async () => {
    const token = await invite('olga', pf, 'viewer')
    const inv = await db.query<{ id: string }>(
      `select id from public.portfolio_invitations where token_hash = sha256(convert_to($1, 'UTF8'))`,
      [token],
    )
    await expect(
      call('paul', `select public.revoke_invitation($1)`, [inv.rows[0].id]),
    ).rejects.toThrow(/Accès refusé/)
    await expect(
      call('rita', `select public.revoke_invitation($1)`, [inv.rows[0].id]),
    ).rejects.toThrow(/Accès refusé/)
    await call('olga', `select public.revoke_invitation($1)`, [inv.rows[0].id])
    await expect(join('rita', token)).rejects.toThrow(GENERIC)
    await expect(
      call('olga', `select public.revoke_invitation('00000000-0000-0000-0000-000000000000')`),
    ).rejects.toThrow(/Accès refusé/)
  })
})

describe('rejoindre avec un code', () => {
  let pf: string

  it('donne le rôle de l’invitation, l’accès en lecture et la liste des membres', async () => {
    pf = await createShared('olga', 'Rejoindre')
    const token = await invite('olga', pf, 'editor')
    const r = await join('paul', token)
    expect(r.rows[0].id).toBe(pf)
    expect(await roleOf(pf, 'paul')).toBe('editor')
    const cash = await call('paul', `select public.portfolio_cash($1)::text as c`, [pf])
    expect(Number(cash.rows[0].c)).toBe(10000)
    const members = await call('paul', `select pseudo, role from public.list_members($1)`, [pf])
    expect(members.rows).toEqual([
      { pseudo: 'Olga', role: 'owner' },
      { pseudo: 'Paul', role: 'editor' },
    ])
  })

  it('un code ne sert qu’une fois, et tous les échecs donnent le même message', async () => {
    const token = await invite('olga', pf, 'viewer')
    await join('quentin', token)
    await expect(join('rita', token)).rejects.toThrow(GENERIC) // déjà utilisé
    for (const bad of ['0'.repeat(64), 'abc', '', '   ', null]) {
      await expect(join('rita', bad)).rejects.toThrow(GENERIC)
    }
  })

  it('accepte le code en majuscules et avec des espaces autour', async () => {
    const token = await invite('olga', pf, 'viewer')
    await join('rita', `  ${token.toUpperCase()}  `)
    expect(await roleOf(pf, 'rita')).toBe('viewer')
    await db.query(
      `delete from public.portfolio_members where portfolio_id = $1 and user_id = $2`,
      [pf, u.rita],
    )
  })

  it('refuse un code expiré', async () => {
    const token = await invite('olga', pf, 'viewer')
    await db.query(
      `update public.portfolio_invitations set expires_at = now() - interval '1 minute'`,
    )
    await expect(join('rita', token)).rejects.toThrow(GENERIC)
  })

  it('refuse un code dont le portefeuille est archivé', async () => {
    const other = await createShared('olga', 'À archiver')
    const token = await invite('olga', other, 'viewer')
    await db.query(`update public.portfolios set archived_at = now() where id = $1`, [other])
    await expect(join('rita', token)).rejects.toThrow(GENERIC)
  })

  it('refuse à quelqu’un déjà membre, sans consommer le code', async () => {
    const token = await invite('olga', pf, 'viewer')
    await expect(join('paul', token)).rejects.toThrow(/déjà membre/)
    await join('rita', token) // le code est toujours utilisable par un autre
    expect(await roleOf(pf, 'rita')).toBe('viewer')
    await db.query(
      `delete from public.portfolio_members where portfolio_id = $1 and user_id = $2`,
      [pf, u.rita],
    )
  })

  it('refuse au-delà de 10 membres, sans consommer le code', async () => {
    const full = await createShared('olga', 'Complet')
    for (let i = 0; i < 9; i++) {
      await addUser(`m${i}`)
      await joinAs(`m${i}`, full)
    }
    const token = await invite('olga', full)
    await expect(join('rita', token)).rejects.toThrow(/complet/)
    await db.query(
      `delete from public.portfolio_members where portfolio_id = $1 and user_id = $2`,
      [full, u.m0],
    )
    await join('rita', token) // une place s'est libérée : le même code fonctionne
    expect(await roleOf(full, 'rita')).toBe('editor')
  })

  it('un visiteur anonyme ne peut pas rejoindre', async () => {
    await expect(asAnon(db, `select public.join_portfolio('abc')`)).rejects.toThrow(
      /permission denied/,
    )
  })
})

describe('droits des membres sur les opérations', () => {
  let pf: string

  it('l’éditeur peut acheter (auteur tracé), le lecteur non', async () => {
    pf = await createShared('olga', 'Droits')
    await joinAs('paul', pf, 'editor')
    await joinAs('quentin', pf, 'viewer')
    const r = await call(
      'paul',
      `select * from public.buy_coin($1, 'bitcoin', 100::numeric, null)`,
      [pf],
    )
    expect((r.rows[0] as Record<string, unknown>).user_id).toBe(u.paul)
    await expect(
      call('quentin', `select * from public.buy_coin($1, 'bitcoin', 10::numeric, null)`, [pf]),
    ).rejects.toThrow(/lecture seule/)
    // le lecteur voit les transactions des autres
    const tx = await call(
      'quentin',
      `select user_id from public.transactions where portfolio_id = $1`,
      [pf],
    )
    expect(tx.rows).toEqual([{ user_id: u.paul }])
  })

  it('le cash est commun : l’achat d’un membre réduit ce que voient les autres', async () => {
    const c = await call('olga', `select public.portfolio_cash($1)::text as c`, [pf])
    expect(Number(c.rows[0].c)).toBe(9900)
  })

  it('un non-membre n’a accès à rien', async () => {
    await expect(call('rita', `select public.portfolio_cash($1)`, [pf])).rejects.toThrow(
      /Accès refusé/,
    )
    await expect(call('rita', `select * from public.list_members($1)`, [pf])).rejects.toThrow(
      /Accès refusé/,
    )
    expect((await call('rita', `select * from public.transactions`)).rows).toHaveLength(0)
  })
})

describe('pseudos : visibles seulement entre co-membres', () => {
  it('on voit les pseudos des membres de ses portefeuilles, pas ceux des autres', async () => {
    const seenByPaul = await call('paul', `select pseudo from public.profiles order by pseudo`)
    const names = seenByPaul.rows.map((r) => (r as { pseudo: string }).pseudo)
    expect(names).toEqual(expect.arrayContaining(['Olga', 'Paul', 'Quentin']))
    expect(names).not.toContain('Zed')
    // quelqu'un qui n'a aucun portefeuille en commun ne voit que lui-même
    const seenByZed = await call('zed', `select pseudo from public.profiles`)
    expect(seenByZed.rows.map((r) => (r as { pseudo: string }).pseudo)).toEqual(['Zed'])
  })

  it('seuls l’identifiant et le pseudo sont lisibles (pas la date de création)', async () => {
    await expect(call('paul', `select created_at from public.profiles`)).rejects.toThrow(
      /permission denied/,
    )
  })

  it('shares_portfolio ne dit vrai que pour les co-membres', async () => {
    const yes = await call('paul', `select public.shares_portfolio($1) as s`, [u.olga])
    const no = await call('paul', `select public.shares_portfolio($1) as s`, [u.rita])
    expect(yes.rows[0]).toEqual({ s: true })
    expect(no.rows[0]).toEqual({ s: false })
  })
})

describe('gestion des membres', () => {
  let pf: string

  it('changer un rôle : propriétaire seulement, jamais vers « owner », jamais le sien', async () => {
    pf = await createShared('olga', 'Gestion')
    await joinAs('paul', pf, 'viewer')
    await joinAs('quentin', pf, 'editor')
    await call('olga', `select public.set_member_role($1, $2, 'editor')`, [pf, u.paul])
    expect(await roleOf(pf, 'paul')).toBe('editor')
    await expect(
      call('quentin', `select public.set_member_role($1, $2, 'viewer')`, [pf, u.paul]),
    ).rejects.toThrow(/Seul le propriétaire/)
    await expect(
      call('olga', `select public.set_member_role($1, $2, 'owner')`, [pf, u.paul]),
    ).rejects.toThrow(/Rôle invalide/)
    await expect(
      call('olga', `select public.set_member_role($1, $2, 'viewer')`, [pf, u.olga]),
    ).rejects.toThrow(/propriétaire ne peut pas être changé/)
    await expect(
      call('olga', `select public.set_member_role($1, $2, 'viewer')`, [pf, u.rita]),
    ).rejects.toThrow(/n’existe pas/)
  })

  it('retirer un membre : il perd l’accès, ses opérations passées restent, il ne voit plus les pseudos', async () => {
    // walt n'a aucun autre portefeuille en commun avec olga : il doit cesser de voir son pseudo
    await addUser('walt', 'Walt')
    await joinAs('walt', pf, 'editor')
    await call('walt', `select * from public.buy_coin($1, 'bitcoin', 50::numeric, null)`, [pf])
    await expect(call('paul', `select public.remove_member($1, $2)`, [pf, u.walt])).rejects.toThrow(
      /Seul le propriétaire/,
    )
    await call('olga', `select public.remove_member($1, $2)`, [pf, u.walt])
    expect(await roleOf(pf, 'walt')).toBeUndefined()
    await expect(call('walt', `select public.portfolio_cash($1)`, [pf])).rejects.toThrow(
      /Accès refusé/,
    )
    await expect(
      call('walt', `select * from public.buy_coin($1, 'bitcoin', 10::numeric, null)`, [pf]),
    ).rejects.toThrow(/Accès refusé/)
    const tx = await call(
      'olga',
      `select user_id from public.transactions where portfolio_id = $1`,
      [pf],
    )
    expect(tx.rows).toEqual([{ user_id: u.walt }]) // la transaction de l'ancien membre est conservée
    const pseudos = await call('walt', `select pseudo from public.profiles`)
    expect(pseudos.rows.map((r) => (r as { pseudo: string }).pseudo)).not.toContain('Olga')
    expect(
      (await call('walt', `select * from public.my_portfolios()`)).rows.map(
        (r) => (r as { id: string }).id,
      ),
    ).not.toContain(pf)
  })

  it('on ne retire ni le propriétaire ni un inconnu', async () => {
    await expect(call('olga', `select public.remove_member($1, $2)`, [pf, u.olga])).rejects.toThrow(
      /propriétaire ne peut pas être retiré/,
    )
    await expect(call('olga', `select public.remove_member($1, $2)`, [pf, u.rita])).rejects.toThrow(
      /n’existe pas/,
    )
  })

  it('quitter : un membre peut partir, pas le propriétaire, pas un étranger', async () => {
    await call('paul', `select public.leave_portfolio($1)`, [pf])
    expect(await roleOf(pf, 'paul')).toBeUndefined()
    await expect(call('olga', `select public.leave_portfolio($1)`, [pf])).rejects.toThrow(
      /peut l’archiver/,
    )
    await expect(call('rita', `select public.leave_portfolio($1)`, [pf])).rejects.toThrow(
      /Accès refusé/,
    )
  })
})

describe('archivage et remise à zéro d’un portefeuille partagé', () => {
  it('archiver : propriétaire seulement, partagé seulement, invitations révoquées, plus de transactions', async () => {
    const pf = await createShared('olga', 'À fermer')
    await joinAs('paul', pf, 'editor')
    const pending = await invite('olga', pf, 'viewer')
    await expect(call('paul', `select public.archive_portfolio($1)`, [pf])).rejects.toThrow(
      /Seul le propriétaire/,
    )
    await expect(
      call('olga', `select public.archive_portfolio($1)`, [await personal('olga')]),
    ).rejects.toThrow(/ne peut pas être archivé/)
    await call('olga', `select public.archive_portfolio($1)`, [pf])
    expect(await isRevoked(pending)).toBe(true) // révoquée explicitement, pas seulement refusée
    await expect(join('rita', pending)).rejects.toThrow(GENERIC)
    await expect(
      call('paul', `select * from public.buy_coin($1, 'bitcoin', 10::numeric, null)`, [pf]),
    ).rejects.toThrow(/archivé/)
    await expect(call('olga', `select public.archive_portfolio($1)`, [pf])).rejects.toThrow(
      /déjà archivé/,
    )
    const mine = await call('paul', `select id from public.my_portfolios()`)
    expect(mine.rows.map((r) => (r as { id: string }).id)).not.toContain(pf)
  })

  it('remise à zéro : mêmes membres et rôles, 10 000 €, invitations en cours révoquées', async () => {
    const pf = await createShared('olga', 'À remettre à zéro')
    await joinAs('paul', pf, 'editor')
    await joinAs('quentin', pf, 'viewer')
    await call('paul', `select * from public.buy_coin($1, 'bitcoin', 100::numeric, null)`, [pf])
    const pending = await invite('olga', pf, 'viewer')
    await expect(call('paul', `select public.reset_portfolio($1)`, [pf])).rejects.toThrow(
      /Seul le propriétaire/,
    )
    const r = await call('olga', `select public.reset_portfolio($1) as id`, [pf])
    const fresh = (r.rows[0] as { id: string }).id
    expect(fresh).not.toBe(pf)
    const members = await db.query<{ user_id: string; role: string }>(
      `select user_id, role from public.portfolio_members where portfolio_id = $1`,
      [fresh],
    )
    expect(members.rows).toEqual(
      expect.arrayContaining([
        { user_id: u.olga, role: 'owner' },
        { user_id: u.paul, role: 'editor' },
        { user_id: u.quentin, role: 'viewer' },
      ]),
    )
    expect(members.rows).toHaveLength(3)
    const cash = await call('paul', `select public.portfolio_cash($1)::text as c`, [fresh])
    expect(Number(cash.rows[0].c)).toBe(10000)
    expect(await isRevoked(pending)).toBe(true) // révoquée explicitement, pas seulement refusée
    await expect(join('rita', pending)).rejects.toThrow(GENERIC)
  })
})

describe('my_portfolios', () => {
  it('liste le portefeuille personnel d’abord, avec rôle et nombre de membres, sans les archivés', async () => {
    await addUser('vera', 'Vera')
    const shared = await createShared('vera', 'Collectif')
    await joinAs2('vera', 'paul', shared)
    const other = await createShared('vera', 'Fermé')
    await call('vera', `select public.archive_portfolio($1)`, [other])
    const r = await call(
      'vera',
      `select name, kind, role, member_count::int as n from public.my_portfolios()`,
    )
    expect(r.rows).toEqual([
      { name: 'Mon portefeuille', kind: 'personal', role: 'owner', n: 1 },
      { name: 'Collectif', kind: 'shared', role: 'owner', n: 2 },
    ])
    const p = await call(
      'paul',
      `select name, role from public.my_portfolios() where name = 'Collectif'`,
    )
    expect(p.rows).toEqual([{ name: 'Collectif', role: 'editor' }])
    const none = await call(
      'rita',
      `select name from public.my_portfolios() where name = 'Collectif'`,
    )
    expect(none.rows).toHaveLength(0)
  })
})

async function joinAs2(owner: string, who: string, pf: string, role = 'editor') {
  const r = await asUser<{ t: string }>(
    db,
    u[owner],
    `select public.create_invitation($1, $2, 7) as t`,
    [pf, role],
  )
  await join(who, r.rows[0].t)
}

describe('sécurité générale', () => {
  it('un visiteur anonyme ne peut appeler aucune fonction de partage', async () => {
    const pf = await personal('olga')
    const calls = [
      `select public.create_invitation('${pf}', 'editor', 7)`,
      `select public.revoke_invitation('${pf}')`,
      `select public.remove_member('${pf}', '${u.paul}')`,
      `select public.set_member_role('${pf}', '${u.paul}', 'viewer')`,
      `select public.leave_portfolio('${pf}')`,
      `select public.archive_portfolio('${pf}')`,
      `select * from public.list_members('${pf}')`,
      `select * from public.my_portfolios()`,
    ]
    for (const sql of calls) await expect(asAnon(db, sql)).rejects.toThrow(/permission denied/)
  })

  it('aucune écriture directe sur les invitations ni les membres', async () => {
    const pf = await createShared('olga', 'Écritures')
    await expect(
      call('olga', `update public.portfolio_members set role = 'owner' where user_id = $1`, [
        u.paul,
      ]),
    ).rejects.toThrow(/permission denied/)
    await expect(
      call(
        'paul',
        `insert into public.portfolio_members (portfolio_id, user_id, role) values ($1, $2, 'owner')`,
        [pf, u.paul],
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(
      call(
        'olga',
        `insert into public.portfolio_invitations (portfolio_id, token_hash, role, expires_at) values ($1, '\\x00', 'editor', now())`,
        [pf],
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(call('olga', `delete from public.portfolio_invitations`)).rejects.toThrow(
      /permission denied/,
    )
  })

  it('une inscription crée toujours un portefeuille personnel et un pseudo neutre', async () => {
    const id = await addUser('nouveau', 'temp')
    expect(await personal('nouveau')).toBeTruthy()
    const fresh = await db.query<{ id: string; pseudo: string }>(
      `insert into auth.users (email) values ('autre@example.org') returning id`,
    )
    const p = await db.query<{ pseudo: string }>(
      `select pseudo from public.profiles where id = $1`,
      [fresh.rows[0].id],
    )
    expect(p.rows[0].pseudo).toMatch(/^Membre-\d{4}$/)
    void id
  })
})
