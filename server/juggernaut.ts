/**
 * GritIQ Method 2.0 — Core + Goal-Adapted Variants
 *
 * Three training goals, each with distinct periodization:
 *
 * POWERLIFTING: Classic GritIQ 2.0 — maximize 1RM on squat/bench/deadlift/ohp
 *   4 Waves (10s→8s→5s→3s), AMRAP-based progression, high intensity
 *
 * BODYBUILDING: Hypertrophy-first — more volume, higher rep ranges, shorter rest
 *   Waves: 15s→12s→10s→8s, pump-focused, accessory-style sets
 *
 * WEIGHTLOSS: Metabolic conditioning — moderate weights, supersets, dense training
 *   Waves: 15s→12s→10s→8s, 60–75% TM, shorter rest (60–90s), circuit-style
 */

// Powerlifting: the 4 competition lifts
// Bodybuilding: 6 muscle-group splits (chest, back, legs, shoulders, arms, glutes/core)
// Weightloss: 3 full-body metabolic sessions per week rotation
export type PLLift = "squat" | "bench" | "deadlift" | "ohp";
export type BBLift = "chest" | "back" | "legs" | "shoulders" | "arms" | "glutes";
export type WLLift = "fullbody_a" | "fullbody_b" | "fullbody_c";
export type Lift = PLLift | BBLift | WLLift;
export type Wave = 1 | 2 | 3 | 4;
export type WeekType = 1 | 2 | 3 | 4; // 1=Acc, 2=Int, 3=Real, 4=Deload
export type TrainingGoal = "powerlifting" | "bodybuilding" | "weightloss";

export interface SetPrescription {
  setNumber: number;
  targetReps: number;
  percentOfTrainingMax: number;
  targetWeight: number;
  isAmrap: boolean;
  note?: string;
}

export interface WorkoutPrescription {
  waveName: string;
  weekName: string;
  lift: Lift;
  sets: SetPrescription[];
  restSeconds: number;
  focusNote: string;
}

// ── Names ────────────────────────────────────────────────────────────────────

const WAVE_NAMES: Record<TrainingGoal, string[]> = {
  powerlifting: ["10s Wave", "8s Wave", "5s Wave", "3s Wave"],
  bodybuilding: ["15s Wave", "12s Wave", "10s Wave", "8s Wave"],
  weightloss: ["15s Wave", "12s Wave", "10s Wave", "8s Wave"],
};

const WEEK_NAMES = ["Akkumulation", "Intensivierung", "Realisierung", "Deload"];

const FOCUS_NOTES: Record<TrainingGoal, Record<number, string>> = {
  powerlifting: {
    1: "Hohe Wiederholungen, moderate Last — Arbeitskapazität aufbauen.",
    2: "Volumen reduziert, Intensität steigt — auf Technik fokussieren.",
    3: "AMRAP-Satz: maximale Wiederholungen — neues 1RM berechnen!",
    4: "Deload — leichte Erholung, kein Versagen.",
  },
  bodybuilding: {
    1: "Volumenphase: 5 Sätze, kontrollierte Exzentrik (3–4s runter).",
    2: "Intensivierung: Gewicht steigt, Wiederholungen sinken leicht.",
    3: "Maximaler Pump — letzter Satz bis 1 Wdh. vor Versagen.",
    4: "Deload — aktive Erholung, Mobilität & Stretching.",
  },
  weightloss: {
    1: "Metabolisch: kurze Pausen (60s), höheres Tempo.",
    2: "Supersatz mit Körpergewichtsübung nach jedem Hauptsatz.",
    3: "AMRAP-Runde: alle Übungen ohne lange Pause — maximale Kalorienverbrennung.",
    4: "Aktiver Deload — leichte Cardio-Einheiten empfohlen.",
  },
};

// ── Prescription tables ───────────────────────────────────────────────────────

type PrescriptionRow = { pct: number; reps: number; amrap?: boolean };

