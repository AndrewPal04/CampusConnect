import { useEffect, useState } from 'react'
import { getAdminUsers, updateAdminUserRole } from '../api'

const ROLE_OPTIONS = ['student', 'org_leader', 'admin']

function formatDate(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A'
  }

  return parsed.toLocaleDateString()
}

function UsersPage({ token }) {
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [busyUserId, setBusyUserId] = useState('')

  useEffect(() => {
    let active = true

    async function loadInitialUsers() {
      try {
        const rows = await getAdminUsers(token)
        if (active) {
          setUsers(rows)
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error.message || 'Failed to load users')
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    loadInitialUsers()

    return () => {
      active = false
    }
  }, [token])

  async function handleRefresh() {
    setErrorMessage('')
    setIsLoading(true)

    try {
      const rows = await getAdminUsers(token)
      setUsers(rows)
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRoleChange(userId, role) {
    setBusyUserId(userId)
    setErrorMessage('')

    try {
      const updatedUser = await updateAdminUserRole(token, userId, role)
      setUsers((current) =>
        current.map((user) => (user.id === userId ? updatedUser : user))
      )
    } catch (error) {
      setErrorMessage(error.message || 'Failed to update user role')
    } finally {
      setBusyUserId('')
    }
  }

  return (
    <section className="card">
      <header className="table-header">
        <div>
          <h2>Users</h2>
          <p className="muted-text">Review accounts and assign roles.</p>
        </div>
        <button type="button" className="secondary-btn" onClick={handleRefresh}>
          Refresh
        </button>
      </header>

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      {isLoading ? <p className="muted-text">Loading users...</p> : null}

      {!isLoading && users.length === 0 ? (
        <p className="muted-text">No users found.</p>
      ) : null}

      {!isLoading && users.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Change Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name || 'N/A'}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className="badge neutral">{user.role}</span>
                  </td>
                  <td>{formatDate(user.created_at)}</td>
                  <td>
                    <select
                      value={user.role}
                      onChange={(event) => handleRoleChange(user.id, event.target.value)}
                      disabled={busyUserId === user.id}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

export default UsersPage
