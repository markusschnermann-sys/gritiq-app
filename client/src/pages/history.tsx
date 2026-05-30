import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useHashLocation } from "wouter/use-hash-location";
import { ChevronRight, Calendar, TrendingUp, BarChart2, List, Trophy, Target, Lock, Medal, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import MobileHeader from "@/components/MobileHeader";
import PerformanceAnalytics from "@/components/PerformanceAnalytics";
import PRWall from "@/components/PRWall";
import StrengthStandards from "@/components/StrengthStandards";
import GoodliftScoreCard from "@/components/GoodliftScoreCard";
import { ProGate, ProBadge } from "@/components/ProGate";
import { useSubscription } from "@/hooks/useSubscription";
import type { User, WorkoutSession } from "@shared/schema";

const WAVE_NAMES = ["10s Wave", "8s Wave", "5s Wave", "3s Wave"];
const WEEK_NAMES = ["Akkumulation", "Intensivierung", "Realisierung", "Deload"];
const LIFT_NAMES: Record<string, string> = {
  squat: "Kniebeuge", bench: "Bankdrücken", deadlift: "Kreuzheben", ohp: "Schulterdrücken",
};
const LIFT_ICONS: Record<string, string> = {
  squat: "🏋️", bench: "💪", deadlift: "🔥", ohp: "⬆️",
};

type Tab = "verlauf" | "analyse" | "prwall" | "standards" | "glscore";

export default function HistoryPage() {
  const [, navigate] = useHashLocation();
  const [tab, setTab] = useState<Tab>("verlauf");
  const { data: sub } = useSubscription();
  const isPro = !!sub?.isPro;

  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
    queryFn: async () => (await apiRequest("GET", "/api/user")).json(),
  });

  const { data: sessions, isLoading } = useQuery<WorkoutSession[]>({
    queryKey: ["/api/sessions"],
    queryFn: async () => (await apiRequest("GET", "/api/sessions")).json(),
  });

  const allCompleted = sessions?.filter(s => s.status === "completed") ?? [];

  // Gate: free users see only the last 4 weeks of history
  const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - FOUR_WEEKS_MS).toISOString().slice(0, 10);
  const completed = isPro
    ? allCompleted
    : allCompleted.filter(s => s.date >= cutoffDate);
  const hiddenCount = isPro ? 0 : allCompleted.length - completed.length;

  return (
    <div>
      <MobileHeader user={user} title="Verlauf" />

      <div className="p-4 md:p-6 max-w-3xl space-y-5">

        {/* ── Tab switcher ── */}
        <div className="grid grid-cols-3 sm:flex sm:items-center gap-1 p-1 rounded-xl bg-secondary/40 border border-border w-full">
          <button
            onClick={() => setTab("verlauf")}
            data-testid="tab-verlauf"
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-display font-semibold transition-all duration-200",
              tab === "verlauf"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List size={15} />
            Verlauf
          </button>
          <button
            onClick={() => setTab("analyse")}
            data-testid="tab-analyse"
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-display font-semibold transition-all duration-200",
              tab === "analyse"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart2 size={15} />
            Analyse
            {!isPro && <Lock className="h-3 w-3 text-orange-400" />}
          </button>
          <button
            onClick={() => setTab("prwall")}
            data-testid="tab-prwall"
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-display font-semibold transition-all duration-200",
              tab === "prwall"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Trophy size={15} />
            PR Wall
            {!isPro && <Lock className="h-3 w-3 text-orange-400" />}
          </button>
          <button
            onClick={() => setTab("standards")}
            data-testid="tab-standards"
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-display font-semibold transition-all duration-200",
              tab === "standards"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Target size={15} />
            Standards
            {!isPro && <Lock className="h-3 w-3 text-orange-400" />}
          </button>
          <button
            onClick={() => setTab("glscore")}
            data-testid="tab-glscore"
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-display font-semibold transition-all duration-200",
              tab === "glscore"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Medal size={15} />
            GL Score
          </button>
        </div>

        {/* ── VERLAUF TAB ── */}
        {tab === "verlauf" && (
          <>
            <div>
              <h1 className="font-display text-xl font-bold">Trainings-Verlauf</h1>
              <p className="text-muted-foreground text-sm mt-1">{completed.length} abgeschlossene Workouts</p>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : (
              <>
                {/* Lift counts */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {["squat", "bench", "deadlift", "ohp"].map((lift) => (
                    <div key={lift} className="stat-card text-center">
                      <span className="text-2xl">{LIFT_ICONS[lift]}</span>
                      <p className="text-xl font-bold font-display mt-1">
                        {completed.filter(s => s.lift === lift).length}
                      </p>
                      <p className="text-xs text-muted-foreground">{LIFT_NAMES[lift]}</p>
                    </div>
                  ))}
                </div>

                {/* Current maxes */}
                {user && (
                  <div className="stat-card">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp size={16} className="text-primary" />
                      <h2 className="font-display font-bold text-sm">Aktuelle 1RM</h2>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { key: "squat",     label: "Kniebeuge",  val: user.squatMax },
                        { key: "bench",     label: "Bankdrücken", val: user.benchMax },
                        { key: "deadlift",  label: "Kreuzheben", val: user.deadliftMax },
                        { key: "ohp",       label: "OHP",        val: user.ohpMax },
                      ].map(({ key, label, val }) => (
                        <div key={key} className="bg-background rounded-lg p-3 text-center">
                          <p className="text-lg font-bold font-display text-foreground">{val} kg</p>
                          <p className="text-xs text-primary mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Session list */}
                {completed.length === 0 && hiddenCount === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <p className="text-4xl mb-4">🏋️</p>
                    <p className="font-display font-bold text-base mb-1">Noch keine Workouts</p>
                    <p className="text-sm">Starte dein erstes Training vom Dashboard.</p>
                  </div>
                ) : (
                  <>
                    <SessionList completed={completed} navigate={navigate} />
                    {/* Pro gate: older sessions hidden */}
                    {hiddenCount > 0 && (
                      <div className="rounded-xl border border-dashed border-orange-500/30 bg-orange-500/5 p-5 text-center space-y-2 mt-2">
                        <Lock className="h-5 w-5 text-orange-400 mx-auto" />
                        <p className="font-display font-semibold text-sm">
                          +{hiddenCount} ältere Workouts versteckt
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Free-User sehen die letzten 4 Wochen. Upgrade auf Pro für den kompletten Verlauf.
                        </p>
                        <button
                          className="mt-1 text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors inline-flex items-center gap-1"
                          onClick={() => navigate("/upgrade")}
                          data-testid="button-history-upgrade"
                        >
                          <Zap className="h-3 w-3" />
                          Pro freischalten
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── ANALYSE TAB ── */}
        {tab === "analyse" && (
          <ProGate feature="analytics">
            <PerformanceAnalytics />
          </ProGate>
        )}

        {/* ── PR WALL TAB ── */}
        {tab === "prwall" && (
          <ProGate feature="analytics">
            <PRWall />
          </ProGate>
        )}

        {/* ── STANDARDS TAB ── */}
        {tab === "standards" && (
          <ProGate feature="analytics">
            <StrengthStandards />
          </ProGate>
        )}

        {/* ── GL SCORE TAB ── */}
        {tab === "glscore" && (
          <div className="space-y-4">
            <div>
              <h1 className="font-display text-xl font-bold">IPF GL Score</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Dein Goodlift-Koeffizient — wie du im Vergleich zu anderen Athleten abschneidest
              </p>
            </div>
            <GoodliftScoreCard />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Session list sub-component ────────────────────────────────────────────────
function SessionList({
  completed,
  navigate,
}: {
  completed: WorkoutSession[];
  navigate: (path: string) => void;
}) {
  const byDate = completed.reduce<Record<string, WorkoutSession[]>>((acc, s) => {
    (acc[s.date] = acc[s.date] ?? []).push(s);
    return acc;
  }, {});
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      {sortedDates.map((date) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} className="text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{date}</p>
          </div>
          <div className="space-y-2">
            {byDate[date].map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:border-border/70 cursor-pointer transition-colors"
                onClick={() => navigate(`/workout/${s.id}`)}
                data-testid={`history-row-${s.id}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{LIFT_ICONS[s.lift] ?? "🏋️"}</span>
                  <div>
                    <p className="font-semibold text-sm font-display">{LIFT_NAMES[s.lift] ?? s.lift}</p>
                    <p className="text-xs text-muted-foreground">
                      {WAVE_NAMES[s.wave - 1]} · {WEEK_NAMES[s.week - 1]}
                      {s.sessionDifficulty ? ` · Schwierigkeit: ${s.sessionDifficulty}/10` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">✓ Fertig</Badge>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
