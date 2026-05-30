/**
 * StrengthStandards — Compares the user's stored 1RM for the 4 main lifts
 * against ExRx.net / StrengthLevel.com strength standards, interpolated by
 * bodyweight. Shows current tier badge + kg-to-next-tier progress bar.
 *
 * Sources:
 *   Squat / Bench / Deadlift: https://exrx.net (kg, men, 18–39)
 *   OHP: https://strengthlevel.com/strength-standards/overhead-press/kg (men)
 */
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ChevronRight, Info } from "lucide-react";
import type { User } from "@shared/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

type Tier = "Untrained" | "Novice" | "Intermediate" | "Advanced" | "Elite";

interface StandardRow {
  bw: number; // upper-bound bodyweight for this row (145+ → Infinity)
  untrained: number;
  novice: number;
  intermediate: number;
  advanced: number;
  elite: number;
}

// ─── Raw Standards Tables (kg, Adult Men) ───────────────────────────────────
// Source: ExRx.net — Squat / Bench / Deadlift (18-39, kg)
// Source: StrengthLevel.com — OHP (men, kg)

const SQUAT_STANDARDS: StandardRow[] = [
  { bw: 52,       untrained: 35.0,  novice: 65.0,  intermediate: 80.0,  advanced: 107.5, elite: 145.0 },
  { bw: 56,       untrained: 37.5,  novice: 70.0,  intermediate: 87.5,  advanced: 117.5, elite: 157.5 },
  { bw: 60,       untrained: 40.0,  novice: 77.5,  intermediate: 92.5,  advanced: 127.5, elite: 167.5 },
  { bw: 67,       untrained: 45.0,  novice: 85.0,  intermediate: 105.0, advanced: 142.5, elite: 185.0 },
  { bw: 75,       untrained: 50.0,  novice: 92.5,  intermediate: 112.5, advanced: 155.0, elite: 202.5 },
  { bw: 82,       untrained: 55.0,  novice: 100.0, intermediate: 122.5, advanced: 167.5, elite: 217.5 },
  { bw: 90,       untrained: 57.5,  novice: 105.0, intermediate: 130.0, advanced: 177.5, elite: 230.0 },
  { bw: 100,      untrained: 60.0,  novice: 110.0, intermediate: 135.0, advanced: 185.0, elite: 240.0 },
  { bw: 110,      untrained: 62.5,  novice: 115.0, intermediate: 140.0, advanced: 192.5, elite: 250.0 },
  { bw: 125,      untrained: 65.0,  novice: 117.5, intermediate: 145.0, advanced: 197.5, elite: 257.5 },
  { bw: 145,      untrained: 67.5,  novice: 122.5, intermediate: 147.5, advanced: 202.5, elite: 262.5 },
  { bw: Infinity, untrained: 70.0,  novice: 125.0, intermediate: 150.0, advanced: 207.5, elite: 270.0 },
];

const BENCH_STANDARDS: StandardRow[] = [
  { bw: 52,       untrained: 37.5, novice: 50.0,  intermediate: 60.0,  advanced: 82.5,  elite: 100.0 },
  { bw: 56,       untrained: 40.0, novice: 52.5,  intermediate: 62.5,  advanced: 90.0,  elite: 110.0 },
  { bw: 60,       untrained: 45.0, novice: 57.5,  intermediate: 70.0,  advanced: 95.0,  elite: 117.5 },
  { bw: 67,       untrained: 50.0, novice: 65.0,  intermediate: 77.5,  advanced: 107.5, elite: 132.5 },
  { bw: 75,       untrained: 55.0, novice: 70.0,  intermediate: 85.0,  advanced: 115.0, elite: 145.0 },
  { bw: 82,       untrained: 60.0, novice: 75.0,  intermediate: 90.0,  advanced: 125.0, elite: 157.5 },
  { bw: 90,       untrained: 62.5, novice: 80.0,  intermediate: 97.5,  advanced: 132.5, elite: 162.5 },
  { bw: 100,      untrained: 62.5, novice: 82.5,  intermediate: 102.5, advanced: 137.5, elite: 172.5 },
  { bw: 110,      untrained: 65.0, novice: 85.0,  intermediate: 105.0, advanced: 142.5, elite: 180.0 },
  { bw: 125,      untrained: 67.5, novice: 87.5,  intermediate: 107.5, advanced: 147.5, elite: 185.0 },
  { bw: 145,      untrained: 70.0, novice: 90.0,  intermediate: 112.5, advanced: 152.5, elite: 190.0 },
  { bw: Infinity, untrained: 72.5, novice: 92.5,  intermediate: 115.0, advanced: 155.0, elite: 192.5 },
];

