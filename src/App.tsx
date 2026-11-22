import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'

export function AppRoutes() {
  const { session, loading } = useAuth()
  if (loading) return <p className="p-6 text-muted">Chargement…</p>
  return (
    <Routes>
      <Route path="/" element={session ? <HomePage /> : <Navigate to="/connexion" replace />} />
      <Route path="/connexion" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
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
