# GritIQ — Adaptive Strength Tracker

> A full-stack progressive web app for powerlifters and strength athletes — built on the **Adaptive Strength Waves** methodology. Track workouts, follow periodized programs, get AI coaching from ATLAS, monitor nutrition, and compete in head-to-head challenges.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/markusschnermann-sys/gritiq-app)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/markusschnermann-sys/gritiq-app)

---

## Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start (local)](#quick-start-local)
- [Environment Variables](#environment-variables)
- [SQLite Schema](#sqlite-schema)
- [Deploying to Render](#deploying-to-render)
- [Deploying to Railway](#deploying-to-railway)
- [Deploying with Docker](#deploying-with-docker)
- [Stripe Setup](#stripe-setup)
- [Pro vs. Free Feature Gates](#pro-vs-free-feature-gates)
- [Architecture](#architecture)

---

## Features

| Category | Details |
|---|---|
| **Adaptive Strength Waves** | 4-wave periodization (10s → 8s → 5s → 3s), auto-deload, RPE/RIR logging |
| **ATLAS AI Coach** | GPT-4o powered coaching — session feedback, readiness check, program advice (5 msg/mo free, unlimited Pro) |
| **Nutrition Plan** | Mifflin-St-Jeor TDEE, goal-specific macros (Powerlifting / Bodybuilding / Fat Loss), calorie cycling |
| **Supplement Guide** | Evidence-based (ISSN), contraindication matrix, goal-specific stacks |
| **Analytics** | PR Wall, IPF Goodlift Score, Wilks2, 4-week history (free) / full history (Pro) |
| **H2H Challenges** | Head-to-head Wilks2/IPF GL coefficient improvement duels |
| **Referral System** | Bronze → Silber → Gold → Diamant tiers; 30 days Pro per conversion |
| **PWA** | Installable on iOS/Android, offline-ready service worker |
| **Stripe Billing** | Monthly (9,99 €) + Annual (79,99 €), 14-day trial, webhook-based Pro status |
| **Auth** | JWT access + refresh tokens (httpOnly cookies), bcrypt passwords, rate limiting |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 7, Tailwind CSS 3, shadcn/ui, Wouter (hash routing), TanStack Query |
| Backend | Node.js 20, Express 5, TypeScript |
| Database | SQLite via `better-sqlite3` + Drizzle ORM |
| Auth | JWT (jsonwebtoken), bcryptjs, httpOnly cookies |
| Payments | Stripe SDK (subscriptions + webhooks) |
| AI | OpenAI SDK (GPT-4o) |
| Fonts | Clash Grotesk (display), Satoshi (body) — via Fontshare |
| Deploy | Render / Railway / Docker (see below) |

---

## Quick Start (local)

### Prerequisites

- Node.js 20+
- npm 10+

### Steps

```bash
# 1. Clone
git clone https://github.com/markusschnermann-sys/gritiq-app.git
cd gritiq-app

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET, JWT_REFRESH_SECRET, OPENAI_API_KEY

# 4. Create the SQLite database (runs Drizzle migrations)
npm run db:push

# 5. Start the dev server (hot reload on both frontend and backend)
npm run dev
```

The app is now available at **http://localhost:5000**.

---

## Environment Variables

Copy `.env.example` → `.env` and fill in all values before running.

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | No | HTTP port (default: `5000`) |
| `DATABASE_PATH` | No | Path to SQLite file (default: `./data.db`) |
| `JWT_SECRET` | **Yes** | Secret for signing access tokens — min 32 chars. Generate: `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | **Yes** | Separate secret for refresh tokens |
| `STRIPE_SECRET_KEY` | Yes* | Stripe secret key (`sk_live_...` or `sk_test_...`) |
| `STRIPE_PRICE_ID_MONTHLY` | Yes* | Stripe Price ID for the monthly plan (9,99 €) |
| `STRIPE_PRICE_ID_ANNUAL` | Yes* | Stripe Price ID for the annual plan (79,99 €) |
| `STRIPE_WEBHOOK_SECRET` | Yes* | Webhook signing secret (`whsec_...`) |
| `OPENAI_API_KEY` | Yes* | OpenAI API key for ATLAS AI Coach |
| `APP_URL` | Yes* | Full public URL of your deployment — used for referral links and Stripe redirects |

*Required for the feature to function; the app starts without them but those features will be disabled/error.

---

## SQLite Schema

The database is created automatically on first run via `npm run db:push`. All tables use SQLite with Drizzle ORM.

### Tables

#### `users`
Core user profile, 1RM records, subscription state, and referral tracking.

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `name` | TEXT | Display name |
| `squat_max` | REAL | Current 1RM in kg |
| `bench_max` | REAL | Current 1RM in kg |
| `deadlift_max` | REAL | Current 1RM in kg |
| `ohp_max` | REAL | Current 1RM in kg |
| `current_wave` | INTEGER | Wave 1–4 (10s/8s/5s/3s) |
| `current_week` | INTEGER | Week 1–4 (Acc/Int/Real/Deload) |
| `program_start_date` | TEXT | ISO date |
| `training_goal` | TEXT | `powerlifting` \| `bodybuilding` \| `weightloss` |
| `gender` | TEXT | `male` \| `female` \| `other` |
| `age` | INTEGER | Optional, used for TDEE |
| `bodyweight` | REAL | kg, optional |
| `nutrition_prefs` | TEXT | JSON — custom macro overrides |
| `calorie_cycling_prefs` | TEXT | JSON — training/rest day split |
| `is_pro` | INTEGER | `0` = Free, `1` = Pro |
| `stripe_customer_id` | TEXT | Stripe `cus_...` |
| `stripe_subscription_id` | TEXT | Stripe `sub_...` |
| `stripe_subscription_status` | TEXT | `active` \| `trialing` \| `canceled` \| `past_due` |
| `stripe_plan` | TEXT | `monthly` \| `annual` |
| `stripe_renewal_date` | TEXT | ISO datetime of next renewal |
| `pro_expires_at` | TEXT | ISO datetime (null = active indefinitely) |
| `atlas_messages_this_month` | INTEGER | Rate-limit counter |
| `atlas_reset_at` | TEXT | ISO date of last monthly reset |
| `leaderboard_visibility` | TEXT | `public` \| `anonymous` \| `hidden` |
| `referral_code` | TEXT | Unique code e.g. `MARKUS-A3X2` |
| `referred_by_code` | TEXT | Code used at signup |
| `referral_bonus_days_total` | INTEGER | Cumulative free Pro days earned |

#### `workout_sessions`
One row per training session (planned → in_progress → completed).

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `user_id` | INTEGER | FK → users |
| `date` | TEXT | ISO date |
| `lift` | TEXT | `squat` \| `bench` \| `deadlift` \| `ohp` |
| `wave` | INTEGER | 1–4 |
| `week` | INTEGER | 1–4 |
| `status` | TEXT | `planned` \| `in_progress` \| `completed` |
| `readiness_score` | INTEGER | 1–5 overall readiness |
| `sleep_score` | INTEGER | 1–5 |
| `nutrition_score` | INTEGER | 1–5 |
| `motivation_score` | INTEGER | 1–5 |
| `fatigue_score` | INTEGER | 1–5 |
| `session_difficulty` | INTEGER | 5–10 RPE post-session |
| `notes` | TEXT | Free text |

#### `sets`
Individual sets within a workout session.

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | |
| `session_id` | INTEGER | FK → workout_sessions |
| `set_number` | INTEGER | Order within session |
| `target_reps` | INTEGER | Prescribed reps |
| `target_weight` | REAL | Prescribed weight (kg) |
| `actual_reps` | INTEGER | Logged reps |
| `actual_weight` | REAL | Logged weight (kg) |
| `rpe` | REAL | Rating of Perceived Exertion 1–10 |
| `rir` | INTEGER | Reps In Reserve |
| `is_amrap` | INTEGER | Boolean (0/1) |
| `is_completed` | INTEGER | Boolean (0/1) |

#### `exercises`
Global + user-created exercise library.

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | |
| `name` | TEXT | German display name |
| `name_en` | TEXT | English alias |
| `muscle_group` | TEXT | e.g. `chest`, `back`, `legs` |
| `equipment` | TEXT | `barbell` \| `dumbbell` \| `machine` \| `cable` \| `bodyweight` \| `kettlebell` |
| `movement_type` | TEXT | `compound` \| `isolation` |
| `tags` | TEXT | Comma-separated: `powerlifting`, `bodybuilding`, `weightloss` |
| `is_custom` | INTEGER | 0 = global, 1 = user-created |
| `user_id` | INTEGER | null = global exercise |

#### `challenges`
Group challenges (volume / consistency / PR / streak).

#### `challenge_participants`
Membership + progress per user per challenge.

#### `refresh_tokens`
JWT refresh token store (family-based rotation, stored as SHA-256 hash).

#### `h2h_challenges` / `h2h_snapshots` / `h2h_events`
Head-to-head 1-vs-1 strength duels with weekly Wilks2/IPF GL snapshots and trash-talk events.

#### `password_reset_tokens`
Single-use, 1-hour expiry reset tokens (stored as SHA-256 hash).

---

## Deploying to Render

The repo includes a `render.yaml` for one-click deployment.

1. **Fork** or push this repo to your GitHub account.
2. Click **Deploy to Render** above (or go to [render.com/new](https://render.com/new)).
3. Connect your GitHub repository.
4. Render detects `render.yaml` automatically and creates:
   - A **Web Service** (Node.js)
   - A **Persistent Disk** at `/data` for SQLite (1 GB)
5. In the Render dashboard, add the required **Environment Variables** listed above (especially `STRIPE_SECRET_KEY`, `OPENAI_API_KEY`, and `APP_URL`).
6. The first deploy runs `npm ci && npm run build`, then `npm start`.

> **Important:** Set `APP_URL` to your Render URL (`https://gritiq-app.onrender.com`) before deploying — it's needed for Stripe redirect URLs and referral link generation.

### Stripe Webhook on Render

After deployment, create a webhook in the Stripe Dashboard:
- **Endpoint URL:** `https://your-render-url.onrender.com/api/stripe/webhook`
- **Events to listen for:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Copy the **Signing Secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.

---

## Deploying to Railway

1. Click **Deploy on Railway** above.
2. Railway uses `railway.json` + Nixpacks to auto-detect Node.js.
3. Add a **Volume** in Railway and mount it at `/data` for SQLite persistence.
4. Set all environment variables in the Railway dashboard.
5. Set `APP_URL` to your Railway URL.

> **Note:** Railway's free tier hibernates after inactivity. Use the Hobby plan for always-on production deployments.

---

## Deploying with Docker

```bash
# Build
docker build -t gritiq-app .

# Run (mount a host directory for SQLite persistence)
docker run -d \
  --name gritiq \
  -p 5000:5000 \
  -v /your/host/data:/data \
  -e NODE_ENV=production \
  -e JWT_SECRET=your_secret_here \
  -e JWT_REFRESH_SECRET=your_refresh_secret_here \
  -e STRIPE_SECRET_KEY=sk_live_... \
  -e STRIPE_PRICE_ID_MONTHLY=price_... \
  -e STRIPE_PRICE_ID_ANNUAL=price_... \
  -e STRIPE_WEBHOOK_SECRET=whsec_... \
  -e OPENAI_API_KEY=sk-proj-... \
  -e APP_URL=https://yourdomain.com \
  gritiq-app
```

The app is available at `http://localhost:5000`.

### docker-compose.yml (optional)

```yaml
version: "3.9"
services:
  gritiq:
    build: .
    restart: unless-stopped
    ports:
      - "5000:5000"
    volumes:
      - gritiq_data:/data
    env_file: .env

volumes:
  gritiq_data:
```

---

## Stripe Setup

### 1. Create Products & Prices

In the [Stripe Dashboard](https://dashboard.stripe.com/products):

| Product | Price | Interval | Price ID |
|---|---|---|---|
| GritIQ Pro | 9,99 € | Monthly | Copy → `STRIPE_PRICE_ID_MONTHLY` |
| GritIQ Pro | 79,99 € | Yearly | Copy → `STRIPE_PRICE_ID_ANNUAL` |

Enable **14-day free trial** on both prices in the Price settings.

### 2. Configure Webhooks

Endpoint: `POST /api/stripe/webhook`

Required events:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

### 3. Test locally

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks to local dev server
stripe listen --forward-to localhost:5000/api/stripe/webhook

# In a separate terminal, trigger a test event
stripe trigger checkout.session.completed
```

---

## Pro vs. Free Feature Gates

| Feature | Free | Pro |
|---|---|---|
| Adaptive Strength Waves (Wave 1) | ✓ | ✓ |
| Waves 2–4 | — | ✓ |
| ATLAS AI Coach | 5 msg/month | Unlimited |
| Full Nutrition Plan | — | ✓ |
| Supplement Stack Guide | — | ✓ |
| Training History | Last 4 weeks | Unlimited |
| PR Wall & Analytics | — | ✓ |
| IPF Goodlift Score | ✓ | ✓ |
| H2H Challenges | — | ✓ |
| Referral Bonus | 30 days Pro per conversion | ✓ |

Gates are enforced **server-side** via `isPro` on the user record. Client-side `<ProGate>` components show locked states.

---

## Architecture

```
gritiq-app/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── components/      # UI components (shadcn/ui + custom)
│       ├── pages/           # Route-level page components
│       ├── hooks/           # Custom React hooks (useSubscription, etc.)
│       └── lib/             # API client, utilities
├── server/                  # Express backend
│   ├── index.ts             # Entry point, middleware setup
│   ├── routes.ts            # All API endpoints
│   ├── auth.ts              # JWT auth + refresh token rotation
│   ├── storage.ts           # Drizzle ORM queries (data access layer)
│   ├── juggernaut.ts        # Adaptive Strength Waves business logic
│   ├── coefficients.ts      # Wilks2 + IPF GL calculations
│   └── static.ts            # Vite dev middleware / production static serving
├── shared/
│   └── schema.ts            # Drizzle schema — single source of truth for DB + types
├── landing/                 # Static landing page (deployed separately)
├── Dockerfile               # Multi-stage production Docker image
├── render.yaml              # Render one-click deploy config
├── railway.json             # Railway deploy config
├── .env.example             # Environment variable template
└── drizzle.config.ts        # Drizzle ORM config
```

### Request flow

```
Browser → Express (port 5000)
  ├── /api/*          → routes.ts (authenticated via JWT middleware)
  ├── /api/auth/*     → auth.ts (login, register, refresh, logout)
  ├── /api/stripe/*   → Stripe checkout + webhook handler
  └── /*              → Vite dev server (dev) / dist/public (production)
```

### Auth flow

1. `POST /api/auth/login` → returns `accessToken` (15 min, httpOnly cookie) + `refreshToken` (30 days, httpOnly cookie, stored hashed in DB)
2. On `401` → client calls `POST /api/auth/refresh` → rotates both tokens
3. Logout revokes the refresh token family in the DB

---

## License

MIT — see [LICENSE](LICENSE) for details.
