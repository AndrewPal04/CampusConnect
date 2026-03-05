# CampusConnect — Architecture & File Structure

## Repository Layout

```
campusconnect/
├── client/                        # React.js frontend (Vite)
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── .env.example
│   └── src/
│       ├── main.jsx               # React entry — QueryClient + Router + Toaster
│       ├── App.jsx                # Route definitions + auth guards
│       ├── index.css              # Global styles + CSS variables + animations
│       │
│       ├── pages/
│       │   ├── auth/
│       │   │   ├── SplashPage.jsx      ← START SCREEN (fully implemented)
│       │   │   ├── LoginPage.jsx
│       │   │   ├── RegisterPage.jsx
│       │   │   └── InterestsPage.jsx
│       │   ├── app/
│       │   │   ├── HomePage.jsx        — Event feed with category filters
│       │   │   ├── EventDetailPage.jsx — Full event info + RSVP
│       │   │   ├── MapPage.jsx         — Mapbox campus map
│       │   │   ├── NotificationsPage.jsx
│       │   │   └── ProfilePage.jsx
│       │   ├── organiser/
│       │   │   ├── DashboardPage.jsx   — Analytics + event list
│       │   │   ├── CreateEventPage.jsx — Event creation form
│       │   │   ├── EditEventPage.jsx
│       │   │   └── CheckInPage.jsx     — QR code check-in validator
│       │   └── NotFoundPage.jsx
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.jsx        — Authenticated layout wrapper
│       │   │   ├── AuthLayout.jsx      — Public/auth layout wrapper
│       │   │   ├── BottomNav.jsx       — Sticky bottom navigation
│       │   │   └── TopBar.jsx          — Screen-level top bar
│       │   ├── ui/                     — Reusable primitives
│       │   │   ├── Button.jsx
│       │   │   ├── Input.jsx
│       │   │   ├── Badge.jsx
│       │   │   ├── Modal.jsx
│       │   │   ├── Toast.jsx
│       │   │   └── Skeleton.jsx        — Loading shimmer
│       │   ├── events/
│       │   │   ├── EventCard.jsx       — List-style event row
│       │   │   ├── FeaturedCard.jsx    — Large hero event card
│       │   │   ├── EventList.jsx       — Scrollable event list
│       │   │   ├── CategoryFilter.jsx  — Horizontal scroll chip tabs
│       │   │   └── RsvpButton.jsx      — RSVP toggle with state
│       │   ├── map/
│       │   │   ├── CampusMap.jsx       — Mapbox GL wrapper
│       │   │   └── EventPin.jsx        — Custom map marker
│       │   └── organiser/
│       │       ├── AnalyticsCard.jsx   — Stat card with progress bars
│       │       └── QRTicket.jsx        — QR code display + validator
│       │
│       ├── hooks/
│       │   ├── useEvents.js            — React Query hooks for event data
│       │   ├── useAuth.js              — Auth state helpers
│       │   └── useRsvp.js              — RSVP mutation + optimistic update
│       │
│       ├── store/
│       │   ├── authStore.js            — Zustand: user + auth state
│       │   └── eventStore.js           — Zustand: selected filters, search term
│       │
│       ├── api/
│       │   ├── client.js              — Axios instance with auth header injection
│       │   ├── events.js              — GET /events, GET /events/:id
│       │   ├── auth.js                — POST /auth/register, /auth/me
│       │   ├── users.js               — GET /users/:id, PATCH /users/:id
│       │   └── rsvp.js                — POST/DEL /rsvp/:eventId
│       │
│       └── utils/
│           ├── firebase.js            — Firebase app init + auth export
│           ├── constants.js           — ROUTES, CATEGORIES, USER_TYPES
│           ├── dates.js               — Date formatting helpers
│           └── categories.js          — Category colour/emoji mapping
│
├── server/                         # Node.js + Express API
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── index.js                — Express app setup + middleware + routes
│       ├── routes/
│       │   ├── events.js           — GET/POST/PUT/DEL /api/events
│       │   ├── rsvp.js             — POST/DEL /api/rsvp/:eventId
│       │   ├── users.js            — GET/PATCH /api/users/:id
│       │   ├── auth.js             — POST /api/auth/register, /me
│       │   └── uploads.js          — POST /api/uploads/image (Cloudinary)
│       ├── controllers/            — Business logic (one per route file)
│       ├── models/                 — DB query functions (no ORM — raw pg)
│       ├── middleware/
│       │   ├── auth.js             — Firebase token verification
│       │   ├── errorHandler.js     — Global error formatter
│       │   └── notFound.js         — 404 handler
│       ├── services/               — Cloudinary, QR code generation, email
│       ├── config/
│       │   ├── db.js               — pg Pool instance
│       │   ├── firebase.js         — Firebase Admin SDK init
│       │   └── cloudinary.js       — Cloudinary SDK config
│       └── db/
│           ├── migrations/
│           │   └── 001_initial_schema.sql   — Users, Events, RSVPs, Notifications
│           └── seeds/
│               └── 001_sample_events.sql    — Sample data for dev
│
├── docs/
│   ├── architecture.md             ← this file
│   └── requirements.md             — Phased requirements (from business plan)
│
├── docker-compose.yml              — PostgreSQL + server + client
├── package.json                    — Root: concurrently dev script
├── .gitignore
└── README.md
```

## Technology Decisions

### Frontend
| Decision | Choice | Reason |
|---|---|---|
| Build tool | Vite | Fastest HMR; simpler than CRA for 2-person team |
| Styling | Tailwind CSS | Utility-first; consistent with design tokens; no CSS file proliferation |
| State | Zustand | Lightweight; no Redux boilerplate for MVP scale |
| Data fetching | React Query | Caching + loading states out of the box; avoids manual useEffect/fetch |
| Routing | React Router v6 | Industry standard; nested routes for layouts |
| Auth (client) | Firebase SDK | Handles token refresh, session persistence automatically |
| Maps | Mapbox GL JS | Free tier sufficient for MVP; better UX than Google Maps for custom pins |
| Images | Cloudinary | Free tier, CDN, auto-resize/optimize |

### Backend
| Decision | Choice | Reason |
|---|---|---|
| Runtime | Node.js + Express | Dev 1 can ship API alongside Dev 2's UI work; no context switching |
| Database | PostgreSQL (raw pg) | No ORM overhead; schema designed to extend cleanly to Phase 2+ |
| Auth (server) | Firebase Admin | Verifies tokens issued by client SDK; no separate user table for passwords |
| QR codes | `qrcode` npm package | Zero-dependency, server-side generation; no external service |

## Data Flow

```
User action (e.g. RSVP)
  → RsvpButton.jsx calls useRsvp() hook
  → hook calls api/rsvp.js (Axios, auto-injects Firebase ID token)
  → Express /api/rsvp/:eventId
  → requireAuth middleware verifies token with Firebase Admin
  → rsvp controller inserts row, updates events.rsvp_count
  → 201 response
  → React Query cache invalidated → UI updates
```

## Running Locally (No Docker)

```bash
# Terminal 1 — PostgreSQL (requires local Postgres install)
createdb campusconnect
psql campusconnect < server/src/db/migrations/001_initial_schema.sql

# Terminal 2 — API server
cd server && cp .env.example .env  # fill in values
npm install && npm run dev

# Terminal 3 — React client
cd client && cp .env.example .env  # fill in Firebase + Mapbox keys
npm install && npm run dev
# → http://localhost:3000
```
