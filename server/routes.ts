import type { Express, Request, Response, NextFunction } from "express";
import { Server } from "http";
import express from "express";
import { verifyAccessToken } from "./auth";
import { calculateScores, ipfGl } from "./coefficients";
import {
  globalApiLimiter,
  chatLimiter,
  insightsLimiter,
  checkoutLimiter,
  portalLimiter,
  webhookLimiter,
  onboardingLimiter,
  referralLimiter,
  progressLimiter,
  exerciseLogLimiter,
  analyticsLimiter,
  deleteAccountLimiter,
  sessionMutationLimiter,
} from "./rateLimit";
import { storage, getAnalyticsData } from "./storage";
import { insertUserSchema, insertWorkoutSessionSchema, insertSetSchema, insertExerciseSchema, insertChallengeSchema } from "@shared/schema";
import {
  getPrescription, calculateProgressionAfterAmrap, estimate1RM,
  getWaveSchedule, EXERCISE_VIDEOS, GOAL_LIFTS,
  type Wave, type WeekType, type Lift, type TrainingGoal
} from "./juggernaut";
import OpenAI from "openai";
import Stripe from "stripe";

// ── Stripe setup ──────────────────────────────────────────────────────────────
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID ?? ""; // price_... monthly from your Stripe dashboard
const STRIPE_ANNUAL_PRICE_ID = process.env.STRIPE_ANNUAL_PRICE_ID ?? "price_1TcjZsLStXqsnT4TVwfEivmr"; // 79.99 EUR/year
const APP_URL = process.env.APP_URL ?? "https://www.perplexity.ai/computer/a/gritiq-kraft-tracker-o6hBGiG0TfefyYrNLKzJGw";

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-04-30.basil" as any })
  : null;

// ── sanitizeUser: strip fields that must never reach the client ─────────────────────
function sanitizeUser<T extends Record<string, unknown>>(user: T): Omit<T, "stripeCustomerId" | "stripeSubscriptionId"> {
  const { stripeCustomerId: _sc, stripeSubscriptionId: _ss, ...safe } = user as any;
  return safe;
}

