# GritIQ — Adaptive Strength Tracker

A full-stack fitness app built on the **GritIQ Adaptive Strength Waves** method.
Dark-industrial design · Orange accent · Clash Grotesk + Satoshi typography.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS v3 + shadcn/ui + wouter (hash routing) |
| Backend | Express + TypeScript |
| Database | SQLite via `better-sqlite3` + Drizzle ORM |
| Auth | JWT (access 15 min · refresh 30 days) + bcrypt |
| Payments | Stripe (monthly & annual subscriptions, 14-day trial) |
| AI | OpenAI SDK (ATLAS coach + weekly nutrition emails) |
| Build | esbuild (server) + Vite (client) |

---

## Features

### Free
- Wave 1 training program (4 weeks · Powerlifting goal)
- AMRAP-based progression & 1RM tracking
- Workout history (last 4 weeks)
- IPF GL Score & Goodlift coefficient
- Leaderboard & challenges (join only)
- ATLAS KI-Coach (5 messages/month)

### GritIQ Pro (9,99 €/month · 79,99 €/year · 14-day free trial)
- Full 16-week program (all 4 waves)
- All 3 training goals: Powerlifting · Bodybuilding · Abnehmen
- Unlimited ATLAS KI-Coach sessions
- Advanced Analytics: PR Wall, Strength Standards, Performance Graphs
- Unlimited workout history
- Weekly AI-generated nutrition plan (email every Monday)
- Evidence-based supplement stack (ISSN)
- Create challenges & Head-to-Head strength duels
- Referral bonus: 30 days Pro per referred conversion

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### 1. Clone & install

```bash
git clone https://github.com/<your-org>/gritiq-app.git
cd gritiq-app
npm install
```

### 2. Environment variables

Create a `.env` file in the project root (or export these in your shell):

```env
# Required
OPENAI_API_KEY=sk-...
JWT_SECRET=your-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars

# Stripe (optional — needed for Pro checkout)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_ID=price_...          # monthly price ID
STRIPE_ANNUAL_PRICE_ID=price_...   # annual price ID
STRIPE_WEBHOOK_SECRET=whsec_...    # for local webhook testing (optional)
```

### 3. Run in development

```bash
npm run dev
```

Opens at [http://localhost:5000](http://localhost:5000).
Express serves the API; Vite HMR handles the React frontend on the same port.

### 4. Build for production

```bash
npm run build
```

Outputs:
- `dist/public/` — static frontend (Vite bundle)
- `dist/index.cjs` — compiled Express server

### 5. Start in production

```bash
NODE_ENV=production node dist/index.cjs
```

---

## Project Structure

```
gritiq-app/
├── client/
│   └── src/
│       ├── App.tsx               # Root + routing (hash-based via wouter)
│       ├── pages/                # Route-level pages
│       │   ├── auth.tsx
│       │   ├── onboarding.tsx
│       │   ├── dashboard.tsx
│       │   ├── training.tsx
│       │   ├── program.tsx
│       │   ├── workout.tsx
│       │   ├── history.tsx
│       │   ├── settings.tsx
│       │   ├── coach.tsx         # ATLAS KI-Coach
│       │   ├── exercises.tsx
│       │   ├── challenges.tsx
│       │   ├── leaderboard.tsx
│       │   ├── h2h.tsx           # Head-to-Head duels
│       │   ├── invite.tsx        # Referral sharing
│       │   ├── upgrade.tsx       # Pro upgrade page
│       │   └── referral-analytics.tsx  # Admin dashboard
│       ├── components/
│       │   ├── ProGate.tsx       # Feature gating wrapper
│       │   ├── UpgradeModal.tsx  # Checkout modal
│       │   ├── Sidebar.tsx
│       │   ├── BottomNav.tsx
│       │   └── ...
│       ├── hooks/
│       │   ├── useSubscription.ts
│       │   └── useReferral.ts
│       └── lib/
│           ├── authStore.ts      # JWT auth state
│           ├── queryClient.ts    # TanStack Query + apiRequest
│           ├── nutrition.ts      # Mifflin-St-Jeor TDEE calculator
│           └── supplements.ts    # ISSN supplement stack
├── server/
│   ├── index.ts                  # Express entry point
│   ├── routes.ts                 # All API routes
│   ├── storage.ts                # Drizzle ORM storage layer
│   └── vite.ts                   # Vite dev-server integration
├── shared/
│   └── schema.ts                 # Drizzle schema + Zod types
├── data.db                       # SQLite database (auto-created)
├── drizzle.config.ts
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## API Overview

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout |

### User & Program
| Method | Path | Description |
|---|---|---|
| GET | `/api/user` | Current user profile + Pro status |
| PATCH | `/api/user` | Update profile / maxes / nutrition prefs |
| GET | `/api/sessions` | All workout sessions |
| POST | `/api/sessions` | Start new session |
| PATCH | `/api/sessions/:id` | Update session |

### Subscription
| Method | Path | Description |
|---|---|---|
| GET | `/api/subscription` | Current subscription status |
| POST | `/api/subscription/checkout` | Create Stripe checkout session |
| POST | `/api/subscription/cancel` | Cancel subscription |
| POST | `/api/webhooks/stripe` | Stripe webhook handler |

### Referral
| Method | Path | Description |
|---|---|---|
| GET | `/api/referral` | Referral stats + tier progress |
| POST | `/api/referral/use` | Apply referral code |

### Social
| Method | Path | Description |
|---|---|---|
| GET | `/api/leaderboard` | Global strength leaderboard |
| GET/POST | `/api/challenges` | Challenges |
| GET/POST | `/api/h2h` | Head-to-Head duels |

---

## Routing

Uses **hash-based routing** (`/#/`, `/#/settings`, etc.) via wouter's `useHashLocation`.
Required for iframe embedding compatibility.

**Critical:** `<Router hook={useHashLocation}>` goes on `<Router>`, NOT on `<Switch>`.

---

## Pro Paywall Architecture

- `ProGate` component wraps any Pro-only UI section
- Feature types: `nutrition | supplements | program | analytics | atlas | challenges | h2h | generic`
- Pro status sources: Stripe checkout (`status="active"/"trialing"`) or referral bonus (`status="referral_bonus"`, 30-day expiry)
- Auto-revocation: `/api/user` checks `proExpiresAt` on every request
- History gate: free users see last 4 weeks only; older sessions show a locked banner

---

## Scheduled Tasks

A Monday 06:00 CEST cron generates a weekly nutrition plan email using the GritIQ Adaptive Strength Waves method (Mifflin-St-Jeor TDEE · goal-specific macros · 5 meal templates · shopping list · meal prep guide).

---

## License

Private — all rights reserved.
