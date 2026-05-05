import * as SecureStore from './secureStorage';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
export const AUTH_TOKEN_KEY = 'campusconnect_token';

let unauthorizedHandler = null;
let isHandlingUnauthorized = false;

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
}

function readErrorMessage(payload, fallback) {
  if (!payload) {
    return fallback;
  }

  if (typeof payload === 'string') {
    return payload;
  }

  return (
    payload.message ||
    payload.error ||
    payload.errors?.[0]?.message ||
    payload.errors?.[0]?.msg ||
    fallback
  );
}

async function handleUnauthorized(error) {
  if (error?.status !== 401 || isHandlingUnauthorized) {
    return;
  }

  isHandlingUnauthorized = true;
  try {
    await storeToken(null);
    if (unauthorizedHandler) {
      await unauthorizedHandler(error);
    }
  } finally {
    isHandlingUnauthorized = false;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const requestError = new Error(
      readErrorMessage(payload, `Request failed with status ${response.status}`)
    );
    requestError.status = response.status;
    requestError.payload = payload;

    if (response.status === 401 && options.requiresAuth) {
      await handleUnauthorized(requestError);
    }

    throw requestError;
  }

  return payload;
}

async function authedRequest(path, options = {}) {
  const authToken = options.token || (await getStoredToken());

  if (!authToken) {
    const noTokenError = new Error('No auth token found');
    noTokenError.status = 401;
    await handleUnauthorized(noTokenError);
    throw noTokenError;
  }

  return request(path, {
    ...options,
    requiresAuth: true,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${authToken}`,
    },
  });
}

function toQueryString(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    query.append(key, String(value));
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export function extractAuthToken(payload) {
  return (
    payload?.token ||
    payload?.accessToken ||
    payload?.jwt ||
    payload?.data?.token ||
    payload?.data?.accessToken ||
    payload?.data?.jwt ||
    null
  );
}

export function extractUser(payload) {
  const candidate =
    payload?.user ||
    payload?.data?.user ||
    payload?.profile ||
    payload?.data?.profile ||
    payload?.data;

  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  return candidate;
}

export async function storeToken(token) {
  if (token) {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
    return;
  }

  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

export async function getStoredToken() {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function register(data) {
  const payload = await request('/auth/register', {
    method: 'POST',
    body: data,
  });

  const token = extractAuthToken(payload);
  if (token) {
    await storeToken(token);
  }

  return payload;
}

export async function login(data) {
  const payload = await request('/auth/login', {
    method: 'POST',
    body: data,
  });

  const token = extractAuthToken(payload);
  if (token) {
    await storeToken(token);
  }

  return payload;
}

export async function forgotPassword(data) {
  return request('/auth/forgot-password', {
    method: 'POST',
    body: data,
  });
}

export async function getMe(token) {
  return authedRequest('/auth/me', {
    token,
  });
}

export const me = getMe;

export async function getEvents(params = {}) {
  return request(`/events${toQueryString(params)}`);
}

export async function getEventById(eventId) {
  return request(`/events/${eventId}`);
}

export async function getEventAnalytics(eventId, token) {
  return authedRequest(`/events/${eventId}/analytics`, {
    token,
  });
}

export async function getUpcomingEvents() {
  return request('/events/upcoming');
}

export async function getRecommendedEvents(token) {
  return authedRequest('/events/recommended', { token });
}

export async function createEvent(data, token) {
  return authedRequest('/events', {
    method: 'POST',
    token,
    body: data,
  });
}

export async function updateEvent(eventId, data, token) {
  return authedRequest(`/events/${eventId}`, {
    method: 'PATCH',
    token,
    body: data,
  });
}

export async function rsvpEvent(eventId, token) {
  return authedRequest(`/rsvp/${eventId}`, {
    method: 'POST',
    token,
  });
}

export async function purchaseTicket(eventId, paymentMethodId, token) {
  const body = paymentMethodId ? { paymentMethodId } : undefined;

  return authedRequest(`/rsvp/${eventId}/purchase`, {
    method: 'POST',
    token,
    body,
  });
}

export async function cancelRsvp(eventId, token) {
  return authedRequest(`/rsvp/${eventId}`, {
    method: 'DELETE',
    token,
  });
}

export async function fetchMyRsvps(token) {
  return authedRequest('/rsvp/mine', { token });
}

export async function trackEventView(eventId, token) {
  return authedRequest(`/events/${eventId}/view`, {
    method: 'POST',
    token,
  });
}

export async function updateMyProfile(data, token) {
  return authedRequest('/users/me', {
    method: 'PATCH',
    token,
    body: data,
  });
}

export async function submitOrgVerification(data, token) {
  return authedRequest('/orgs/verify-request', {
    method: 'POST',
    token,
    body: data,
  });
}

export async function checkInAttendee(qrToken, token) {
  return authedRequest('/rsvp/checkin', {
    method: 'POST',
    token,
    body: { qrToken },
  });
}

export const checkIn = checkInAttendee;

export async function getNotifications(token) {
  return authedRequest('/users/notifications', { token });
}

export async function getNotificationPreferences(token) {
  return authedRequest('/users/notification-preferences', { token });
}

export async function updateNotificationPreferences(data, token) {
  return authedRequest('/users/notification-preferences', {
    method: 'PATCH',
    token,
    body: data,
  });
}

export async function registerPushToken(token, authToken) {
  return authedRequest('/users/push-token', {
    method: 'POST',
    token: authToken,
    body: { token },
  });
}

export async function markAllNotificationsRead(token) {
  return authedRequest('/users/notifications/read-all', {
    method: 'PATCH',
    token,
  });
}

export async function markNotificationRead(notificationId, token) {
  return authedRequest(`/users/notifications/${notificationId}/read`, {
    method: 'PATCH',
    token,
  });
}

export async function saveUserInterests(categories, token) {
  return authedRequest('/users/interests', {
    method: 'POST',
    token,
    body: { categories },
  });
}

const api = {
  register,
  login,
  forgotPassword,
  getMe,
  me,
  getEvents,
  getEventById,
  getEventAnalytics,
  getUpcomingEvents,
  getRecommendedEvents,
  createEvent,
  updateEvent,
  rsvpEvent,
  purchaseTicket,
  cancelRsvp,
  fetchMyRsvps,
  trackEventView,
  updateMyProfile,
  submitOrgVerification,
  checkInAttendee,
  checkIn,
  getNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  registerPushToken,
  markAllNotificationsRead,
  markNotificationRead,
  saveUserInterests,
  storeToken,
  getStoredToken,
};

export default api;
