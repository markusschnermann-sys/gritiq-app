/**
 * GritIQ Nutrition Calculator
 *
 * Goal-specific calorie targets, macro splits and meal timing guides.
 * All values computed from bodyweight (kg) and training goal.
 * Users can override any value — overrides are stored in `nutritionPrefs` JSON via the API.
 */

export type TrainingGoal = "powerlifting" | "bodybuilding" | "weightloss";

export interface MacroTargets {
  calories: number;       // kcal/day
  proteinG: number;       // grams protein
  carbsG: number;         // grams carbs
  fatG: number;           // grams fat
}

export interface NutritionPrefs {
  // Overrides — if set, use these instead of computed values
  customCalories?: number;
  customProteinG?: number;
  customCarbsG?: number;
  customFatG?: number;
  // Bodyweight used for calculations (mirrors user.bodyweight but editable here)
  bodyweightKg?: number;
}

// ── Goal multipliers ──────────────────────────────────────────────────────────

interface GoalConfig {
  /** kcal per kg bodyweight */
  caloriesPerKg: number;
  /** protein g per kg */
  proteinPerKg: number;
  /** fat g per kg */
  fatPerKg: number;
  label: string;
  emoji: string;
  rationale: string;
  /** Meal timing guide: training day entries */
  mealTiming: MealTimingEntry[];
  /** Meal timing guide: rest day entries */
  restDayTiming: MealTimingEntry[];
  /** Goal accent color identifiers */
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  accentText: string;
}

export interface MealTimingEntry {
  time: string;          // e.g. "2h vor Training"
  title: string;
  description: string;
  icon: string;
}

export type DayType = "training" | "rest";