const POWERLIFTING_PRESCRIPTIONS: Record<number, Record<number, PrescriptionRow[]>> = {
  1: {
    1: [{ pct: 60, reps: 10 }, { pct: 60, reps: 10 }, { pct: 60, reps: 10 }, { pct: 60, reps: 10 }, { pct: 60, reps: 10, amrap: true }],
    2: [{ pct: 65, reps: 10 }, { pct: 65, reps: 10 }, { pct: 65, reps: 10, amrap: true }],
    3: [{ pct: 75, reps: 10, amrap: true }],
    4: [{ pct: 40, reps: 5 }, { pct: 50, reps: 5 }, { pct: 60, reps: 5 }],
  },
  2: {
    1: [{ pct: 65, reps: 8 }, { pct: 65, reps: 8 }, { pct: 65, reps: 8 }, { pct: 65, reps: 8 }, { pct: 65, reps: 8, amrap: true }],
    2: [{ pct: 70, reps: 8 }, { pct: 70, reps: 8 }, { pct: 70, reps: 8, amrap: true }],
    3: [{ pct: 80, reps: 8, amrap: true }],
    4: [{ pct: 40, reps: 5 }, { pct: 50, reps: 5 }, { pct: 60, reps: 5 }],
  },
  3: {
    1: [{ pct: 70, reps: 5 }, { pct: 70, reps: 5 }, { pct: 70, reps: 5 }, { pct: 70, reps: 5 }, { pct: 70, reps: 5 }, { pct: 70, reps: 5, amrap: true }],
    2: [{ pct: 75, reps: 5 }, { pct: 75, reps: 5 }, { pct: 75, reps: 5 }, { pct: 75, reps: 5, amrap: true }],
    3: [{ pct: 85, reps: 5, amrap: true }],
    4: [{ pct: 40, reps: 5 }, { pct: 50, reps: 5 }, { pct: 60, reps: 5 }],
  },
  4: {
    1: [{ pct: 75, reps: 3 }, { pct: 75, reps: 3 }, { pct: 75, reps: 3 }, { pct: 75, reps: 3 }, { pct: 75, reps: 3 }, { pct: 75, reps: 3, amrap: true }],
    2: [{ pct: 80, reps: 3 }, { pct: 80, reps: 3 }, { pct: 80, reps: 3 }, { pct: 80, reps: 3 }, { pct: 80, reps: 3, amrap: true }],
    3: [{ pct: 90, reps: 3, amrap: true }],
    4: [{ pct: 40, reps: 5 }, { pct: 50, reps: 5 }, { pct: 60, reps: 5 }],
  },
};

