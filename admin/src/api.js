const API_BASE_URL = import.meta.env.VITE_API_URL

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.message
      ? payload.message
      : `Request failed (${response.status})`
    throw new Error(message)
  }

  return payload
}

export async function loginAsAdmin(email, password) {
  const payload = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  })

  if (payload?.user?.role !== 'admin') {
    throw new Error('This account does not have admin access')
  }

  return payload
}

export async function getAdminEvents(token) {
  const payload = await request('/api/admin/events', { token })
  return payload.events || []
}

export async function deleteAdminEvent(token, eventId) {
  return request(`/api/admin/events/${eventId}`, {
    method: 'DELETE',
    token,
  })
}

export async function getAdminOrgs(token) {
  const payload = await request('/api/admin/orgs', { token })
  return payload.orgs || []
}

export async function updateAdminOrg(token, requestId, status) {
  const payload = await request(`/api/admin/orgs/${requestId}`, {
    method: 'PATCH',
    token,
    body: { status },
  })

  return payload.request
}

export async function getAdminUsers(token) {
  const payload = await request('/api/admin/users', { token })
  return payload.users || []
}

export async function updateAdminUserRole(token, userId, role) {
  const payload = await request(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    token,
    body: { role },
  })

  return payload.user
}

export async function getAdminAnalyticsSummary(token) {
  return request('/api/admin/analytics/summary', { token })
}

export async function searchEventsByTitle(token, title) {
  const params = new URLSearchParams({
    search: title,
    limit: '50',
    sort: 'title',
  })

  const payload = await request(`/api/events?${params.toString()}`, { token })
  const events = Array.isArray(payload?.events) ? payload.events : []
  const normalizedSearch = title.trim().toLowerCase()

  return events.filter((eventRow) =>
    String(eventRow?.title || '').toLowerCase().includes(normalizedSearch)
  )
}

export async function getEventAnalytics(token, eventId) {
  return request(`/api/events/${eventId}/analytics`, { token })
}