const DEADLIFT_STANDARDS: StandardRow[] = [
  { bw: 52,       untrained: 42.5, novice: 82.5,  intermediate: 92.5,  advanced: 135.0, elite: 175.0 },
  { bw: 56,       untrained: 47.5, novice: 87.5,  intermediate: 100.0, advanced: 145.0, elite: 187.5 },
  { bw: 60,       untrained: 50.0, novice: 95.0,  intermediate: 110.0, advanced: 155.0, elite: 200.0 },
  { bw: 67,       untrained: 57.5, novice: 107.5, intermediate: 122.5, advanced: 172.5, elite: 217.5 },
  { bw: 75,       untrained: 62.5, novice: 115.0, intermediate: 135.0, advanced: 185.0, elite: 235.0 },
  { bw: 82,       untrained: 67.5, novice: 125.0, intermediate: 142.5, advanced: 200.0, elite: 250.0 },
  { bw: 90,       untrained: 70.0, novice: 132.5, intermediate: 152.5, advanced: 207.5, elite: 257.5 },
  { bw: 100,      untrained: 75.0, novice: 137.5, intermediate: 160.0, advanced: 217.5, elite: 265.0 },
  { bw: 110,      untrained: 77.5, novice: 145.0, intermediate: 165.0, advanced: 222.5, elite: 270.0 },
  { bw: 125,      untrained: 80.0, novice: 147.5, intermediate: 170.0, advanced: 227.5, elite: 272.5 },
  { bw: 145,      untrained: 82.5, novice: 152.5, intermediate: 172.5, advanced: 230.0, elite: 277.5 },
  { bw: Infinity, untrained: 85.0, novice: 155.0, intermediate: 177.5, advanced: 232.5, elite: 280.0 },
];

// StrengthLevel.com — OHP (men, kg, by bodyweight)
const OHP_STANDARDS: StandardRow[] = [
  { bw: 52,       untrained: 14,  novice: 28,  intermediate: 47,  advanced: 73,  elite: 102 },
  { bw: 56,       untrained: 16,  novice: 31,  intermediate: 51,  advanced: 78,  elite: 108 },
  { bw: 60,       untrained: 18,  novice: 34,  intermediate: 55,  advanced: 83,  elite: 114 },
  { bw: 65,       untrained: 20,  novice: 37,  intermediate: 59,  advanced: 88,  elite: 119 },
  { bw: 70,       untrained: 22,  novice: 39,  intermediate: 63,  advanced: 93,  elite: 125 },
  { bw: 75,       untrained: 23,  novice: 42,  intermediate: 66,  advanced: 98,  elite: 130 },
  { bw: 80,       untrained: 25,  novice: 44,  intermediate: 70,  advanced: 102, elite: 136 },
  { bw: 85,       untrained: 26,  novice: 47,  intermediate: 73,  advanced: 107, elite: 141 },
  { bw: 90,       untrained: 28,  novice: 49,  intermediate: 76,  advanced: 111, elite: 146 },
  { bw: 95,       untrained: 29,  novice: 51,  intermediate: 79,  advanced: 115, elite: 151 },
  { bw: 100,      untrained: 30,  novice: 54,  intermediate: 82,  advanced: 119, elite: 155 },
  { bw: 105,      untrained: 32,  novice: 56,  intermediate: 85,  advanced: 123, elite: 160 },
  { bw: 110,      untrained: 33,  novice: 58,  intermediate: 88,  advanced: 127, elite: 164 },
  { bw: 115,      untrained: 34,  novice: 60,  intermediate: 90,  advanced: 130, elite: 168 },
  { bw: 120,      untrained: 35,  novice: 62,  intermediate: 93,  advanced: 134, elite: 173 },
  { bw: 125,      untrained: 36,  novice: 64,  intermediate: 95,  advanced: 137, elite: 177 },
  { bw: 130,      untrained: 37,  novice: 66,  intermediate: 98,  advanced: 141, elite: 181 },
  { bw: 135,      untrained: 38,  novice: 67,  intermediate: 100, advanced: 144, elite: 185 },
  { bw: Infinity, untrained: 39,  novice: 69,  intermediate: 102, advanced: 147, elite: 189 },
];

