import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const { error } =
      mode === 'connexion'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            // Le lien de l'email revient là d'où l'on s'est inscrit (localhost en dev, le site publié sinon)
            options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
          })
    setBusy(false)
    if (error) setMessage(error.message)
    else if (mode === 'inscription')
      setMessage('Compte créé. Vérifie ta boîte mail pour confirmer.')
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">MarniarauCrypto</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-line bg-surface p-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Mot de passe
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-line bg-surface p-2"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-accent p-2 font-medium text-bg disabled:opacity-60"
        >
          {mode === 'connexion' ? 'Se connecter' : 'Créer le compte'}
        </button>
        {message && (
          <p role="status" className="text-sm text-muted">
            {message}
          </p>
        )}
      </form>
      <button
        type="button"
        onClick={() => setMode(mode === 'connexion' ? 'inscription' : 'connexion')}
        className="text-sm text-accent underline"
      >
        {mode === 'connexion' ? 'Pas de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
      </button>
    </main>
  )
}
