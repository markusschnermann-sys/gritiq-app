import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User profile with 1RMs
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  squatMax: real("squat_max").notNull(), // kg
  benchMax: real("bench_max").notNull(),
  deadliftMax: real("deadlift_max").notNull(),
  ohpMax: real("ohp_max").notNull(),
  currentWave: integer("current_wave").notNull().default(1), // 1=10s, 2=8s, 3=5s, 4=3s
  currentWeek: integer("current_week").notNull().default(1), // 1=Accumulation, 2=Intensification, 3=Realization, 4=Deload
  programStartDate: text("program_start_date").notNull(),
  trainingGoal: text("training_goal").notNull().default("powerlifting"), // "powerlifting" | "bodybuilding" | "weightloss"
  gender: text("gender").notNull().default("other"), // "male" | "female" | "other"
  age: integer("age"), // years, optional
  cyclePhase: text("cycle_phase"), // "follicular" | "luteal" | null (female users only)
  bodyweight: real("bodyweight"), // kg, optional
  nutritionPrefs: text("nutrition_prefs"), // JSON string with custom overrides
  calorieCyclingPrefs: text("calorie_cycling_prefs"), // JSON: CalorieCyclingPrefs
  // Stripe / Subscription
  isPro: integer("is_pro").notNull().default(0),                     // 0 = free, 1 = pro
  stripeCustomerId: text("stripe_customer_id"),                      // cus_...
  stripeSubscriptionId: text("stripe_subscription_id"),             // sub_...
  stripeSubscriptionStatus: text("stripe_subscription_status"),     // active | canceled | past_due | trialing
  stripePlan: text("stripe_plan"),                                   // "monthly" | "annual"
  stripeRenewalDate: text("stripe_renewal_date"),                    // ISO datetime of next renewal / period end
  proExpiresAt: text("pro_expires_at"),                             // ISO datetime, null = active
  atlasMessagesThisMonth: integer("atlas_messages_this_month").notNull().default(0),
  atlasResetAt: text("atlas_reset_at"),                             // ISO date of last monthly reset
  // Leaderboard privacy: "public" | "anonymous" | "hidden"
  leaderboardVisibility: text("leaderboard_visibility").notNull().default("hidden"),
  // Referral
  referralCode: text("referral_code"),                              // e.g. "MARKUS-A3X2" — unique per user
  referredByCode: text("referred_by_code"),                         // code used when this user signed up
  referralBonusDaysTotal: integer("referral_bonus_days_total").notNull().default(0), // cumulative free days earned
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Workout sessions
export const workoutSessions = sqliteTable("workout_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  date: text("date").notNull(), // ISO date string
  lift: text("lift").notNull(), // "squat" | "bench" | "deadlift" | "ohp"
  wave: integer("wave").notNull(), // 1-4
  week: integer("week").notNull(), // 1-4 (Acc/Int/Real/Deload)
  status: text("status").notNull().default("planned"), // "planned" | "in_progress" | "completed"
  readinessScore: integer("readiness_score"), // 1-5 overall readiness
  sleepScore: integer("sleep_score"), // 1-5
  nutritionScore: integer("nutrition_score"), // 1-5
  motivationScore: integer("motivation_score"), // 1-5
  fatigueScore: integer("fatigue_score"), // 1-5
  sessionDifficulty: integer("session_difficulty"), // 5-10 post-session
  notes: text("notes"),
});

export const insertWorkoutSessionSchema = createInsertSchema(workoutSessions).omit({ id: true });
export type InsertWorkoutSession = z.infer<typeof insertWorkoutSessionSchema>;
export type WorkoutSession = typeof workoutSessions.$inferSelect;

// Individual sets within a session
export const sets = sqliteTable("sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  setNumber: integer("set_number").notNull(),
  targetReps: integer("target_reps").notNull(),
  targetWeight: real("target_weight").notNull(), // kg
  actualReps: integer("actual_reps"),
  actualWeight: real("actual_weight"),
  rpe: real("rpe"), // 1-10 Rating of Perceived Exertion
  rir: integer("rir"), // Reps in Reserve
  isAmrap: integer("is_amrap").notNull().default(0), // boolean as 0/1
  isCompleted: integer("is_completed").notNull().default(0),
});

export const insertSetSchema = createInsertSchema(sets).omit({ id: true });
export type InsertSet = z.infer<typeof insertSetSchema>;
export type Set = typeof sets.$inferSelect;