// ─── Interpolation logic ────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function getStandardsForBW(table: StandardRow[], bodyweight: number): {
  untrained: number; novice: number; intermediate: number; advanced: number; elite: number;
} {
  // Find surrounding rows
  const rows = table;
  const sorted = [...rows].sort((a, b) => a.bw - b.bw);

  // Below first row → use first row
  if (bodyweight <= sorted[0].bw) return sorted[0];

  // Above last finite row → use last row
  const lastFinite = sorted[sorted.length - 2]; // second-to-last (last is Infinity)
  const lastRow = sorted[sorted.length - 1];
  if (bodyweight >= lastFinite.bw) return lastRow;

  // Find the two bracketing rows
  let lower = sorted[0];
  let upper = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].bw >= bodyweight) {
      lower = i > 0 ? sorted[i - 1] : sorted[0];
      upper = sorted[i];
      break;
    }
  }

  // If bodyweight falls exactly on a row, use it
  if (upper.bw === bodyweight) return upper;

  // Linear interpolation between lower and upper
  const t = (bodyweight - lower.bw) / (upper.bw - lower.bw);
  return {
    untrained:    Math.round(lerp(lower.untrained,    upper.untrained,    t) * 2) / 2,
    novice:       Math.round(lerp(lower.novice,       upper.novice,       t) * 2) / 2,
    intermediate: Math.round(lerp(lower.intermediate, upper.intermediate, t) * 2) / 2,
    advanced:     Math.round(lerp(lower.advanced,     upper.advanced,     t) * 2) / 2,
    elite:        Math.round(lerp(lower.elite,        upper.elite,        t) * 2) / 2,
  };
}

function getTier(standards: ReturnType<typeof getStandardsForBW>, liftKg: number): Tier {
  if (liftKg >= standards.elite)        return "Elite";
  if (liftKg >= standards.advanced)     return "Advanced";
  if (liftKg >= standards.intermediate) return "Intermediate";
  if (liftKg >= standards.novice)       return "Novice";
  return "Untrained";
}

function getNextTier(current: Tier): Tier | null {
  const order: Tier[] = ["Untrained", "Novice", "Intermediate", "Advanced", "Elite"];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : null;
}

function getNextTierTarget(standards: ReturnType<typeof getStandardsForBW>, nextTier: Tier): number {
  switch (nextTier) {
    case "Untrained":    return standards.untrained;
    case "Novice":       return standards.novice;
    case "Intermediate": return standards.intermediate;
    case "Advanced":     return standards.advanced;
    case "Elite":        return standards.elite;
  }
}

function getPrevTierTarget(standards: ReturnType<typeof getStandardsForBW>, current: Tier): number {
  switch (current) {
    case "Novice":       return standards.untrained;
    case "Intermediate": return standards.novice;
    case "Advanced":     return standards.intermediate;
    case "Elite":        return standards.advanced;
    default:             return 0;
  }
}

// ─── Tier visual config ──────────────────────────────────────────────────────

