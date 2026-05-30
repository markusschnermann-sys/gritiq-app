import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, inArray } from "drizzle-orm";
import { users, workoutSessions, sets, exercises, challenges, challengeMembers, feedEntries, aiMessages, exerciseLogs, exercisePrs, referrals as referralsTable, h2hChallenges, h2hSnapshots, h2hEvents } from "@shared/schema";
import type {
  User, InsertUser,
  WorkoutSession, InsertWorkoutSession,
  Set as WorkoutSet, InsertSet,
  Exercise, InsertExercise,
  Challenge, InsertChallenge,
  H2hChallenge, InsertH2hChallenge,
  H2hSnapshot, InsertH2hSnapshot,
  H2hEvent, InsertH2hEvent,
  ChallengeMember, InsertChallengeMember,
  FeedEntry, InsertFeedEntry,
  AiMessage, InsertAiMessage,
  ExerciseLog, InsertExerciseLog,
  ExercisePr, InsertExercisePr,
  Referral, InsertReferral,
} from "@shared/schema";

const sqlite = new Database(process.env.DATABASE_PATH ?? "data.db");
const db = drizzle(sqlite);

// ── Create core tables ────────────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    squat_max REAL NOT NULL,
    bench_max REAL NOT NULL,
    deadlift_max REAL NOT NULL,
    ohp_max REAL NOT NULL,
    current_wave INTEGER NOT NULL DEFAULT 1,
    current_week INTEGER NOT NULL DEFAULT 1,
    program_start_date TEXT NOT NULL,
    training_goal TEXT NOT NULL DEFAULT 'powerlifting',
    gender TEXT NOT NULL DEFAULT 'other',
    age INTEGER,
    bodyweight REAL,
    nutrition_prefs TEXT
  );

  CREATE TABLE IF NOT EXISTS workout_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    lift TEXT NOT NULL,
    wave INTEGER NOT NULL,
    week INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned',
    readiness_score INTEGER,
    sleep_score INTEGER,
    nutrition_score INTEGER,
    motivation_score INTEGER,
    fatigue_score INTEGER,
    session_difficulty INTEGER,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    target_reps INTEGER NOT NULL,
    target_weight REAL NOT NULL,
    actual_reps INTEGER,
    actual_weight REAL,
    rpe REAL,
    rir INTEGER,
    is_amrap INTEGER NOT NULL DEFAULT 0,
    is_completed INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_en TEXT,
    muscle_group TEXT NOT NULL,
    muscle_group_label TEXT NOT NULL,
    equipment TEXT NOT NULL DEFAULT 'barbell',
    movement_type TEXT NOT NULL DEFAULT 'compound',
    tags TEXT NOT NULL DEFAULT '',
    is_custom INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER,
    cues TEXT
  );

  CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    goal TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    is_public INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS challenge_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TEXT NOT NULL,
    progress REAL NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS feed_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ai_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS exercise_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    sets TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS exercise_prs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    best_weight REAL NOT NULL,
    best_reps INTEGER NOT NULL,
    best_volume REAL NOT NULL,
    achieved_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id INTEGER NOT NULL,
    referred_user_id INTEGER,
    code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    bonus_days INTEGER NOT NULL DEFAULT 30,
    created_at TEXT NOT NULL,
    rewarded_at TEXT
  );
`);

// ── Idempotent migrations ─────────────────────────────────────────────────────
const migrations = [
  `ALTER TABLE users ADD COLUMN nutrition_prefs TEXT`,
  `ALTER TABLE users ADD COLUMN training_goal TEXT NOT NULL DEFAULT 'powerlifting'`,
  `ALTER TABLE users ADD COLUMN gender TEXT NOT NULL DEFAULT 'other'`,
  `ALTER TABLE users ADD COLUMN bodyweight REAL`,
  // Stripe / Subscription columns
  `ALTER TABLE users ADD COLUMN is_pro INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN stripe_customer_id TEXT`,
  `ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT`,
  `ALTER TABLE users ADD COLUMN stripe_subscription_status TEXT`,
  `ALTER TABLE users ADD COLUMN pro_expires_at TEXT`,
  `ALTER TABLE users ADD COLUMN stripe_plan TEXT`,
  `ALTER TABLE users ADD COLUMN stripe_renewal_date TEXT`,
  `ALTER TABLE users ADD COLUMN atlas_messages_this_month INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN atlas_reset_at TEXT`,
  // Age
  `ALTER TABLE users ADD COLUMN age INTEGER`,
  // Cycle phase (female users)
  `ALTER TABLE users ADD COLUMN cycle_phase TEXT`,
  // Referral columns
  `ALTER TABLE users ADD COLUMN referral_code TEXT`,
  `ALTER TABLE users ADD COLUMN referred_by_code TEXT`,
  `ALTER TABLE users ADD COLUMN referral_bonus_days_total INTEGER NOT NULL DEFAULT 0`,
  // ── Integrity & performance indexes (idempotent: IF NOT EXISTS) ──
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_prs_unique ON exercise_prs(exercise_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON workout_sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_exercise_user ON exercise_logs(exercise_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_messages_user ON ai_messages(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id)`,
  // Leaderboard privacy column
  `ALTER TABLE users ADD COLUMN leaderboard_visibility TEXT NOT NULL DEFAULT 'hidden'`,
  // Head-to-head challenge tables
  `CREATE TABLE IF NOT EXISTS h2h_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenger_id INTEGER NOT NULL,
    opponent_id INTEGER NOT NULL,
    metric TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    start_date TEXT,
    end_date TEXT,
    winner_id INTEGER,
    created_at TEXT NOT NULL,
    completed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS h2h_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    squat_max REAL NOT NULL,
    bench_max REAL NOT NULL,
    deadlift_max REAL NOT NULL,
    bodyweight REAL,
    wilks2 REAL NOT NULL,
    ipf_gl REAL NOT NULL,
    recorded_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_h2h_challenger ON h2h_challenges(challenger_id)`,
  `CREATE INDEX IF NOT EXISTS idx_h2h_opponent ON h2h_challenges(opponent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_h2h_snapshots_challenge ON h2h_snapshots(challenge_id, user_id)`,
  // H2H events (trash-talk, reactions, milestones)
  `CREATE TABLE IF NOT EXISTS h2h_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id INTEGER NOT NULL,
    from_user_id INTEGER,
    to_user_id INTEGER,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_h2h_events_challenge ON h2h_events(challenge_id)`,
  `CREATE INDEX IF NOT EXISTS idx_h2h_events_recipient ON h2h_events(to_user_id, read_at)`,
  // Calorie cycling preferences (weekly training schedule + cycling mode)
  `ALTER TABLE users ADD COLUMN calorie_cycling_prefs TEXT`,
];
for (const sql of migrations) {
  try { sqlite.exec(sql); } catch {}
}

