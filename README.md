# CampusConnect

> Your campus, all in one place — a centralized event discovery and management platform for college students and student organizations.

## Project Overview

CampusConnect solves the fragmented nature of campus event promotion. Students discover all events in one place; organizers get real RSVPs and analytics; the platform grows through network effects.

**Tech Stack**
- **Frontend:** React.js (web, responsive) · React Native (mobile — Phase 2)
- **Backend:** Node.js + Express REST API
- **Database:** PostgreSQL
- **Auth:** Firebase Authentication
- **Storage:** Cloudinary (event images)
- **Maps:** Mapbox GL JS
- **Deployment:** Docker → AWS/GCP

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/your-org/campusconnect.git
cd campusconnect

# 2. Install dependencies
npm install                    # root (shared tooling)
cd client && npm install       # React frontend
cd ../server && npm install    # Express backend

# 3. Set up environment variables
cp client/.env.example client/.env
cp server/.env.example server/.env
# → Fill in Firebase, Cloudinary, Mapbox, DB credentials

# 4. Run database migrations
cd server && npm run db:migrate

# 5. Start development servers (from root)
npm run dev
# → Frontend: http://localhost:3000
# → Backend:  http://localhost:5000
```

## Project Structure

See [`docs/architecture.md`](docs/architecture.md) for a detailed breakdown.

## Phase 1 MVP Scope

The 9-week MVP targets:
- Student account creation, event browsing, and RSVP
- Organizer event creation, management, and basic analytics
- Campus map with event pins
- QR code check-in (web-based validator)
- Responsive web app (mobile native app is Phase 2)

See [`docs/requirements.md`](docs/requirements.md) for the full phased requirements.

## Team

| Role | Sprint Focus |
|---|---|
| Dev 1 — Full-Stack | API, database, auth, backend logic |
| Dev 2 — Full-Stack / Design | UI components, pages, design system |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start both client and server in watch mode |
| `npm run build` | Production build (client) |
| `npm run test` | Run all tests |
| `npm run db:migrate` | Run pending database migrations |
| `npm run db:seed` | Seed database with sample events |
| `npm run lint` | ESLint across client and server |

## License

MIT