// ── Exercise Library ─────────────────────────────────────────────────────────
export const exercises = sqliteTable("exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nameEn: text("name_en"), // English alias
  muscleGroup: text("muscle_group").notNull(), // e.g. "chest", "back", "legs"
  muscleGroupLabel: text("muscle_group_label").notNull(), // Display label
  equipment: text("equipment").notNull().default("barbell"), // "barbell"|"dumbbell"|"machine"|"cable"|"bodyweight"|"kettlebell"
  movementType: text("movement_type").notNull().default("compound"), // "compound"|"isolation"
  tags: text("tags").notNull().default(""), // comma-separated: "powerlifting","bodybuilding","weightloss"
  isCustom: integer("is_custom").notNull().default(0), // user-created
  userId: integer("user_id"), // null = global
  cues: text("cues"), // coaching cues JSON
});

export const insertExerciseSchema = createInsertSchema(exercises).omit({ id: true });
export type InsertExercise = z.infer<typeof insertExerciseSchema>;
export type Exercise = typeof exercises.$inferSelect;

// ── Social: Challenges & Groups ──────────────────────────────────────────────
export const challenges = sqliteTable("challenges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  creatorId: integer("creator_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // "volume" | "consistency" | "pr" | "streak"
  goal: text("goal").notNull(), // JSON: { targetValue, unit, lift? }
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  isPublic: integer("is_public").notNull().default(1),
  status: text("status").notNull().default("active"), // "active"|"completed"|"cancelled"
  createdAt: text("created_at").notNull(),
});

export const insertChallengeSchema = createInsertSchema(challenges).omit({ id: true });
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type Challenge = typeof challenges.$inferSelect;

export const challengeMembers = sqliteTable("challenge_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  challengeId: integer("challenge_id").notNull(),
  userId: integer("user_id").notNull(),
  joinedAt: text("joined_at").notNull(),
  progress: real("progress").notNull().default(0), // current value toward goal
  completed: integer("completed").notNull().default(0),
});

export const insertChallengeMemberSchema = createInsertSchema(challengeMembers).omit({ id: true });
export type InsertChallengeMember = z.infer<typeof insertChallengeMemberSchema>;
export type ChallengeMember = typeof challengeMembers.$inferSelect;

// Activity feed entries
export const feedEntries = sqliteTable("feed_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // "pr" | "session" | "challenge_join" | "challenge_complete"
  payload: text("payload").notNull(), // JSON with event data
  createdAt: text("created_at").notNull(),
});

export const insertFeedEntrySchema = createInsertSchema(feedEntries).omit({ id: true });
export type InsertFeedEntry = z.infer<typeof insertFeedEntrySchema>;
export type FeedEntry = typeof feedEntries.$inferSelect;

// ── Exercise Logs & PR Tracker ───────────────────────────────────────────────
// One row per training session for a given exercise
export const exerciseLogs = sqliteTable("exercise_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  exerciseId: integer("exercise_id").notNull(),
  userId: integer("user_id").notNull(),
  date: text("date").notNull(), // ISO date string YYYY-MM-DD
  sets: text("sets").notNull(), // JSON: [{weight: number, reps: number, notes?: string}][]
  createdAt: text("created_at").notNull(),
});

export const insertExerciseLogSchema = createInsertSchema(exerciseLogs).omit({ id: true });
export type InsertExerciseLog = z.infer<typeof insertExerciseLogSchema>;
export type ExerciseLog = typeof exerciseLogs.$inferSelect;

// One row per exercise per user — upserted whenever a new log beats the PR
export const exercisePrs = sqliteTable("exercise_prs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  exerciseId: integer("exercise_id").notNull(),
  userId: integer("user_id").notNull(),
  bestWeight: real("best_weight").notNull(),   // kg
  bestReps: integer("best_reps").notNull(),     // reps at bestWeight
  bestVolume: real("best_volume").notNull(),    // bestWeight * bestReps (as a tiebreak)
  achievedAt: text("achieved_at").notNull(),   // ISO date of the PR session
});

export const insertExercisePrSchema = createInsertSchema(exercisePrs).omit({ id: true });
export type InsertExercisePr = z.infer<typeof insertExercisePrSchema>;
export type ExercisePr = typeof exercisePrs.$inferSelect;

// ── AI Coach Messages ─────────────────────────────────────────────────────────
export const aiMessages = sqliteTable("ai_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertAiMessageSchema = createInsertSchema(aiMessages).omit({ id: true });
export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;
export type AiMessage = typeof aiMessages.$inferSelect;

// ── Referrals ──────────────────────────────────────────────────────────────
// One row per referral attempt. Status transitions: pending → rewarded | expired
export const referrals = sqliteTable("referrals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  referrerId: integer("referrer_id").notNull(),       // user who shared the code
  referredUserId: integer("referred_user_id"),        // null until the referred user registers
  code: text("code").notNull(),                       // the referral code used
  status: text("status").notNull().default("pending"), // "pending" | "rewarded" | "expired"
  bonusDays: integer("bonus_days").notNull().default(30), // days credited on conversion
  createdAt: text("created_at").notNull(),
  rewardedAt: text("rewarded_at"),                    // ISO datetime when bonus was applied
});