// ── Seed exercises if empty ───────────────────────────────────────────────────
const exerciseCount = (sqlite.prepare("SELECT COUNT(*) as c FROM exercises WHERE is_custom = 0").get() as any).c;
if (exerciseCount === 0) {
  seedExercises();
}

export interface IStorage {
  getUser(id: number): User | undefined;
  getUserByDefault(): User | undefined;
  getAllUsers(): User[];
  createUser(data: InsertUser): User;
  updateUser(id: number, data: Partial<InsertUser>): User | undefined;
  deleteUser(userId: number): void;

  getSessions(userId: number): WorkoutSession[];
  getSession(id: number): WorkoutSession | undefined;
  createSession(data: InsertWorkoutSession): WorkoutSession;
  updateSession(id: number, data: Partial<InsertWorkoutSession>): WorkoutSession | undefined;
  getSessionsByWaveWeek(userId: number, wave: number, week: number): WorkoutSession[];

  getSet(id: number): WorkoutSet | undefined;
  getSetsForSession(sessionId: number): WorkoutSet[];
  createSet(data: InsertSet): WorkoutSet;
  updateSet(id: number, data: Partial<InsertSet>): WorkoutSet | undefined;
  deleteSet(id: number): void;

  // Exercises
  getExercises(filter?: { muscleGroup?: string; equipment?: string; goal?: string; search?: string }): Exercise[];
  getExercise(id: number): Exercise | undefined;
  createExercise(data: InsertExercise): Exercise;
  deleteExercise(id: number): void;

  // Challenges
  getChallenges(): Challenge[];
  getChallenge(id: number): Challenge | undefined;
  createChallenge(data: InsertChallenge): Challenge;
  updateChallenge(id: number, data: Partial<InsertChallenge>): Challenge | undefined;
  getChallengeMembers(challengeId: number): ChallengeMember[];
  joinChallenge(data: InsertChallengeMember): ChallengeMember;
  updateMemberProgress(challengeId: number, userId: number, progress: number): void;
  getMembership(challengeId: number, userId: number): ChallengeMember | undefined;

  // Feed
  getFeed(limit?: number): FeedEntry[];
  createFeedEntry(data: InsertFeedEntry): FeedEntry;

  // AI Messages
  getAiMessages(userId: number, limit?: number): AiMessage[];
  createAiMessage(data: InsertAiMessage): AiMessage;
  clearAiMessages(userId: number): void;

  // Exercise Logs & PR Tracker
  getExerciseLogs(exerciseId: number, userId: number): ExerciseLog[];
  createExerciseLog(data: InsertExerciseLog): ExerciseLog;
  getExercisePr(exerciseId: number, userId: number): ExercisePr | undefined;
  upsertExercisePr(exerciseId: number, userId: number, weight: number, reps: number, date: string): ExercisePr;
  // PR Wall aggregation
  getAllPrs(userId: number): ExercisePr[];
  getFirstLogForExercise(exerciseId: number, userId: number): ExerciseLog | undefined;

  // Referrals
  getAllReferrals(): Referral[];
  getReferralsByReferrer(referrerId: number): Referral[];
  getReferralByCode(code: string): Referral | undefined;
  createReferral(data: InsertReferral): Referral;
  updateReferral(id: number, data: Partial<InsertReferral>): Referral | undefined;
  getUserByReferralCode(code: string): User | undefined;

