// ── Event Categories ──────────────────────────────────────────────────────────
export const CATEGORIES = [
  { id: 'all',          label: 'All',          emoji: '✨' },
  { id: 'professional', label: 'Professional',  emoji: '🏢' },
  { id: 'social',       label: 'Social',        emoji: '🎉' },
  { id: 'academic',     label: 'Academic',      emoji: '🎓' },
  { id: 'cultural',     label: 'Cultural',      emoji: '🌍' },
  { id: 'arts',         label: 'Arts',          emoji: '🎭' },
  { id: 'sports',       label: 'Sports',        emoji: '⚽' },
];

// ── User Types ────────────────────────────────────────────────────────────────
export const USER_TYPES = {
  STUDENT:   'student',
  ORGANISER: 'organiser',
};

// ── Route Paths ───────────────────────────────────────────────────────────────
export const ROUTES = {
  SPLASH:        '/',
  LOGIN:         '/login',
  REGISTER:      '/register',
  INTERESTS:     '/interests',
  HOME:          '/home',
  EVENT_DETAIL:  (id = ':id') => `/events/${id}`,
  MAP:           '/map',
  NOTIFICATIONS: '/notifications',
  PROFILE:       '/profile',
  ORGANISER:     '/organiser',
  CREATE_EVENT:  '/organiser/create',
  EDIT_EVENT:    (id = ':id') => `/organiser/edit/${id}`,
  CHECKIN:       (id = ':id') => `/organiser/checkin/${id}`,
};

// ── API ───────────────────────────────────────────────────────────────────────
export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