export function registerRoutes(httpServer: Server, app: Express) {
  // ── Global rate limit (all /api/* routes) ────────────────────────────────
  app.use("/api", globalApiLimiter);

  // ── Auth middleware: all /api routes require a valid access token ─────────
  // /api/auth/* is registered BEFORE registerRoutes() in index.ts, so it never
  // reaches this middleware. /api/stripe/webhook is exempt (Stripe calls it without JWT).
  // ── HEALTH (public — before JWT middleware) ────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  app.use("/api", (req, res, next) => {
    if (req.path === "/stripe/webhook") return next(); // Stripe webhook — no JWT
    return verifyAccessToken(req, res, next);
  });

  // ── USER ──────────────────────────────────────────────────────────────────
  app.get("/api/user", (req, res) => {
    let user = storage.getUser(req.userId);
    if (!user) return res.status(404).json({ message: "No user found" });
    // SC-4 FIX: Inline expiry check so /api/user never returns stale isPro=1
    // for a referral_bonus or manual grant that has already passed.
    // This prevents the frontend from briefly showing Pro UI after token refresh.
    if (user.isPro && user.proExpiresAt) {
      const expired = new Date(user.proExpiresAt) <= new Date();
      if (expired) {
        user = storage.updateUser(user.id, {
          isPro: 0,
          stripeSubscriptionStatus: "expired",
        }) ?? user;
      }
    }
    res.json(sanitizeUser(user));
  });

  app.post("/api/user", onboardingLimiter, (req, res) => {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const existing = storage.getUser(req.userId);
    if (existing) {
      const updated = storage.updateUser(existing.id, parsed.data);
      return res.json(sanitizeUser(updated ?? existing));
    }
    const user = storage.createUser(parsed.data);
    res.status(201).json(sanitizeUser(user));
  });

  // Returns which onboarding step to resume from (R5: partial-onboarding resume)
  app.get("/api/user/onboarding-state", (req, res) => {
    const user = storage.getUser(req.userId);
    if (!user) return res.json({ resumeFromStep: 0 });
    // User fully onboarded: no resume needed
    if (user.squatMax && user.benchMax && user.deadliftMax && user.ohpMax) {
      return res.json({ resumeFromStep: null });
    }
    // Partial: has name/goal but missing maxes → resume at step 2 (1RM in new 5-step wizard)
    if (user.name) return res.json({ resumeFromStep: 2, user: sanitizeUser(user) });
    return res.json({ resumeFromStep: 0 });
  });

  // Self-update route — authenticated user updates their own profile
  app.patch("/api/user", (req, res) => {
    const user = storage.getUser(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const updated = storage.updateUser(user.id, req.body);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json(sanitizeUser(updated));
  });

  app.patch("/api/user/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const updated = storage.updateUser(id, req.body);
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json(sanitizeUser(updated));
  });

  // ── PROGRAM ────────────────────────────────────────────────────────────────
  // Returns the goal-specific lift roster for the current user
  app.get("/api/goal-lifts", (req, res) => {
    const user = storage.getUser(req.userId);
    if (!user) return res.status(404).json({ message: "No user" });
    const goal = (user.trainingGoal ?? "powerlifting") as TrainingGoal;
    res.json(GOAL_LIFTS[goal]);
  });

  app.get("/api/program/wave/:wave", (req, res) => {
    const wave = parseInt(req.params.wave) as Wave;
    res.json(getWaveSchedule(wave));
  });

  app.get("/api/program/prescription", (req, res) => {
    const { wave, week, lift, max } = req.query;
    if (!wave || !week || !lift || !max) {
      return res.status(400).json({ message: "Missing parameters" });
    }
    const prescription = getPrescription(
      parseInt(wave as string) as Wave,
      parseInt(week as string) as WeekType,
      lift as Lift,
      parseFloat(max as string),
    );
    res.json(prescription);
  });

  app.post("/api/program/progress", progressLimiter, (req, res) => {
    const { currentMax, amrapReps, wave, lift } = req.body;
    const newMax = calculateProgressionAfterAmrap(currentMax, amrapReps, wave, lift);
    res.json({ newMax, increase: newMax - currentMax });
  });

  app.post("/api/program/estimate-1rm", (req, res) => {
    const { weight, reps } = req.body;
    const oneRM = estimate1RM(weight, reps);
    res.json({ oneRM: Math.round(oneRM * 10) / 10 });
  });

  // ── EXERCISE VIDEOS ───────────────────────────────────────────────────────
  app.get("/api/exercises/videos", (req, res) => {
    const user = storage.getUser(req.userId);
    const goal = ((user?.trainingGoal ?? "powerlifting") as TrainingGoal);
    const lift = req.query.lift as string | undefined;

    if (lift && lift in EXERCISE_VIDEOS) {
      const videos = EXERCISE_VIDEOS[lift as keyof typeof EXERCISE_VIDEOS]
        .filter(v => v.tags.includes(goal));
      return res.json(videos);
    }

    // Return all videos filtered by goal, keyed by lift
    const result: Record<string, typeof EXERCISE_VIDEOS[keyof typeof EXERCISE_VIDEOS]> = {};
    for (const [key, vids] of Object.entries(EXERCISE_VIDEOS)) {
      result[key] = vids.filter(v => v.tags.includes(goal));
    }
    res.json(result);
  });

  // ── SESSIONS ───────────────────────────────────────────────────────────────
  app.get("/api/sessions", (req, res) => {
    const user = storage.getUser(req.userId);
    if (!user) return res.json([]);
    res.json(storage.getSessions(user.id));
  });

  app.get("/api/sessions/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const session = storage.getSession(id);
    if (!session) return res.status(404).json({ message: "Session not found" });
    const sets = storage.getSetsForSession(id);
    res.json({ ...session, sets });
  });

  app.post("/api/sessions", sessionMutationLimiter, (req, res) => {
    const user = storage.getUser(req.userId);
    if (!user) return res.status(404).json({ message: "No user found" });

    const body = { ...req.body, userId: user.id };
    const parsed = insertWorkoutSessionSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const session = storage.createSession(parsed.data);

    // Auto-generate sets based on prescription
    const lift = session.lift as Lift;
    // For BB/WL lifts, map to the closest 1RM reference lift for weight calculations
    const liftToMax: Record<string, number> = {
      squat: user.squatMax, bench: user.benchMax,
      deadlift: user.deadliftMax, ohp: user.ohpMax,
      // Bodybuilding splits — map to closest primary lift
      chest: user.benchMax, back: user.deadliftMax,
      legs: user.squatMax, shoulders: user.ohpMax,
      arms: user.benchMax, glutes: user.squatMax,
      // Weightloss full-body — use squat as reference (moderate intensity)
      fullbody_a: user.squatMax, fullbody_b: user.deadliftMax, fullbody_c: user.squatMax,
    };
    const maxForLift = liftToMax[lift] ?? user.squatMax;

    const goalValue = (user.trainingGoal ?? "powerlifting") as TrainingGoal;

    const prescription = getPrescription(
      session.wave as Wave,
      session.week as WeekType,
      lift,
      maxForLift,
      goalValue,
    );

    for (const s of prescription.sets) {
      storage.createSet({
        sessionId: session.id,
        setNumber: s.setNumber,
        targetReps: s.targetReps,
        targetWeight: (s as any).targetWeight,
        isAmrap: s.isAmrap ? 1 : 0,
        isCompleted: 0,
      });
    }

    const sets = storage.getSetsForSession(session.id);
    res.status(201).json({ ...session, sets });
  });

  app.patch("/api/sessions/:id", sessionMutationLimiter, (req, res) => {
    const id = parseInt(req.params.id);
    const updated = storage.updateSession(id, req.body);
    if (!updated) return res.status(404).json({ message: "Session not found" });
    res.json(updated);
  });

  // ── SETS ───────────────────────────────────────────────────────────────────
  app.get("/api/sessions/:id/sets", (req, res) => {
    const id = parseInt(req.params.id);
    res.json(storage.getSetsForSession(id));
  });

  app.post("/api/sessions/:id/sets", sessionMutationLimiter, (req, res) => {
    const sessionId = parseInt(req.params.id);
    const parsed = insertSetSchema.safeParse({ ...req.body, sessionId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const set = storage.createSet(parsed.data);
    res.status(201).json(set);
  });

  app.patch("/api/sets/:id", sessionMutationLimiter, (req, res) => {
    const id = parseInt(req.params.id);
    const updated = storage.updateSet(id, req.body);
    if (!updated) return res.status(404).json({ message: "Set not found" });
    res.json(updated);
  });

  // ── EXERCISES ────────────────────────────────────────────────────────────
  app.get("/api/exercises", (req, res) => {
    const { muscleGroup, equipment, goal, search } = req.query as Record<string, string>;
    const exercises = storage.getExercises({ muscleGroup, equipment, goal, search });
    res.json(exercises);
  });

  app.post("/api/exercises", (req, res) => {
    const user = storage.getUser(req.userId);
    const parsed = insertExerciseSchema.safeParse({ ...req.body, isCustom: 1, userId: user?.id });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const ex = storage.createExercise(parsed.data);
    res.status(201).json(ex);
  });

  app.delete("/api/exercises/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const ex = storage.getExercise(id);
    if (!ex || !ex.isCustom) return res.status(403).json({ message: "Can only delete custom exercises" });
    storage.deleteExercise(id);
    res.json({ ok: true });
  });

  // ── EXERCISE LOGS & PR ──────────────────────────────────────────────────
  // GET /api/exercises/:id/logs  — all sessions logged for this exercise
  app.get("/api/exercises/:id/logs", (req, res) => {
    const exerciseId = parseInt(req.params.id);
    const user = storage.getUser(req.userId);
    if (!user) return res.json([]);
    const logs = storage.getExerciseLogs(exerciseId, user.id);
    res.json(logs);
  });

  // POST /api/exercises/:id/logs  — log a new training session for this exercise
  app.post("/api/exercises/:id/logs", exerciseLogLimiter, (req, res) => {
    const exerciseId = parseInt(req.params.id);
    const user = storage.getUser(req.userId);
    if (!user) return res.status(401).json({ message: "No user" });

    const { sets, date } = req.body;
    if (!sets || !Array.isArray(sets) || sets.length === 0) {
      return res.status(400).json({ message: "sets must be a non-empty array" });
    }

    // Validate each set: weight and reps must be positive finite numbers
    const validSets = (sets as any[]).filter(s =>
      Number.isFinite(Number(s.weight)) && Number(s.weight) > 0 &&
      Number.isInteger(Number(s.reps))  && Number(s.reps)   > 0 && Number(s.reps) <= 100
    );
    if (validSets.length === 0)
      return res.status(400).json({ message: "No valid sets — weight and reps must be positive numbers" });

    const logDate = date ?? new Date().toISOString().split("T")[0];

    const log = storage.createExerciseLog({
      exerciseId,
      userId: user.id,
      date: logDate,
      sets: JSON.stringify(validSets),
      createdAt: new Date().toISOString(),
    });

    // Compute best set in this session and upsert PR
    const bestSet = (validSets as { weight: number; reps: number }[]).reduce((best, s) => {
      const vol = s.weight * s.reps;
      const bestVol = best.weight * best.reps;
      return vol > bestVol || (vol === bestVol && s.weight > best.weight) ? s : best;
    });
    const pr = storage.upsertExercisePr(exerciseId, user.id, bestSet.weight, bestSet.reps, logDate);
    const isNewPr = pr.achievedAt === logDate;

    res.status(201).json({ log, pr, isNewPr });
  });

  // GET /api/exercises/:id/pr  — current personal record for this exercise
  app.get("/api/exercises/:id/pr", (req, res) => {
    const exerciseId = parseInt(req.params.id);
    const user = storage.getUser(req.userId);
    if (!user) return res.json(null);
    const pr = storage.getExercisePr(exerciseId, user.id);
    res.json(pr ?? null);
  });

  // ── PR WALL ──────────────────────────────────────────────────
  // GET /api/prs  — all PRs for this user, enriched with exercise info and
  //               first-log baseline for improvement percentage calculation
  app.get("/api/prs", (req, res) => {
    const user = storage.getUser(req.userId);
    if (!user) return res.json([]);

    const allPrs  = storage.getAllPrs(user.id);
    const allExercises = storage.getExercises();
    const exerciseMap = new Map(allExercises.map(e => [e.id, e]));

    const enriched = allPrs.map(pr => {
      const exercise = exerciseMap.get(pr.exerciseId);
      if (!exercise) return null;

      // First log: earliest session for this exercise — extract best weight from sets
      const firstLog = storage.getFirstLogForExercise(pr.exerciseId, user.id);
      let firstBestWeight: number | null = null;
      let firstDate: string | null = null;
      let totalSessions = 0;

      if (firstLog) {
        firstDate = firstLog.date;
        const sets = JSON.parse(firstLog.sets) as { weight: number; reps: number }[];
        firstBestWeight = sets.reduce((best, s) => s.weight > best ? s.weight : best, 0);
      }

      // Count total logged sessions for this exercise
      const logs = storage.getExerciseLogs(pr.exerciseId, user.id);
      totalSessions = logs.length;

      // Improvement % from first session best to current PR best weight
      let improvementPct: number | null = null;
      if (firstBestWeight && firstBestWeight > 0 && pr.bestWeight > firstBestWeight) {
        improvementPct = Math.round(((pr.bestWeight - firstBestWeight) / firstBestWeight) * 100);
      } else if (firstBestWeight && pr.bestWeight === firstBestWeight) {
        improvementPct = 0;
      }

      // Milestone badges
      const milestones: string[] = [];
      if (totalSessions === 1) milestones.push("first_log");
      if (improvementPct !== null && improvementPct >= 10)  milestones.push("plus10");
      if (improvementPct !== null && improvementPct >= 25)  milestones.push("plus25");
      if (improvementPct !== null && improvementPct >= 50)  milestones.push("plus50");
      if (improvementPct !== null && improvementPct >= 100) milestones.push("plus100");

      return {
        pr,
        exercise,
        firstBestWeight,
        firstDate,
        totalSessions,
        improvementPct,
        milestones,
      };
    }).filter(Boolean);

    res.json(enriched);
  });

  // ── CHALLENGES ────────────────────────────────────────────────────────────
  app.get("/api/challenges", (req, res) => {
    const challenges = storage.getChallenges();
    const user = storage.getUser(req.userId);
    const withMembers = challenges.map(c => {
      const members = storage.getChallengeMembers(c.id);
      const membership = user ? storage.getMembership(c.id, user.id) : undefined;
      return { ...c, memberCount: members.length, members, membership };
    });
    res.json(withMembers);
  });

  app.post("/api/challenges", (req, res) => {
    const user = storage.getUser(req.userId);
    if (!user) return res.status(401).json({ message: "No user" });
    const parsed = insertChallengeSchema.safeParse({
      ...req.body,
      creatorId: user.id,
      createdAt: new Date().toISOString(),
    });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const challenge = storage.createChallenge(parsed.data);
    // Creator auto-joins
    storage.joinChallenge({ challengeId: challenge.id, userId: user.id, joinedAt: new Date().toISOString(), progress: 0, completed: 0 });
    storage.createFeedEntry({ userId: user.id, type: "challenge_create", payload: JSON.stringify({ challengeId: challenge.id, name: challenge.name, challengeType: challenge.type }), createdAt: new Date().toISOString() });
    res.status(201).json(challenge);
  });

  app.post("/api/challenges/:id/join", (req, res) => {
    const user = storage.getUser(req.userId);
    if (!user) return res.status(401).json({ message: "No user" });
    const challengeId = parseInt(req.params.id);
    const existing = storage.getMembership(challengeId, user.id);
    if (existing) return res.status(409).json({ message: "Already a member" });
    const membership = storage.joinChallenge({ challengeId, userId: user.id, joinedAt: new Date().toISOString(), progress: 0, completed: 0 });
    storage.createFeedEntry({ userId: user.id, type: "challenge_join", payload: JSON.stringify({ challengeId, userName: user.name }), createdAt: new Date().toISOString() });
    res.status(201).json(membership);
  });

  app.patch("/api/challenges/:id/progress", (req, res) => {
    const user = storage.getUser(req.userId);
    if (!user) return res.status(401).json({ message: "No user" });
    const challengeId = parseInt(req.params.id);
    const { progress } = req.body;
    storage.updateMemberProgress(challengeId, user.id, progress);
    if (progress >= 100) {
      const challenge = storage.getChallenge(challengeId);
      storage.createFeedEntry({ userId: user.id, type: "challenge_complete", payload: JSON.stringify({ challengeId, name: challenge?.name, userName: user.name }), createdAt: new Date().toISOString() });
    }
    res.json({ ok: true, progress });
  });

  // ── FEED ─────────────────────────────────────────────────────────────────
  app.get("/api/feed", (req, res) => {
    const user = storage.getUser(req.userId);
    const feed = storage.getFeed(30);
    res.json(feed.map(e => ({ ...e, payload: JSON.parse(e.payload), isOwn: e.userId === user?.id })));
  });

  // ── AI COACH ──────────────────────────────────────────────────────────────
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

  function buildSystemPrompt(user: ReturnType<typeof storage.getUser>): string {
    if (!user) return "You are GritIQ Coach, an expert strength and nutrition coach.";
    const GOAL_NAMES: Record<string, string> = { powerlifting: "Powerlifting/Kraftzuwachs", bodybuilding: "Bodybuilding/Muskelaufbau", weightloss: "Abnehmen/Fettabbau" };
    const WAVE_NAMES = ["10s Wave", "8s Wave", "5s Wave", "3s Wave"];
    const WEEK_NAMES = ["Akkumulation", "Intensivierung", "Realisierung", "Deload"];
    return `You are ATLAS, the GritIQ AI strength coach — direct, evidence-based, and motivating.
Your athlete: ${user.name}, ${user.bodyweight ?? 80}kg bodyweight, goal: ${GOAL_NAMES[user.trainingGoal] ?? user.trainingGoal}.
Current program phase: ${WAVE_NAMES[user.currentWave - 1]}, ${WEEK_NAMES[user.currentWeek - 1]} (Wave ${user.currentWave}/4, Week ${user.currentWeek}/4).
Current 1RMs: Squat ${user.squatMax}kg, Bench ${user.benchMax}kg, Deadlift ${user.deadliftMax}kg, OHP ${user.ohpMax}kg.
Training maxes (90%): SQ ${(user.squatMax * 0.9).toFixed(1)}kg, BP ${(user.benchMax * 0.9).toFixed(1)}kg, DL ${(user.deadliftMax * 0.9).toFixed(1)}kg, OHP ${(user.ohpMax * 0.9).toFixed(1)}kg.
Give specific, actionable advice tailored to this athlete. Reference their actual numbers when relevant.
Keep responses concise (2-4 paragraphs max). Use evidence-based recommendations.
Speak in the language the user writes in (German or English — match their language).`;
  }

  app.get("/api/coach/messages", (req, res) => {
    const user = storage.getUser(req.userId);
    if (!user) return res.json([]);
    res.json(storage.getAiMessages(user.id, 100));
  });

  app.post("/api/coach/chat", chatLimiter, async (req, res) => {
    const user = storage.getUser(req.userId);
    if (!user) return res.status(401).json({ message: "No user" });
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: "Empty message" });

    // ── Feature Gate: ATLAS is limited to 5 messages/month for Free users ──
    if (!user.isPro) {
      // Reset counter if month has changed
      const now = new Date();
      const resetAt = user.atlasResetAt ? new Date(user.atlasResetAt) : null;
      const sameMonth = resetAt &&
        resetAt.getMonth() === now.getMonth() &&
        resetAt.getFullYear() === now.getFullYear();

      const used = sameMonth ? (user.atlasMessagesThisMonth ?? 0) : 0;

      if (used >= 5) {
        return res.status(402).json({
          message: "limit_reached",
          used,
          limit: 5,
        });
      }

      // Increment counter
      storage.updateUser(user.id, {
        atlasMessagesThisMonth: used + 1,
        atlasResetAt: sameMonth ? user.atlasResetAt! : now.toISOString().slice(0, 10),
      });
    }

    // Save user message
    storage.createAiMessage({ userId: user.id, role: "user", content: message, createdAt: new Date().toISOString() });

    // Build context from last 20 messages
    const history = storage.getAiMessages(user.id, 20);
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: buildSystemPrompt(user) },
      ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: openaiMessages,
        max_tokens: 600,
        temperature: 0.7,
      });
      const reply = completion.choices[0]?.message?.content ?? "Entschuldigung, ich konnte keine Antwort generieren.";
      storage.createAiMessage({ userId: user.id, role: "assistant", content: reply, createdAt: new Date().toISOString() });
      res.json({ reply });
    } catch (err: any) {
      console.error("OpenAI error:", err.message);
      // Distinguish key/auth errors from transient errors
      const isKeyError = err.status === 401 || err.message?.includes('Incorrect API key') || err.message?.includes('invalid_api_key');
      if (isKeyError) {
        return res.status(503).json({ message: "atlas_key_invalid", detail: "OpenAI API key is not configured correctly. Please contact support." });
      }
      res.status(500).json({ message: "AI-Coach nicht erreichbar. Bitte versuche es erneut." });
    }
  });

  app.post("/api/coach/insights", insightsLimiter, async (req, res) => {
    const user = storage.getUser(req.userId);
    if (!user) return res.json({ insights: [] });

    const analytics = getAnalyticsData(user.id);
    const recentSessions = analytics.slice(-6);
    const sessionSummary = recentSessions.map(s =>
      `${s.date} ${s.lift}: rpe=${s.avgRpe?.toFixed(1) ?? "n/a"}, amrap=${s.amrapReps ?? "n/a"}, readiness=${s.readinessScore ?? "n/a"}`
    ).join("\n");

    const prompt = `Based on this athlete's recent training data, generate 2-3 short, specific proactive insights (each max 1 sentence). Return as JSON array of strings.

Athlete: ${user.name}, ${user.trainingGoal}, Wave ${user.currentWave} Week ${user.currentWeek}
Recent sessions:\n${sessionSummary || "No sessions yet"}

Return ONLY valid JSON like: ["Insight 1", "Insight 2"]`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.6,
        response_format: { type: "json_object" },
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw);
      const insights: string[] = Array.isArray(parsed) ? parsed : (parsed.insights ?? parsed.data ?? []);
      res.json({ insights });
    } catch (err) {
      res.json({ insights: [] });
    }
  });

  app.delete("/api/coach/messages", (req, res) => {
    const user = storage.getUser(req.userId);
    if (user) storage.clearAiMessages(user.id);
    res.json({ ok: true });
  });

  // ── RESET (delete user + all data to re-trigger onboarding) ────────────
  app.delete("/api/user", deleteAccountLimiter, (req, res) => {
    const user = storage.getUser(req.userId);
    if (req.body?.confirm !== "DELETE_MY_DATA") {
      return res.status(400).json({ message: "Confirmation token required" });
    }
    if (!user) return res.json({ ok: true, message: "No user to delete" });
    storage.deleteUser(user.id);
    res.json({ ok: true });
  });

  // ── ANALYTICS ───────────────────────────────────────────────────────────────────
  app.get("/api/analytics", analyticsLimiter, (req, res) => {
    const user = storage.getUser(req.userId);
    if (!user) return res.json({ sessions: [], lifts: [], overreachFlags: [] });

    const raw = getAnalyticsData(user.id);

    // Group by lift
    const LIFTS = ["squat", "bench", "deadlift", "ohp"] as const;
    const byLift: Record<string, typeof raw> = {};
    for (const lift of LIFTS) byLift[lift] = raw.filter(s => s.lift === lift);

    // Overreach flag: RPE spike (>= +1.5 vs rolling avg of prev 2) without perf gain
    const overreachFlags: { sessionId: number; date: string; lift: string; wave: number; week: number; reason: string }[] = [];

    for (const lift of LIFTS) {
      const liftData = byLift[lift];
      for (let i = 2; i < liftData.length; i++) {
        const cur = liftData[i];
        const prev = liftData.slice(Math.max(0, i - 2), i);
        const prevAvgRpe = prev.filter(s => s.avgRpe !== null).reduce((a, s) => a + s.avgRpe!, 0) / prev.length;
        const prevAvgPerf = prev.filter(s => s.performanceRatio !== null).reduce((a, s) => a + s.performanceRatio!, 0) / prev.length;

        const rpeSpike = cur.avgRpe !== null && prevAvgRpe > 0 && (cur.avgRpe - prevAvgRpe) >= 1.5;
        const noPerfGain = cur.performanceRatio !== null && prevAvgPerf > 0 && cur.performanceRatio <= prevAvgPerf * 1.02;

        if (rpeSpike && noPerfGain) {
          overreachFlags.push({
            sessionId: cur.sessionId,
            date: cur.date,
            lift,
            wave: cur.wave,
            week: cur.week,
            reason: `RPE +${(cur.avgRpe! - prevAvgRpe).toFixed(1)} vs. Vorschnitt, Leistung stagniert (${(cur.performanceRatio! * 100).toFixed(0)}% Ziel)`,
          });
        }
      }
    }

    res.json({ sessions: raw, byLift, overreachFlags, userMaxes: {
      squat: user.squatMax, bench: user.benchMax, deadlift: user.deadliftMax, ohp: user.ohpMax,
    }});
  });

  // ── GL SCORE HISTORY ──────────────────────────────────────────────────────────

  /**
   * GET /api/gl-score-history
   * Returns the user's IPF GL (Goodlift) score progression across the 16-week
   * Juggernaut program. Each of the 16 program positions (wave 1-4 × week 1-4)
   * is given an estimated GL score by back-calculating earlier 1RMs from the
   * current maxes using the known Juggernaut wave progression (~2.5% per wave).
   * Completed sessions are overlaid as real data points.
   *
   * Response shape:
   * {
   *   currentScore: number,        // GL score right now
   *   currentTotal: number,        // SQ+BP+DL in kg
   *   bodyweight: number | null,
   *   gender: string,
   *   programWeek: number,         // 1-16 (current position)
   *   percentileLabel: string,     // human-readable tier
   *   percentile: number,          // 0-100
   *   timeline: Array<{
   *     programWeek: number,       // 1-16
   *     wave: number, week: number,
   *     label: string,
   *     estimatedScore: number,
   *     isCompleted: boolean,
   *     isCurrent: boolean,
   *   }>,
   * }
   */
  app.get("/api/gl-score-history", analyticsLimiter, (req, res) => {
    const user = storage.getUser(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { squatMax, benchMax, deadliftMax, bodyweight, gender, currentWave, currentWeek } = user;
    const sex: "male" | "female" = gender === "female" ? "female" : "male";
    const bw = bodyweight ?? 0;
    const currentTotal = (squatMax ?? 0) + (benchMax ?? 0) + (deadliftMax ?? 0);
    const currentScore = bw >= 30 && currentTotal > 0
      ? Math.round(ipfGl(currentTotal, bw, sex) * 10) / 10
      : 0;

    // ── Percentile thresholds (IPF GL, classic raw, open division) ────────────
    // Based on Open Powerlifting community benchmarks and IPF Golden Standard tiers.
    // Male: Beginner<50, Novice 50-65, Intermediate 65-75, Advanced 75-85,
    //       Elite 85-95, World-class>95
    // Female thresholds are ~10 pts lower per tier due to coefficient scaling.
    type PercentileTier = { minScore: number; label: string; percentile: number };
    const MALE_TIERS: PercentileTier[] = [
      { minScore: 95, label: "Weltklasse (Top 1 %)",        percentile: 99 },
      { minScore: 85, label: "Elite (Top 5 %)",             percentile: 95 },
      { minScore: 75, label: "Wettkampfniveau (Top 15 %)", percentile: 85 },
      { minScore: 65, label: "Fortgeschritten (Top 30 %)", percentile: 70 },
      { minScore: 50, label: "Ambitioniert (Top 50 %)",    percentile: 50 },
      { minScore: 35, label: "Einsteiger (Top 70 %)",      percentile: 30 },
      { minScore:  0, label: "Anfänger",                   percentile: 10 },
    ];
    const FEMALE_TIERS: PercentileTier[] = [
      { minScore: 85, label: "Weltklasse (Top 1 %)",        percentile: 99 },
      { minScore: 75, label: "Elite (Top 5 %)",             percentile: 95 },
      { minScore: 65, label: "Wettkampfniveau (Top 15 %)", percentile: 85 },
      { minScore: 55, label: "Fortgeschritten (Top 30 %)", percentile: 70 },
      { minScore: 42, label: "Ambitioniert (Top 50 %)",    percentile: 50 },
      { minScore: 28, label: "Einsteiger (Top 70 %)",      percentile: 30 },
      { minScore:  0, label: "Anfänger",                   percentile: 10 },
    ];
    const tiers = sex === "female" ? FEMALE_TIERS : MALE_TIERS;
    const tier = tiers.find(t => currentScore >= t.minScore) ?? tiers[tiers.length - 1];

    // ── Build 16-week timeline ─────────────────────────────────────────────────
    // Juggernaut average wave-to-wave progression: ~2.5% per wave on total.
    // Wave 4 = current. Wave 3 = /1.025. Wave 2 = /1.025^2. Wave 1 = /1.025^3.
    // Within a wave, weeks 1-3 are training weeks (score stable), week 4 = deload.
    // We assign a slight week-to-week gain within a wave (0.5% per training week).
    const WEEK_LABELS = ["Akkumulation", "Intensivierung", "Realisierung", "Deload"];
    const WAVE_LABELS = ["10s Wave", "8s Wave", "5s Wave", "3s Wave"];

    const currentProgramWeek = (currentWave - 1) * 4 + currentWeek; // 1-16

    const timeline = [];
    for (let w = 1; w <= 4; w++) {
      // Back-calculate wave total: each wave adds ~2.5% vs the previous
      const wavesBack = 4 - w; // how many waves ago
      const waveFactor = Math.pow(1 / 1.025, wavesBack);
      const waveTotal = currentTotal * waveFactor;

      for (let wk = 1; wk <= 4; wk++) {
        const programWeek = (w - 1) * 4 + wk;
        // Within-wave progression: Deload (week 4) = slight dip back
        let weekFactor: number;
        if (wk === 4) weekFactor = 0.98;        // deload — small drop
        else          weekFactor = 1 + (wk - 1) * 0.005; // +0%, +0.5%, +1%

        const estTotal = waveTotal * weekFactor;
        const estScore = bw >= 30 && estTotal > 0
          ? Math.round(ipfGl(estTotal, bw, sex) * 10) / 10
          : 0;

        const isProgramWeekCompleted = programWeek < currentProgramWeek;
        const isCurrent = programWeek === currentProgramWeek;

        timeline.push({
          programWeek,
          wave: w,
          week: wk,
          label: `${WAVE_LABELS[w - 1]} · ${WEEK_LABELS[wk - 1]}`,
          shortLabel: `W${w}/${wk}`,
          estimatedScore: estScore,
          isCompleted: isProgramWeekCompleted,
          isCurrent,
        });
      }
    }

    res.json({
      currentScore,
      currentTotal,
      bodyweight: bw || null,
      gender,
      programWeek: currentProgramWeek,
      percentileLabel: tier.label,
      percentile: tier.percentile,
      timeline,
    });
  });

    // ── LEADERBOARD ──────────────────────────────────────────────────────────────

  // GET /api/leaderboard?metric=wilks2|ipfgl
  app.get("/api/leaderboard", analyticsLimiter, (req, res) => {
    const metric = (req.query.metric as string) === "ipfgl" ? "ipfgl" : "wilks2";
    const me = storage.getUser(req.userId);
    if (!me) return res.status(404).json({ message: "User not found" });

    const allUsers = storage.getAllUsers();

    type ScoredEntry = {
      userId: number; displayName: string | null; visibility: string;
      score: number; totalKg: number; bodyweight: number | null; gender: string;
      squatMax: number; benchMax: number; deadliftMax: number;
    };

    const scored: ScoredEntry[] = allUsers
      .map((u) => {
        const scores = calculateScores(u.squatMax, u.benchMax, u.deadliftMax, u.bodyweight, u.gender);
        return {
          userId: u.id, displayName: u.name,
          visibility: (u as any).leaderboardVisibility ?? "hidden",
          score: metric === "ipfgl" ? scores.ipfGl : scores.wilks2,
          totalKg: scores.totalKg,
          bodyweight: u.bodyweight ?? null, gender: u.gender,
          squatMax: u.squatMax, benchMax: u.benchMax, deadliftMax: u.deadliftMax,
        };
      })
      .filter((u) => u.score > 0)
      .sort((a, b) => b.score - a.score);

    const total = scored.length;

    const rows = scored
      .map((entry, idx) => {
        const rank = idx + 1;
        const isMe = entry.userId === req.userId;
        const percentile = total > 1 ? Math.round(((total - rank) / (total - 1)) * 100) : 100;
        const nextEntry = idx > 0 ? scored[idx - 1] : null;
        const deltaToNext = nextEntry ? Math.round((nextEntry.score - entry.score) * 10) / 10 : 0;
        if (entry.visibility === "hidden" && !isMe) return null;
        return {
          rank, userId: isMe ? entry.userId : null,
          displayName: entry.visibility === "anonymous" && !isMe ? null : entry.displayName,
          isMe, isAnonymous: entry.visibility === "anonymous" && !isMe,
          score: Math.round(entry.score * 10) / 10,
          totalKg: entry.totalKg,
          bodyweight: isMe ? entry.bodyweight : null,
          gender: isMe ? entry.gender : null,
          percentile, deltaToNext,
          squatMax: isMe ? entry.squatMax : null,
          benchMax: isMe ? entry.benchMax : null,
          deadliftMax: isMe ? entry.deadliftMax : null,
        };
      })
      .filter(Boolean);

    // Always include requester's own entry (even if hidden from public list)
    let myEntry = rows.find((r) => r?.isMe) ?? null;
    if (!myEntry) {
      const myIdx = scored.findIndex((u) => u.userId === req.userId);
      if (myIdx >= 0) {
        const entry = scored[myIdx];
        const rank = myIdx + 1;
        const percentile = total > 1 ? Math.round(((total - rank) / (total - 1)) * 100) : 100;
        const nextEntry = myIdx > 0 ? scored[myIdx - 1] : null;
        const deltaToNext = nextEntry ? Math.round((nextEntry.score - entry.score) * 10) / 10 : 0;
        myEntry = {
          rank, userId: entry.userId, displayName: entry.displayName,
          isMe: true, isAnonymous: false,
          score: Math.round(entry.score * 10) / 10, totalKg: entry.totalKg,
          bodyweight: entry.bodyweight, gender: entry.gender,
          percentile, deltaToNext,
          squatMax: entry.squatMax, benchMax: entry.benchMax, deadliftMax: entry.deadliftMax,
        };
      }
    }

    res.json({ metric, totalParticipants: total, publicCount: rows.length, myEntry, entries: rows });
  });

  // PATCH /api/leaderboard/visibility
  app.patch("/api/leaderboard/visibility", (req, res) => {
    const { visibility } = req.body ?? {};
    if (!["public", "anonymous", "hidden"].includes(visibility))
      return res.status(400).json({ message: "visibility must be public | anonymous | hidden" });
    const user = storage.getUser(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const updated = storage.updateUser(user.id, { leaderboardVisibility: visibility });
    res.json({ ok: true, visibility: (updated as any)?.leaderboardVisibility ?? visibility });
  });

  // ── HEAD-TO-HEAD CHALLENGES ─────────────────────────────────────────────────

  // Helper: take a fresh snapshot from user's current 1RM + bodyweight
  function takeH2hSnapshot(challengeId: number, userId: number, weekNumber: number) {
    const u = storage.getUser(userId);
    if (!u) return null;
    const scores = calculateScores(
      u.squatMax ?? 0, u.benchMax ?? 0, u.deadliftMax ?? 0,
      u.bodyweight, u.gender ?? "male"
    );
    return storage.createH2hSnapshot({
      challengeId,
      userId,
      weekNumber,
      squatMax: u.squatMax ?? 0,
      benchMax: u.benchMax ?? 0,
      deadliftMax: u.deadliftMax ?? 0,
      bodyweight: u.bodyweight ?? null,
      wilks2: scores.wilks2,
      ipfGl: scores.ipfGl,
      recordedAt: new Date().toISOString(),
    });
  }

  // Helper: compute current week number within challenge (0 = before start)
  function currentWeek(startDate: string | null): number {
    if (!startDate) return 0;
    const diffMs = Date.now() - new Date(startDate).getTime();
    if (diffMs < 0) return 0;
    return Math.min(4, Math.ceil(diffMs / (7 * 86400000)));
  }

  // Helper: resolve display name for a user (hide if anonymous on leaderboard, but show in H2H)
  function h2hUserName(userId: number): string {
    const u = storage.getUser(userId);
    return u?.name ?? `Athlet #${userId}`;
  }

  // Helper: attach full enriched data to a challenge
  function enrichH2h(c: any, meId: number) {
    const snapshots = storage.getH2hSnapshots(c.id);
    const week = currentWeek(c.startDate);
    const challengerSnaps = snapshots.filter(s => s.userId === c.challengerId);
    const opponentSnaps   = snapshots.filter(s => s.userId === c.opponentId);
    const baseline = (snaps: typeof challengerSnaps) => snaps.find(s => s.weekNumber === 0);
    const latest   = (snaps: typeof challengerSnaps) => [...snaps].sort((a,b) => b.weekNumber - a.weekNumber)[0];

    function delta(snaps: typeof challengerSnaps, metric: string): number {
      const base = baseline(snaps);
      const last = latest(snaps);
      if (!base || !last) return 0;
      const bVal = metric === "wilks2" ? base.wilks2 : base.ipfGl;
      const lVal = metric === "wilks2" ? last.wilks2  : last.ipfGl;
      if (bVal === 0) return 0;
      return Math.round(((lVal - bVal) / bVal) * 1000) / 10; // % with 1 decimal
    }

    function weeklyProgress(snaps: typeof challengerSnaps, metric: string) {
      const base = baseline(snaps);
      const baseVal = base ? (metric === "wilks2" ? base.wilks2 : base.ipfGl) : 0;
      return [1,2,3,4].map(w => {
        const snap = snaps.find(s => s.weekNumber === w);
        if (!snap || baseVal === 0) return null;
        const val = metric === "wilks2" ? snap.wilks2 : snap.ipfGl;
        return Math.round(((val - baseVal) / baseVal) * 1000) / 10;
      });
    }

    return {
      ...c,
      currentWeek: week,
      challengerName: h2hUserName(c.challengerId),
      opponentName:   h2hUserName(c.opponentId),
      isChallenger: c.challengerId === meId,
      myDelta:    c.challengerId === meId ? delta(challengerSnaps, c.metric) : delta(opponentSnaps, c.metric),
      theirDelta: c.challengerId === meId ? delta(opponentSnaps, c.metric)   : delta(challengerSnaps, c.metric),
      challengerDelta: delta(challengerSnaps, c.metric),
      opponentDelta:   delta(opponentSnaps, c.metric),
      challengerWeekly: weeklyProgress(challengerSnaps, c.metric),
      opponentWeekly:   weeklyProgress(opponentSnaps, c.metric),
      challengerBaseline: baseline(challengerSnaps),
      opponentBaseline:   baseline(opponentSnaps),
      challengerLatest:   latest(challengerSnaps),
      opponentLatest:     latest(opponentSnaps),
      snapshots,
      winnerName: c.winnerId ? h2hUserName(c.winnerId) : null,
    };
  }

  // POST /api/h2h — initiate a challenge against another leaderboard user
  app.post("/api/h2h", (req, res) => {
    const me = storage.getUser(req.userId);
    if (!me) return res.status(404).json({ message: "User not found" });
    const { opponentId, metric } = req.body ?? {};
    if (!opponentId || !metric || !["wilks2", "ipfgl"].includes(metric))
      return res.status(400).json({ message: "opponentId and metric (wilks2|ipfgl) required" });
    if (opponentId === me.id)
      return res.status(400).json({ message: "Cannot challenge yourself" });
    const opponent = storage.getUser(opponentId);
    if (!opponent) return res.status(404).json({ message: "Opponent not found" });
    // Prevent duplicate active challenges between same two users
    const existing = storage.getH2hChallengesForUser(me.id);
    const dup = existing.find(c =>
      ["pending","active"].includes(c.status) &&
      ((c.challengerId === me.id && c.opponentId === opponentId) ||
       (c.opponentId === me.id && c.challengerId === opponentId))
    );
    if (dup) return res.status(409).json({ message: "Active challenge already exists between these athletes" });
    const challenge = storage.createH2hChallenge({
      challengerId: me.id,
      opponentId,
      metric,
      status: "pending",
      startDate: null,
      endDate: null,
      winnerId: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    });
    res.status(201).json(enrichH2h(challenge, me.id));
  });

  // POST /api/h2h/:id/accept — opponent accepts, baseline snapshots taken
  app.post("/api/h2h/:id/accept", (req, res) => {
    const me = storage.getUser(req.userId);
    if (!me) return res.status(404).json({ message: "User not found" });
    const id = parseInt(req.params.id);
    const challenge = storage.getH2hChallenge(id);
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });
    if (challenge.opponentId !== me.id)
      return res.status(403).json({ message: "Only the opponent can accept" });
    if (challenge.status !== "pending")
      return res.status(400).json({ message: "Challenge is not pending" });
    const startDate = new Date().toISOString().split("T")[0];
    const endDate   = new Date(Date.now() + 28 * 86400000).toISOString().split("T")[0];
    const updated = storage.updateH2hChallenge(id, { status: "active", startDate, endDate });
    // Take baseline snapshots (week 0) for both athletes
    takeH2hSnapshot(id, challenge.challengerId, 0);
    takeH2hSnapshot(id, challenge.opponentId, 0);
    res.json(enrichH2h(updated!, me.id));
  });

  // POST /api/h2h/:id/decline
  app.post("/api/h2h/:id/decline", (req, res) => {
    const me = storage.getUser(req.userId);
    if (!me) return res.status(404).json({ message: "User not found" });
    const id = parseInt(req.params.id);
    const challenge = storage.getH2hChallenge(id);
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });
    if (challenge.opponentId !== me.id && challenge.challengerId !== me.id)
      return res.status(403).json({ message: "Not a participant" });
    storage.updateH2hChallenge(id, { status: "declined" });
    res.json({ ok: true });
  });

  // ── Taunt generator ───────────────────────────────────────────────────────────
  function pickTaunt(
    leaderName: string,
    trailerName: string,
    deltaGap: number,           // leader_delta - trailer_delta in %
    metric: string,
    week: number,
  ): string {
    const metricLabel = metric === "wilks2" ? "Wilks" : "IPF GL";
    const gap = Math.abs(deltaGap).toFixed(1);
    const pool = [
      `${leaderName} liegt ${gap}% vorne — ${trailerName}, der Riemen wird enger! 😈`,
      `${trailerName} schaut auf ${leaderName}'s Rückseite in Woche ${week}. +${gap}% Vorsprung!`,
      `${metricLabel} lügt nicht — ${leaderName} macht gerade einen auf Atlas und trägt die ganze Rangliste. 🏆`,
      `${trailerName}, deine Beine wissen nicht was dein ${metricLabel}-Score weiß. Hol auf!`,
      `+${gap}% Vorsprung für ${leaderName}. Das ist kein Bug, das ist ein Feature! 💪`,
      `${leaderName} macht gerade was ${trailerName} nur träumt — progressiv überladen. 🔥`,
      `Woche ${week}: ${leaderName} führt mit ${gap}% Abstand. Die Hantel schreibt Geschichte!`,
      `${trailerName}, man kann Ausreden nicht snappen — nur 1RMs. ${leaderName} hat das verstanden!`,
      `${leaderName} lädt gerade mehr Scheiben auf als ${trailerName} Ausreden hat. 🤏`,
      `${gap}% Koeffizient-Vorsprung. ${leaderName} spielt Schach, ${trailerName} spielt Jenga mit seinem Ego.`,
    ];
    // Use week + gap hash to pick deterministically per overtake but vary over time
    const idx = (week * 7 + Math.floor(deltaGap * 3)) % pool.length;
    return pool[Math.abs(idx)];
  }

  function pickFinalTaunt(winnerName: string, loserName: string, metric: string): string {
    const m = metric === "wilks2" ? "Wilks" : "IPF GL";
    const pool = [
      `Duell abgeschlossen! ${winnerName} gewinnt — ${m} hat entschieden. Respekt ans Eisen! 🏆`,
      `${loserName} kämpfte gut, aber ${winnerName}'s Koeffizient sagt: nicht gut genug. 😈`,
      `4 Wochen, ein Sieger: ${winnerName}. Der ${m}-Score lügt nicht. Zeit für Revanche?`,
    ];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // POST /api/h2h/:id/snapshot — record this week's progress + overtake detection
  app.post("/api/h2h/:id/snapshot", (req, res) => {
    const me = storage.getUser(req.userId);
    if (!me) return res.status(404).json({ message: "User not found" });
    const id = parseInt(req.params.id);
    const challenge = storage.getH2hChallenge(id);
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });
    if (challenge.challengerId !== me.id && challenge.opponentId !== me.id)
      return res.status(403).json({ message: "Not a participant" });
    if (challenge.status !== "active")
      return res.status(400).json({ message: "Challenge is not active" });
    const week = currentWeek(challenge.startDate);
    if (week < 1 || week > 4)
      return res.status(400).json({ message: "No active week to snapshot" });

    // Capture delta BEFORE this snapshot to detect overtakes
    const snapsBefore = storage.getH2hSnapshots(id);
    const cSnapsBefore = snapsBefore.filter(s => s.userId === challenge.challengerId);
    const oSnapsBefore = snapsBefore.filter(s => s.userId === challenge.opponentId);
    const deltaCalc = (snaps: typeof cSnapsBefore, m: string) => {
      const base = snaps.find(s => s.weekNumber === 0);
      const last = [...snaps].sort((a,b) => b.weekNumber - a.weekNumber)[0];
      if (!base || !last) return 0;
      const bVal = m === "wilks2" ? base.wilks2 : base.ipfGl;
      const lVal = m === "wilks2" ? last.wilks2  : last.ipfGl;
      if (bVal === 0) return 0;
      return ((lVal - bVal) / bVal) * 100;
    };
    const cDeltaBefore = deltaCalc(cSnapsBefore, challenge.metric);
    const oDeltaBefore = deltaCalc(oSnapsBefore, challenge.metric);
    // Who was leading before?
    const leaderBefore = cDeltaBefore >= oDeltaBefore ? challenge.challengerId : challenge.opponentId;

    // Take the new snapshot
    const snapshot = takeH2hSnapshot(id, me.id, week);

    // Re-evaluate deltas after snapshot
    const snapsAfter  = storage.getH2hSnapshots(id);
    const cSnapsAfter = snapsAfter.filter(s => s.userId === challenge.challengerId);
    const oSnapsAfter = snapsAfter.filter(s => s.userId === challenge.opponentId);
    const cDeltaAfter = deltaCalc(cSnapsAfter, challenge.metric);
    const oDeltaAfter = deltaCalc(oSnapsAfter, challenge.metric);
    const leaderAfter = cDeltaAfter >= oDeltaAfter ? challenge.challengerId : challenge.opponentId;

    // Determine opponent id (the other participant)
    const opponentId = me.id === challenge.challengerId ? challenge.opponentId : challenge.challengerId;
    const myName    = me.name ?? "Athlet";
    const theirName = h2hUserName(opponentId);

    let tauntsCreated: any[] = [];

    // ── Milestone: week snapshot ──
    storage.createH2hEvent({
      challengeId: id,
      fromUserId: null,
      toUserId: null,
      type: "milestone",
      message: `${myName} hat Woche-${week}-Snapshot erfasst — ${challenge.metric === "wilks2" ? "Wilks" : "IPF GL"}: ${snapshot ? (challenge.metric === "wilks2" ? snapshot.wilks2 : snapshot.ipfGl) : "?"} Punkte`,
      readAt: null,
      createdAt: new Date().toISOString(),
    });

    // ── Overtake detection ──
    const bothHaveData = cSnapsAfter.some(s => s.weekNumber > 0) && oSnapsAfter.some(s => s.weekNumber > 0);
    if (bothHaveData && leaderBefore !== leaderAfter) {
      // An overtake just happened!
      const leaderName  = h2hUserName(leaderAfter);
      const trailerName = h2hUserName(leaderAfter === challenge.challengerId ? challenge.opponentId : challenge.challengerId);
      const trailerUserId = leaderAfter === challenge.challengerId ? challenge.opponentId : challenge.challengerId;
      const leaderUserId  = leaderAfter;
      const gap = Math.abs(cDeltaAfter - oDeltaAfter);
      const taunMsg = pickTaunt(leaderName, trailerName, gap, challenge.metric, week);
      const taunt = storage.createH2hEvent({
        challengeId: id,
        fromUserId: leaderUserId,
        toUserId: trailerUserId,
        type: "taunt",
        message: taunMsg,
        readAt: null,
        createdAt: new Date().toISOString(),
      });
      tauntsCreated.push(taunt);
    } else if (bothHaveData) {
      // Same leader, but snapshot updated — send a progress taunt if gap widened by >1%
      const gapBefore = Math.abs(cDeltaBefore - oDeltaBefore);
      const gapAfter  = Math.abs(cDeltaAfter - oDeltaAfter);
      if (gapAfter - gapBefore >= 1.0) {
        const leaderName  = h2hUserName(leaderAfter);
        const trailerUserId = leaderAfter === challenge.challengerId ? challenge.opponentId : challenge.challengerId;
        const leaderUserId  = leaderAfter;
        const trailerName = h2hUserName(trailerUserId);
        const taunMsg = pickTaunt(leaderName, trailerName, gapAfter, challenge.metric, week);
        const taunt = storage.createH2hEvent({
          challengeId: id,
          fromUserId: leaderUserId,
          toUserId: trailerUserId,
          type: "taunt",
          message: taunMsg,
          readAt: null,
          createdAt: new Date().toISOString(),
        });
        tauntsCreated.push(taunt);
      }
    }

    // Auto-complete at end of week 4
    let completedChallenge: any = null;
    if (week === 4) {
      const cW4 = cSnapsAfter.some(s => s.weekNumber === 4);
      const oW4 = oSnapsAfter.some(s => s.weekNumber === 4);
      if (cW4 && oW4) {
        const winnerId = cDeltaAfter >= oDeltaAfter ? challenge.challengerId : challenge.opponentId;
        const loserId  = winnerId === challenge.challengerId ? challenge.opponentId : challenge.challengerId;
        completedChallenge = storage.updateH2hChallenge(id, {
          status: "completed",
          winnerId,
          completedAt: new Date().toISOString(),
        });
        // Final milestone event
        const finalMsg = pickFinalTaunt(h2hUserName(winnerId), h2hUserName(loserId), challenge.metric);
        storage.createH2hEvent({
          challengeId: id,
          fromUserId: null,
          toUserId: loserId,
          type: "milestone",
          message: finalMsg,
          readAt: null,
          createdAt: new Date().toISOString(),
        });
      }
    }

    res.json({ ok: true, snapshot, week, taunts: tauntsCreated, completed: !!completedChallenge });
  });

  // GET /api/h2h — list all challenges for the current user
  app.get("/api/h2h", (req, res) => {
    const me = storage.getUser(req.userId);
    if (!me) return res.status(404).json({ message: "User not found" });
    const challenges = storage.getH2hChallengesForUser(me.id);
    res.json(challenges.map(c => enrichH2h(c, me.id)));
  });

  // GET /api/h2h/:id — single challenge detail
  app.get("/api/h2h/:id", (req, res) => {
    const me = storage.getUser(req.userId);
    if (!me) return res.status(404).json({ message: "User not found" });
    const id = parseInt(req.params.id);
    const challenge = storage.getH2hChallenge(id);
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });
    if (challenge.challengerId !== me.id && challenge.opponentId !== me.id)
      return res.status(403).json({ message: "Not a participant" });
    res.json(enrichH2h(challenge, me.id));
  });

  // GET /api/h2h/:id/events — event feed for a challenge (taunts + milestones)
  app.get("/api/h2h/:id/events", (req, res) => {
    const me = storage.getUser(req.userId);
    if (!me) return res.status(404).json({ message: "User not found" });
    const id = parseInt(req.params.id);
    const challenge = storage.getH2hChallenge(id);
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });
    if (challenge.challengerId !== me.id && challenge.opponentId !== me.id)
      return res.status(403).json({ message: "Not a participant" });
    // Mark events addressed to me as read
    storage.markH2hEventsRead(id, me.id);
    const events = storage.getH2hEventsByChallenge(id);
    res.json(events);
  });

  // POST /api/h2h/:id/react — send a preset comeback reaction
  app.post("/api/h2h/:id/react", (req, res) => {
    const me = storage.getUser(req.userId);
    if (!me) return res.status(404).json({ message: "User not found" });
    const id = parseInt(req.params.id);
    const challenge = storage.getH2hChallenge(id);
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });
    if (challenge.challengerId !== me.id && challenge.opponentId !== me.id)
      return res.status(403).json({ message: "Not a participant" });
    const { message } = req.body ?? {};
    if (!message || typeof message !== "string" || message.length > 300)
      return res.status(400).json({ message: "message required (max 300 chars)" });
    const recipientId = me.id === challenge.challengerId ? challenge.opponentId : challenge.challengerId;
    const event = storage.createH2hEvent({
      challengeId: id,
      fromUserId: me.id,
      toUserId: recipientId,
      type: "reaction",
      message,
      readAt: null,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(event);
  });

  // GET /api/h2h/unread — count of unread taunt+reaction events for current user
  app.get("/api/h2h/unread", (req, res) => {
    const me = storage.getUser(req.userId);
    if (!me) return res.status(404).json({ message: "User not found" });
    const unread = storage.getUnreadH2hEvents(me.id);
    res.json({ count: unread.length, events: unread.filter(e => e.type !== "milestone") });
  });

  // ── REFERRALS ──────────────────────────────────────────────────────────────

  // Deterministic code generator: NAME-XXXX (uppercase, no ambiguous chars)
  function generateReferralCode(name: string): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
    const slug = name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "USER";
    const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `${slug}-${suffix}`;
  }

  // GET /api/referral — returns (or lazily creates) the user's referral code + stats
  app.get("/api/referral", (req, res) => {
    let user = storage.getUser(req.userId);
    if (!user) return res.status(404).json({ message: "No user" });

    // Lazily generate referral code on first request
    if (!user.referralCode) {
      let code: string;
      // Retry until unique (collision is astronomically unlikely but be safe)
      let attempts = 0;
      do {
        code = generateReferralCode(user.name);
        attempts++;
      } while (storage.getUserByReferralCode(code) && attempts < 10);

      user = storage.updateUser(user.id, { referralCode: code }) ?? user;
    }

    const referrals = storage.getReferralsByReferrer(user.id);
    const pending  = referrals.filter(r => r.status === "pending").length;
    const rewarded = referrals.filter(r => r.status === "rewarded").length;
    const bonusDaysEarned = referrals
      .filter(r => r.status === "rewarded")
      .reduce((sum, r) => sum + r.bonusDays, 0);

    // ── Reward tier progression ──────────────────────────────────────
    const TIERS = [
      { id: "bronze",   label: "Bronze",   requiredConversions: 1,  bonusDays: 30,  emoji: "🥉" },
      { id: "silver",   label: "Silber",   requiredConversions: 3,  bonusDays: 90,  emoji: "🥈" },
      { id: "gold",     label: "Gold",     requiredConversions: 5,  bonusDays: 150, emoji: "🥇" },
      { id: "diamond",  label: "Diamant",  requiredConversions: 10, bonusDays: 300, emoji: "💎" },
    ];

    // Current tier = highest tier whose threshold is met
    let currentTierIdx = -1;
    for (let i = 0; i < TIERS.length; i++) {
      if (rewarded >= TIERS[i].requiredConversions) currentTierIdx = i;
    }
    const currentTier = currentTierIdx >= 0 ? TIERS[currentTierIdx] : null;

    // Next tier = first unmet tier
    const nextTierIdx = currentTierIdx + 1;
    const nextTier = nextTierIdx < TIERS.length ? TIERS[nextTierIdx] : null;

    // Progress toward next tier
    const progressFrom = currentTier?.requiredConversions ?? 0;
    const progressTo   = nextTier?.requiredConversions ?? TIERS[TIERS.length - 1].requiredConversions;
    const progressPct  = nextTier
      ? Math.min(Math.round(((rewarded - progressFrom) / (progressTo - progressFrom)) * 100), 100)
      : 100;
    const conversionsUntilNext = nextTier ? Math.max(nextTier.requiredConversions - rewarded, 0) : 0;

    // Recent referral activity (last 5 rewarded, with approximate date)
    const recentRewarded = referrals
      .filter(r => r.status === "rewarded" && r.rewardedAt)
      .sort((a, b) => (b.rewardedAt! > a.rewardedAt! ? 1 : -1))
      .slice(0, 5)
      .map(r => ({ bonusDays: r.bonusDays, rewardedAt: r.rewardedAt }));

    res.json({
      code: user.referralCode,
      referralUrl: `${APP_URL}?ref=${user.referralCode}`,
      pending,
      rewarded,
      bonusDaysEarned,
      bonusDaysTotal: user.referralBonusDaysTotal ?? 0,
      // Tier data
      tiers: TIERS,
      currentTier,
      nextTier,
      progressPct,
      conversionsUntilNext,
      recentRewarded,
    });
  });

  // POST /api/referral/use — called when a referred user starts checkout
  // Body: { referralCode: string }
  app.post("/api/referral/use", referralLimiter, (req, res) => {
    const { referralCode } = req.body as { referralCode?: string };
    if (!referralCode) return res.status(400).json({ message: "referralCode required" });
    // Validate format before DB lookup (prevents excessively long probe strings)
    if (typeof referralCode !== "string" || !/^[A-Z0-9]+-[A-Z0-9]{4}$/.test(referralCode))
      return res.status(400).json({ message: "Invalid referral code format" });

    const currentUser = storage.getUser(req.userId);
    if (!currentUser) return res.status(404).json({ message: "No user" });

    // Find the referrer
    const referrer = storage.getUserByReferralCode(referralCode);
    if (!referrer) return res.status(404).json({ message: "Invalid referral code" });

    // Don't allow self-referral
    if (referrer.id === currentUser.id) {
      return res.status(400).json({ message: "Cannot refer yourself" });
    }

    // Check if this user already used a referral code
    if (currentUser.referredByCode) {
      return res.status(409).json({ message: "Already used a referral code" });
    }

    // Create the pending referral row
    const referral = storage.createReferral({
      referrerId: referrer.id,
      referredUserId: currentUser.id,
      code: referralCode,
      status: "pending",
      bonusDays: 30,
      createdAt: new Date().toISOString(),
      rewardedAt: null,
    });

    // Mark the current user as referred
    storage.updateUser(currentUser.id, { referredByCode: referralCode });

    res.json({ success: true, referralId: referral.id, referrerName: referrer.name });
  });

  // ── ADMIN: REFERRAL ANALYTICS ─────────────────────────────────────────────
  // GET /api/admin/referral-stats
  // Admin-only: aggregate referral analytics across all users.
  // Guard: only the user with id=10 (Markus / first real account) OR any user
  // whose email matches the hardcoded admin list can access this.
  // Simple token-based admin check — no separate admin role table needed.
  app.get("/api/admin/referral-stats", (req, res) => {
    const caller = storage.getUser(req.userId);
    if (!caller) return res.status(404).json({ message: "No user" });

    // ── Admin guard: hardcoded user IDs that are allowed ──────────────────
    // Extend this list as needed.
    const ADMIN_IDS = [10, 19]; // Markus production accounts
    if (!ADMIN_IDS.includes(caller.id)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    // ── Pull raw data ──────────────────────────────────────────────────────
    const allReferrals = storage.getAllReferrals();

    const allUsers = storage.getAllUsers();
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    // ── Global KPIs ───────────────────────────────────────────────────────
    const total     = allReferrals.length;
    const rewarded  = allReferrals.filter((r: any) => r.status === "rewarded").length;
    const pending   = allReferrals.filter((r: any) => r.status === "pending").length;
    const convRate  = total > 0 ? Math.round((rewarded / total) * 100) : 0;
    const totalBonusDays = allReferrals
      .filter((r: any) => r.status === "rewarded")
      .reduce((s: number, r: any) => s + (r.bonusDays ?? 30), 0);
    const avgBonusDays = rewarded > 0 ? Math.round(totalBonusDays / rewarded) : 0;

    // Time-to-convert: average hours from created_at to rewarded_at
    const convertedWithTime = allReferrals.filter(
      (r: any) => r.status === "rewarded" && r.createdAt && r.rewardedAt
    );
    const avgConvertHours = convertedWithTime.length > 0
      ? Math.round(
          convertedWithTime.reduce((s: number, r: any) => {
            const diff = new Date(r.rewardedAt).getTime() - new Date(r.createdAt).getTime();
            return s + diff / 3_600_000;
          }, 0) / convertedWithTime.length
        )
      : null;

    // ── Per-referrer breakdown ─────────────────────────────────────────────
    const byReferrer = new Map<number, {
      referrerId: number;
      name: string;
      code: string;
      sent: number;
      rewarded: number;
      pending: number;
      bonusDaysEarned: number;
      firstReferralAt: string | null;
      lastReferralAt: string | null;
    }>();

    for (const r of allReferrals as any[]) {
      const uid = r.referrerId;
      if (!byReferrer.has(uid)) {
        const u = userMap.get(uid);
        byReferrer.set(uid, {
          referrerId: uid,
          name: u?.name ?? `User #${uid}`,
          code: r.code,
          sent: 0,
          rewarded: 0,
          pending: 0,
          bonusDaysEarned: 0,
          firstReferralAt: null,
          lastReferralAt: null,
        });
      }
      const row = byReferrer.get(uid)!;
      row.sent++;
      if (r.status === "rewarded") {
        row.rewarded++;
        row.bonusDaysEarned += r.bonusDays ?? 30;
      } else if (r.status === "pending") {
        row.pending++;
      }
      const ts = r.createdAt;
      if (ts) {
        if (!row.firstReferralAt || ts < row.firstReferralAt) row.firstReferralAt = ts;
        if (!row.lastReferralAt  || ts > row.lastReferralAt)  row.lastReferralAt  = ts;
      }
    }

    // Sort leaderboard: rewarded desc, then sent desc
    const leaderboard = Array.from(byReferrer.values())
      .sort((a, b) => b.rewarded - a.rewarded || b.sent - a.sent)
      .map((row, i) => ({ rank: i + 1, ...row,
        convRate: row.sent > 0 ? Math.round((row.rewarded / row.sent) * 100) : 0 }));

    // ── Daily activity (last 30 days) ─────────────────────────────────────
    const now = new Date();
    const dailyActivity: Record<string, { sent: number; rewarded: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dailyActivity[d.toISOString().slice(0, 10)] = { sent: 0, rewarded: 0 };
    }
    for (const r of allReferrals as any[]) {
      const day = r.createdAt?.slice(0, 10);
      if (day && dailyActivity[day]) {
        dailyActivity[day].sent++;
        if (r.status === "rewarded") dailyActivity[day].rewarded++;
      }
    }
    const dailySeries = Object.entries(dailyActivity).map(([date, v]) => ({ date, ...v }));

    res.json({
      kpis: { total, rewarded, pending, convRate, totalBonusDays, avgBonusDays, avgConvertHours },
      leaderboard,
      dailySeries,
    });
  });

  // ── STRIPE / SUBSCRIPTION ────────────────────────────────────────────────

  // GET /api/subscription  — current subscription status for the logged-in user
  app.get("/api/subscription", (req, res) => {
    let user = storage.getUser(req.userId);
    if (!user) return res.status(404).json({ message: "No user" });

    // ── Expiry check for timed Pro access (referral bonus, manual grants) ──
    // If isPro=1 but proExpiresAt is set and already passed, revoke Pro in DB.
    if (user.isPro && user.proExpiresAt) {
      const expired = new Date(user.proExpiresAt) <= new Date();
      if (expired) {
        user = storage.updateUser(user.id, {
          isPro: 0,
          stripeSubscriptionStatus: "expired",
        }) ?? user;
      }
    }

    res.json({
      isPro: !!user.isPro,
      status: user.stripeSubscriptionStatus ?? "none",
      plan: (user as any).stripePlan ?? null,          // "monthly" | "annual" | null
      renewalDate: (user as any).stripeRenewalDate ?? null, // ISO datetime of next renewal
      expiresAt: user.proExpiresAt ?? null,
      atlasUsed: user.atlasMessagesThisMonth ?? 0,
      atlasLimit: !!user.isPro ? null : 5,
    });
  });

  // POST /api/subscription/checkout  — create Stripe Checkout Session
  app.post("/api/subscription/checkout", checkoutLimiter, async (req, res) => {
    if (!stripe) return res.status(503).json({ message: "Stripe not configured. Add STRIPE_SECRET_KEY env variable." });
    if (!STRIPE_PRICE_ID) return res.status(503).json({ message: "STRIPE_PRICE_ID not configured." });
    const billingCycle = (req.body as any).billingCycle === "yearly" ? "yearly" : "monthly";
    const activePriceId = billingCycle === "yearly" ? STRIPE_ANNUAL_PRICE_ID : STRIPE_PRICE_ID;

    const user = storage.getUser(req.userId);
    if (!user) return res.status(404).json({ message: "No user" });

    try {
      // Reuse existing customer if already created
      let customerId = user.stripeCustomerId ?? undefined;
      if (!customerId) {
        const customer = await stripe.customers.create({
          name: user.name,
          metadata: { gritiqUserId: String(user.id) },
        });
        customerId = customer.id;
        storage.updateUser(user.id, { stripeCustomerId: customerId });
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: activePriceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${APP_URL}/#/settings?upgrade=success`,
        cancel_url: `${APP_URL}/#/settings?upgrade=cancelled`,
        allow_promotion_codes: true,
        subscription_data: {
          metadata: { gritiqUserId: String(user.id) },
          trial_period_days: 14, // 14-day free trial (extended for higher conversion)
        },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Stripe checkout error:", err.message);
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/subscription/portal  — Stripe Customer Portal (manage/cancel)
  app.post("/api/subscription/portal", portalLimiter, async (req, res) => {
    if (!stripe) return res.status(503).json({ message: "Stripe not configured." });
    const user = storage.getUser(req.userId);
    if (!user?.stripeCustomerId) return res.status(400).json({ message: "No Stripe customer" });

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${APP_URL}/#/settings`,
      });
      res.json({ url: session.url });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/stripe/webhook  — Stripe sends events here
  // Body parsing: global express.json() runs first (saves raw Buffer to req.rawBody via verify callback).
  // We use req.rawBody for signature verification and req.body (parsed object) for dev mode fallback.
  app.post("/api/stripe/webhook",
    webhookLimiter,
    async (req, res) => {
      if (!stripe) return res.status(503).send("Stripe not configured");

      const sig = req.headers["stripe-signature"] as string;
      let event: Stripe.Event;

      // req.rawBody is the raw Buffer saved by the global express.json() verify callback.
      // We need the raw Buffer for stripe.webhooks.constructEvent signature verification.
      // req.body is the already-parsed JS object (from global express.json()) used in dev mode.
      const rawBuf = (req as any).rawBody as Buffer | undefined;

      try {
        if (STRIPE_WEBHOOK_SECRET && sig && rawBuf) {
          event = stripe.webhooks.constructEvent(rawBuf, sig, STRIPE_WEBHOOK_SECRET);
        } else if (req.body && typeof req.body === "object") {
          // Dev mode without webhook secret — body already parsed by express.json()
          event = req.body as Stripe.Event;
        } else {
          return res.status(400).send("Webhook Error: no usable body");
        }
        // legacy fallback kept for reference (dead code when above branches handle it):
        // JSON.parse(req.body.toString())
      } catch (err: any) {
        console.error("Webhook signature error:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Helper — find user by Stripe customer ID
      const findUser = (customerId: string) =>
        storage.getAllUsers().find((u) => u.stripeCustomerId === customerId);

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const customerId = session.customer as string;
          const user = findUser(customerId);
          if (user) {
            // Fetch the subscription to get plan interval + renewal date
            let plan: "monthly" | "annual" = "monthly";
            let renewalDate: string | null = null;
            let subStatus = "active";
            try {
              const subId = session.subscription as string;
              if (subId && stripe) {
                const sub = await stripe.subscriptions.retrieve(subId);
                const interval = sub.items.data[0]?.price?.recurring?.interval;
                plan = interval === "year" ? "annual" : "monthly";
                renewalDate = new Date(sub.current_period_end * 1000).toISOString();
                subStatus = sub.status; // may be "trialing" if trial started
              }
            } catch (e) { /* non-fatal */ }

            storage.updateUser(user.id, {
              isPro: 1,
              stripeSubscriptionId: session.subscription as string,
              stripeSubscriptionStatus: subStatus,
              proExpiresAt: null,
              stripePlan: plan,
              stripeRenewalDate: renewalDate,
            } as any);

            // ── Referral reward: if this user was referred, reward the referrer ──
            if (user.referredByCode) {
              const referrer = storage.getUserByReferralCode(user.referredByCode);
              if (referrer) {
                // Find the pending referral row
                const allReferrals = storage.getReferralsByReferrer(referrer.id);
                const pendingReferral = allReferrals.find(
                  r => r.referredUserId === user.id && r.status === "pending"
                );

                if (pendingReferral) {
                  // Mark as rewarded
                  storage.updateReferral(pendingReferral.id, {
                    status: "rewarded",
                    rewardedAt: new Date().toISOString(),
                  });

                  // Add 30 days Pro to the referrer
                  const bonusDays = pendingReferral.bonusDays;
                  const newTotal = (referrer.referralBonusDaysTotal ?? 0) + bonusDays;

                  // Extend proExpiresAt by bonusDays
                  // Determine whether the referrer has an active paid Stripe subscription
                  // (not a referral_bonus or expired timed access).
                  const referrerHasActivePaidSub =
                    referrer.isPro &&
                    referrer.stripeSubscriptionStatus !== "referral_bonus" &&
                    referrer.stripeSubscriptionStatus !== "expired" &&
                    !referrer.proExpiresAt; // paid subs have no proExpiresAt

                  // SC-3 FIX: also treat an expired referral_bonus as "free" so we
                  // properly grant new timed access instead of silently dropping the reward.
                  const referrerBonusExpired =
                    referrer.isPro &&
                    referrer.proExpiresAt &&
                    new Date(referrer.proExpiresAt) <= new Date();

                  if (!referrer.isPro || referrerBonusExpired) {
                    // Free user OR expired bonus — grant/extend timed Pro access
                    const now = new Date();
                    const baseDate =
                      referrer.proExpiresAt && new Date(referrer.proExpiresAt) > now
                        ? new Date(referrer.proExpiresAt) // still-active bonus: stack on top
                        : now;                            // expired/none: start fresh from now
                    baseDate.setDate(baseDate.getDate() + bonusDays);
                    storage.updateUser(referrer.id, {
                      isPro: 1,
                      stripeSubscriptionStatus: "referral_bonus",
                      proExpiresAt: baseDate.toISOString(),
                      referralBonusDaysTotal: newTotal,
                    });
                  } else if (referrerHasActivePaidSub) {
                    // Active paid Stripe sub — Stripe handles billing continuity.
                    // Just track the bonus days earned; no proExpiresAt needed.
                    storage.updateUser(referrer.id, {
                      referralBonusDaysTotal: newTotal,
                    });
                  } else {
                    // Catch-all: active referral_bonus with future expiry → stack bonus days
                    const baseDate = new Date(referrer.proExpiresAt!);
                    baseDate.setDate(baseDate.getDate() + bonusDays);
                    storage.updateUser(referrer.id, {
                      proExpiresAt: baseDate.toISOString(),
                      referralBonusDaysTotal: newTotal,
                    });
                  }

                  console.log(`[Referral] Rewarded ${referrer.name} with ${bonusDays} bonus days (referral of user ${user.id})`);
                }
              }
            }
          }
          break;
        }
        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          const user = findUser(sub.customer as string);
          if (user) {
            const active = ["active", "trialing"].includes(sub.status);
            const interval = sub.items.data[0]?.price?.recurring?.interval;
            const plan = interval === "year" ? "annual" : "monthly";
            // Guard: current_period_end may be missing in some Stripe events
            const renewalDate = sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null;
            storage.updateUser(user.id, {
              isPro: active ? 1 : 0,
              stripeSubscriptionStatus: sub.status,
              stripePlan: plan,
              stripeRenewalDate: renewalDate,
              proExpiresAt: active ? null : renewalDate,
            } as any);
          }
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const user = findUser(sub.customer as string);
          if (user) {
            // Guard: current_period_end may be missing in some Stripe events
            const endDate = sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null;
            storage.updateUser(user.id, {
              isPro: 0,
              stripeSubscriptionStatus: "canceled",
              stripeRenewalDate: null,
              proExpiresAt: endDate,
            } as any);
          }
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const user = findUser(invoice.customer as string);
          if (user) {
            storage.updateUser(user.id, { stripeSubscriptionStatus: "past_due" });
          }
          break;
        }
      }

      res.json({ received: true });
    }
  );

  return httpServer;
}
