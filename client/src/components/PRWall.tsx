/**
 * PRWall — Cross-exercise personal record wall with milestone badges,
 * improvement ranking, and muscle-group / goal filtering.
 *
 * Data source: GET /api/prs (server-side enriched — each item carries
 * pr, exercise, firstBestWeight, firstDate, totalSessions, improvementPct,
 * milestones[]).
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Trophy, TrendingUp, Dumbbell, Calendar, Flame,
  Star, Zap, Award, Filter, ArrowUpDown, X, ChevronUp, ChevronDown,
} from "lucide-react";
import type { Exercise, ExercisePr } from "@shared/schema";

// ── Types ──────────────────────────────────────────────────────────────────
interface PREntry {
  pr: ExercisePr;
  exercise: Exercise;
  firstBestWeight: number | null;
  firstDate: string | null;
  totalSessions: number;
  improvementPct: number | null;
  milestones: string[];
}

// ── Milestone config ───────────────────────────────────────────────────────
const MILESTONE_CONFIG: Record<string, {
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  priority: number;
}> = {
  plus100: {
    label: "+100%", icon: "🔥", color: "text-red-400",
    bg: "bg-red-500/15", border: "border-red-500/30", priority: 5,
  },
  plus50: {
    label: "+50%", icon: "⚡", color: "text-orange-400",
    bg: "bg-orange-500/15", border: "border-orange-500/30", priority: 4,
  },
  plus25: {
    label: "+25%", icon: "🏆", color: "text-yellow-400",
    bg: "bg-yellow-500/15", border: "border-yellow-500/30", priority: 3,
  },
  plus10: {
    label: "+10%", icon: "📈", color: "text-green-400",
    bg: "bg-green-500/15", border: "border-green-500/30", priority: 2,
  },
  first_log: {
    label: "Erstes Log", icon: "✦", color: "text-blue-400",
    bg: "bg-blue-500/15", border: "border-blue-500/30", priority: 1,
  },
};

// ── Filter config ──────────────────────────────────────────────────────────
const MUSCLE_GROUPS = [
  { key: "", label: "Alle Muskeln" },
  { key: "chest", label: "Brust" },
  { key: "back", label: "Rücken" },
  { key: "legs", label: "Beine" },
  { key: "shoulders", label: "Schultern" },
  { key: "biceps", label: "Bizeps" },
  { key: "triceps", label: "Trizeps" },
  { key: "core", label: "Core" },
  { key: "glutes", label: "Gesäß" },
  { key: "fullbody", label: "Ganzkörper" },
];

const GOAL_OPTIONS = [
  { key: "", label: "Alle Ziele" },
  { key: "powerlifting", label: "Powerlifting" },
  { key: "bodybuilding", label: "Bodybuilding" },
  { key: "weightloss", label: "Abnehmen" },
];

const SORT_OPTIONS = [
  { key: "recency", label: "Neueste PR" },
  { key: "improvement", label: "Beste Verbesserung" },
  { key: "weight", label: "Höchstes Gewicht" },
  { key: "volume", label: "Höchstes Volumen" },
  { key: "sessions", label: "Meiste Einheiten" },
];

const MILESTONE_FILTER_OPTIONS = [
  { key: "", label: "Alle Meilensteine" },
  { key: "plus10", label: "+10% Verbesserung" },
  { key: "plus25", label: "+25% Verbesserung" },
  { key: "plus50", label: "+50% Verbesserung" },
  { key: "first_log", label: "Erste Einheit" },
];

// ── Color helpers ──────────────────────────────────────────────────────────
const MUSCLE_ACCENT: Record<string, string> = {
  chest: "#FF6B1A", back: "#3B82F6", legs: "#10B981",
  shoulders: "#8B5CF6", biceps: "#06B6D4", triceps: "#F59E0B",
  core: "#EF4444", glutes: "#EC4899", fullbody: "#FF6B1A",
};

const GOAL_COLORS: Record<string, string> = {
  powerlifting: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  bodybuilding: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  weightloss:   "bg-green-500/15 text-green-400 border-green-500/25",
};
const GOAL_LABELS: Record<string, string> = {
  powerlifting: "Powerlifting", bodybuilding: "Bodybuilding", weightloss: "Abnehmen",
};

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Improvement bar ────────────────────────────────────────────────────────
function ImprovementBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100);
  const color =
    pct >= 50 ? "bg-red-500" :
    pct >= 25 ? "bg-orange-500" :
    pct >= 10 ? "bg-yellow-500" :
                "bg-green-500";
  return (
    <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-1.5 rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ── Milestone badge strip ──────────────────────────────────────────────────
function MilestoneBadges({ milestones }: { milestones: string[] }) {
  if (milestones.length === 0) return null;
  // Show highest milestone only if there are many; show all if ≤ 2
  const sorted = [...milestones].sort(
    (a, b) => (MILESTONE_CONFIG[b]?.priority ?? 0) - (MILESTONE_CONFIG[a]?.priority ?? 0)
  );
  const toShow = sorted.slice(0, 2);
  return (
    <div className="flex gap-1 flex-wrap">
      {toShow.map(m => {
        const cfg = MILESTONE_CONFIG[m];
        if (!cfg) return null;
        return (
          <span
            key={m}
            className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}
          >
            {cfg.icon} {cfg.label}
          </span>
        );
      })}
    </div>
  );
}

// ── Summary stats bar ──────────────────────────────────────────────────────
function SummaryBar({ entries }: { entries: PREntry[] }) {
  const total = entries.length;
  const withImprovement = entries.filter(e => (e.improvementPct ?? 0) > 0);
  const avgImprovement = withImprovement.length > 0
    ? Math.round(withImprovement.reduce((s, e) => s + (e.improvementPct ?? 0), 0) / withImprovement.length)
    : 0;
  const bestImprovement = withImprovement.length > 0
    ? Math.max(...withImprovement.map(e => e.improvementPct ?? 0))
    : 0;
  const totalSessions = entries.reduce((s, e) => s + e.totalSessions, 0);
  const milestoneCounts = entries.reduce<Record<string, number>>((acc, e) => {
    e.milestones.forEach(m => { acc[m] = (acc[m] ?? 0) + 1; });
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { icon: <Trophy size={16} className="text-yellow-400" />, value: total, label: "PRs gesamt", sub: `${totalSessions} Einheiten` },
        { icon: <TrendingUp size={16} className="text-green-400" />, value: `+${avgImprovement}%`, label: "Ø Verbesserung", sub: withImprovement.length > 0 ? `${withImprovement.length} mit Daten` : "noch keine" },
        { icon: <Flame size={16} className="text-red-400" />, value: bestImprovement > 0 ? `+${bestImprovement}%` : "—", label: "Bester Fortschritt", sub: "Einzelübung" },
        { icon: <Star size={16} className="text-blue-400" />, value: (milestoneCounts.plus50 ?? 0) + (milestoneCounts.plus100 ?? 0), label: "Top-Meilensteine", sub: "+50% oder mehr" },
      ].map((stat, i) => (
        <div key={i} className="stat-card flex flex-col gap-1 py-3">
          <div className="flex items-center gap-2">
            {stat.icon}
            <span className="font-display font-bold text-lg text-foreground">{stat.value}</span>
          </div>
          <p className="text-xs font-semibold text-muted-foreground leading-tight">{stat.label}</p>
          <p className="text-[10px] text-muted-foreground/60">{stat.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── Milestone timeline ─────────────────────────────────────────────────────
function MilestoneTimeline({ entries }: { entries: PREntry[] }) {
  // Collect all entries that have any milestone, sorted by achievedAt
  const milestoneEntries = entries
    .filter(e => e.milestones.length > 0)
    .sort((a, b) => b.pr.achievedAt.localeCompare(a.pr.achievedAt))
    .slice(0, 5);

  if (milestoneEntries.length === 0) return null;

  return (
    <div className="stat-card space-y-3">
      <div className="flex items-center gap-2">
        <Award size={15} className="text-primary" />
        <p className="font-display font-bold text-sm text-foreground">Letzte Meilensteine</p>
      </div>
      <div className="space-y-2.5">
        {milestoneEntries.map(e => {
          // Pick highest milestone for this entry
          const topMilestone = [...e.milestones].sort(
            (a, b) => (MILESTONE_CONFIG[b]?.priority ?? 0) - (MILESTONE_CONFIG[a]?.priority ?? 0)
          )[0];
          const cfg = MILESTONE_CONFIG[topMilestone];
          const accent = MUSCLE_ACCENT[e.exercise.muscleGroup] ?? "#FF6B1A";
          return (
            <div key={e.pr.id} className="flex items-center gap-3">
              {/* Colored dot with exercise accent */}
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{e.exercise.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDate(e.pr.achievedAt)} · {e.pr.bestWeight}kg × {e.pr.bestReps}
                </p>
              </div>
              {cfg && (
                <span className={`flex-shrink-0 flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                  {cfg.icon} {cfg.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PR Card ────────────────────────────────────────────────────────────────
function PRCard({ entry, rank }: { entry: PREntry; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const { pr, exercise, firstBestWeight, firstDate, totalSessions, improvementPct, milestones } = entry;
  const accent = MUSCLE_ACCENT[exercise.muscleGroup] ?? "#FF6B1A";
  const tags = exercise.tags ? exercise.tags.split(",").map(t => t.trim()).filter(Boolean) : [];

  return (
    <div
      className={`rounded-xl border bg-card transition-all duration-200 overflow-hidden ${
        milestones.length > 0 ? "border-primary/30" : "border-border/60"
      }`}
      data-testid={`pr-card-${pr.exerciseId}`}
    >
      {/* Left accent bar */}
      <div className="flex">
        <div className="w-1 flex-shrink-0 rounded-l-xl" style={{ backgroundColor: accent }} />

        <div className="flex-1 p-3 min-w-0">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              {/* Rank number */}
              <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-muted/50 flex items-center justify-center text-[10px] font-bold text-muted-foreground font-display">
                {rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold text-sm text-foreground leading-tight truncate">{exercise.name}</p>
                {exercise.nameEn && (
                  <p className="text-[10px] text-muted-foreground/60 truncate">{exercise.nameEn}</p>
                )}
              </div>
            </div>

            {/* PR weight + reps (right side) */}
            <div className="text-right flex-shrink-0">
              <p className="font-display font-bold text-base text-foreground leading-none">
                {pr.bestWeight}<span className="text-xs text-muted-foreground ml-0.5">kg</span>
              </p>
              <p className="text-[10px] text-muted-foreground">× {pr.bestReps} Wdh</p>
            </div>
          </div>

          {/* Middle row: milestones + improvement */}
          <div className="mt-2 flex items-center justify-between gap-3">
            <MilestoneBadges milestones={milestones} />
            {improvementPct !== null && improvementPct > 0 && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <TrendingUp size={10} className="text-green-400" />
                <span className="text-[11px] font-bold text-green-400">+{improvementPct}%</span>
              </div>
            )}
          </div>

          {/* Improvement bar — only if we have baseline data */}
          {improvementPct !== null && improvementPct > 0 && (
            <div className="mt-2">
              <ImprovementBar pct={improvementPct} />
            </div>
          )}

          {/* Meta row: date + sessions + muscle */}
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar size={9} />
              {formatDate(pr.achievedAt)}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Dumbbell size={9} />
              {totalSessions} {totalSessions === 1 ? "Einheit" : "Einheiten"}
            </span>
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border"
              style={{ color: accent, borderColor: `${accent}40`, backgroundColor: `${accent}15` }}
            >
              {exercise.muscleGroupLabel}
            </span>
          </div>

          {/* Expandable detail */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            data-testid={`pr-card-expand-${pr.exerciseId}`}
          >
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {expanded ? "Weniger" : "Details"}
          </button>

          {expanded && (
            <div className="mt-2.5 pt-2.5 border-t border-border/40 space-y-2">
              {/* Goal tags */}
              {tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {tags.map(tag => (
                    <span key={tag} className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${GOAL_COLORS[tag] ?? "bg-muted/30 text-muted-foreground border-border"}`}>
                      {GOAL_LABELS[tag] ?? tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Baseline */}
              {firstBestWeight !== null && firstDate && (
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Startwert ({formatDate(firstDate)})</span>
                  <span className="font-semibold text-foreground">{firstBestWeight} kg</span>
                </div>
              )}

              {/* Current PR details */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "PR Gewicht", value: `${pr.bestWeight} kg` },
                  { label: "Wdh", value: pr.bestReps },
                  { label: "Volumen", value: `${pr.bestVolume.toFixed(0)} kg` },
                ].map(item => (
                  <div key={item.label} className="bg-background/60 rounded-lg p-2 text-center">
                    <p className="text-xs font-bold font-display text-foreground">{item.value}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>

              {/* All milestone badges in expanded state */}
              {milestones.length > 0 && (
                <div>
                  <p className="text-[9px] font-display font-bold text-muted-foreground uppercase tracking-wider mb-1">Meilensteine</p>
                  <div className="flex flex-wrap gap-1">
                    {milestones.map(m => {
                      const cfg = MILESTONE_CONFIG[m];
                      if (!cfg) return null;
                      return (
                        <span key={m} className={`flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Equipment */}
              <p className="text-[10px] text-muted-foreground">
                Equipment: <span className="text-foreground font-medium">{exercise.equipment === "barbell" ? "Langhantel" : exercise.equipment === "dumbbell" ? "Kurzhantel" : exercise.equipment === "bodyweight" ? "Eigengewicht" : exercise.equipment === "machine" ? "Maschine" : exercise.equipment === "cable" ? "Kabel" : exercise.equipment === "kettlebell" ? "Kettlebell" : exercise.equipment}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main PRWall component ──────────────────────────────────────────────────
export default function PRWall() {
  const [sortBy, setSortBy] = useState("recency");
  const [muscleFilter, setMuscleFilter] = useState("");
  const [goalFilter, setGoalFilter] = useState("");
  const [milestoneFilter, setMilestoneFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: allEntries = [], isLoading } = useQuery<PREntry[]>({
    queryKey: ["/api/prs"],
    queryFn: async () => (await apiRequest("GET", "/api/prs")).json(),
    staleTime: 0,
  });

  // Filter
  const filtered = useMemo(() => {
    let list = [...allEntries];
    if (muscleFilter) list = list.filter(e => e.exercise.muscleGroup === muscleFilter);
    if (goalFilter) list = list.filter(e =>
      e.exercise.tags.split(",").map(t => t.trim()).includes(goalFilter)
    );
    if (milestoneFilter) list = list.filter(e => e.milestones.includes(milestoneFilter));
    return list;
  }, [allEntries, muscleFilter, goalFilter, milestoneFilter]);

  // Sort
  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortBy) {
      case "improvement":
        list.sort((a, b) => (b.improvementPct ?? -1) - (a.improvementPct ?? -1));
        break;
      case "weight":
        list.sort((a, b) => b.pr.bestWeight - a.pr.bestWeight);
        break;
      case "volume":
        list.sort((a, b) => b.pr.bestVolume - a.pr.bestVolume);
        break;
      case "sessions":
        list.sort((a, b) => b.totalSessions - a.totalSessions);
        break;
      case "recency":
      default:
        list.sort((a, b) => b.pr.achievedAt.localeCompare(a.pr.achievedAt));
        break;
    }
    return list;
  }, [filtered, sortBy]);

  const activeFilters = [muscleFilter, goalFilter, milestoneFilter].filter(Boolean).length;
  const clearFilters = () => { setMuscleFilter(""); setGoalFilter(""); setMilestoneFilter(""); };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-card border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (allEntries.length === 0) {
    return (
      <div className="stat-card text-center py-16 space-y-4" data-testid="pr-wall-empty">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Trophy size={28} className="text-primary/60" />
        </div>
        <div>
          <p className="font-display font-bold text-base text-foreground">Noch keine PRs</p>
          <p className="text-sm text-muted-foreground mt-1">
            Öffne eine Übung, logge deine ersten Sätze — und dein erster PR erscheint hier.
          </p>
        </div>
        <p className="text-xs text-muted-foreground/60">
          Tipp: In der Übungsbibliothek → Karte öffnen → „Einheit loggen"
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="pr-wall">
      {/* Summary bar */}
      <SummaryBar entries={allEntries} />

      {/* Milestone timeline */}
      <MilestoneTimeline entries={allEntries} />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sort */}
        <div className="flex items-center gap-1.5 border border-border rounded-xl px-3 py-1.5 bg-card">
          <ArrowUpDown size={12} className="text-muted-foreground flex-shrink-0" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="text-xs font-semibold font-display bg-transparent text-muted-foreground border-none outline-none cursor-pointer"
            data-testid="pr-wall-sort"
          >
            {SORT_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(v => !v)}
          data-testid="pr-wall-filter-toggle"
          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold font-display border transition-colors ${
            activeFilters > 0
              ? "border-primary/50 text-primary bg-primary/10"
              : "border-border text-muted-foreground hover:border-primary/40 bg-card"
          }`}
        >
          <Filter size={12} />
          Filter
          {activeFilters > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center font-bold">
              {activeFilters}
            </span>
          )}
        </button>

        {/* Count */}
        <p className="text-xs text-muted-foreground ml-auto">
          {sorted.length === allEntries.length
            ? `${allEntries.length} PRs`
            : `${sorted.length} von ${allEntries.length} PRs`}
        </p>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="stat-card border-border/50 space-y-3 py-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">Filter</p>
            {activeFilters > 0 && (
              <button onClick={clearFilters} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                <X size={10} /> Zurücksetzen
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Muscle group */}
            <div className="space-y-1.5">
              <p className="text-[9px] font-display font-bold text-muted-foreground uppercase tracking-wider">Muskelgruppe</p>
              <div className="flex flex-wrap gap-1">
                {MUSCLE_GROUPS.map(mg => (
                  <button
                    key={mg.key}
                    onClick={() => setMuscleFilter(mg.key)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
                      muscleFilter === mg.key
                        ? "gradient-orange text-white border-transparent"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {mg.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Training goal */}
            <div className="space-y-1.5">
              <p className="text-[9px] font-display font-bold text-muted-foreground uppercase tracking-wider">Trainingsziel</p>
              <div className="flex flex-wrap gap-1">
                {GOAL_OPTIONS.map(g => (
                  <button
                    key={g.key}
                    onClick={() => setGoalFilter(g.key)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
                      goalFilter === g.key
                        ? "gradient-orange text-white border-transparent"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Milestone filter */}
            <div className="space-y-1.5">
              <p className="text-[9px] font-display font-bold text-muted-foreground uppercase tracking-wider">Meilenstein</p>
              <div className="flex flex-wrap gap-1">
                {MILESTONE_FILTER_OPTIONS.map(m => (
                  <button
                    key={m.key}
                    onClick={() => setMilestoneFilter(m.key)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
                      milestoneFilter === m.key
                        ? "gradient-orange text-white border-transparent"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {activeFilters > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {muscleFilter && (
            <span className="flex items-center gap-1 text-xs bg-primary/15 text-primary border border-primary/30 px-2.5 py-1 rounded-full font-semibold">
              {MUSCLE_GROUPS.find(m => m.key === muscleFilter)?.label}
              <button onClick={() => setMuscleFilter("")}><X size={10} /></button>
            </span>
          )}
          {goalFilter && (
            <span className="flex items-center gap-1 text-xs bg-primary/15 text-primary border border-primary/30 px-2.5 py-1 rounded-full font-semibold">
              {GOAL_OPTIONS.find(g => g.key === goalFilter)?.label}
              <button onClick={() => setGoalFilter("")}><X size={10} /></button>
            </span>
          )}
          {milestoneFilter && (
            <span className="flex items-center gap-1 text-xs bg-primary/15 text-primary border border-primary/30 px-2.5 py-1 rounded-full font-semibold">
              {MILESTONE_FILTER_OPTIONS.find(m => m.key === milestoneFilter)?.label}
              <button onClick={() => setMilestoneFilter("")}><X size={10} /></button>
            </span>
          )}
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline">Alle löschen</button>
        </div>
      )}

      {/* PR List */}
      {sorted.length === 0 ? (
        <div className="stat-card text-center py-10">
          <Zap size={24} className="mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground font-semibold">Keine PRs mit diesen Filtern</p>
          <button onClick={clearFilters} className="mt-2 text-xs text-primary hover:underline">Filter zurücksetzen</button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((entry, idx) => (
            <PRCard key={entry.pr.id} entry={entry} rank={idx + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