const GOAL_CONFIG: Record<TrainingGoal, GoalConfig> = {
  powerlifting: {
    caloriesPerKg: 38,
    proteinPerKg: 2.2,
    fatPerKg: 1.1,
    label: "Powerlifting / Kraft",
    emoji: "🏋️",
    accentColor: "orange",
    accentBg: "bg-orange-500/10",
    accentBorder: "border-orange-500/30",
    accentText: "text-orange-400",
    rationale: "Leichter Kalorienüberschuss für maximalen Kraftzuwachs. Hoher Proteinanteil schützt Muskelmasse während intensiver Belastung.",
    mealTiming: [
      {
        time: "2–3h vor Training",
        title: "Pre-Workout Mahlzeit",
        description: "Kohlenhydratreich + moderat Protein. Reis, Nudeln oder Haferflocken mit Hühnchen oder Quark. Kein zu viel Fett — verlangsamt Verdauung.",
        icon: "🍝",
      },
      {
        time: "30min vor Training",
        title: "Optional: Booster",
        description: "Kleiner Snack falls nötig: Banane + 20g Whey. Koffein kann Maximalkraft um 3–7% steigern.",
        icon: "⚡",
      },
      {
        time: "Direkt nach Training",
        title: "Post-Workout Protein",
        description: "30–40g Protein innerhalb 30min. Whey-Shake oder mageres Fleisch. Kohlenhydrate helfen beim Glykogenauffüllen.",
        icon: "💪",
      },
      {
        time: "Abends",
        title: "Abendmahlzeit",
        description: "Große kohlenhydratreiche Abendmahlzeit: Reis oder Kartoffeln mit Fleisch/Fisch. Glykogenspeicher für die nächste Session füllen.",
        icon: "🍽️",
      },
    ],
    restDayTiming: [
      {
        time: "Morgens",
        title: "Frühstück — Protein-First",
        description: "Proteinreiches Frühstück: Eier, Quark oder Whey. Kohlenhydrate reduzieren (kein Training heute) — fokus auf Muskelreparatur.",
        icon: "🥚",
      },
      {
        time: "Mittags",
        title: "Ausgewogenes Mittagessen",
        description: "Mageres Fleisch oder Fisch + viel Gemüse + moderate Kohlenhydrate. Gesunde Fette (Avocado, Olivenöl) sind jetzt besonders wertvoll.",
        icon: "🥗",
      },
      {
        time: "Nachmittags",
        title: "Protein-Snack",
        description: "Hüttenkäse, Magerquark oder Casein-Shake. Langsam verdauliches Protein hält anabole Signalwege auf Ruhetagen aktiv.",
        icon: "🧀",
      },
      {
        time: "Abends",
        title: "Leichtes Abendessen",
        description: "−200 kcal gegenüber Trainingstag. Protein beibehalten. Weniger Kohlenhydrate — Körper benötigt kein Glykogen zum Auffüllen. Casein vor dem Schlafen optional.",
        icon: "😴",
      },
    ],
  },

  bodybuilding: {
    caloriesPerKg: 35,
    proteinPerKg: 2.4,
    fatPerKg: 0.9,
    label: "Bodybuilding / Muskelaufbau",
    emoji: "💪",
    accentColor: "blue",
    accentBg: "bg-blue-500/10",
    accentBorder: "border-blue-500/30",
    accentText: "text-blue-400",
    rationale: "Moderater Kalorienüberschuss (~300–400 kcal) für sauberen Muskelaufbau. Sehr hoher Proteinanteil und moderate Kohlenhydrate für Volumen und Pump.",
    mealTiming: [
      {
        time: "1,5–2h vor Training",
        title: "Pre-Workout Mahlzeit",
        description: "Slow Carbs + Protein: Reis, Süßkartoffel, Chicken Breast. Ziel: volle Glykogenspeicher für hohe Satzanzahl.",
        icon: "🍠",
      },
      {
        time: "Direkt vor Training",
        title: "Fast Carbs + Creatine",
        description: "Optionaler Fast-Carb-Snack (Gels, Banane) und 3–5g Creatin für intrazelluläres Volumen und ATP-Produktion.",
        icon: "🍌",
      },
      {
        time: "Während Training",
        title: "Intra-Workout",
        description: "Bei Sessions >75min: 30–40g schnelle Kohlenhydrate (EAAs + Dextrose) um Katabolismus zu verhindern.",
        icon: "🥤",
      },
      {
        time: "30min nach Training",
        title: "Anaboles Fenster",
        description: "Schnelles Protein (Whey, 40g) + Fast Carbs (100g Reis/Obst). Insulin-Spike transportiert Aminosäuren in die Muskeln.",
        icon: "🥩",
      },
    ],
    restDayTiming: [
      {
        time: "Morgens",
        title: "Langsames Frühstück",
        description: "Haferflocken + Eier + Beeren. Langsame Kohlenhydrate und viel Protein. Keine Eile — Insulin niedrig halten fördert Fettoxidation.",
        icon: "🥣",
      },
      {
        time: "Mittags",
        title: "Meal-Prep Mahlzeit",
        description: "Vorgekochtes Hähnchen/Rind + Reis + Gemüse. Gleiche Proteinmenge wie Trainingstag beibehalten — Muskelproteinsynthese läuft 24–48h.",
        icon: "🍱",
      },
      {
        time: "Nachmittags",
        title: "Leucin-Boost Snack",
        description: "Hüttenkäse + Nüsse oder Whey-Shake. Leucin (min. 2,5g) aktiviert mTOR-Signalweg auch ohne Training.",
        icon: "🥜",
      },
      {
        time: "Abends",
        title: "Casein + Fette",
        description: "Magerquark oder Casein-Shake + gesunde Fette (Nüsse, Olivenöl). Langsame Proteinzufuhr über Nacht maximiert anabole Regeneration.",
        icon: "🌙",
      },
    ],
  },

  weightloss: {
    caloriesPerKg: 28,
    proteinPerKg: 2.6,
    fatPerKg: 0.8,
    label: "Abnehmen / Fettabbau",
    emoji: "🔥",
    accentColor: "red",
    accentBg: "bg-red-500/10",
    accentBorder: "border-red-500/30",
    accentText: "text-red-400",
    rationale: "Kaloriendefizit von ~400–600 kcal unter Erhaltungsbedarf. Sehr hoher Proteinanteil (2,6g/kg) schützt Muskeln beim Abnehmen. Kohlenhydrate bevorzugt um das Training herum.",
    mealTiming: [
      {
        time: "Morgens",
        title: "Frühstück mit Protein",
        description: "Proteinreiches Frühstück (Eier, Quark, Whey) reduziert Hunger über den Tag. Kohlenhydrate optional je nach Trainingszeit.",
        icon: "🍳",
      },
      {
        time: "1h vor Training",
        title: "Pre-Workout: leicht",
        description: "Kleiner Snack: 20g Protein + wenig Kohlenhydrate (z.B. Hüttenkäse + Reiswaffel). Kein großes Essen — Fettverbrennung bleibt aktiv.",
        icon: "🥗",
      },
      {
        time: "Direkt nach Training",
        title: "Post-Workout Protein",
        description: "30–40g Protein sofort nach Training. Kohlenhydrate gezielt hier platzieren — Glykogen wird effizient eingelagert statt als Fett.",
        icon: "🥛",
      },
      {
        time: "Abends",
        title: "Abendmahlzeit",
        description: "Hauptmahlzeit: viel Gemüse, Protein (Fisch, Fleisch, Hülsenfrüchte), minimale Kohlenhydrate. Sättigend aber kalorienarm.",
        icon: "🥦",
      },
    ],
    restDayTiming: [
      {
        time: "Morgens",
        title: "Protein + Wasser",
        description: "Starte mit einem Glas Wasser + Proteinfrühstück. Kein Training heute = kein Bedarf für Kohlenhydrate morgens. Hält den Stoffwechsel aktiv.",
        icon: "💧",
      },
      {
        time: "Mittags",
        title: "Low-Carb Hauptmahlzeit",
        description: "Mehr Proteine, weniger Kohlenhydrate als am Trainingstag. Fisch, Tofu oder Hähnchen + viel Gemüse. Ziel: −200 bis −300 kcal zum Trainingstag.",
        icon: "🐟",
      },
      {
        time: "Nachmittags",
        title: "Sättigungs-Snack",
        description: "Psyllium (Flohsamenschalen) in Wasser + Magerquark oder Reiswaffeln mit Hüttenkäse. Ballaststoffe reduzieren Hunger effektiv ohne Kalorien.",
        icon: "🫙",
      },
      {
        time: "Abends",
        title: "Leichtes Abendessen",
        description: "Gemüse-Hauptmahlzeit mit Protein. Kein Zucker, keine Stärke. Maximales Kaloriendefizit am Ruhetag beschleunigt Fettabbau ohne Muskelverlust.",
        icon: "🥬",
      },
    ],
  },
};

