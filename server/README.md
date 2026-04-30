# CampusConnect Server

This folder contains the initial Express backend scaffold for CampusConnect.

## Run Locally

1. Install dependencies:

```bash
cd server
npm install
```

2. Create your local env file from the example:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Update `.env` with your values:

- `DATABASE_URL` for your PostgreSQL connection string
- `JWT_SECRET` for signing/verifying JWTs
- `PORT` (defaults to `4000`)

4. Start the development server:

```bash
npm run dev
```

5. Verify the API is running:

- `GET http://localhost:4000/api/health`
- Expected response: `{ "status": "ok" }`

## Notes

- Route files are scaffolded under `routes/`:
  - `auth.js`
  - `events.js`
  - `rsvp.js`
  - `users.js`
- Route logic is intentionally not implemented yet.
