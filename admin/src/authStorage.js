const AUTH_STORAGE_KEY = 'campusconnect_admin_auth'

function isValidAuthShape(value) {
  return Boolean(
    value &&
      typeof value.token === 'string' &&
      value.token.trim() !== '' &&
      value.user &&
      typeof value.user === 'object' &&
      value.user.role === 'admin'
  )
}

export function loadStoredAuth() {
  const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue)
    if (!isValidAuthShape(parsed)) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }

    return parsed
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

export function saveStoredAuth(auth) {
  if (!isValidAuthShape(auth)) {
    return
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
}

export function clearStoredAuth() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}
