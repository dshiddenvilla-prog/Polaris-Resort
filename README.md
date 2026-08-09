# Polaris Resort Backend

Express + MongoDB (Mongoose) API for the Polaris Resort booking site. Replaces the
`localStorage`-based store in `index.html` / `admin.html` with a real shared database.

## Stack
- Node.js / Express
- MongoDB via Mongoose
- JWT admin auth (bcrypt-hashed passcode check)
- express-rate-limit on public booking creation and admin login
- Deploy target: Render

## Setup

```bash
npm install
cp .env.example .env
# fill in .env with real values
npm start
```

The frontend (`public/index.html`, `public/admin.html`) is served directly by this
same Express app — one Render service, one URL, no CORS setup needed. Visit `/` for
the guest site and `/admin` (or `/admin.html`) for the admin panel.

## Environment variables

| Var | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string (e.g. Atlas) |
| `JWT_SECRET` | Long random string used to sign admin JWTs |
| `ADMIN_PASSCODE` | Single shared admin passcode (plaintext in env, hashed in memory for comparison) |
| `PORT` | Port to listen on (Render sets this automatically) |
| `ALLOWED_ORIGIN` | Exact origin of the resort's frontend, e.g. `https://polarisresort.com` |

## Setting the admin passcode

Set `ADMIN_PASSCODE` in your environment (in Render: Dashboard → your service →
Environment). Pick anything memorable but non-trivial — it's the single shared
passcode used at `/api/admin/login`. Changing it in Render's env vars and
redeploying/restarting immediately rotates the passcode; no database migration
needed since it's never stored, only compared.

## Deploying to Render

1. Push this repo to GitHub.
2. In Render, create a new **Web Service** from the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add the environment variables listed above in the Render dashboard.
5. Render provides `PORT` automatically; the app already reads `process.env.PORT`.
6. Point `ALLOWED_ORIGIN` at your live frontend domain (no trailing slash).

## API Endpoints

### Public

| Method | Path | Description |
|---|---|---|
| POST | `/api/bookings` | Create a booking. Validates required fields, checks for date conflicts against accepted bookings + blocked dates (409 on conflict), auto-generates a unique `ref`, defaults `status` to `pending`. Rate-limited. |
| GET | `/api/availability` | Returns `{ blockedDates: ["YYYY-MM-DD", ...] }` — union of manually blocked dates and all dates covered by accepted bookings. |

### Admin

All admin routes except login require `Authorization: Bearer <token>` from `/api/admin/login`.

| Method | Path | Description |
|---|---|---|
| POST | `/api/admin/login` | Body `{ passcode }`. Returns `{ token }`, expires in 12h. Rate-limited. |
| GET | `/api/admin/bookings` | List all bookings, optional `?status=pending\|accepted\|rejected`, sorted newest first. |
| GET | `/api/admin/stats` | Returns `{ pending, accepted, rejected, total }`. |
| PATCH | `/api/admin/bookings/:ref/status` | Body `{ status }`. Accept/reject/reset a booking. |
| DELETE | `/api/admin/bookings/:ref` | Delete a booking. |
| GET | `/api/admin/blocked-dates` | List manually blocked dates. |
| POST | `/api/admin/blocked-dates` | Body `{ date }`. Adds a blocked date (no-op if already blocked). |
| DELETE | `/api/admin/blocked-dates/:date` | Remove a blocked date. |

## Data model

**Booking**: `ref, package, packageLabel, checkin, checkout, name, phone, fb, guests, email, notes, status, createdAt, updatedAt`

**BlockedDate**: `date, createdAt`

Field names intentionally match the existing `polarisData` localStorage shape so the
frontend swap (`loadStore`/`saveStore`/`getBookedDates` → `fetch` calls) is a drop-in
replacement.

## Notes on date-range logic

Bookings are treated as `[checkin, checkout)` — the checkout date itself is free for a
new guest to check in (standard hotel convention). Day-tour bookings where
`checkin === checkout` block just that single day.