// Bodybuilding: high volume, pump-focused, slightly lower % but more sets
const BODYBUILDING_PRESCRIPTIONS: Record<number, Record<number, PrescriptionRow[]>> = {
  1: { // 15s
    1: [{ pct: 55, reps: 15 }, { pct: 55, reps: 15 }, { pct: 55, reps: 15 }, { pct: 55, reps: 15 }, { pct: 55, reps: 15, amrap: true }],
    2: [{ pct: 60, reps: 15 }, { pct: 60, reps: 15 }, { pct: 60, reps: 15 }, { pct: 60, reps: 12, amrap: true }],
    3: [{ pct: 65, reps: 12, amrap: true }],
    4: [{ pct: 35, reps: 12 }, { pct: 40, reps: 12 }, { pct: 45, reps: 12 }],
  },
  2: { // 12s
    1: [{ pct: 60, reps: 12 }, { pct: 60, reps: 12 }, { pct: 60, reps: 12 }, { pct: 60, reps: 12 }, { pct: 60, reps: 12, amrap: true }],
    2: [{ pct: 65, reps: 12 }, { pct: 65, reps: 12 }, { pct: 65, reps: 12 }, { pct: 65, reps: 10, amrap: true }],
    3: [{ pct: 70, reps: 10, amrap: true }],
    4: [{ pct: 40, reps: 10 }, { pct: 45, reps: 10 }, { pct: 50, reps: 10 }],
  },
  3: { // 10s
    1: [{ pct: 65, reps: 10 }, { pct: 65, reps: 10 }, { pct: 65, reps: 10 }, { pct: 65, reps: 10 }, { pct: 65, reps: 10, amrap: true }],
    2: [{ pct: 70, reps: 10 }, { pct: 70, reps: 10 }, { pct: 70, reps: 10 }, { pct: 70, reps: 8, amrap: true }],
    3: [{ pct: 75, reps: 8, amrap: true }],
    4: [{ pct: 45, reps: 10 }, { pct: 50, reps: 10 }, { pct: 55, reps: 10 }],
  },
  4: { // 8s
    1: [{ pct: 70, reps: 8 }, { pct: 70, reps: 8 }, { pct: 70, reps: 8 }, { pct: 70, reps: 8 }, { pct: 70, reps: 8, amrap: true }],
    2: [{ pct: 75, reps: 8 }, { pct: 75, reps: 8 }, { pct: 75, reps: 8 }, { pct: 75, reps: 6, amrap: true }],
    3: [{ pct: 80, reps: 6, amrap: true }],
    4: [{ pct: 45, reps: 8 }, { pct: 50, reps: 8 }, { pct: 55, reps: 8 }],
  },
};

// Weightloss: higher rep, metabolic, shorter rest — same structure but lighter and more total work
const WEIGHTLOSS_PRESCRIPTIONS: Record<number, Record<number, PrescriptionRow[]>> = {
  1: { // 15s
    1: [{ pct: 50, reps: 15 }, { pct: 50, reps: 15 }, { pct: 50, reps: 15 }, { pct: 55, reps: 15, amrap: true }],
    2: [{ pct: 55, reps: 15 }, { pct: 55, reps: 15 }, { pct: 60, reps: 12, amrap: true }],
    3: [{ pct: 60, reps: 15, amrap: true }],
    4: [{ pct: 35, reps: 15 }, { pct: 40, reps: 15 }],
  },
  2: { // 12s
    1: [{ pct: 55, reps: 12 }, { pct: 55, reps: 12 }, { pct: 55, reps: 12 }, { pct: 60, reps: 12, amrap: true }],
    2: [{ pct: 60, reps: 12 }, { pct: 60, reps: 12 }, { pct: 65, reps: 10, amrap: true }],
    3: [{ pct: 65, reps: 12, amrap: true }],
    4: [{ pct: 35, reps: 12 }, { pct: 40, reps: 12 }],
  },
  3: { // 10s
    1: [{ pct: 60, reps: 10 }, { pct: 60, reps: 10 }, { pct: 60, reps: 10 }, { pct: 65, reps: 10, amrap: true }],
    2: [{ pct: 65, reps: 10 }, { pct: 65, reps: 10 }, { pct: 70, reps: 8, amrap: true }],
    3: [{ pct: 70, reps: 10, amrap: true }],
    4: [{ pct: 40, reps: 10 }, { pct: 45, reps: 10 }],
  },
  4: { // 8s
    1: [{ pct: 65, reps: 8 }, { pct: 65, reps: 8 }, { pct: 65, reps: 8 }, { pct: 70, reps: 8, amrap: true }],
    2: [{ pct: 70, reps: 8 }, { pct: 70, reps: 8 }, { pct: 75, reps: 6, amrap: true }],
    3: [{ pct: 75, reps: 8, amrap: true }],
    4: [{ pct: 40, reps: 8 }, { pct: 45, reps: 8 }],
  },
};

const ALL_PRESCRIPTIONS: Record<TrainingGoal, typeof POWERLIFTING_PRESCRIPTIONS> = {
  powerlifting: POWERLIFTING_PRESCRIPTIONS,
  bodybuilding: BODYBUILDING_PRESCRIPTIONS,
  weightloss: WEIGHTLOSS_PRESCRIPTIONS,
};