  // Head-to-Head challenges
  createH2hChallenge(data: InsertH2hChallenge): H2hChallenge;
  getH2hChallenge(id: number): H2hChallenge | undefined;
  getH2hChallengesForUser(userId: number): H2hChallenge[];
  updateH2hChallenge(id: number, data: Partial<InsertH2hChallenge>): H2hChallenge | undefined;
  createH2hSnapshot(data: InsertH2hSnapshot): H2hSnapshot;
  getH2hSnapshots(challengeId: number): H2hSnapshot[];
  getH2hSnapshot(challengeId: number, userId: number, weekNumber: number): H2hSnapshot | undefined;

  // H2H Events (trash-talk / reactions / milestones)
  createH2hEvent(data: InsertH2hEvent): H2hEvent;
  getH2hEventsByChallenge(challengeId: number): H2hEvent[];
  getUnreadH2hEvents(userId: number): H2hEvent[];
  markH2hEventsRead(challengeId: number, userId: number): void;
}

export const storage: IStorage = {
  // ── Users ──
  getUser(id) { return db.select().from(users).where(eq(users.id, id)).get(); },
  getUserByDefault() { return db.select().from(users).get(); },
  getAllUsers() { return db.select().from(users).all(); },
  createUser(data) { return db.insert(users).values(data).returning().get(); },
  updateUser(id, data) { return db.update(users).set(data).where(eq(users.id, id)).returning().get(); },
  deleteUser(userId) {
    // Cascade: sets → sessions
    const userSessions = db.select({ id: workoutSessions.id }).from(workoutSessions).where(eq(workoutSessions.userId, userId)).all();
    const sessionIds = userSessions.map(s => s.id);
    if (sessionIds.length > 0) db.delete(sets).where(inArray(sets.sessionId, sessionIds)).run();
    db.delete(workoutSessions).where(eq(workoutSessions.userId, userId)).run();
    // Cascade: AI messages, feed, exercise logs & PRs, challenge memberships
    db.delete(aiMessages).where(eq(aiMessages.userId, userId)).run();
    db.delete(feedEntries).where(eq(feedEntries.userId, userId)).run();
    db.delete(exerciseLogs).where(eq(exerciseLogs.userId, userId)).run();
    db.delete(exercisePrs).where(eq(exercisePrs.userId, userId)).run();
    db.delete(challengeMembers).where(eq(challengeMembers.userId, userId)).run();
    // Note: referrals are intentionally preserved for audit trail
    db.delete(users).where(eq(users.id, userId)).run();
  },

  // ── Sessions ──
  getSessions(userId) {
    return db.select().from(workoutSessions).where(eq(workoutSessions.userId, userId)).orderBy(desc(workoutSessions.date)).all();
  },
  getSession(id) { return db.select().from(workoutSessions).where(eq(workoutSessions.id, id)).get(); },
  createSession(data) { return db.insert(workoutSessions).values(data).returning().get(); },
  updateSession(id, data) { return db.update(workoutSessions).set(data).where(eq(workoutSessions.id, id)).returning().get(); },
  getSessionsByWaveWeek(userId, wave, week) {
    return db.select().from(workoutSessions).where(eq(workoutSessions.userId, userId)).all().filter(s => s.wave === wave && s.week === week);
  },

  // ── Sets ──
  getSet(id) { return db.select().from(sets).where(eq(sets.id, id)).get(); },
  getSetsForSession(sessionId) {
    return db.select().from(sets).where(eq(sets.sessionId, sessionId)).all().sort((a, b) => a.setNumber - b.setNumber);
  },
  createSet(data) { return db.insert(sets).values(data).returning().get(); },
  updateSet(id, data) { return db.update(sets).set(data).where(eq(sets.id, id)).returning().get(); },
  deleteSet(id) { db.delete(sets).where(eq(sets.id, id)).run(); },

  // ── Exercises ──
  getExercises(filter) {
    let all = db.select().from(exercises).all();
    if (filter?.muscleGroup) all = all.filter(e => e.muscleGroup === filter.muscleGroup);
    if (filter?.equipment) all = all.filter(e => e.equipment === filter.equipment);
    if (filter?.goal) {
      const g = filter.goal.toLowerCase();
      all = all.filter(e => e.tags.split(",").map(t => t.trim()).includes(g));
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      all = all.filter(e => e.name.toLowerCase().includes(q) || (e.nameEn ?? "").toLowerCase().includes(q));
    }
    return all;
  },
  getExercise(id) { return db.select().from(exercises).where(eq(exercises.id, id)).get(); },
  createExercise(data) { return db.insert(exercises).values(data).returning().get(); },
  deleteExercise(id) { db.delete(exercises).where(eq(exercises.id, id)).run(); },

  // ── Challenges ──
  getChallenges() { return db.select().from(challenges).orderBy(desc(challenges.createdAt)).all(); },
  getChallenge(id) { return db.select().from(challenges).where(eq(challenges.id, id)).get(); },
  createChallenge(data) { return db.insert(challenges).values(data).returning().get(); },
  updateChallenge(id, data) { return db.update(challenges).set(data).where(eq(challenges.id, id)).returning().get(); },
  getChallengeMembers(challengeId) { return db.select().from(challengeMembers).where(eq(challengeMembers.challengeId, challengeId)).all(); },
  joinChallenge(data) { return db.insert(challengeMembers).values(data).returning().get(); },
  updateMemberProgress(challengeId, userId, progress) {
    db.update(challengeMembers)
      .set({ progress, completed: progress >= 100 ? 1 : 0 })
      .where(eq(challengeMembers.challengeId, challengeId))
      .run();
  },
  getMembership(challengeId, userId) {
    return db.select().from(challengeMembers)
      .where(eq(challengeMembers.challengeId, challengeId))
      .all()
      .find(m => m.userId === userId);
  },

  // ── Feed ──
  getFeed(limit = 50) {
    return db.select().from(feedEntries).orderBy(desc(feedEntries.createdAt)).all().slice(0, limit);
  },
  createFeedEntry(data) { return db.insert(feedEntries).values(data).returning().get(); },

  // ── AI Messages ──
  getAiMessages(userId, limit = 50) {
    return db.select().from(aiMessages).where(eq(aiMessages.userId, userId)).orderBy(aiMessages.createdAt).all().slice(-limit);
  },
  createAiMessage(data) { return db.insert(aiMessages).values(data).returning().get(); },
  clearAiMessages(userId) { db.delete(aiMessages).where(eq(aiMessages.userId, userId)).run(); },

  // ── Exercise Logs & PR Tracker ──
  getExerciseLogs(exerciseId, userId) {
    return db.select().from(exerciseLogs)
      .where(eq(exerciseLogs.exerciseId, exerciseId))
      .all()
      .filter(l => l.userId === userId)
      .sort((a, b) => a.date.localeCompare(b.date));
  },
  createExerciseLog(data) {
    return db.insert(exerciseLogs).values(data).returning().get();
  },
  getExercisePr(exerciseId, userId) {
    return db.select().from(exercisePrs)
      .where(eq(exercisePrs.exerciseId, exerciseId))
      .all()
      .find(p => p.userId === userId);
  },
  upsertExercisePr(exerciseId, userId, weight, reps, date) {
    const volume = weight * reps;
    const existing = db.select().from(exercisePrs)
      .where(eq(exercisePrs.exerciseId, exerciseId))
      .all()
      .find(p => p.userId === userId);
    if (existing) {
      // Only update if new log beats the PR (by volume, then weight)
      if (volume > existing.bestVolume || (volume === existing.bestVolume && weight > existing.bestWeight)) {
        return db.update(exercisePrs)
          .set({ bestWeight: weight, bestReps: reps, bestVolume: volume, achievedAt: date })
          .where(eq(exercisePrs.id, existing.id))
          .returning().get()!;
      }
      return existing;
    }
    return db.insert(exercisePrs)
      .values({ exerciseId, userId, bestWeight: weight, bestReps: reps, bestVolume: volume, achievedAt: date })
      .returning().get();
  },

  // ── PR Wall aggregation ──
  getAllPrs(userId) {
    return db.select().from(exercisePrs)
      .all()
      .filter(p => p.userId === userId)
      .sort((a, b) => b.achievedAt.localeCompare(a.achievedAt));
  },
  getFirstLogForExercise(exerciseId, userId) {
    const logs = db.select().from(exerciseLogs)
      .where(eq(exerciseLogs.exerciseId, exerciseId))
      .all()
      .filter(l => l.userId === userId)
      .sort((a, b) => a.date.localeCompare(b.date));
    return logs[0];
  },

  // ── Referrals ──
  getAllReferrals() {
    return db.select().from(referralsTable).all();
  },
  getReferralsByReferrer(referrerId) {
    return db.select().from(referralsTable).where(eq(referralsTable.referrerId, referrerId)).all();
  },
  getReferralByCode(code) {
    return db.select().from(referralsTable).where(eq(referralsTable.code, code)).get();
  },
  createReferral(data) {
    return db.insert(referralsTable).values(data).returning().get();
  },
  updateReferral(id, data) {
    return db.update(referralsTable).set(data).where(eq(referralsTable.id, id)).returning().get();
  },
  getUserByReferralCode(code) {
    return db.select().from(users).where(eq(users.referralCode, code)).get();
  },

  // ── Head-to-Head challenges ──
  createH2hChallenge(data) {
    return db.insert(h2hChallenges).values(data).returning().get();
  },
  getH2hChallenge(id) {
    return db.select().from(h2hChallenges).where(eq(h2hChallenges.id, id)).get();
  },
  getH2hChallengesForUser(userId) {
    // Return challenges where user is challenger or opponent, sorted newest first
    return db.select().from(h2hChallenges)
      .where(inArray(h2hChallenges.challengerId, [userId]))
      .all()
      .concat(
        db.select().from(h2hChallenges)
          .where(inArray(h2hChallenges.opponentId, [userId]))
          .all()
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  updateH2hChallenge(id, data) {
    return db.update(h2hChallenges).set(data).where(eq(h2hChallenges.id, id)).returning().get();
  },
  createH2hSnapshot(data) {
    return db.insert(h2hSnapshots).values(data).returning().get();
  },
  getH2hSnapshots(challengeId) {
    return db.select().from(h2hSnapshots)
      .where(eq(h2hSnapshots.challengeId, challengeId))
      .all()
      .sort((a, b) => a.weekNumber - b.weekNumber);
  },
  getH2hSnapshot(challengeId, userId, weekNumber) {
    return db.select().from(h2hSnapshots)
      .where(eq(h2hSnapshots.challengeId, challengeId))
      .all()
      .find(s => s.userId === userId && s.weekNumber === weekNumber);
  },

  // ── H2H Events ──
  createH2hEvent(data) {
    return db.insert(h2hEvents).values(data).returning().get();
  },
  getH2hEventsByChallenge(challengeId) {
    return db.select().from(h2hEvents)
      .where(eq(h2hEvents.challengeId, challengeId))
      .all()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },
  getUnreadH2hEvents(userId) {
    return db.select().from(h2hEvents)
      .where(eq(h2hEvents.toUserId, userId))
      .all()
      .filter(e => !e.readAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  markH2hEventsRead(challengeId, userId) {
    const now = new Date().toISOString();
    const unread = db.select().from(h2hEvents)
      .where(eq(h2hEvents.challengeId, challengeId))
      .all()
      .filter(e => e.toUserId === userId && !e.readAt);
    for (const e of unread) {
      db.update(h2hEvents).set({ readAt: now }).where(eq(h2hEvents.id, e.id)).run();
    }
  },
};

// ── Analytics helper ──────────────────────────────────────────────────────────
export function getAnalyticsData(userId: number) {
  const completedSessions = db.select().from(workoutSessions).where(eq(workoutSessions.userId, userId)).all().filter(s => s.status === "completed");
  return completedSessions.map(session => {
    const sessionSets = db.select().from(sets).where(eq(sets.sessionId, session.id)).all().filter(s => s.isCompleted);
    const rpeValues = sessionSets.map(s => s.rpe).filter((r): r is number => r !== null && r !== undefined);
    const avgRpe = rpeValues.length > 0 ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : null;
    const amrapSet = sessionSets.find(s => s.isAmrap && s.actualReps !== null);
    const nonAmrap = sessionSets.filter(s => !s.isAmrap);
    const totalActualReps = nonAmrap.reduce((a, s) => a + (s.actualReps ?? s.targetReps ?? 0), 0);
    const totalTargetReps = nonAmrap.reduce((a, s) => a + (s.targetReps ?? 0), 0);
    return {
      sessionId: session.id, date: session.date, lift: session.lift,
      wave: session.wave, week: session.week,
      sessionDifficulty: session.sessionDifficulty ?? null,
      readinessScore: session.readinessScore ?? null,
      fatigueScore: session.fatigueScore ?? null,
      avgRpe, amrapReps: amrapSet?.actualReps ?? null,
      amrapTargetReps: amrapSet?.targetReps ?? null,
      amrapTargetWeight: amrapSet?.targetWeight ?? null,
      totalActualReps, totalTargetReps,
      performanceRatio: totalTargetReps > 0 ? totalActualReps / totalTargetReps : null,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

// ── Exercise seed data ────────────────────────────────────────────────────────
function seedExercises() {
  const data = [
    // CHEST
    { name: "Bankdrücken", nameEn: "Bench Press", muscleGroup: "chest", muscleGroupLabel: "Brust", equipment: "barbell", movementType: "compound", tags: "powerlifting,bodybuilding" },
    { name: "Schrägbankdrücken", nameEn: "Incline Bench Press", muscleGroup: "chest", muscleGroupLabel: "Brust", equipment: "barbell", movementType: "compound", tags: "bodybuilding" },
    { name: "Flachbankdrücken Kurzhantel", nameEn: "Dumbbell Bench Press", muscleGroup: "chest", muscleGroupLabel: "Brust", equipment: "dumbbell", movementType: "compound", tags: "bodybuilding,weightloss" },
    { name: "Schrägbankdrücken Kurzhantel", nameEn: "Incline Dumbbell Press", muscleGroup: "chest", muscleGroupLabel: "Brust", equipment: "dumbbell", movementType: "compound", tags: "bodybuilding" },
    { name: "Butterfly / Fliegende", nameEn: "Chest Fly", muscleGroup: "chest", muscleGroupLabel: "Brust", equipment: "dumbbell", movementType: "isolation", tags: "bodybuilding" },
    { name: "Kabelzug Butterfly", nameEn: "Cable Fly", muscleGroup: "chest", muscleGroupLabel: "Brust", equipment: "cable", movementType: "isolation", tags: "bodybuilding" },
    { name: "Dips (Brust)", nameEn: "Chest Dips", muscleGroup: "chest", muscleGroupLabel: "Brust", equipment: "bodyweight", movementType: "compound", tags: "bodybuilding,weightloss" },
    { name: "Decline Bankdrücken", nameEn: "Decline Bench Press", muscleGroup: "chest", muscleGroupLabel: "Brust", equipment: "barbell", movementType: "compound", tags: "bodybuilding" },
    { name: "Liegestütze", nameEn: "Push-Up", muscleGroup: "chest", muscleGroupLabel: "Brust", equipment: "bodyweight", movementType: "compound", tags: "bodybuilding,weightloss" },
    { name: "Pec Deck", nameEn: "Pec Deck Machine", muscleGroup: "chest", muscleGroupLabel: "Brust", equipment: "machine", movementType: "isolation", tags: "bodybuilding" },

    // BACK
    { name: "Kreuzheben", nameEn: "Deadlift", muscleGroup: "back", muscleGroupLabel: "Rücken", equipment: "barbell", movementType: "compound", tags: "powerlifting,bodybuilding" },
    { name: "Rumänisches Kreuzheben", nameEn: "Romanian Deadlift", muscleGroup: "back", muscleGroupLabel: "Rücken", equipment: "barbell", movementType: "compound", tags: "bodybuilding,weightloss" },
    { name: "Klimmzüge", nameEn: "Pull-Up", muscleGroup: "back", muscleGroupLabel: "Rücken", equipment: "bodyweight", movementType: "compound", tags: "bodybuilding,weightloss" },
    { name: "Latziehen", nameEn: "Lat Pulldown", muscleGroup: "back", muscleGroupLabel: "Rücken", equipment: "cable", movementType: "compound", tags: "bodybuilding,weightloss" },
    { name: "Rudern vorgebeugt", nameEn: "Barbell Row", muscleGroup: "back", muscleGroupLabel: "Rücken", equipment: "barbell", movementType: "compound", tags: "powerlifting,bodybuilding" },
    { name: "Kurzhantelrudern", nameEn: "Dumbbell Row", muscleGroup: "back", muscleGroupLabel: "Rücken", equipment: "dumbbell", movementType: "compound", tags: "bodybuilding" },
    { name: "Kabelrudern", nameEn: "Cable Row", muscleGroup: "back", muscleGroupLabel: "Rücken", equipment: "cable", movementType: "compound", tags: "bodybuilding,weightloss" },
    { name: "T-Bar Rudern", nameEn: "T-Bar Row", muscleGroup: "back", muscleGroupLabel: "Rücken", equipment: "barbell", movementType: "compound", tags: "bodybuilding" },
    { name: "Sumo Kreuzheben", nameEn: "Sumo Deadlift", muscleGroup: "back", muscleGroupLabel: "Rücken", equipment: "barbell", movementType: "compound", tags: "powerlifting" },
    { name: "Rack Pull", nameEn: "Rack Pull", muscleGroup: "back", muscleGroupLabel: "Rücken", equipment: "barbell", movementType: "compound", tags: "powerlifting" },
    { name: "Hyperextension", nameEn: "Back Extension", muscleGroup: "back", muscleGroupLabel: "Rücken", equipment: "machine", movementType: "isolation", tags: "bodybuilding,weightloss" },

    // LEGS
    { name: "Kniebeuge", nameEn: "Squat", muscleGroup: "legs", muscleGroupLabel: "Beine", equipment: "barbell", movementType: "compound", tags: "powerlifting,bodybuilding" },
    { name: "Front Squat", nameEn: "Front Squat", muscleGroup: "legs", muscleGroupLabel: "Beine", equipment: "barbell", movementType: "compound", tags: "powerlifting,bodybuilding" },
    { name: "Hackenschmidt Maschine", nameEn: "Hack Squat", muscleGroup: "legs", muscleGroupLabel: "Beine", equipment: "machine", movementType: "compound", tags: "bodybuilding" },
    { name: "Beinpresse", nameEn: "Leg Press", muscleGroup: "legs", muscleGroupLabel: "Beine", equipment: "machine", movementType: "compound", tags: "bodybuilding,weightloss" },
    { name: "Ausfallschritt", nameEn: "Lunge", muscleGroup: "legs", muscleGroupLabel: "Beine", equipment: "dumbbell", movementType: "compound", tags: "bodybuilding,weightloss" },
    { name: "Bulgarische Kniebeuge", nameEn: "Bulgarian Split Squat", muscleGroup: "legs", muscleGroupLabel: "Beine", equipment: "dumbbell", movementType: "compound", tags: "bodybuilding,weightloss" },
    { name: "Beinstrecker", nameEn: "Leg Extension", muscleGroup: "legs", muscleGroupLabel: "Beine", equipment: "machine", movementType: "isolation", tags: "bodybuilding" },
    { name: "Beinbeuger liegend", nameEn: "Lying Leg Curl", muscleGroup: "legs", muscleGroupLabel: "Beine", equipment: "machine", movementType: "isolation", tags: "bodybuilding" },
    { name: "Beinbeuger sitzend", nameEn: "Seated Leg Curl", muscleGroup: "legs", muscleGroupLabel: "Beine", equipment: "machine", movementType: "isolation", tags: "bodybuilding" },
    { name: "Wadenheben stehend", nameEn: "Standing Calf Raise", muscleGroup: "legs", muscleGroupLabel: "Beine", equipment: "machine", movementType: "isolation", tags: "bodybuilding" },
    { name: "Wadenheben sitzend", nameEn: "Seated Calf Raise", muscleGroup: "legs", muscleGroupLabel: "Beine", equipment: "machine", movementType: "isolation", tags: "bodybuilding" },
    { name: "Goblet Squat", nameEn: "Goblet Squat", muscleGroup: "legs", muscleGroupLabel: "Beine", equipment: "kettlebell", movementType: "compound", tags: "weightloss" },
    { name: "Box Squat", nameEn: "Box Squat", muscleGroup: "legs", muscleGroupLabel: "Beine", equipment: "barbell", movementType: "compound", tags: "powerlifting" },

    // SHOULDERS
    { name: "Schulterdrücken", nameEn: "Overhead Press", muscleGroup: "shoulders", muscleGroupLabel: "Schultern", equipment: "barbell", movementType: "compound", tags: "powerlifting,bodybuilding" },
    { name: "Kurzhantel Schulterdrücken", nameEn: "Dumbbell Shoulder Press", muscleGroup: "shoulders", muscleGroupLabel: "Schultern", equipment: "dumbbell", movementType: "compound", tags: "bodybuilding" },
    { name: "Seitheben", nameEn: "Lateral Raise", muscleGroup: "shoulders", muscleGroupLabel: "Schultern", equipment: "dumbbell", movementType: "isolation", tags: "bodybuilding" },
    { name: "Frontheben", nameEn: "Front Raise", muscleGroup: "shoulders", muscleGroupLabel: "Schultern", equipment: "dumbbell", movementType: "isolation", tags: "bodybuilding" },
    { name: "Kabelseitheben", nameEn: "Cable Lateral Raise", muscleGroup: "shoulders", muscleGroupLabel: "Schultern", equipment: "cable", movementType: "isolation", tags: "bodybuilding" },
    { name: "Arnold Press", nameEn: "Arnold Press", muscleGroup: "shoulders", muscleGroupLabel: "Schultern", equipment: "dumbbell", movementType: "compound", tags: "bodybuilding" },
    { name: "Reverse Fly", nameEn: "Reverse Fly", muscleGroup: "shoulders", muscleGroupLabel: "Schultern", equipment: "dumbbell", movementType: "isolation", tags: "bodybuilding" },
    { name: "Face Pull", nameEn: "Face Pull", muscleGroup: "shoulders", muscleGroupLabel: "Schultern", equipment: "cable", movementType: "isolation", tags: "bodybuilding,powerlifting" },
    { name: "Push Press", nameEn: "Push Press", muscleGroup: "shoulders", muscleGroupLabel: "Schultern", equipment: "barbell", movementType: "compound", tags: "powerlifting" },

    // ARMS - BICEPS
    { name: "Kurzhantel Curl", nameEn: "Dumbbell Curl", muscleGroup: "biceps", muscleGroupLabel: "Bizeps", equipment: "dumbbell", movementType: "isolation", tags: "bodybuilding" },
    { name: "Langhantel Curl", nameEn: "Barbell Curl", muscleGroup: "biceps", muscleGroupLabel: "Bizeps", equipment: "barbell", movementType: "isolation", tags: "bodybuilding" },
    { name: "Hammer Curl", nameEn: "Hammer Curl", muscleGroup: "biceps", muscleGroupLabel: "Bizeps", equipment: "dumbbell", movementType: "isolation", tags: "bodybuilding" },
    { name: "Kabel Curl", nameEn: "Cable Curl", muscleGroup: "biceps", muscleGroupLabel: "Bizeps", equipment: "cable", movementType: "isolation", tags: "bodybuilding" },
    { name: "Konzentrations Curl", nameEn: "Concentration Curl", muscleGroup: "biceps", muscleGroupLabel: "Bizeps", equipment: "dumbbell", movementType: "isolation", tags: "bodybuilding" },
    { name: "Scottcurl", nameEn: "Preacher Curl", muscleGroup: "biceps", muscleGroupLabel: "Bizeps", equipment: "barbell", movementType: "isolation", tags: "bodybuilding" },

    // ARMS - TRICEPS
    { name: "Trizeps Dips", nameEn: "Triceps Dips", muscleGroup: "triceps", muscleGroupLabel: "Trizeps", equipment: "bodyweight", movementType: "compound", tags: "bodybuilding,weightloss" },
    { name: "Trizeps Drücken Kabel", nameEn: "Triceps Pushdown", muscleGroup: "triceps", muscleGroupLabel: "Trizeps", equipment: "cable", movementType: "isolation", tags: "bodybuilding" },
    { name: "Skull Crusher", nameEn: "Skull Crusher", muscleGroup: "triceps", muscleGroupLabel: "Trizeps", equipment: "barbell", movementType: "isolation", tags: "bodybuilding" },
    { name: "Enge Bankdrücken", nameEn: "Close-Grip Bench Press", muscleGroup: "triceps", muscleGroupLabel: "Trizeps", equipment: "barbell", movementType: "compound", tags: "bodybuilding,powerlifting" },
    { name: "Overhead Trizeps Kurzhantel", nameEn: "Overhead Triceps Extension", muscleGroup: "triceps", muscleGroupLabel: "Trizeps", equipment: "dumbbell", movementType: "isolation", tags: "bodybuilding" },
    { name: "Kickback", nameEn: "Triceps Kickback", muscleGroup: "triceps", muscleGroupLabel: "Trizeps", equipment: "dumbbell", movementType: "isolation", tags: "bodybuilding" },

    // CORE
    { name: "Plank", nameEn: "Plank", muscleGroup: "core", muscleGroupLabel: "Core", equipment: "bodyweight", movementType: "isolation", tags: "bodybuilding,weightloss" },
    { name: "Crunches", nameEn: "Crunches", muscleGroup: "core", muscleGroupLabel: "Core", equipment: "bodyweight", movementType: "isolation", tags: "bodybuilding,weightloss" },
    { name: "Hanging Leg Raise", nameEn: "Hanging Leg Raise", muscleGroup: "core", muscleGroupLabel: "Core", equipment: "bodyweight", movementType: "isolation", tags: "bodybuilding,weightloss" },
    { name: "Ab Wheel", nameEn: "Ab Wheel Rollout", muscleGroup: "core", muscleGroupLabel: "Core", equipment: "bodyweight", movementType: "isolation", tags: "bodybuilding" },
    { name: "Russian Twist", nameEn: "Russian Twist", muscleGroup: "core", muscleGroupLabel: "Core", equipment: "bodyweight", movementType: "isolation", tags: "bodybuilding,weightloss" },
    { name: "Pallof Press", nameEn: "Pallof Press", muscleGroup: "core", muscleGroupLabel: "Core", equipment: "cable", movementType: "isolation", tags: "powerlifting,bodybuilding" },
    { name: "Side Plank", nameEn: "Side Plank", muscleGroup: "core", muscleGroupLabel: "Core", equipment: "bodyweight", movementType: "isolation", tags: "bodybuilding,weightloss" },
    { name: "Dragon Flag", nameEn: "Dragon Flag", muscleGroup: "core", muscleGroupLabel: "Core", equipment: "bodyweight", movementType: "isolation", tags: "bodybuilding" },
    { name: "Kabelcrunch", nameEn: "Cable Crunch", muscleGroup: "core", muscleGroupLabel: "Core", equipment: "cable", movementType: "isolation", tags: "bodybuilding" },

    // GLUTES
    { name: "Hip Thrust", nameEn: "Hip Thrust", muscleGroup: "glutes", muscleGroupLabel: "Gesäß", equipment: "barbell", movementType: "isolation", tags: "bodybuilding,weightloss" },
    { name: "Glute Bridge", nameEn: "Glute Bridge", muscleGroup: "glutes", muscleGroupLabel: "Gesäß", equipment: "bodyweight", movementType: "isolation", tags: "bodybuilding,weightloss" },
    { name: "Cable Kickback", nameEn: "Cable Kickback", muscleGroup: "glutes", muscleGroupLabel: "Gesäß", equipment: "cable", movementType: "isolation", tags: "bodybuilding,weightloss" },
    { name: "Sumo Kniebeuge", nameEn: "Sumo Squat", muscleGroup: "glutes", muscleGroupLabel: "Gesäß", equipment: "barbell", movementType: "compound", tags: "bodybuilding,weightloss" },
    { name: "Good Morning", nameEn: "Good Morning", muscleGroup: "glutes", muscleGroupLabel: "Gesäß", equipment: "barbell", movementType: "compound", tags: "powerlifting,bodybuilding" },

    // CARDIO / FULL BODY
    { name: "Kettlebell Swing", nameEn: "Kettlebell Swing", muscleGroup: "fullbody", muscleGroupLabel: "Ganzkörper", equipment: "kettlebell", movementType: "compound", tags: "weightloss,bodybuilding" },
    { name: "Burpees", nameEn: "Burpee", muscleGroup: "fullbody", muscleGroupLabel: "Ganzkörper", equipment: "bodyweight", movementType: "compound", tags: "weightloss" },
    { name: "Thrusters", nameEn: "Thruster", muscleGroup: "fullbody", muscleGroupLabel: "Ganzkörper", equipment: "barbell", movementType: "compound", tags: "weightloss" },
    { name: "Kreuzheben Rumänisch Kurzhantel", nameEn: "DB Romanian Deadlift", muscleGroup: "fullbody", muscleGroupLabel: "Ganzkörper", equipment: "dumbbell", movementType: "compound", tags: "weightloss,bodybuilding" },
    { name: "Clean & Press", nameEn: "Clean and Press", muscleGroup: "fullbody", muscleGroupLabel: "Ganzkörper", equipment: "barbell", movementType: "compound", tags: "powerlifting,bodybuilding" },
    { name: "Kreuzheben Trap Bar", nameEn: "Trap Bar Deadlift", muscleGroup: "fullbody", muscleGroupLabel: "Ganzkörper", equipment: "barbell", movementType: "compound", tags: "powerlifting,bodybuilding" },
  ];

  const stmt = sqlite.prepare(`
    INSERT INTO exercises (name, name_en, muscle_group, muscle_group_label, equipment, movement_type, tags, is_custom)
    VALUES (@name, @nameEn, @muscleGroup, @muscleGroupLabel, @equipment, @movementType, @tags, 0)
  `);
  const insertMany = sqlite.transaction((rows: typeof data) => { for (const row of rows) stmt.run(row); });
  insertMany(data);
}
