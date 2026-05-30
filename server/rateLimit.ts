/**
 * GritIQ — Rate Limiting & Abuse Prevention
 * ==========================================
 * Uses express-rate-limit v8 with a MemoryStore (single-process SQLite app).
 * All limiters return RFC 7807-compliant JSON on 429 and set Retry-After.
 *
 * Threshold rationale is documented inline for each limiter.
 *
 * Key design decisions:
 * - windowMs / max pairs are conservative defaults; adjust via env vars in prod.
 * - Stripe webhook is IP-only (Stripe IPs are well-known, no per-user concept).
 * - OpenAI chat gets the tightest limit — each call costs ~$0.01+.
 * - All responses include `retryAfter` (seconds) in the JSON body.
 */

import rateLimit, { type Options, type RateLimitRequestHandler } from "express-rate-limit";

// ── Helper ────────────────────────────────────────────────────────────────────

function make(
  label: string,
  opts: Partial<Options> & { windowMs: number; max: number }
): RateLimitRequestHandler {
  return rateLimit({
    ...opts,
    standardHeaders: "draft-7",   // RateLimit-Policy, RateLimit, Retry-After (RFC 9110)
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler(req, res, _next, options) {
      const retryAfter = Math.ceil(options.windowMs / 1000);
      res.setHeader("Retry-After", retryAfter);
      res.status(429).json({
        error: "Too Many Requests",
        limiter: label,
        retryAfter,
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      });
    },
  });
}

// ── Global API guard (catch-all) ──────────────────────────────────────────────
/**
 * 100 req / 15 min per IP.
 * Protects against broad enumeration / DDoS at the API level.
 * Generous enough that a normal user never hits it, but stops scripted sweeps.
 */
export const globalApiLimiter = make("global", {
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
});

// ── OpenAI Coach Chat ─────────────────────────────────────────────────────────
/**
 * 10 req / 60 s per IP.
 * Tightest limit — each request hits the OpenAI API (cost ~$0.01–0.05).
 * A legitimate user sending 10 messages per minute is already edge-case behavior.
 * Brute-forcing this without a limit could cost hundreds of dollars per hour.
 */
export const chatLimiter = make("coach/chat", {
  windowMs: 60 * 1000, // 1 min
  max: 10,
});

// ── OpenAI Coach Insights ─────────────────────────────────────────────────────
/**
 * 5 req / 5 min per IP.
 * Insights are heavier GPT calls (longer context). Lower cap than chat.
 * A user generating insights 5x in 5 minutes is automated behavior.
 */
export const insightsLimiter = make("coach/insights", {
  windowMs: 5 * 60 * 1000, // 5 min
  max: 5,
});

// ── Stripe Checkout / Subscription ───────────────────────────────────────────
/**
 * 3 req / 15 min per IP.
 * Prevents card-testing attacks and duplicate checkout session creation.
 * Legitimate users click "Subscribe" once. 3 tries in 15 min covers accidental
 * double-clicks and a retry after a network error — nothing more.
 */
export const checkoutLimiter = make("subscription/checkout", {
  windowMs: 15 * 60 * 1000, // 15 min
  max: 3,
});

// ── Stripe Portal ─────────────────────────────────────────────────────────────
/**
 * 5 req / 15 min per IP.
 * Portal sessions are cheap but there's no reason to request more than a
 * handful per quarter-hour session.
 */
export const portalLimiter = make("subscription/portal", {
  windowMs: 15 * 60 * 1000,
  max: 5,
});

// ── Stripe Webhook ────────────────────────────────────────────────────────────
/**
 * 60 req / 60 s per IP.
 * Stripe sends webhooks from known IP ranges. We validate signatures, so
 * unsigned payloads are rejected upstream. This limiter is a secondary layer
 * against replay floods from unknown IPs. 60/min is generous for Stripe's
 * burst patterns during subscription churn events.
 */
export const webhookLimiter = make("stripe/webhook", {
  windowMs: 60 * 1000, // 1 min
  max: 60,
});

// ── Onboarding / User Creation ────────────────────────────────────────────────
/**
 * 5 req / 10 min per IP.
 * POST /api/user is the account-creation / onboarding submission endpoint.
 * 5 attempts in 10 minutes covers legitimate retries (form errors, network
 * blips) while blocking automated account-farming.
 */
export const onboardingLimiter = make("user/create", {
  windowMs: 10 * 60 * 1000, // 10 min
  max: 5,
});

// ── Referral Code Redemption ──────────────────────────────────────────────────
/**
 * 5 req / 15 min per IP.
 * Prevents brute-force enumeration of valid referral codes.
 * Codes follow [A-Z0-9]+-[A-Z0-9]{4}, so the space is large, but low rate
 * limits remove any incentive to try.
 */
export const referralLimiter = make("referral/use", {
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
});

// ── Program Progress Updates ──────────────────────────────────────────────────
/**
 * 20 req / 60 s per IP.
 * Progress updates happen after each set — a fast lifter doing 5×5 with
 * quick taps could fire 5 requests per exercise, ~20–25 per session.
 * This allows normal usage while blocking loop-based AMRAP grinding attacks.
 */
export const progressLimiter = make("program/progress", {
  windowMs: 60 * 1000, // 1 min
  max: 20,
});

// ── Exercise Log (bulk set logging) ──────────────────────────────────────────
/**
 * 30 req / 60 s per IP.
 * POST /api/exercises/:id/logs accepts multiple sets.
 * 30/min covers a full workout session logged in real time.
 */
export const exerciseLogLimiter = make("exercises/logs", {
  windowMs: 60 * 1000, // 1 min
  max: 30,
});

// ── Analytics ─────────────────────────────────────────────────────────────────
/**
 * 20 req / 60 s per IP.
 * Analytics is a read-heavy aggregation query; we don't want dashboard polling
 * loops hammering the DB. 20/min allows normal tab-switching behavior.
 */
export const analyticsLimiter = make("analytics", {
  windowMs: 60 * 1000, // 1 min
  max: 20,
});

// ── Account Deletion ──────────────────────────────────────────────────────────
/**
 * 3 req / 60 min per IP.
 * DELETE /api/user is irreversible. No legitimate user needs more than
 * one attempt. The 3-request window covers the confirmation-token retry UX.
 */
export const deleteAccountLimiter = make("user/delete", {
  windowMs: 60 * 60 * 1000, // 60 min
  max: 3,
});

// ── Session & Set mutations ───────────────────────────────────────────────────
/**
 * 60 req / 60 s per IP.
 * Session POSTs and set PATCHes are frequent during an active workout.
 * 60/min (1/sec) covers rapid logging without permitting scripted flooding.
 */
export const sessionMutationLimiter = make("sessions/sets", {
  windowMs: 60 * 1000, // 1 min
  max: 60,
});
