import { useEffect, useState } from 'react'
import { getAdminOrgs, updateAdminOrg } from '../api'

function formatDate(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A'
  }

  return parsed.toLocaleDateString()
}

function getStatusMeta(status) {
  const normalized = (status || '').toLowerCase()

  if (normalized === 'approved') {
    return { label: 'Approved', className: 'success' }
  }

  if (normalized === 'denied') {
    return { label: 'Denied', className: 'danger' }
  }

  return { label: 'Pending', className: 'pending' }
}

function OrgsPage({ token }) {
  const [orgs, setOrgs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [busyRequestId, setBusyRequestId] = useState('')

  useEffect(() => {
    let active = true

    async function loadInitialOrgs() {
      try {
        const rows = await getAdminOrgs(token)
        if (active) {
          setOrgs(rows)
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error.message || 'Failed to load verification requests')
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    loadInitialOrgs()

    return () => {
      active = false
    }
  }, [token])

  async function handleRefresh() {
    setErrorMessage('')
    setIsLoading(true)

    try {
      const rows = await getAdminOrgs(token)
      setOrgs(rows)
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load verification requests')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDecision(requestId, status) {
    setBusyRequestId(requestId)
    setErrorMessage('')

    try {
      const updatedRequest = await updateAdminOrg(token, requestId, status)
      setOrgs((current) =>
        current.map((org) => (org.id === requestId ? updatedRequest : org))
      )
    } catch (error) {
      setErrorMessage(error.message || 'Failed to update request status')
    } finally {
      setBusyRequestId('')
    }
  }

  return (
    <section className="card">
      <header className="table-header">
        <div>
          <h2>Organization Verification</h2>
          <p className="muted-text">Approve or deny organization verification requests.</p>
        </div>
        <button type="button" className="secondary-btn" onClick={handleRefresh}>
          Refresh
        </button>
      </header>

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      {isLoading ? <p className="muted-text">Loading verification requests...</p> : null}

      {!isLoading && orgs.length === 0 ? (
        <p className="muted-text">No verification requests found.</p>
      ) : null}

      {!isLoading && orgs.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Submitter</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Proof</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => {
                const statusMeta = getStatusMeta(org.status)
                const pending = (org.status || '').toLowerCase() === 'pending'
                const busy = busyRequestId === org.id

                return (
                  <tr key={org.id}>
                    <td>{org.org_name}</td>
                    <td>{org.submitter_email || 'No submitter email'}</td>
                    <td>
                      <span className={`badge ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td>{formatDate(org.created_at)}</td>
                    <td>
                      {org.proof_url ? (
                        <a href={org.proof_url} target="_blank" rel="noreferrer">
                          View proof
                        </a>
                      ) : (
                        <span className="muted-text">None</span>
                      )}
                    </td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => handleDecision(org.id, 'approved')}
                        disabled={!pending || busy}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="danger-btn"
                        onClick={() => handleDecision(org.id, 'denied')}
                        disabled={!pending || busy}
                      >
                        Deny
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

export default OrgsPage
