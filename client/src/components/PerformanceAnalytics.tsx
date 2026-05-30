/**
 * PerformanceAnalytics — RPE & Performance trend view for the Verlauf section.
 *
 * Displays per-lift trend lines for:
 *   • Average session RPE
 *   • Performance ratio (actual vs. target reps, non-AMRAP sets)
 *   • AMRAP surplus (actual − target reps on AMRAP set)
 *
 * Flags sessions where RPE spiked ≥1.5 points vs. rolling 2-session average
 * without a corresponding performance gain — shown as ⚠️ overreach markers.
 *
 * All charts are pure SVG — no external chart library needed.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Activity, ChevronDown, ChevronUp } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AnalyticsSession {
  sessionId: number;
  date: string;
  lift: string;
  wave: number;
  week: number;
  sessionDifficulty: number | null;
  readinessScore: number | null;
  fatigueScore: number | null;
  avgRpe: number | null;
  amrapReps: number | null;
  amrapTargetReps: number | null;
  amrapTargetWeight: number | null;
  totalActualReps: number;
  totalTargetReps: number;
  performanceRatio: number | null;
}

interface OverreachFlag {
  sessionId: number;
  date: string;
  lift: string;
  wave: number;
  week: number;
  reason: string;
}

interface AnalyticsData {
  sessions: AnalyticsSession[];
  byLift: Record<string, AnalyticsSession[]>;
  overreachFlags: OverreachFlag[];
  userMaxes: { squat: number; bench: number; deadlift: number; ohp: number };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const LIFTS = [
  { key: "squat",     label: "Kniebeuge",       emoji: "🏋️", color: "#FF6B1A", colorMuted: "rgba(255,107,26,0.15)" },
  { key: "bench",     label: "Bankdrücken",      emoji: "💪",  color: "#3B82F6", colorMuted: "rgba(59,130,246,0.15)" },
  { key: "deadlift",  label: "Kreuzheben",       emoji: "🔥",  color: "#EF4444", colorMuted: "rgba(239,68,68,0.15)"  },
  { key: "ohp",       label: "Schulterdrücken",  emoji: "⬆️",  color: "#A855F7", colorMuted: "rgba(168,85,247,0.15)" },
] as const;

const WAVE_NAMES = ["", "10s Wave", "8s Wave", "5s Wave", "3s Wave"];
const WEEK_NAMES = ["", "Akkumulation", "Intensivierung", "Realisierung", "Deload"];

// ── SVG Sparkline ─────────────────────────────────────────────────────────────
function Sparkline({
  data,
  color,
  colorMuted,
  flaggedIndices = [],
  yMin,
  yMax,
  height = 72,
  showArea = true,
}: {
  data: (number | null)[];
  color: string;
  colorMuted: string;
  flaggedIndices?: number[];
  yMin?: number;
  yMax?: number;
  height?: number;
  showArea?: boolean;
}) {
  const W = 300;
  const H = height;
  const PAD = { t: 8, b: 8, l: 4, r: 4 };
  const valid = data.filter((v): v is number => v !== null);
  if (valid.length < 2) {
    return (
      <div className="flex items-center justify-center h-16 text-muted-foreground text-xs">
        Nicht genug Daten
      </div>
    );
  }

  const lo = yMin ?? Math.min(...valid);
  const hi = yMax ?? Math.max(...valid);
  const range = hi - lo || 1;

  const xScale = (i: number) =>
    PAD.l + ((i / (data.length - 1)) * (W - PAD.l - PAD.r));
  const yScale = (v: number) =>
    PAD.t + ((1 - (v - lo) / range) * (H - PAD.t - PAD.b));

  // Build path only through non-null points
  const points: { x: number; y: number; i: number }[] = [];
  data.forEach((v, i) => {
    if (v !== null) points.push({ x: xScale(i), y: yScale(v), i });
  });

  const linePath = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    `${linePath} L ${points[points.length - 1].x.toFixed(1)},${(H - PAD.b).toFixed(1)}` +
    ` L ${points[0].x.toFixed(1)},${(H - PAD.b).toFixed(1)} Z`;

  // Horizontal reference lines
  const refLines = [0.25, 0.5, 0.75].map(f => ({
    y: PAD.t + (1 - f) * (H - PAD.t - PAD.b),
  }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {refLines.map((l, i) => (
        <line
          key={i}
          x1={PAD.l} y1={l.y} x2={W - PAD.r} y2={l.y}
          stroke="currentColor" strokeOpacity="0.06" strokeWidth="1"
        />
      ))}

      {/* Area fill */}
      {showArea && (
        <path
          d={areaPath}
          fill={`url(#grad-${color.replace("#", "")})`}
        />
      )}

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data dots + overreach markers */}
      {points.map(({ x, y, i }) => {
        const flagged = flaggedIndices.includes(i);
        return (
          <g key={i}>
            {flagged && (
              <>
                <circle cx={x} cy={y} r="9" fill="rgba(234,179,8,0.15)" />
                <circle cx={x} cy={y} r="6" fill="rgba(234,179,8,0.3)" stroke="#EAB308" strokeWidth="1.5" />
                {/* ⚠ triangle */}
                <text x={x} y={y + 4} textAnchor="middle" fontSize="7" fill="#EAB308">!</text>
              </>
            )}
            {!flagged && (
              <circle
                cx={x} cy={y} r="3"
                fill={color}
                stroke="var(--background)"
                strokeWidth="1.5"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Trend Badge ───────────────────────────────────────────────────────────────
function TrendBadge({ values }: { values: (number | null)[] }) {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return null;
  const delta = valid[valid.length - 1] - valid[valid.length - 2];
  const pct = ((delta / valid[valid.length - 2]) * 100).toFixed(1);
  if (Math.abs(delta) < 0.05) return (
    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus size={11} /> Stabil
    </span>
  );
  return delta > 0
    ? <span className="flex items-center gap-0.5 text-xs text-green-400"><TrendingUp size={11} /> +{pct}%</span>
    : <span className="flex items-center gap-0.5 text-xs text-red-400"><TrendingDown size={11} /> {pct}%</span>;
}

// ── Stat Pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-secondary/50 rounded-lg px-3 py-2 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn("font-display font-bold text-sm", accent ?? "text-foreground")}>{value}</span>
    </div>
  );
}

// ── Chart Card ────────────────────────────────────────────────────────────────
function LiftChartCard({
  lift,
  sessions,
  flags,
  expanded,
  onToggle,
}: {
  lift: typeof LIFTS[number];
  sessions: AnalyticsSession[];
  flags: OverreachFlag[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const flaggedIds = new Set(flags.filter(f => f.lift === lift.key).map(f => f.sessionId));

  // Build time-ordered series
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  const rpeData = sorted.map(s => s.avgRpe);
  const perfData = sorted.map(s => s.performanceRatio !== null ? +(s.performanceRatio * 100).toFixed(1) : null);
  const amrapData = sorted.map(s =>
    s.amrapReps !== null && s.amrapTargetReps !== null ? s.amrapReps - s.amrapTargetReps : null
  );
  const flaggedIndicesRpe = sorted.map((s, i) => flaggedIds.has(s.sessionId) ? i : -1).filter(i => i >= 0);
  const flaggedIndicesPerf = sorted.map((s, i) => flaggedIds.has(s.sessionId) ? i : -1).filter(i => i >= 0);

  const lastSession = sorted[sorted.length - 1];
  const avgRpeAll = rpeData.filter((v): v is number => v !== null);
  const avgRpe = avgRpeAll.length ? (avgRpeAll.reduce((a, b) => a + b, 0) / avgRpeAll.length).toFixed(1) : "—";
  const perfValid = perfData.filter((v): v is number => v !== null);
  const avgPerf = perfValid.length ? (perfValid.reduce((a, b) => a + b, 0) / perfValid.length).toFixed(0) : "—";
  const amrapValid = amrapData.filter((v): v is number => v !== null);
  const avgAmrap = amrapValid.length ? (amrapValid.reduce((a, b) => a + b, 0) / amrapValid.length).toFixed(1) : "—";
  const flagCount = flags.filter(f => f.lift === lift.key).length;

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">{lift.emoji}</span>
          <div>
            <p className="font-display font-semibold text-sm">{lift.label}</p>
            <p className="text-xs text-muted-foreground">Noch keine Daten</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/20 transition-colors"
        onClick={onToggle}
      >
        <span className="text-xl flex-shrink-0">{lift.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-display font-bold text-sm">{lift.label}</p>
            {flagCount > 0 && (
              <span className="flex items-center gap-1 text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 rounded-full px-2 py-0.5">
                <AlertTriangle size={10} />
                {flagCount} Überreach
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sorted.length} Einheit{sorted.length !== 1 ? "en" : ""}
            {lastSession ? ` · zuletzt ${lastSession.date}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <TrendBadge values={rpeData} />
          {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Quick stats row — always visible */}
      <div className="grid grid-cols-3 gap-2 px-4 pb-3">
        <StatPill label="⌀ RPE" value={avgRpe !== "—" ? `${avgRpe} / 10` : "—"} accent={
          avgRpe !== "—" && parseFloat(avgRpe) > 8 ? "text-red-400" :
          avgRpe !== "—" && parseFloat(avgRpe) < 7 ? "text-green-400" : "text-foreground"
        } />
        <StatPill label="⌀ Leistung" value={avgPerf !== "—" ? `${avgPerf}%` : "—"} accent={
          avgPerf !== "—" && parseInt(avgPerf) >= 100 ? "text-green-400" :
          avgPerf !== "—" && parseInt(avgPerf) < 90 ? "text-red-400" : "text-foreground"
        } />
        <StatPill label="⌀ AMRAP +" value={avgAmrap !== "—" ? `+${avgAmrap} Wdh.` : "—"} accent="text-primary" />
      </div>

      {/* Expanded charts */}
      {expanded && (
        <div className="px-4 pb-4 space-y-5 border-t border-border pt-4">

          {/* RPE Trend */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">RPE-Verlauf</p>
              <TrendBadge values={rpeData} />
            </div>
            <div className="relative">
              <Sparkline
                data={rpeData}
                color={lift.color}
                colorMuted={lift.colorMuted}
                flaggedIndices={flaggedIndicesRpe}
                yMin={5}
                yMax={10}
                height={72}
              />
              {/* Y axis labels */}
              <div className="absolute top-0 right-0 flex flex-col justify-between h-full text-[9px] text-muted-foreground py-1 pr-1">
                <span>10</span>
                <span>7.5</span>
                <span>5</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Zielbereich RPE 7–8.5 · {flaggedIndicesRpe.length > 0 ? `⚠ ${flaggedIndicesRpe.length} Spike(s) markiert` : "Keine Spikes"}
            </p>
          </div>

          {/* Performance Ratio Trend */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Leistungsquote (Ist / Soll Wdh.)</p>
              <TrendBadge values={perfData} />
            </div>
            <div className="relative">
              <Sparkline
                data={perfData}
                color="#22C55E"
                colorMuted="rgba(34,197,94,0.1)"
                flaggedIndices={flaggedIndicesPerf}
                yMin={70}
                yMax={130}
                height={64}
              />
              {/* 100% reference */}
              <div className="absolute top-0 right-0 flex flex-col justify-between h-full text-[9px] text-muted-foreground py-1 pr-1">
                <span>130%</span>
                <span>100%</span>
                <span>70%</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">100% = alle programmierten Wdh. absolviert</p>
          </div>

          {/* AMRAP surplus */}
          {amrapValid.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AMRAP-Überschuss (Wdh. über Ziel)</p>
              <Sparkline
                data={amrapData}
                color="#A855F7"
                colorMuted="rgba(168,85,247,0.1)"
                yMin={-3}
                yMax={Math.max(...amrapValid) + 2}
                height={56}
                showArea={false}
              />
              <p className="text-[10px] text-muted-foreground">Positiv = mehr Wdh. als Mindestziel · Grundlage für 1RM-Progression</p>
            </div>
          )}

          {/* Session detail table */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Einzel-Sessions</p>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Datum</th>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium hidden sm:table-cell">Phase</th>
                    <th className="text-center px-2 py-2 text-muted-foreground font-medium">RPE</th>
                    <th className="text-center px-2 py-2 text-muted-foreground font-medium">Leis.</th>
                    <th className="text-center px-2 py-2 text-muted-foreground font-medium">AMRAP</th>
                    <th className="text-center px-2 py-2 text-muted-foreground font-medium w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => {
                    const isFlagged = flaggedIds.has(s.sessionId);
                    return (
                      <tr
                        key={s.sessionId}
                        className={cn(
                          "border-b border-border/50 last:border-0 transition-colors",
                          isFlagged ? "bg-yellow-500/5" : "hover:bg-secondary/20"
                        )}
                      >
                        <td className="px-3 py-2 font-medium">{s.date}</td>
                        <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                          {WAVE_NAMES[s.wave]} · {WEEK_NAMES[s.week]}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {s.avgRpe !== null ? (
                            <span className={cn(
                              "font-display font-bold",
                              s.avgRpe >= 9 ? "text-red-400" :
                              s.avgRpe >= 8 ? "text-yellow-400" : "text-green-400"
                            )}>
                              {s.avgRpe.toFixed(1)}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {s.performanceRatio !== null ? (
                            <span className={cn(
                              "font-display font-semibold",
                              s.performanceRatio >= 1 ? "text-green-400" :
                              s.performanceRatio >= 0.9 ? "text-foreground" : "text-red-400"
                            )}>
                              {(s.performanceRatio * 100).toFixed(0)}%
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {s.amrapReps !== null && s.amrapTargetReps !== null ? (
                            <span className={cn(
                              "font-display font-semibold",
                              s.amrapReps >= s.amrapTargetReps ? "text-primary" : "text-red-400"
                            )}>
                              {s.amrapReps}{s.amrapTargetReps ? ` / ${s.amrapTargetReps}` : ""}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {isFlagged && (
                            <span title="Überreach-Signal">
                              <AlertTriangle size={12} className="text-yellow-400 mx-auto" />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Overreach Summary Panel ───────────────────────────────────────────────────
function OverreachPanel({ flags }: { flags: OverreachFlag[] }) {
  if (flags.length === 0) {
    return (
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
          <Activity size={16} className="text-green-400" />
        </div>
        <div>
          <p className="text-sm font-display font-bold text-green-400">Kein Überreach erkannt</p>
          <p className="text-xs text-muted-foreground mt-0.5">RPE-Spikes ohne Leistungsgewinn wurden in keiner Session detektiert.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-display font-bold text-yellow-300">
            {flags.length} potenzielle{flags.length !== 1 ? " Überreach-Signale" : "s Überreach-Signal"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sessions mit RPE-Anstieg ≥ 1,5 ohne entsprechende Leistungssteigerung
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {flags.map((f) => {
          const liftCfg = LIFTS.find(l => l.key === f.lift);
          return (
            <div
              key={`${f.sessionId}`}
              className="flex items-start gap-3 bg-background/40 rounded-lg p-3"
            >
              <span className="text-base flex-shrink-0 mt-0.5">{liftCfg?.emoji ?? "🏋️"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold">{liftCfg?.label ?? f.lift}</p>
                  <span className="text-xs text-muted-foreground">{f.date}</span>
                  <span className="text-[10px] bg-secondary rounded-full px-2 py-0.5 text-muted-foreground">
                    {WAVE_NAMES[f.wave]} · {WEEK_NAMES[f.week]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{f.reason}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-muted-foreground border-t border-yellow-500/15 pt-3">
        <strong className="text-yellow-400">Empfehlung:</strong> Deload einplanen oder Intensität in der nächsten Woche um 5–10% reduzieren. Priorität: Schlaf- und Ernährungsqualität prüfen.
      </div>
    </div>
  );
}

// ── Recovery Quality Score ────────────────────────────────────────────────────
function RecoveryOverview({ sessions }: { sessions: AnalyticsSession[] }) {
  const withReadiness = sessions.filter(s => s.readinessScore !== null);
  const withFatigue = sessions.filter(s => s.fatigueScore !== null);
  const withDifficulty = sessions.filter(s => s.sessionDifficulty !== null);

  const avgReadiness = withReadiness.length
    ? (withReadiness.reduce((a, s) => a + s.readinessScore!, 0) / withReadiness.length).toFixed(1)
    : null;
  const avgFatigue = withFatigue.length
    ? (withFatigue.reduce((a, s) => a + s.fatigueScore!, 0) / withFatigue.length).toFixed(1)
    : null;
  const avgDifficulty = withDifficulty.length
    ? (withDifficulty.reduce((a, s) => a + s.sessionDifficulty!, 0) / withDifficulty.length).toFixed(1)
    : null;

  if (!avgReadiness && !avgFatigue && !avgDifficulty) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity size={15} className="text-primary" />
        <p className="font-display font-bold text-sm">Recovery-Überblick</p>
        <span className="text-xs text-muted-foreground">({sessions.length} Sessions gesamt)</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {avgReadiness && (
          <StatPill
            label="⌀ Bereitschaft"
            value={`${avgReadiness} / 5`}
            accent={parseFloat(avgReadiness) >= 4 ? "text-green-400" : parseFloat(avgReadiness) < 3 ? "text-red-400" : "text-foreground"}
          />
        )}
        {avgFatigue && (
          <StatPill
            label="⌀ Ermüdung"
            value={`${avgFatigue} / 5`}
            accent={parseFloat(avgFatigue) <= 2 ? "text-green-400" : parseFloat(avgFatigue) >= 4 ? "text-red-400" : "text-foreground"}
          />
        )}
        {avgDifficulty && (
          <StatPill
            label="⌀ Schwierigkeit"
            value={`${avgDifficulty} / 10`}
            accent={parseFloat(avgDifficulty) >= 9 ? "text-red-400" : parseFloat(avgDifficulty) <= 7 ? "text-green-400" : "text-foreground"}
          />
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PerformanceAnalytics() {
  const [expandedLifts, setExpandedLifts] = useState<Set<string>>(new Set(["squat"]));

  const { data, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
    queryFn: async () => (await apiRequest("GET", "/api/analytics")).json(),
    staleTime: 30_000,
  });

  const toggleLift = (key: string) => {
    setExpandedLifts(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Total session count with RPE data
  const rpeSessionCount = useMemo(
    () => data?.sessions.filter(s => s.avgRpe !== null).length ?? 0,
    [data]
  );

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        Fehler beim Laden der Analyse-Daten.
      </div>
    );
  }

  const { sessions, byLift, overreachFlags } = data;

  if (sessions.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground px-4">
        <p className="text-4xl mb-4">📊</p>
        <p className="font-display font-bold text-base mb-1">Noch keine Analyse-Daten</p>
        <p className="text-sm">Schließe mindestens eine Session mit RPE-Werten ab, um den Analytics-View zu nutzen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div>
        <h2 className="font-display text-lg font-bold">Performance-Analyse</h2>
        <p className="text-muted-foreground text-xs mt-0.5">
          {rpeSessionCount > 0
            ? `${rpeSessionCount} Session${rpeSessionCount !== 1 ? "s" : ""} mit RPE-Daten · ${overreachFlags.length} Überreach-Signal${overreachFlags.length !== 1 ? "e" : ""}`
            : `${sessions.length} Sessions · RPE-Erfassung beim nächsten Workout aktivieren`}
        </p>
      </div>

      {/* Overreach summary */}
      <OverreachPanel flags={overreachFlags} />

      {/* Recovery overview */}
      <RecoveryOverview sessions={sessions} />

      {/* Per-lift cards */}
      <div className="space-y-3">
        {LIFTS.map((lift) => (
          <LiftChartCard
            key={lift.key}
            lift={lift}
            sessions={byLift[lift.key] ?? []}
            flags={overreachFlags}
            expanded={expandedLifts.has(lift.key)}
            onToggle={() => toggleLift(lift.key)}
          />
        ))}
      </div>

      {/* Methodology note */}
      <div className="rounded-lg bg-secondary/30 border border-border p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground text-[11px] uppercase tracking-wider">Methodik</p>
        <p><strong className="text-foreground">Überreach-Signal:</strong> RPE-Anstieg ≥ 1,5 gegenüber dem Schnitt der zwei vorangehenden Sessions derselben Übung, ohne Leistungssteigerung (&gt; 2%).</p>
        <p><strong className="text-foreground">Leistungsquote:</strong> Tatsächliche ÷ geplante Wiederholungen (Nicht-AMRAP-Sätze). &lt; 90% = unvollständige Session.</p>
        <p><strong className="text-foreground">AMRAP-Überschuss:</strong> Geleistete minus Mindestziel-Wdh. Positiv = 1RM-Zuwachs wahrscheinlich.</p>
      </div>
    </div>
  );
}