// ── Rest times ────────────────────────────────────────────────────────────────
const REST_SECONDS: Record<TrainingGoal, Record<number, number>> = {
  powerlifting: { 1: 120, 2: 120, 3: 180, 4: 90 },
  bodybuilding: { 1: 90, 2: 90, 3: 120, 4: 60 },
  weightloss: { 1: 60, 2: 60, 3: 90, 4: 45 },
};

// ── Core helpers ──────────────────────────────────────────────────────────────

export function getTrainingMax(trueMax: number): number {
  return trueMax * 0.9;
}

export function roundToNearest(weight: number, increment = 2.5): number {
  return Math.round(weight / increment) * increment;
}

export function getPrescription(
  wave: Wave,
  week: WeekType,
  lift: Lift,
  trueMax: number,
  goal: TrainingGoal = "powerlifting",
): WorkoutPrescription {
  const tm = getTrainingMax(trueMax);
  const table = ALL_PRESCRIPTIONS[goal];
  const rows = table[wave][week];
  const rest = REST_SECONDS[goal][week];

  const sets: SetPrescription[] = rows.map((s, i) => ({
    setNumber: i + 1,
    targetReps: s.reps,
    percentOfTrainingMax: s.pct,
    targetWeight: roundToNearest(tm * s.pct / 100),
    isAmrap: s.amrap ?? false,
    note: s.amrap ? getAmrapNote(goal) : undefined,
  }));

  return {
    waveName: WAVE_NAMES[goal][wave - 1],
    weekName: WEEK_NAMES[week - 1],
    lift,
    sets,
    restSeconds: rest,
    focusNote: FOCUS_NOTES[goal][week],
  };
}

function getAmrapNote(goal: TrainingGoal): string {
  if (goal === "powerlifting") return "AMRAP — so viele Wiederholungen wie möglich! Neues 1RM wird berechnet.";
  if (goal === "bodybuilding") return "Letzter Satz bis 1 Wdh. vor Versagen — maximaler Pump!";
  return "AMRAP — metabolische Runde, kein Ausrasten!";
}

// ── Progression ───────────────────────────────────────────────────────────────

export function calculateProgressionAfterAmrap(
  currentMax: number,
  amrapReps: number,
  wave: Wave,
  lift: Lift,
  goal: TrainingGoal = "powerlifting",
): number {
  const WAVE_REPS_MAP: Record<TrainingGoal, number[]> = {
    powerlifting: [10, 8, 5, 3],
    bodybuilding: [15, 12, 10, 8],
    weightloss: [15, 12, 10, 8],
  };
  const waveReps = WAVE_REPS_MAP[goal][wave - 1];
  const extraReps = Math.min(amrapReps - waveReps, 10);
  if (extraReps <= 0) return currentMax;

  // Bodybuilding & weightloss: smaller increments (less focus on 1RM)
  const isUpper = lift === "bench" || lift === "ohp";
  const increment = goal === "powerlifting"
    ? (isUpper ? 1.25 : 2.5)
    : (isUpper ? 0.5 : 1.25);

  return currentMax + extraReps * increment;
}

export function estimate1RM(weight: number, reps: number): number {
  return weight * reps * 0.0333 + weight;
}

export function getWaveName(wave: number, goal: TrainingGoal = "powerlifting"): string {
  return WAVE_NAMES[goal][wave - 1] ?? "Unbekannte Wave";
}

export function getWeekName(week: number): string {
  return WEEK_NAMES[week - 1] ?? "Unbekannte Woche";
}

export function getLiftName(lift: Lift): string {
  const names: Record<Lift, string> = {
    squat: "Kniebeuge", bench: "Bankdrücken", deadlift: "Kreuzheben", ohp: "Schulterdrücken",
  };
  return names[lift];
}

