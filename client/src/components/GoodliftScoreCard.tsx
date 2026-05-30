/**
 * GoodliftScoreCard
 * =================
 * Displays the user's live IPF GL (Goodlift) score derived from their stored
 * bodyweight and current 1RM values (Squat + Bench + Deadlift).
 *
 * Features:
 *  - Live GL score with big hero number
 *  - Percentile tier label with colour-coded badge
 *  - 16-week sparkline showing estimated score progression through the program
 *  - Formula breakdown (SQ + BP + DL total, bodyweight)
 *  - Missing-data nudge if bodyweight is not set
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Info, TrendingUp, AlertCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHashLocation } from "wouter/use-hash-location";

// ── Types ────────────────────────────────────────────────────────────────────

interface TimelinePoint {
  programWeek: number;
  wave: number;
  week: number;
  label: string;
  shortLabel: string;
  estimatedScore: number;
  isCompleted: boolean;
  isCurrent: boolean;
}

interface GlScoreData {
  currentScore: number;
  currentTotal: number;
  bodyweight: number | null;
  gender: string;
  programWeek: number;
  percentileLabel: string;
  percentile: number;
  timeline: TimelinePoint[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map percentile → accent colour classes */
function tierColor(percentile: number): { bg: string; text: string; border: string } {
  if (percentile >= 95) return { bg: "bg-yellow-500/15",  text: "text-yellow-400",  border: "border-yellow-500/30" };
  if (percentile >= 85) return { bg: "bg-orange-500/15",  text: "text-orange-400",  border: "border-orange-500/30" };
  if (percentile >= 70) return { bg: "bg-blue-500/15",    text: "text-blue-400",    border: "border-blue-500/30"   };
  if (percentile >= 50) return { bg: "bg-teal-500/15",    text: "text-teal-400",    border: "border-teal-500/30"   };
  if (percentile >= 30) return { bg: "bg-green-500/15",   text: "text-green-400",   border: "border-green-500/30"  };
  return                       { bg: "bg-secondary/60",   text: "text-muted-foreground", border: "border-border"   };
}

