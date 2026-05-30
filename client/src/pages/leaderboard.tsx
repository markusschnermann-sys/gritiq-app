import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Star, TrendingUp, TrendingDown, Minus, User, Eye, EyeOff, Lock, ChevronUp, BarChart2, Dumbbell, Info, Swords } from "lucide-react";
import { useHashLocation } from "wouter/use-hash-location";
import MobileHeader from "@/components/MobileHeader";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ── Types ──────────────────────────────────────────────────────────────────────
type LeaderboardEntry = {
  rank: number;
  userId: number | null;
  displayName: string | null;
  isMe: boolean;
  isAnonymous: boolean;
  score: number;
  totalKg: number;
  bodyweight: number | null;
  gender: string | null;
  percentile: number;
  deltaToNext: number;
  squatMax: number | null;
  benchMax: number | null;
  deadliftMax: number | null;
};

type LeaderboardData = {
  metric: "wilks2" | "ipfgl";
  totalParticipants: number;
  publicCount: number;
  myEntry: LeaderboardEntry | null;
  entries: LeaderboardEntry[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────
type MetricKey = "wilks2" | "ipfgl";

const METRIC_LABELS: Record<MetricKey, { label: string; desc: string }> = {
  wilks2: {
    label: "Wilks 2",
    desc: "Normalisierter Kraftkoeffizient nach Körpergewicht (2020er Revision). Höher = relativ stärker.",
  },
  ipfgl: {
    label: "IPF GL (Goodlift)",
    desc: "Offizieller IPF Goodlift-Koeffizient (2020). Wird bei internationalen Wettkämpfen verwendet.",
  },
};

function rankMedal(rank: number) {
  if (rank === 1) return <span className="text-yellow-400 text-lg">🥇</span>;
  if (rank === 2) return <span className="text-slate-300 text-lg">🥈</span>;
  if (rank === 3) return <span className="text-amber-600 text-lg">🥉</span>;
  return (
    <span className="text-muted-foreground font-mono text-sm w-6 text-center inline-block">
      {rank}
    </span>
  );
}

function percentileColor(p: number) {
  if (p >= 90) return "text-primary";
  if (p >= 70) return "text-green-400";
  if (p >= 50) return "text-yellow-400";
  return "text-muted-foreground";
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <Skeleton className="w-6 h-4" />
      <Skeleton className="w-24 h-4" />
      <div className="ml-auto flex gap-3">
        <Skeleton className="w-14 h-4" />
        <Skeleton className="w-12 h-4" />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const [metric, setMetric] = useState<MetricKey>("ipfgl");
  const [, navigate] = useHashLocation();

  const { data, isLoading } = useQuery<LeaderboardData>({
    queryKey: ["/api/leaderboard", metric],
    queryFn: async () => {
      const { authFetch } = await import("@/lib/authStore");
      const res = await authFetch(`/api/leaderboard?metric=${metric}`);
      if (!res.ok) throw new Error("Failed to load leaderboard");
      return res.json();
    },
    staleTime: 60_000,
  });

  const myEntry = data?.myEntry ?? null;
  const entries = data?.entries ?? [];

  return (
    <div className="flex flex-col h-full">
      <MobileHeader title="Leaderboard" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 md:pb-4">

        {/* Metric switcher */}
        <div className="flex bg-muted rounded-xl p-1 gap-1">
          {(Object.keys(METRIC_LABELS) as MetricKey[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                metric === m
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {METRIC_LABELS[m].label}
            </button>
          ))}
        </div>

        {/* H2H CTA */}
        <button
          onClick={() => navigate("/h2h")}
          className="flex items-center gap-3 w-full rounded-xl border border-primary/25 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 px-4 py-3 transition-all text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Swords size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">1-gegen-1 Duell starten</p>
            <p className="text-xs text-muted-foreground">Fordere einen Athleten zu einem 4-Wochen Koeffizient-Duell heraus</p>
          </div>
          <ChevronUp size={14} className="text-muted-foreground rotate-90 flex-shrink-0" />
        </button>

        {/* Metric description */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2.5">
          <Info size={13} className="flex-shrink-0 mt-0.5" />
          <p>{METRIC_LABELS[metric].desc}</p>
        </div>

        {/* My rank card */}
        {isLoading ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : myEntry ? (
          <MyRankCard entry={myEntry} metric={metric} totalParticipants={data?.totalParticipants ?? 0} />
        ) : (
          <div className="rounded-xl border border-border bg-muted/30 p-5 text-center space-y-2">
            <BarChart2 className="mx-auto text-muted-foreground" size={28} />
            <p className="text-sm font-medium text-foreground">Noch kein Rang verfügbar</p>
            <p className="text-xs text-muted-foreground">
              Gib dein Körpergewicht in den Einstellungen ein um am Leaderboard teilzunehmen.
              Aktiviere dann dein Ranking unter <strong>Einstellungen → Leaderboard</strong>.
            </p>
          </div>
        )}

        {/* Leaderboard table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-display font-bold text-sm text-foreground">
              Rangliste
            </h2>
            {data && (
              <span className="text-xs text-muted-foreground">
                {data.publicCount} sichtbar · {data.totalParticipants} gesamt
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="divide-y divide-border/50">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Trophy className="mx-auto text-muted-foreground/40" size={36} />
              <p className="text-sm text-muted-foreground">
                Noch keine öffentlichen Einträge.
              </p>
              <p className="text-xs text-muted-foreground/70">
                Aktiviere dein Ranking in den Einstellungen.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {entries.map((entry) => (
                <LeaderboardRow key={`${entry.rank}-${entry.userId ?? entry.displayName}`} entry={entry} />
              ))}
            </div>
          )}
        </div>

        {/* Privacy note */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground/70 px-1">
          <Lock size={11} className="flex-shrink-0 mt-0.5" />
          <p>
            Anonyme Einträge werden ohne Namen angezeigt. Versteckte Profile erscheinen nicht in der Rangliste.
            Dein eigener Rang ist immer für dich sichtbar.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── My Rank Card ───────────────────────────────────────────────────────────────
function MyRankCard({
  entry,
  metric,
  totalParticipants,
}: {
  entry: LeaderboardEntry;
  metric: MetricKey;
  totalParticipants: number;
}) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
            Mein Rang
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold text-primary">
              #{entry.rank}
            </span>
            <span className="text-sm text-muted-foreground">
              von {totalParticipants}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground mb-0.5">{METRIC_LABELS[metric].label}</p>
          <p className="font-display text-2xl font-bold text-foreground">{entry.score}</p>
          <p className={`text-xs font-medium ${percentileColor(entry.percentile)}`}>
            Top {100 - entry.percentile}%
          </p>
        </div>
      </div>

      {/* Lift breakdown */}
      {entry.squatMax !== null && (
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-primary/20">
          {[
            { label: "SQ", value: entry.squatMax },
            { label: "BK", value: entry.benchMax },
            { label: "KH", value: entry.deadliftMax },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-semibold text-foreground">{value ?? 0} kg</p>
            </div>
          ))}
        </div>
      )}

      {/* Delta to next rank */}
      {entry.deltaToNext > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/50 rounded-lg px-3 py-2">
          <ChevronUp size={12} className="text-primary" />
          <span>
            Noch <strong className="text-foreground">{entry.deltaToNext}</strong> Punkte bis Rang #{entry.rank - 1}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Leaderboard Row ────────────────────────────────────────────────────────────
function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const isTop3 = entry.rank <= 3;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
        entry.isMe ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-muted/30"
      }`}
    >
      {/* Rank */}
      <div className="w-6 flex-shrink-0 flex justify-center">
        {rankMedal(entry.rank)}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {entry.isAnonymous ? (
            <>
              <EyeOff size={12} className="text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground italic">Anonym</span>
            </>
          ) : (
            <span className={`text-sm font-medium truncate ${entry.isMe ? "text-primary" : "text-foreground"}`}>
              {entry.displayName ?? "Anonym"}
              {entry.isMe && (
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">(du)</span>
              )}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {entry.totalKg > 0 ? `Total: ${entry.totalKg} kg` : ""}
        </p>
      </div>

      {/* Score + percentile */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold tabular-nums text-foreground">{entry.score}</p>
        <p className={`text-xs ${percentileColor(entry.percentile)}`}>
          Top {100 - entry.percentile}%
        </p>
      </div>
    </div>
  );
}