export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;

// ── Auth: Credentials (email + bcrypt password hash) ───────────────────────────
export const credentials = sqliteTable("credentials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});
export type Credential = typeof credentials.$inferSelect;

// ── Auth: Refresh Tokens (HttpOnly cookie token rotation) ───────────────────
export const refreshTokens = sqliteTable("refresh_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  tokenHash: text("token_hash").notNull(), // SHA-256 of the raw token — never store raw
  family: text("family").notNull(),        // UUID — detect token reuse across a family
  expiresAt: text("expires_at").notNull(), // ISO datetime
  revokedAt: text("revoked_at"),           // null = active
  createdAt: text("created_at").notNull(),
});
export type RefreshToken = typeof refreshTokens.$inferSelect;

// ── Head-to-Head Strength Challenges ─────────────────────────────────────────
// A 4-week 1-vs-1 challenge tracked by Wilks2 or IPF GL coefficient improvement.

export const h2hChallenges = sqliteTable("h2h_challenges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  challengerId: integer("challenger_id").notNull(),       // user who initiated
  opponentId:   integer("opponent_id").notNull(),         // user who was invited
  metric:       text("metric").notNull(),                 // "wilks2" | "ipfgl"
  status:       text("status").notNull().default("pending"), // "pending"|"active"|"completed"|"declined"
  startDate:    text("start_date"),                       // ISO date, set when accepted
  endDate:      text("end_date"),                         // startDate + 28 days
  winnerId:     integer("winner_id"),                     // null until completed
  createdAt:    text("created_at").notNull(),
  completedAt:  text("completed_at"),
});

export const insertH2hChallengeSchema = createInsertSchema(h2hChallenges).omit({ id: true });
export type InsertH2hChallenge = z.infer<typeof insertH2hChallengeSchema>;
export type H2hChallenge = typeof h2hChallenges.$inferSelect;

// Weekly snapshots — one row per user per week (week 0 = baseline at start)
export const h2hSnapshots = sqliteTable("h2h_snapshots", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  challengeId: integer("challenge_id").notNull(),
  userId:      integer("user_id").notNull(),
  weekNumber:  integer("week_number").notNull(), // 0=baseline, 1-4=progress weeks
  squatMax:    real("squat_max").notNull(),
  benchMax:    real("bench_max").notNull(),
  deadliftMax: real("deadlift_max").notNull(),
  bodyweight:  real("bodyweight"),
  wilks2:      real("wilks2").notNull(),
  ipfGl:       real("ipf_gl").notNull(),
  recordedAt:  text("recorded_at").notNull(),
});

export const insertH2hSnapshotSchema = createInsertSchema(h2hSnapshots).omit({ id: true });
export type InsertH2hSnapshot = z.infer<typeof insertH2hSnapshotSchema>;
export type H2hSnapshot = typeof h2hSnapshots.$inferSelect;

// ── H2H Events — trash-talk taunts, reactions, milestones ─────────────────────
// One row per event, linked to a challenge. Types:
//   "taunt"     — auto-generated overtake notification (fromUserId = leader)
//   "reaction"  — preset comeback from trailing athlete (fromUserId = trailer)
//   "milestone" — system event: challenge started, week completed, winner declared
export const h2hEvents = sqliteTable("h2h_events", {
  id:          integer("id").primaryKey({ autoIncrement: true }),
  challengeId: integer("challenge_id").notNull(),
  fromUserId:  integer("from_user_id"),           // null for system milestones
  toUserId:    integer("to_user_id"),             // recipient of the notification
  type:        text("type").notNull(),            // "taunt" | "reaction" | "milestone"
  message:     text("message").notNull(),         // the text to display
  readAt:      text("read_at"),                   // null = unread
  createdAt:   text("created_at").notNull(),
});

export const insertH2hEventSchema = createInsertSchema(h2hEvents).omit({ id: true });
export type InsertH2hEvent = z.infer<typeof insertH2hEventSchema>;
export type H2hEvent = typeof h2hEvents.$inferSelect;

// ── Auth: Password Reset Tokens ────────────────────────────────────────────────
// One-time token (SHA-256 hashed) valid for 1 hour. Used in the forgot-password flow.
export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id:        integer("id").primaryKey({ autoIncrement: true }),
  userId:    integer("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),  // SHA-256 of the raw URL token — never stored raw
  expiresAt: text("expires_at").notNull(),  // ISO datetime, 1 hour from creation
  usedAt:    text("used_at"),               // null = still valid; set on use (single-use)
  createdAt: text("created_at").notNull(),
});
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