const TIER_CONFIG: Record<Tier, {
  label: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  barColor: string;
}> = {
  Untrained:    { label: "Untrainiert",    color: "text-zinc-400",   bg: "bg-zinc-500/15",   border: "border-zinc-500/30",   glow: "",                          barColor: "bg-zinc-500"    },
  Novice:       { label: "Anfänger",       color: "text-blue-400",   bg: "bg-blue-500/15",   border: "border-blue-500/30",   glow: "shadow-blue-500/20",        barColor: "bg-blue-500"    },
  Intermediate: { label: "Fortgeschritten",color: "text-green-400",  bg: "bg-green-500/15",  border: "border-green-500/30",  glow: "shadow-green-500/20",       barColor: "bg-green-500"   },
  Advanced:     { label: "Erfahren",       color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/30", glow: "shadow-orange-500/20",      barColor: "bg-orange-500"  },
  Elite:        { label: "Elite",          color: "text-yellow-400", bg: "bg-yellow-500/15", border: "border-yellow-500/30", glow: "shadow-yellow-500/20",      barColor: "bg-yellow-400"  },
};

const NEXT_TIER_LABELS: Record<Tier, string> = {
  Untrained:    "Anfänger",
  Novice:       "Fortgeschritten",
  Intermediate: "Erfahren",
  Advanced:     "Elite",
  Elite:        "Elite",
};

// ─── Lift config ─────────────────────────────────────────────────────────────

interface LiftConfig {
  key: "squat" | "bench" | "deadlift" | "ohp";
  label: string;
  labelDe: string;
  icon: string;
  table: StandardRow[];
  userMaxKey: keyof User;
  source: string;
  sourceUrl: string;
  accentColor: string;
}

const LIFTS: LiftConfig[] = [
  {
    key: "squat",     label: "Squat",          labelDe: "Kniebeuge",
    icon: "🏋️",      table: SQUAT_STANDARDS,
    userMaxKey: "squatMax",
    source: "ExRx.net",       sourceUrl: "https://exrx.net/Testing/WeightLifting/SquatStandardsKg",
    accentColor: "from-orange-500/20 to-transparent",
  },
  {
    key: "bench",     label: "Bench Press",    labelDe: "Bankdrücken",
    icon: "💪",      table: BENCH_STANDARDS,
    userMaxKey: "benchMax",
    source: "ExRx.net",       sourceUrl: "https://exrx.net/Testing/WeightLifting/BenchStandardsKg",
    accentColor: "from-blue-500/20 to-transparent",
  },
  {
    key: "deadlift",  label: "Deadlift",       labelDe: "Kreuzheben",
    icon: "🔥",      table: DEADLIFT_STANDARDS,
    userMaxKey: "deadliftMax",
    source: "ExRx.net",       sourceUrl: "https://exrx.net/Testing/WeightLifting/DeadliftStandardsKg",
    accentColor: "from-red-500/20 to-transparent",
  },
  {
    key: "ohp",       label: "Overhead Press", labelDe: "Schulterdrücken",
    icon: "⬆️",      table: OHP_STANDARDS,
    userMaxKey: "ohpMax",
    source: "StrengthLevel",  sourceUrl: "https://strengthlevel.com/strength-standards/overhead-press/kg",
    accentColor: "from-purple-500/20 to-transparent",
  },
];

// ─── Tier row (mini bar inside the card) ────────────────────────────────────

function TierRow({
  tier,
  target,
  isCurrent,
  isNext,
  userMax,
}: {
  tier: Tier;
  target: number;
  isCurrent: boolean;
  isNext: boolean;
  userMax: number;
}) {
  const cfg = TIER_CONFIG[tier];
  const reached = userMax >= target;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all",
        isCurrent && "ring-1 ring-inset " + cfg.border + " " + cfg.bg,
        !isCurrent && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("font-semibold font-display", cfg.color)}>{cfg.label}</span>
        {isCurrent && (
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold border", cfg.bg, cfg.border, cfg.color)}>
            AKTUELL
          </span>
        )}
        {isNext && !reached && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-primary/15 border border-primary/30 text-primary">
            NÄCHSTES ZIEL
          </span>
        )}
      </div>
      <span className="text-muted-foreground font-mono">{target} kg</span>
    </div>
  );
}

// ─── Single lift card ────────────────────────────────────────────────────────

