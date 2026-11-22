import { collect, type Env } from './collector'

type ScheduledEvent = { scheduledTime: number; cron: string }

export default {
  // Déclenché par le cron (toutes les 5 minutes). Écrire dans Supabase à chaque passage sert aussi
  // de keep-alive à la base de l'offre gratuite.
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    try {
      const report = await collect(env, {
        fetch: (input, init) => fetch(input, init),
        now: () => new Date(),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      })
      console.log(JSON.stringify({ ok: true, ...report }))
    } catch (error) {
      console.error(JSON.stringify({ ok: false, error: String(error) }))
      throw error
    }
  },

  // Rien n'est exposé en HTTP.
  async fetch(): Promise<Response> {
    return new Response('not found', { status: 404 })
  },
}
