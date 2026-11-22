import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { AppShell } from './components/AppShell'
import { HomePage } from './pages/HomePage'
import { PortfolioPage } from './pages/PortfolioPage'
import { LoginPage } from './pages/LoginPage'
import { SignalsPage } from './pages/SignalsPage'

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
        </Route>
      ) : null}
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