/** SVG sparkline — no external charting lib needed */
function Sparkline({ points, currentWeek }: { points: TimelinePoint[]; currentWeek: number }) {
  if (points.length === 0) return null;

  const W = 400;
  const H = 80;
  const PAD_X = 4;
  const PAD_Y = 8;

  const scores = points.map(p => p.estimatedScore);
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const range = maxS - minS || 1;

  const toX = (i: number) => PAD_X + (i / (points.length - 1)) * (W - PAD_X * 2);
  const toY = (s: number) => H - PAD_Y - ((s - minS) / range) * (H - PAD_Y * 2);

  // Build path
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.estimatedScore).toFixed(1)}`)
    .join(" ");

  // Fill area under line
  const fillD = `${d} L ${toX(points.length - 1).toFixed(1)} ${H} L ${toX(0).toFixed(1)} ${H} Z`;

  // Wave dividers (every 4 points)
  const dividers = [4, 8, 12].map(idx => toX(idx - 0.5));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 80 }}
      aria-hidden="true"
    >
      {/* Wave dividers */}
      {dividers.map((x, i) => (
        <line key={i} x1={x} y1={0} x2={x} y2={H} stroke="hsl(var(--border))" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
      ))}

      {/* Fill */}
      <path d={fillD} fill="hsl(25 100% 55% / 0.08)" />

      {/* Line */}
      <path d={d} fill="none" stroke="hsl(25 100% 55%)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />

      {/* Data points */}
      {points.map((p, i) => {
        const x = toX(i);
        const y = toY(p.estimatedScore);
        const isCur = p.isCurrent;
        const isDone = p.isCompleted;
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r={isCur ? 5 : 3}
              fill={isCur ? "hsl(25 100% 55%)" : isDone ? "hsl(25 100% 55% / 0.6)" : "hsl(var(--muted))"}
              stroke={isCur ? "white" : "none"}
              strokeWidth={isCur ? 1.5 : 0}
            />
          </g>
        );
      })}

      {/* Current position tooltip */}
      {(() => {
        const cur = points.find(p => p.isCurrent);
        if (!cur) return null;
        const i = points.indexOf(cur);
        const x = toX(i);
        const y = toY(cur.estimatedScore);
        const labelX = Math.min(Math.max(x - 24, 0), W - 56);
        return (
          <g>
            <rect x={labelX} y={y - 20} width={50} height={14} rx="3" fill="hsl(25 100% 55% / 0.9)" />
            <text x={labelX + 25} y={y - 10} textAnchor="middle" fontSize="9" fill="white" fontWeight="600">
              {cur.estimatedScore.toFixed(1)} Pkt
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function GoodliftScoreCard() {
  const [, navigate] = useHashLocation();

  const { data, isLoading } = useQuery<GlScoreData>({
    queryKey: ["/api/gl-score-history"],
    queryFn: async () => (await apiRequest("GET", "/api/gl-score-history")).json(),
    staleTime: 1000 * 60 * 5, // 5 min
  });

  if (isLoading) {
    return (
      <div className="stat-card space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-14 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!data) return null;

  const { currentScore, currentTotal, bodyweight, programWeek, percentileLabel, percentile, timeline } = data;
  const colors = tierColor(percentile);
  const missingBw = !bodyweight;
  const missingLifts = currentTotal <= 0;

  // Wave label groups for x-axis
  const waveLabels = ["10s", "8s", "5s", "3s"];

  return (
    <div className="stat-card space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <TrendingUp size={15} className="text-primary" />
            <h2 className="font-display font-bold text-sm">IPF GL (Goodlift) Score</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Offizieller IPF-Koeffizient · Kniebeuge + Bankdrücken + Kreuzheben
          </p>
        </div>
        <a
          href="https://ironcompare.com/tools/ipf-gl-calculator"
          target="_top"
          className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
          title="IPF GL Formel"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {/* ── Missing data nudge ── */}
      {(missingBw || missingLifts) && (
        <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-300">Daten unvollständig</p>
            <p className="text-xs text-amber-300/70 mt-0.5">
              {missingBw
                ? "Körpergewicht fehlt — bitte in den Einstellungen eintragen."
                : "Keine 1RM-Werte vorhanden."}
            </p>
            <button
              onClick={() => navigate("/settings")}
              className="text-xs text-amber-400 underline underline-offset-2 mt-1"
            >
              Zu den Einstellungen →
            </button>
          </div>
        </div>
      )}

      {/* ── Hero score ── */}
      {!missingBw && !missingLifts && (
        <div className="flex items-end gap-4">
          {/* Big number */}
          <div>
            <p className="text-5xl font-display font-black text-foreground tabular-nums leading-none">
              {currentScore.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Punkte · Woche {programWeek}/16</p>
          </div>

          {/* Tier badge + context */}
          <div className="space-y-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                colors.bg, colors.text, colors.border
              )}
            >
              {percentileLabel}
            </span>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Total: <span className="text-foreground font-semibold">{currentTotal} kg</span></p>
              <p>Körpergewicht: <span className="text-foreground font-semibold">{bodyweight} kg</span></p>
            </div>
          </div>
        </div>
      )}

      {/* ── Sparkline chart ── */}
      {!missingBw && !missingLifts && timeline.length > 0 && (
        <div>
          <Sparkline points={timeline} currentWeek={programWeek} />

          {/* X-axis wave labels */}
          <div className="grid grid-cols-4 mt-1">
            {waveLabels.map((lbl, i) => (
              <p key={i} className="text-center text-[10px] text-muted-foreground/60 font-display">
                {lbl}
              </p>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground/50 mt-2 text-center">
            Geschätzte Progression über 16 Wochen · orangener Punkt = aktuelle Woche
          </p>
        </div>
      )}

      {/* ── Formula note ── */}
      {!missingBw && !missingLifts && (
        <div className="flex items-start gap-2 pt-1 border-t border-border/50">
          <Info size={12} className="text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            GL = (Total × 100) / (A × KG^B − C). Der Score normalisiert deinen Total relativ zu
            deinem Körpergewicht — 100 Punkte entspricht Weltklasseniveau.
            <a
              href="https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/Models_Evaluation-I-2020_01.pdf"
              target="_top"
              className="ml-1 text-primary/70 hover:text-primary underline underline-offset-2"
            >
              IPF-Quelle
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