// ── Calculator ────────────────────────────────────────────────────────────────

/**
 * Mifflin-St-Jeor BMR (most validated formula per ISSN 2023):
 *   Men:   10 * kg + 6.25 * cm - 5 * age + 5
 *   Women: 10 * kg + 6.25 * cm - 5 * age - 161
 *   Other: average of male/female
 *
 * Activity factor for strength training (3-5x/week): 1.55 (moderate-high)
 * Goal modifier on top of maintenance TDEE:
 *   powerlifting: +10% surplus
 *   bodybuilding: +5% surplus
 *   weightloss:   -20% deficit
 *
 * Fallback: if age/height unknown, use kcal/kg multiplier.
 */
export function computeBMR(
  bodyweightKg: number,
  gender: "male" | "female" | "other",
  age?: number | null,
  heightCm?: number | null,
): number | null {
  if (!age || !heightCm) return null;
  const maleBMR = 10 * bodyweightKg + 6.25 * heightCm - 5 * age + 5;
  const femaleBMR = 10 * bodyweightKg + 6.25 * heightCm - 5 * age - 161;
  if (gender === "male") return maleBMR;
  if (gender === "female") return femaleBMR;
  return (maleBMR + femaleBMR) / 2;
}

export type Gender = "male" | "female" | "other";

export interface ComputeMacrosOptions {
  gender?: Gender | null;
  age?: number | null;
  heightCm?: number | null;
}

