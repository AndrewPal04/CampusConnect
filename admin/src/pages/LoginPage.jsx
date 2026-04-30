import { useState } from 'react'
import { Navigate } from 'react-router-dom'

function LoginPage({ auth, isLoggingIn, onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  if (auth?.token && auth?.user?.role === 'admin') {
    return <Navigate to="/events" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    try {
      await onLogin({ email: email.trim(), password })
    } catch (error) {
      setErrorMessage(error.message || 'Unable to sign in')
    }
  }

  return (
    <main className="login-page">
      <section className="card">
        <h1>Admin Login</h1>
        <p className="muted-text">Use an account with role = admin</p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

          <button type="submit" disabled={isLoggingIn}>
            {isLoggingIn ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default LoginPage
