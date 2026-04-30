import { useEffect, useMemo, useState } from 'react'
import {
  getAdminAnalyticsSummary,
  getEventAnalytics,
  searchEventsByTitle,
} from '../api'

function formatCount(value) {
  return Number(value || 0).toLocaleString()
}

function toPercentNumber(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return 0
  }

  return Math.max(numericValue, 0)
}

function toBarWidth(value) {
  return `${Math.min(Math.max(value, 0), 100)}%`
}

function AnalyticsPage({ token }) {
  const [summary, setSummary] = useState(null)
  const [isSummaryLoading, setIsSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventAnalytics, setEventAnalytics] = useState(null)
  const [isEventAnalyticsLoading, setIsEventAnalyticsLoading] = useState(false)
  const [eventAnalyticsError, setEventAnalyticsError] = useState('')

  useEffect(() => {
    let active = true

    async function loadSummary() {
      try {
        const payload = await getAdminAnalyticsSummary(token)
        if (active) {
          setSummary(payload)
        }
      } catch (error) {
        if (active) {
          setSummaryError(error.message || 'Failed to load analytics summary')
        }
      } finally {
        if (active) {
          setIsSummaryLoading(false)
        }
      }
    }

    loadSummary()

    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    const normalizedInput = searchInput.trim()

    if (!normalizedInput) {
      setSearchResults([])
      setSearchError('')
      setIsSearching(false)
      return undefined
    }

    let active = true
    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true)
      setSearchError('')

      try {
        const matches = await searchEventsByTitle(token, normalizedInput)
        if (active) {
          setSearchResults(matches)
        }
      } catch (error) {
        if (active) {
          setSearchResults([])
          setSearchError(error.message || 'Failed to search events')
        }
      } finally {
        if (active) {
          setIsSearching(false)
        }
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [searchInput, token])

  async function loadEventAnalytics(eventId) {
    setIsEventAnalyticsLoading(true)
    setEventAnalyticsError('')

    try {
      const payload = await getEventAnalytics(token, eventId)
      setEventAnalytics(payload)
    } catch (error) {
      setEventAnalytics(null)
      setEventAnalyticsError(error.message || 'Failed to load event analytics')
    } finally {
      setIsEventAnalyticsLoading(false)
    }
  }

  function handleSelectEvent(eventRow) {
    setSelectedEvent(eventRow)
    setSearchInput(eventRow.title || '')
    setShowDropdown(false)
    setSearchResults([])
    loadEventAnalytics(eventRow.id)
  }

  const topCategories = Array.isArray(summary?.topCategories) ? summary.topCategories : []
  const maxCategoryCount = useMemo(() => {
    const highestCount = topCategories.reduce(
      (max, item) => Math.max(max, Number(item?.count) || 0),
      0
    )
    return highestCount > 0 ? highestCount : 1
  }, [topCategories])

  const rsvpRate = toPercentNumber(eventAnalytics?.rsvpRate)
  const checkInRate = toPercentNumber(eventAnalytics?.checkInRate)
  const timelineRows = Array.isArray(eventAnalytics?.rsvpTimeline) ? eventAnalytics.rsvpTimeline : []

  return (
    <section className="analytics-grid">
      <div className="card">
        <header className="table-header">
          <div>
            <h2>Platform Analytics</h2>
            <p className="muted-text">Aggregate stats without PII.</p>
          </div>
        </header>

        {summaryError ? <p className="error-text">{summaryError}</p> : null}
        {isSummaryLoading ? (
          <p className="muted-text">Loading summary metrics...</p>
        ) : (
          <>
            <div className="stats-grid">
              <article className="stat-card">
                <p className="muted-text">Total Events</p>
                <p className="stat-value">{formatCount(summary?.totalEvents)}</p>
              </article>
              <article className="stat-card">
                <p className="muted-text">Total Users</p>
                <p className="stat-value">{formatCount(summary?.totalUsers)}</p>
              </article>
              <article className="stat-card">
                <p className="muted-text">Total RSVPs</p>
                <p className="stat-value">{formatCount(summary?.totalRsvps)}</p>
              </article>
              <article className="stat-card">
                <p className="muted-text">Total Check-ins</p>
                <p className="stat-value">{formatCount(summary?.totalCheckIns)}</p>
              </article>
            </div>

            <div className="analytics-inline-stats">
              <span>Upcoming Events: {formatCount(summary?.upcomingEventsCount)}</span>
              <span>Scraped Events: {formatCount(summary?.scrapedEventsCount)}</span>
            </div>

            <div className="category-chart">
              <h3>Top Categories (by RSVP count)</h3>
              {topCategories.length === 0 ? (
                <p className="muted-text">No category data available yet.</p>
              ) : (
                topCategories.map((item) => {
                  const count = Number(item?.count) || 0
                  const width = (count / maxCategoryCount) * 100

                  return (
                    <div key={item.category} className="category-row">
                      <div className="category-meta">
                        <span>{item.category}</span>
                        <span>{formatCount(count)}</span>
                      </div>
                      <div className="category-track">
                        <div
                          style={{
                            width: `${Math.max(width, 0)}%`,
                            background: '#f5a623',
                            height: '100%',
                            borderRadius: '999px',
                          }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <header className="table-header">
          <div>
            <h2>Event Analytics</h2>
            <p className="muted-text">Search by event title to inspect attendance rates.</p>
          </div>
        </header>

        <div className="analytics-search-wrap">
          <label htmlFor="analytics-search-input">Event title</label>
          <input
            id="analytics-search-input"
            type="text"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => window.setTimeout(() => setShowDropdown(false), 120)}
            placeholder="Type an event title..."
          />

          {showDropdown && searchInput.trim() ? (
            <div className="analytics-dropdown">
              {isSearching ? <p className="muted-text">Searching...</p> : null}
              {!isSearching && searchError ? <p className="error-text">{searchError}</p> : null}
              {!isSearching && !searchError && searchResults.length === 0 ? (
                <p className="muted-text">No matching events.</p>
              ) : null}
              {!isSearching && !searchError && searchResults.length > 0
                ? searchResults.map((eventRow) => (
                    <button
                      key={eventRow.id}
                      type="button"
                      className="analytics-dropdown-item"
                      onMouseDown={(mouseEvent) => mouseEvent.preventDefault()}
                      onClick={() => handleSelectEvent(eventRow)}
                    >
                      <span>{eventRow.title}</span>
                      <span className="muted-text">{eventRow.date}</span>
                    </button>
                  ))
                : null}
            </div>
          ) : null}
        </div>

        {selectedEvent ? (
          <p className="muted-text">
            Selected event: <strong>{selectedEvent.title}</strong>
          </p>
        ) : null}

        {eventAnalyticsError ? <p className="error-text">{eventAnalyticsError}</p> : null}
        {isEventAnalyticsLoading ? <p className="muted-text">Loading event analytics...</p> : null}

        {!isEventAnalyticsLoading && eventAnalytics ? (
          <div className="event-analytics-panel">
            <div className="rate-row">
              <div className="rate-meta">
                <span>RSVP Rate</span>
                <span>{rsvpRate.toFixed(1)}%</span>
              </div>
              <div className="rate-track">
                <div className="rate-fill blue" style={{ width: toBarWidth(rsvpRate) }} />
              </div>
            </div>

            <div className="rate-row">
              <div className="rate-meta">
                <span>Check-in Rate</span>
                <span>{checkInRate.toFixed(1)}%</span>
              </div>
              <div className="rate-track">
                <div className="rate-fill green" style={{ width: toBarWidth(checkInRate) }} />
              </div>
            </div>

            <div className="analytics-inline-stats">
              <span>Capacity: {formatCount(eventAnalytics.capacity)}</span>
              <span>RSVP Count: {formatCount(eventAnalytics.rsvpCount)}</span>
              <span>Checked-in Count: {formatCount(eventAnalytics.checkedInCount)}</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>RSVP Count</th>
                  </tr>
                </thead>
                <tbody>
                  {timelineRows.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="muted-text">
                        No RSVP timeline data available.
                      </td>
                    </tr>
                  ) : (
                    timelineRows.map((row) => (
                      <tr key={`${row.date}-${row.count}`}>
                        <td>{row.date}</td>
                        <td>{formatCount(row.count)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default AnalyticsPage
