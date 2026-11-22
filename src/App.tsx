import { HashRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { AppShell } from './components/AppShell'
import { rememberJoinCode } from './lib/pendingJoin'
import { HomePage } from './pages/HomePage'
import { JoinPage } from './pages/JoinPage'
import { LoginPage } from './pages/LoginPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { SignalsPage } from './pages/SignalsPage'

/** Lien d'invitation ouvert sans être connecté : on garde le code, puis on passe par la connexion. */
function RememberJoin() {
  const [params] = useSearchParams()
  const code = params.get('code')
  if (code) rememberJoinCode(code)
  return <Navigate to="/connexion" replace />
}

export function AppRoutes() {
  const { session, loading } = useAuth()
  if (loading) return <p className="p-6 text-muted">Chargement…</p>
  return (
    <Routes>
      {session ? (
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="signaux" element={<SignalsPage />} />
          <Route path="portefeuille" element={<PortfolioPage />} />
          <Route path="rejoindre" element={<JoinPage />} />
        </Route>
      ) : (
        <Route path="/rejoindre" element={<RememberJoin />} />
      )}
      <Route path="/connexion" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="*" element={<Navigate to={session ? '/' : '/connexion'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}