export function getWaveSchedule(wave: Wave, goal: TrainingGoal = "powerlifting") {
  const lifts: Lift[] = ["squat", "bench", "deadlift", "ohp"];
  return {
    wave,
    waveName: WAVE_NAMES[goal][wave - 1],
    weeks: [1, 2, 3, 4].map((week) => ({
      week,
      weekName: WEEK_NAMES[week - 1],
      lifts,
    })),
  };
}

// ── Exercise videos ───────────────────────────────────────────────────────────

export interface ExerciseVideo {
  title: string;
  channel: string;
  url: string;
  duration?: string;
  tags: TrainingGoal[];
}

export const EXERCISE_VIDEOS: Record<Lift, ExerciseVideo[]> = {
  squat: [
    {
      title: "How To Squat — Low Bar (Alan Thrall)",
      channel: "Alan Thrall",
      url: "https://www.youtube.com/watch?v=vmNPOjaGrVE",
      tags: ["powerlifting"],
    },
    {
      title: "How To Squat — Any Style (Alan Thrall)",
      channel: "Alan Thrall",
      url: "https://www.youtube.com/watch?v=UFs6E3Ti1jg",
      tags: ["bodybuilding", "weightloss"],
    },
    {
      title: "How To Squat Properly (Jeff Nippard)",
      channel: "Jeff Nippard",
      url: "https://www.youtube.com/watch?v=ultWZbUMPL8",
      tags: ["bodybuilding", "powerlifting", "weightloss"],
    },
  ],
  bench: [
    {
      title: "How To Get A Huge Bench Press (Jeff Nippard)",
      channel: "Jeff Nippard",
      url: "https://www.youtube.com/watch?v=vcBig73ojpE",
      tags: ["powerlifting", "bodybuilding"],
    },
    {
      title: "How To Bench Press With Perfect Technique",
      channel: "Jeff Nippard",
      url: "https://www.youtube.com/watch?v=BYKScL2sgCs",
      tags: ["bodybuilding", "weightloss"],
    },
  ],
  deadlift: [
    {
      title: "How To Deadlift — 5-Step Guide (Alan Thrall)",
      channel: "Alan Thrall",
      url: "https://www.youtube.com/watch?v=MBbyAqvTNkU",
      tags: ["powerlifting", "bodybuilding", "weightloss"],
    },
    {
      title: "How to Deadlift With Mark Rippetoe",
      channel: "The Art of Manliness",
      url: "https://www.youtube.com/watch?v=4AObAU-EcYE",
      tags: ["powerlifting"],
    },
  ],
  ohp: [
    {
      title: "How to Overhead Press — Proper Form (Alan Thrall)",
      channel: "Alan Thrall",
      url: "https://www.youtube.com/watch?v=nNMR9fRGRjQ",
      tags: ["powerlifting", "bodybuilding", "weightloss"],
    },
    {
      title: "How To Perform Overhead Press (Starting Strength)",
      channel: "Starting Strength",
      url: "https://www.youtube.com/watch?v=F3QY5vMz_6I",
      tags: ["powerlifting"],
    },
  ],
};

// ── Goal-specific lift rosters ────────────────────────────────────────────────

export interface LiftConfig {
  key: Lift;
  label: string;          // German display name
  icon: string;           // emoji
  muscleGroup: string;    // maps to exercise filter
  primaryExercise: string; // descriptive hint shown in card
  description: string;    // short coaching cue shown in card
}

/** Powerlifting: the 4 competition lifts — unchanged */
export const POWERLIFTING_LIFTS: LiftConfig[] = [
  { key: "squat",    label: "Kniebeuge",        icon: "🏋️", muscleGroup: "legs",      primaryExercise: "Kniebeuge (Low/High Bar)", description: "1RM-Fokus — maximale Kraft" },
  { key: "bench",    label: "Bankdrücken",       icon: "💪", muscleGroup: "chest",     primaryExercise: "Bankdrücken (Langhantel)", description: "Wettkampftechnik, schwere Last" },
  { key: "deadlift", label: "Kreuzheben",        icon: "🔥", muscleGroup: "back",      primaryExercise: "Kreuzheben (Konventionell)", description: "Rückenkettenentwicklung" },
  { key: "ohp",      label: "Schulterdrücken",   icon: "⬆️", muscleGroup: "shoulders", primaryExercise: "Overhead Press", description: "Schulterstärke & Stabilität" },
];