function LiftCard({ lift, user }: { lift: LiftConfig; user: User }) {
  const bodyweight = user.bodyweight ?? 80;
  const userMax = (user[lift.userMaxKey] as number) ?? 0;

  const standards = getStandardsForBW(lift.table, bodyweight);
  const currentTier = getTier(standards, userMax);
  const nextTier = getNextTier(currentTier);
  const cfg = TIER_CONFIG[currentTier];

  // Progress bar from current tier floor → next tier ceiling
  const prevFloor = getPrevTierTarget(standards, currentTier);
  const nextCeiling = nextTier ? getNextTierTarget(standards, nextTier) : userMax;
  const kgToNext = nextTier ? Math.max(0, nextCeiling - userMax) : 0;

  // Progress 0-1 within current tier band
  const bandTotal = nextCeiling - prevFloor;
  const bandProgress = bandTotal > 0 ? Math.min(1, (userMax - prevFloor) / bandTotal) : 1;

  const TIERS: Tier[] = ["Untrained", "Novice", "Intermediate", "Advanced", "Elite"];
  // Map each tier to its threshold
  const tierThresholds: Record<Tier, number> = {
    Untrained:    standards.untrained,
    Novice:       standards.novice,
    Intermediate: standards.intermediate,
    Advanced:     standards.advanced,
    Elite:        standards.elite,
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card",
        "transition-all duration-200 hover:border-border/60",
        cfg.glow && `shadow-lg ${cfg.glow}`,
      )}
      data-testid={`strength-card-${lift.key}`}
    >
      {/* Gradient top accent */}
      <div className={cn("absolute inset-x-0 top-0 h-24 bg-gradient-to-b opacity-40 pointer-events-none", lift.accentColor)} />

      <div className="relative p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{lift.icon}</span>
            <div>
              <h3 className="font-display font-bold text-sm text-foreground">{lift.labelDe}</h3>
              <p className="text-xs text-muted-foreground">{lift.label}</p>
            </div>
          </div>

          {/* Tier badge */}
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold font-display",
            cfg.bg, cfg.border, cfg.color,
          )}>
            {currentTier === "Elite" && <span>★</span>}
            {cfg.label}
          </div>
        </div>

        {/* Current max + next tier callout */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-display font-black text-foreground leading-none">
              {userMax}
              <span className="text-base font-semibold text-muted-foreground ml-1">kg</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">1RM (gespeichert)</p>
          </div>

          {nextTier && kgToNext > 0 ? (
            <div className="text-right">
              <p className={cn("text-xl font-display font-black leading-none", cfg.color)}>
                +{kgToNext} kg
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                bis {NEXT_TIER_LABELS[currentTier]}
              </p>
            </div>
          ) : currentTier === "Elite" ? (
            <div className="text-right">
              <p className="text-xl font-display font-black leading-none text-yellow-400">★ Elite</p>
              <p className="text-xs text-muted-foreground mt-1">Maximales Niveau</p>
            </div>
          ) : null}
        </div>

        {/* Progress bar inside current tier band */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{cfg.label} ({prevFloor > 0 ? prevFloor + " kg" : "0 kg"})</span>
            {nextTier && <span>{NEXT_TIER_LABELS[currentTier]} ({nextCeiling} kg)</span>}
          </div>
          <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", cfg.barColor)}
              style={{ width: `${Math.round(bandProgress * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-right text-muted-foreground">
            {Math.round(bandProgress * 100)}% der aktuellen Stufe
          </p>
        </div>

        {/* Tier breakdown rows */}
        <div className="space-y-1 pt-1 border-t border-border/50">
          {TIERS.map((tier) => {
            const isCurrent = tier === currentTier;
            const isNext = nextTier === tier;
            return (
              <TierRow
                key={tier}
                tier={tier}
                target={tierThresholds[tier]}
                isCurrent={isCurrent}
                isNext={isNext}
                userMax={userMax}
              />
            );
          })}
        </div>

        {/* Source attribution */}
        <p className="text-[10px] text-muted-foreground/50 text-right">
          Quelle: <a href={lift.sourceUrl} target="_top" className="underline hover:text-muted-foreground">{lift.source}</a>
          {" "}· Männer · 18–39 · {bodyweight} kg KG
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StrengthStandards() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/user"],
    queryFn: async () => (await apiRequest("GET", "/api/user")).json(),
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-4xl mb-4">⚠️</p>
        <p className="font-display font-bold text-base">Nutzerdaten nicht gefunden</p>
      </div>
    );
  }

  const bodyweight = user.bodyweight ?? 80;

  // Quick summary: how many lifts are at Intermediate or above?
  const summaryLifts = LIFTS.map((l) => {
    const bw = bodyweight;
    const max = (user[l.userMaxKey] as number) ?? 0;
    const standards = getStandardsForBW(l.table, bw);
    return { tier: getTier(standards, max) };
  });
  const advancedCount = summaryLifts.filter(
    (l) => l.tier === "Advanced" || l.tier === "Elite"
  ).length;

  return (
    <div className="space-y-5" data-testid="strength-standards">
      {/* Section header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-base font-bold flex items-center gap-2">
            <TrendingUp size={16} className="text-primary" />
            Kraftniveau-Vergleich
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Deine 1RM im Vergleich zu etablierten Kraftstandards · {bodyweight} kg Körpergewicht
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/40 rounded-lg px-2.5 py-1.5 border border-border">
          <Info size={10} />
          ExRx · StrengthLevel
        </div>
      </div>

      {/* Quick summary chips */}
      <div className="flex flex-wrap gap-2">
        {LIFTS.map((lift) => {
          const max = (user[lift.userMaxKey] as number) ?? 0;
          const standards = getStandardsForBW(lift.table, bodyweight);
          const tier = getTier(standards, max);
          const cfg = TIER_CONFIG[tier];
          return (
            <div
              key={lift.key}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold font-display",
                cfg.bg, cfg.border, cfg.color,
              )}
            >
              <span>{lift.icon}</span>
              <span>{lift.labelDe}</span>
              <ChevronRight size={10} className="opacity-60" />
              <span>{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {advancedCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-semibold">
          <span>🏆</span>
          {advancedCount === 4
            ? "Alle 4 Haupthübe auf Advanced oder Elite — herausragende Leistung!"
            : `${advancedCount} von 4 Haupthüben auf Advanced oder Elite`}
        </div>
      )}

      {/* 2-column grid on desktop, single column on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {LIFTS.map((lift) => (
          <LiftCard key={lift.key} lift={lift} user={user} />
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground/50 text-center leading-relaxed">
        Kraftstandards basieren auf ExRx.net (Kniebeuge, Bankdrücken, Kreuzheben) und StrengthLevel.com (Schulterdrücken)
        für erwachsene Männer (18–39 Jahre). Dein gespeicherter 1RM wird mit der nächstgelegenen Körpergewichtsklasse verglichen.
      </p>
    </div>
  );
}
