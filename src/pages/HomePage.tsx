import { supabase } from '../lib/supabase'

export function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">MarniarauCrypto</h1>
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="rounded border border-line px-3 py-1 text-sm"
        >
          Se déconnecter
        </button>
      </header>
      <p className="text-muted">Connecté. Les prix arrivent au prochain jalon.</p>
      <footer className="mt-auto text-xs text-muted">
        <p>
          MarniarauCrypto est un outil éducatif. Les signaux et simulations ne constituent pas des
          conseils financiers.
        </p>
        <p>
          v{__APP_VERSION__} ({__APP_COMMIT__})
        </p>
      </footer>
    </main>
  )
}