export function computeMacros(
  bodyweightKg: number,
  goal: TrainingGoal,
  opts: ComputeMacrosOptions = {},
): MacroTargets {
  const cfg = GOAL_CONFIG[goal];
  const { gender = "other", age, heightCm } = opts;

  // Try Mifflin-St-Jeor TDEE first
  const bmr = computeBMR(bodyweightKg, gender ?? "other", age, heightCm);
  let calories: number;
  if (bmr !== null) {
    // TDEE at moderate-high activity (strength training 3-5x/week)
    const tdee = bmr * 1.55;
    // Goal modifier
    const modifier = goal === "powerlifting" ? 1.10
      : goal === "bodybuilding" ? 1.05
      : 0.80; // weightloss: -20%
    calories = Math.round(tdee * modifier);
  } else {
    // Fallback: simple kcal/kg multiplier (no age/height available)
    calories = Math.round(bodyweightKg * cfg.caloriesPerKg);
  }

  // Protein scaled by goal — slightly higher for females due to relatively higher lean mass %
  const proteinMultiplier = gender === "female" ? cfg.proteinPerKg * 1.05 : cfg.proteinPerKg;
  const proteinG = Math.round(bodyweightKg * proteinMultiplier);
  const fatG = Math.round(bodyweightKg * cfg.fatPerKg);
  // Remaining calories from carbs
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));

  return { calories, proteinG, carbsG, fatG };
}

/** Merge computed defaults with user overrides */
export function resolveTargets(
  bodyweightKg: number,
  goal: TrainingGoal,
  prefs: NutritionPrefs,
  opts?: ComputeMacrosOptions,
): MacroTargets {
  const base = computeMacros(bodyweightKg, goal, opts);
  return {
    calories: prefs.customCalories ?? base.calories,
    proteinG: prefs.customProteinG ?? base.proteinG,
    carbsG: prefs.customCarbsG ?? base.carbsG,
    fatG: prefs.customFatG ?? base.fatG,
  };
}

export function getGoalConfig(goal: TrainingGoal): GoalConfig {
  return GOAL_CONFIG[goal];
}

export function parseNutritionPrefs(json: string | null | undefined): NutritionPrefs {
  if (!json) return {};
  try { return JSON.parse(json) as NutritionPrefs; } catch { return {}; }
}

/** Macro percentage breakdown for display */
export function macroPercentages(t: MacroTargets): { protein: number; carbs: number; fat: number } {
  const total = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;
  if (total === 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: Math.round((t.proteinG * 4 / total) * 100),
    carbs: Math.round((t.carbsG * 4 / total) * 100),
    fat: Math.round((t.fatG * 9 / total) * 100),
  };
}

// ── Calorie Cycling ──────────────────────────────────────────────────────────

export type CyclingMode = "moderate" | "standard" | "aggressive";
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Mon, 6=Sun

export interface CalorieCyclingPrefs {
  /** Which days are training days (0=Mon … 6=Sun). Default: [0,1,3,4] */
  trainingDays: WeekDay[];
  /** Cycling intensity */
  mode: CyclingMode;
  /** Whether the feature is enabled at all */
  enabled: boolean;
}

