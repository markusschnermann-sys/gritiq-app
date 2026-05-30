/**
 * GritIQ — Age & Gender Training Adaptations
 *
 * Pure logic module. No side effects, no imports from React or the app.
 * Used by program.tsx, workout.tsx, and settings.tsx.
 */

export type CyclePhase = "follicular" | "luteal";

export interface AgeAdaptations {
  isOver40: boolean;
  /** Week number that becomes an extra deload (normally week 3 → deload for 40+) */
  extraDeloadWeek: number | null;
  /** AMRAP percentage reduction (0–1, e.g. 0.05 = 5% off) */
  amrapPctReduction: number;
  /** Warm-up protocol steps */
  warmupProtocol: string[];
  /** Short label for the badge */
  badgeLabel: string;
}

export interface CyclePhaseAdaptations {
  active: boolean; // Only true for female users with a phase set
  phase: CyclePhase | null;
  volumeMultiplier: number; // 1.0 = no change, 0.9 = −10%
  notes: string[];
  badgeLabel: string;
}

export interface AdaptationNote {
  icon: string;
  text: string;
  type: "warning" | "info" | "phase";
}

// ── Age ───────────────────────────────────────────────────────────────────────

export function getAgeAdaptations(age: number | null | undefined): AgeAdaptations {
  const isOver40 = typeof age === "number" && age >= 40;

  if (!isOver40) {
    return {
      isOver40: false,
      extraDeloadWeek: null,
      amrapPctReduction: 0,
      warmupProtocol: [],
      badgeLabel: "",
    };
  }

  return {
    isOver40: true,
    // Week 3 (Realisierung) becomes an additional deload for 40+ users.
    // Evidence: Masters athletes benefit from higher deload frequency
    // (Häkkinen et al., 2000; Izquierdo et al., 2011).
    extraDeloadWeek: 3,
    // AMRAP intensity moderated by 5% to reduce injury risk on max-effort sets.
    // Based on Kraemer & Fleck (2007) recommendations for masters trainees.
    amrapPctReduction: 0.05,
    warmupProtocol: [
      "5 min leichtes Cardio (Fahrrad oder zügiges Gehen)",
      "Hüftkreisen & Schulterrotation je 10×",
      "Bodyweight Squat 2×15 (ohne Last)",
      "Band-Pulls Apart 2×15",
      "Spezifisches Aufwärmen: 3 Rampen-Sätze (50% / 65% / 80% TM × 5)",
    ],
    badgeLabel: "40+ Protokoll",
  };
}

// ── Cycle Phase ───────────────────────────────────────────────────────────────

export function getCyclePhaseAdaptations(
  phase: CyclePhase | null | undefined,
  gender: string | null | undefined,
): CyclePhaseAdaptations {
  const isFemale = gender === "female";

  if (!isFemale || !phase) {
    return {
      active: false,
      phase: null,
      volumeMultiplier: 1.0,
      notes: [],
      badgeLabel: "",
    };
  }

  if (phase === "follicular") {
    return {
      active: true,
      phase: "follicular",
      // Follicular phase (day 1–14): estrogen rising → optimal recovery,
      // strength peaks. Full volume and intensity appropriate.
      // (McNulty et al., 2020; Sports Medicine)
      volumeMultiplier: 1.0,
      notes: [
        "Follikelphase: Östrogen steigt — optimale Regeneration & Kraft.",
        "Normales Volumen und Intensität. Gute Zeit für neue PRs.",
      ],
      badgeLabel: "☀️ Follikelphase",
    };
  }

  return {
    active: true,
    phase: "luteal",
    // Luteal phase (day 15–28): progesterone dominant, core temperature elevated,
    // perceived exertion higher. Volume moderated by −10%.
    // (Romero-Moraleda et al., 2019; Journal of Human Kinetics)
    volumeMultiplier: 0.9,
    notes: [
      "Lutealphase: Progesteron dominant — erhöhte Körpertemperatur & RPE.",
      "Volumen um −10% reduziert. Auf Regeneration und Technik fokussieren.",
    ],
    badgeLabel: "🌙 Lutealphase",
  };
}

// ── Compound notes for display ─────────────────────────────────────────────────

export function getAdaptationNotes(
  age: number | null | undefined,
  gender: string | null | undefined,
  phase: CyclePhase | null | undefined,
): AdaptationNote[] {
  const notes: AdaptationNote[] = [];

  const age40 = getAgeAdaptations(age);
  if (age40.isOver40) {
    notes.push({
      icon: "⚡",
      text: "40+ Protokoll aktiv: Deload alle 3 Wochen · AMRAP −5% · 10 min Warm-up",
      type: "warning",
    });
  }

  const cycleAdapts = getCyclePhaseAdaptations(phase, gender);
  if (cycleAdapts.active && cycleAdapts.phase === "luteal") {
    notes.push({
      icon: "🌙",
      text: "Lutealphase: Volumen −10% · Fokus auf Technik & Regeneration",
      type: "phase",
    });
  } else if (cycleAdapts.active && cycleAdapts.phase === "follicular") {
    notes.push({
      icon: "☀️",
      text: "Follikelphase: Normales Volumen · Optimale Zeit für PRs",
      type: "info",
    });
  }

  return notes;
}

// ── Week-level adaptation helper ──────────────────────────────────────────────

/**
 * Returns whether a given week in the program cycle should be treated as
 * an additional deload for 40+ users.
 */
export function isOver40DeloadWeek(week: number, isOver40: boolean): boolean {
  return isOver40 && week === 3;
}

/**
 * Returns effective AMRAP percentage for a set, applying age-based reduction.
 */
export function getEffectiveAmrapPct(basePct: number, age: number | null | undefined): number {
  const adapts = getAgeAdaptations(age);
  if (!adapts.isOver40) return basePct;
  return Math.round((basePct * (1 - adapts.amrapPctReduction)) * 10) / 10;
}

/**
 * Returns effective number of working sets, applying cycle-phase volume reduction.
 * For luteal phase: round down to nearest whole set (minimum 1).
 */
export function getEffectiveSets(
  baseSets: number,
  phase: CyclePhase | null | undefined,
  gender: string | null | undefined,
): number {
  const cycleAdapts = getCyclePhaseAdaptations(phase, gender);
  if (!cycleAdapts.active) return baseSets;
  return Math.max(1, Math.floor(baseSets * cycleAdapts.volumeMultiplier));
}
