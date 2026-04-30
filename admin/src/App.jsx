import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import {
  loginAsAdmin,
} from './api'
import {
  clearStoredAuth,
  loadStoredAuth,
  saveStoredAuth,
} from './authStorage'
import AdminLayout from './components/AdminLayout'
import RequireAdmin from './components/RequireAdmin'
import AnalyticsPage from './pages/AnalyticsPage'
import EventsPage from './pages/EventsPage'
import LoginPage from './pages/LoginPage'
import OrgsPage from './pages/OrgsPage'
import UsersPage from './pages/UsersPage'

function App() {
  const [auth, setAuth] = useState(() => loadStoredAuth())
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  async function handleLogin({ email, password }) {
    setIsLoggingIn(true)

    try {
      const payload = await loginAsAdmin(email, password)
      const nextAuth = {
        token: payload.token,
        user: payload.user,
      }

      saveStoredAuth(nextAuth)
      setAuth(nextAuth)
    } finally {
      setIsLoggingIn(false)
    }
  }

  function handleLogout() {
    clearStoredAuth()
    setAuth(null)
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <LoginPage
            auth={auth}
            isLoggingIn={isLoggingIn}
            onLogin={handleLogin}
          />
        }
      />

      <Route element={<RequireAdmin auth={auth} />}>
        <Route
          element={<AdminLayout user={auth?.user} onLogout={handleLogout} />}
        >
          <Route path="/" element={<Navigate to="/events" replace />} />
          <Route path="/events" element={<EventsPage token={auth?.token} />} />
          <Route path="/analytics" element={<AnalyticsPage token={auth?.token} />} />
          <Route path="/orgs" element={<OrgsPage token={auth?.token} />} />
          <Route path="/users" element={<UsersPage token={auth?.token} />} />
        </Route>
      </Route>

      <Route
        path="*"
        element={<Navigate to={auth ? '/events' : '/login'} replace />}
      />
    </Routes>
  )
}

export default App