export interface DayPlan {
  /** 0=Mon … 6=Sun */
  dayIndex: WeekDay;
  label: string;
  shortLabel: string;
  isTraining: boolean;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const CYCLING_MODE_CONFIG: Record<CyclingMode, {
  label: string;
  description: string;
  /** kcal added on training days (removed on rest days), applied symmetrically */
  delta: number;
}> = {
  moderate: {
    label: "Moderat ±150 kcal",
    description: "+150 kcal Trainingstage, −150 kcal Ruhetage. Sanfte Variation — gut für Einsteiger.",
    delta: 150,
  },
  standard: {
    label: "Standard ±300 kcal",
    description: "+300 kcal Trainingstage, −300 kcal Ruhetage. Evidence-based Sweet-Spot.",
    delta: 300,
  },
  aggressive: {
    label: "Aggressiv ±500 kcal",
    description: "+500 kcal Trainingstage, −500 kcal Ruhetage. Maximaler Effekt — für fortgeschrittene Athleten.",
    delta: 500,
  },
};

export const DAY_LABELS = [
  { label: "Montag", short: "Mo" },
  { label: "Dienstag", short: "Di" },
  { label: "Mittwoch", short: "Mi" },
  { label: "Donnerstag", short: "Do" },
  { label: "Freitag", short: "Fr" },
  { label: "Samstag", short: "Sa" },
  { label: "Sonntag", short: "So" },
];

export const DEFAULT_CYCLING_PREFS: CalorieCyclingPrefs = {
  trainingDays: [0, 1, 3, 4], // Mon, Tue, Thu, Fri
  mode: "standard",
  enabled: false,
};

/**
 * Compute a weekly 7-day calorie cycling plan.
 *
 * Strategy:
 *   1. Start from base weekly calorie total (7 × baseTargets.calories)
 *   2. Training days get +delta, rest days get −delta
 *   3. But the *average* must equal baseTargets.calories exactly.
 *      With N training days out of 7, delta is redistributed proportionally
 *      so the weekly total is preserved.
 *
 * Protein stays constant every day (muscle synthesis requires consistent supply).
 * Fat stays constant every day (hormonal stability).
 * Carbs absorb the calorie delta (glycogen-centric adjustment — evidence-based).
 */
export function computeWeeklyCyclingPlan(
  baseTargets: MacroTargets,
  prefs: CalorieCyclingPrefs,
): DayPlan[] {
  const { trainingDays, mode } = prefs;
  const delta = CYCLING_MODE_CONFIG[mode].delta;
  const nTraining = trainingDays.length;
  const nRest = 7 - nTraining;

  // To keep weekly average = base, the effective deltas must sum to zero:
  //   nTraining × trainDelta + nRest × restDelta = 0
  //   trainDelta = -restDelta × (nRest / nTraining)
  // Simplest: set trainDelta = delta, restDelta = -(delta × nTraining / nRest)
  // Guard against 0 training or 7 training days — no cycling possible then.
  let trainDelta = delta;
  let restDelta = nRest > 0 && nTraining > 0 ? -Math.round((delta * nTraining) / nRest) : 0;
  if (nTraining === 0 || nRest === 0) {
    trainDelta = 0;
    restDelta = 0;
  }

  return (Array.from({ length: 7 }, (_, i) => i) as WeekDay[]).map((dayIndex) => {
    const isTraining = trainingDays.includes(dayIndex as WeekDay);
    const calDelta = isTraining ? trainDelta : restDelta;
    const dayCals = Math.max(1200, baseTargets.calories + calDelta);

    // Protein fixed, fat fixed — carbs absorb delta (can't go below 0)
    const proteinKcal = baseTargets.proteinG * 4;
    const fatKcal = baseTargets.fatG * 9;
    const carbKcal = Math.max(0, dayCals - proteinKcal - fatKcal);
    const carbsG = Math.round(carbKcal / 4);

    return {
      dayIndex: dayIndex as WeekDay,
      label: DAY_LABELS[dayIndex].label,
      shortLabel: DAY_LABELS[dayIndex].short,
      isTraining,
      calories: dayCals,
      proteinG: baseTargets.proteinG,
      carbsG,
      fatG: baseTargets.fatG,
    };
  });
}

export function parseCalorieCyclingPrefs(json: string | null | undefined): CalorieCyclingPrefs {
  if (!json) return { ...DEFAULT_CYCLING_PREFS };
  try {
    const parsed = JSON.parse(json) as Partial<CalorieCyclingPrefs>;
    return {
      trainingDays: parsed.trainingDays ?? DEFAULT_CYCLING_PREFS.trainingDays,
      mode: parsed.mode ?? DEFAULT_CYCLING_PREFS.mode,
      enabled: parsed.enabled ?? DEFAULT_CYCLING_PREFS.enabled,
    };
  } catch {
    return { ...DEFAULT_CYCLING_PREFS };
  }
}
