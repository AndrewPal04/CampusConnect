import { useEffect, useState } from 'react'
import { deleteAdminEvent, getAdminEvents } from '../api'

function formatDate(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A'
  }

  return parsed.toLocaleString()
}

function EventsPage({ token }) {
  const [events, setEvents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [busyEventId, setBusyEventId] = useState('')

  useEffect(() => {
    let active = true

    async function loadInitialEvents() {
      try {
        const rows = await getAdminEvents(token)
        if (active) {
          setEvents(rows)
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error.message || 'Failed to load events')
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    loadInitialEvents()

    return () => {
      active = false
    }
  }, [token])

  async function handleRefresh() {
    setIsRefreshing(true)
    setErrorMessage('')

    try {
      const rows = await getAdminEvents(token)
      setEvents(rows)
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load events')
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleDelete(eventRow) {
    const confirmed = window.confirm(`Delete event "${eventRow.title}"?`)
    if (!confirmed) {
      return
    }

    setBusyEventId(eventRow.id)
    setErrorMessage('')

    try {
      await deleteAdminEvent(token, eventRow.id)
      setEvents((current) => current.filter((item) => item.id !== eventRow.id))
    } catch (error) {
      setErrorMessage(error.message || 'Failed to delete event')
    } finally {
      setBusyEventId('')
    }
  }

  return (
    <section className="card">
      <header className="table-header">
        <div>
          <h2>All Events</h2>
          <p className="muted-text">Manage imported and manually created events.</p>
        </div>
        <button
          type="button"
          className="secondary-btn"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      {isLoading ? <p className="muted-text">Loading events...</p> : null}

      {!isLoading && events.length === 0 ? (
        <p className="muted-text">No events found.</p>
      ) : null}

      {!isLoading && events.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Date</th>
                <th>Source</th>
                <th>Category</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {events.map((eventRow) => (
                <tr key={eventRow.id}>
                  <td>{eventRow.title}</td>
                  <td>{formatDate(eventRow.date)}</td>
                  <td>{eventRow.source || 'N/A'}</td>
                  <td>{eventRow.category || 'N/A'}</td>
                  <td>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() => handleDelete(eventRow)}
                      disabled={busyEventId === eventRow.id}
                    >
                      {busyEventId === eventRow.id ? 'Deleting...' : 'Delete'}
                    </button>
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

export default EventsPage