/**
 * Bodybuilding: 6-day PPL-inspired split
 * Push (Brust/Schultern/Trizeps) → Pull (Rücken/Bizeps) → Legs → repeat with variation
 * Each session targets a specific muscle group with compound + accessory focus
 */
export const BODYBUILDING_LIFTS: LiftConfig[] = [
  { key: "chest",     label: "Brust",            icon: "💥", muscleGroup: "chest",     primaryExercise: "Bankdrücken + Fliegende", description: "Pec-Fokus: Volumen & Pump" },
  { key: "back",      label: "Rücken",            icon: "🦅", muscleGroup: "back",      primaryExercise: "Klimmzüge + Rudern",     description: "Breite & Dicke aufbauen" },
  { key: "legs",      label: "Beine (Quad)",      icon: "🦵", muscleGroup: "legs",      primaryExercise: "Kniebeuge + Leg Press",  description: "Quad-Dominanz, hohe Wiederholungen" },
  { key: "shoulders", label: "Schultern",         icon: "🔱", muscleGroup: "shoulders", primaryExercise: "OHP + Seitheben",        description: "3D-Schulterentwicklung" },
  { key: "arms",      label: "Arme",              icon: "💪", muscleGroup: "biceps",    primaryExercise: "Curls + Trizepsdrücken", description: "Bizeps & Trizeps — Volumen" },
  { key: "glutes",    label: "Beine (Post.)",     icon: "🍑", muscleGroup: "glutes",    primaryExercise: "RDL + Hip Thrust",       description: "Hintere Kette: Hams & Gesäß" },
];

/**
 * Weightloss: 3 rotating full-body metabolic sessions (A/B/C)
 * Each hits all major muscle groups, different exercise emphasis, circuit-style
 */
export const WEIGHTLOSS_LIFTS: LiftConfig[] = [
  { key: "fullbody_a", label: "Ganzkörper A",   icon: "⚡", muscleGroup: "fullbody", primaryExercise: "Kniebeuge · Bankdrücken · Rudern", description: "Zirkel: 60s Pause, Push-Fokus" },
  { key: "fullbody_b", label: "Ganzkörper B",   icon: "🔄", muscleGroup: "fullbody", primaryExercise: "Kreuzheben · OHP · Ausfallschritt",  description: "Zirkel: 60s Pause, Pull-Fokus" },
  { key: "fullbody_c", label: "Ganzkörper C",   icon: "🎯", muscleGroup: "fullbody", primaryExercise: "Goblet Squat · Rudern · Plank",      description: "HIIT-Zirkel: maximale Kalorienverbrennung" },
];

export const GOAL_LIFTS: Record<TrainingGoal, LiftConfig[]> = {
  powerlifting: POWERLIFTING_LIFTS,
  bodybuilding: BODYBUILDING_LIFTS,
  weightloss:   WEIGHTLOSS_LIFTS,
};

/** Returns today's lift keys for a given goal */
export function getLiftsForGoal(goal: TrainingGoal): Lift[] {
  return GOAL_LIFTS[goal].map(l => l.key);
}

/** Returns display config for a single lift key */
export function getLiftConfig(key: Lift, goal: TrainingGoal): LiftConfig {
  return GOAL_LIFTS[goal].find(l => l.key === key) ?? POWERLIFTING_LIFTS[0];
}

/** Wave name lookup that handles all goals */
export function getGoalWaveName(wave: number, goal: TrainingGoal): string {
  return WAVE_NAMES[goal][wave - 1] ?? "Wave";
}
