import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { TrendingUp, Calendar, Zap, Play, ChevronRight, Award, Utensils, Trophy, Swords, Crown, User, Gift, UserPlus } from "lucide-react";
import { useReferral } from "@/hooks/useReferral";
import MobileHeader from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { User, WorkoutSession, Challenge, ChallengeMember } from "@shared/schema";
import { computeMacros, resolveTargets, parseNutritionPrefs, macroPercentages, getGoalConfig, type TrainingGoal as NutriGoal } from "@/lib/nutrition";

const WAVE_NAMES = ["10s Wave", "8s Wave", "5s Wave", "3s Wave"];
const WEEK_NAMES = ["Akkumulation", "Intensivierung", "Realisierung", "Deload"];
const LIFT_NAMES: Record<string, string> = {
  squat: "Kniebeuge", bench: "Bankdrücken", deadlift: "Kreuzheben", ohp: "Schulterdrücken",
  chest: "Brust", back: "Rücken", legs: "Beine", shoulders: "Schultern",
  arms: "Arme", glutes: "Beine (Post.)",
  fullbody_a: "Ganzkörper A", fullbody_b: "Ganzkörper B", fullbody_c: "Ganzkörper C",
};
const LIFT_ICONS: Record<string, string> = {
  squat: "🏋️", bench: "💪", deadlift: "🔥", ohp: "⬆️",
  chest: "💥", back: "🦥", legs: "🦵", shoulders: "🔱",
  arms: "💪", glutes: "🍑",
  fullbody_a: "⚡", fullbody_b: "🔄", fullbody_c: "🎯",
};

export default function DashboardPage() {
  const { toast } = useToast();
  const [, navigate] = useHashLocation();

  // Referral data for dashboard CTA
  const { data: referral } = useReferral();

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const res = await fetch("/api/user");
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    placeholderData: (prev) => prev,
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery<WorkoutSession[]>({
    queryKey: ["/api/sessions"],
    queryFn: async () => (await apiRequest("GET", "/api/sessions")).json(),
  });

  const { data: challenges } = useQuery<(Challenge & { members: ChallengeMember[] })[]>({
    queryKey: ["/api/challenges"],
    queryFn: async () => (await apiRequest("GET", "/api/challenges")).json(),
    staleTime: 0,
  });

  // H2H Challenges
  const { data: h2hChallenges = [] } = useQuery<any[]>({
    queryKey: ["/api/h2h"],
    queryFn: async () => {
      const { authFetch } = await import("@/lib/authStore");
      const r = await authFetch("/api/h2h");
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 30_000,
  });

  interface LiftConfig { key: string; label: string; icon: string; muscleGroup: string; primaryExercise: string; description: string; }
  const { data: goalLifts = [] } = useQuery<LiftConfig[]>({
    queryKey: ["/api/goal-lifts"],
    queryFn: async () => (await apiRequest("GET", "/api/goal-lifts")).json(),
    staleTime: 0,
  });

  const startWorkoutMutation = useMutation({
    mutationFn: async ({ lift, wave, week }: { lift: string; wave: number; week: number }) => {
      const res = await apiRequest("POST", "/api/sessions", {
        lift,
        wave,
        week,
        date: new Date().toISOString().split("T")[0],
        status: "in_progress",
      });
      return res.json();
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      navigate(`/workout/${session.id}`);
    },
    onError: () => toast({ title: "Fehler", description: "Workout konnte nicht gestartet werden.", variant: "destructive" }),
  });

  if (userLoading || sessionsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!user) return null;

  const wave = user.currentWave as 1|2|3|4;
  const week = user.currentWeek as 1|2|3|4;
  const waveName = WAVE_NAMES[wave - 1];
  const weekName = WEEK_NAMES[week - 1];

  const completedSessions = sessions?.filter(s => s.status === "completed") ?? [];
  const totalWeeks = 16;
  const completedWeeks = ((wave - 1) * 4) + (week - 1);
  const progressPct = Math.round((completedWeeks / totalWeeks) * 100);

  // Today's planned lifts — goal-specific
  const todaysLifts = goalLifts.length > 0 ? goalLifts : [
    { key: "squat", label: "Kniebeuge", icon: "🏋️", muscleGroup: "legs", primaryExercise: "", description: "" },
    { key: "bench", label: "Bankdrücken", icon: "💪", muscleGroup: "chest", primaryExercise: "", description: "" },
    { key: "deadlift", label: "Kreuzheben", icon: "🔥", muscleGroup: "back", primaryExercise: "", description: "" },
    { key: "ohp", label: "Schulterdrücken", icon: "⬆️", muscleGroup: "shoulders", primaryExercise: "", description: "" },
  ];

  // Recent sessions
  const recentSessions = sessions?.filter(s => s.status === "completed").slice(0, 4) ?? [];

  const maxes = [
    { key: "squat", value: user.squatMax, label: "Kniebeuge" },
    { key: "bench", value: user.benchMax, label: "Bankdrücken" },
    { key: "deadlift", value: user.deadliftMax, label: "Kreuzheben" },
    { key: "ohp", value: user.ohpMax, label: "OHP" },
  ];

  return (
    <div>
      <MobileHeader user={user} />
    <div className="p-4 md:p-6 max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">
            Hey, {user.name} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Bereit für heute?</p>
        </div>
        <div className="text-right">
          <Badge className="bg-primary/15 text-primary border-primary/20 font-display font-semibold">
            {waveName}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">{weekName}</p>
        </div>
      </div>

      {/* Progress + Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              <span className="text-sm font-medium">Programmfortschritt</span>
            </div>
            <span className="text-sm font-bold text-primary font-display">{progressPct}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Woche {completedWeeks + 1} von {totalWeeks} · {waveName}, {weekName}
          </p>
        </div>

        <div className="stat-card flex flex-col items-center justify-center text-center">
          <div className="text-3xl font-bold font-display text-primary">{completedSessions.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Abgeschlossene Workouts</p>
        </div>

        <div className="stat-card flex flex-col items-center justify-center text-center">
          <div className="text-3xl font-bold font-display text-foreground">{16 - completedWeeks}</div>
          <p className="text-xs text-muted-foreground mt-1">Verbleibende Wochen</p>
        </div>
      </div>

      {/* Current maxes */}
      <div>
        <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
          <Award size={16} className="text-primary" />
          Aktuelle 1RM
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {maxes.map((m) => (
            <div key={m.key} className="stat-card text-center">
              <p className="text-2xl font-bold font-display text-foreground">{m.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">kg</p>
              <p className="text-xs font-medium text-primary mt-1">{m.label}</p>
              <p className="text-xs text-muted-foreground">TM: {Math.round(m.value * 0.9)} kg</p>
            </div>
          ))}
        </div>
      </div>

      {/* Today's workouts — goal-specific */}
      <div>
        <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
          <Zap size={16} className="text-primary" />
          Heutige Übungen — {weekName}
        </h2>
        <div className={`grid gap-3 ${
          todaysLifts.length <= 4 ? "grid-cols-2" :
          todaysLifts.length === 6 ? "grid-cols-2" : "grid-cols-2"
        }`}>
          {todaysLifts.map((lc) => {
            const isCompleted = sessions?.some(
              s => s.lift === lc.key && s.wave === wave && s.week === week && s.status === "completed"
            );
            return (
              <div
                key={lc.key}
                className={`lift-card ${isCompleted ? "opacity-60" : ""}`}
                onClick={() => !isCompleted && startWorkoutMutation.mutate({ lift: lc.key, wave, week })}
                data-testid={`card-lift-${lc.key}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{lc.icon}</span>
                  {isCompleted ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">✓ Fertig</Badge>
                  ) : (
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">{waveName}</Badge>
                  )}
                </div>
                <p className="font-display font-bold text-sm">{lc.label}</p>
                {lc.primaryExercise && (
                  <p className="text-[10px] text-primary/80 font-medium mt-0.5 leading-tight">{lc.primaryExercise}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{weekName}</p>
                {!isCompleted && (
                  <Button
                    size="sm"
                    className="mt-2 w-full gradient-orange text-white border-0 hover:opacity-90 text-xs"
                    disabled={startWorkoutMutation.isPending}
                    data-testid={`button-start-${lc.key}`}
                  >
                    <Play size={12} className="mr-1" />
                    {startWorkoutMutation.isPending ? "Starte…" : "Workout starten"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Nutrition card */}
      {(() => {
        const goal = (user.trainingGoal ?? "powerlifting") as NutriGoal;
        const goalCfg = getGoalConfig(goal);
        const bw = user.bodyweight || null;
        const prefs = parseNutritionPrefs(user.nutritionPrefs);
        const effectiveBw = bw || 80;
        const targets = resolveTargets(effectiveBw, goal, prefs);
        const pct = macroPercentages(targets);

        // Goal-specific colors
        const accentText = goalCfg.accentText;
        const accentBg = goalCfg.accentBg;
        const accentBorder = goalCfg.accentBorder;
        const proteinBarColor = goal === "powerlifting" ? "bg-orange-500/80"
          : goal === "bodybuilding" ? "bg-blue-500/80"
          : "bg-red-500/80";
        const goalShortLabel = goal === "powerlifting" ? "Kraftzuwachs"
          : goal === "bodybuilding" ? "Muskelaufbau" : "Fettabbau";

        return (
          <div>
            <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
              <Utensils size={16} className={accentText} />
              Tagesernährung
              {!bw && (
                <button
                  onClick={() => navigate("/settings/nutrition")}
                  className={`ml-auto text-xs ${accentText} underline font-normal`}
                >
                  Körpergewicht eingeben
                </button>
              )}
            </h2>
            <div className={`stat-card space-y-4 border ${accentBorder}`} data-testid="nutrition-dashboard-card">
              {/* Goal + calorie headline */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{goalCfg.emoji}</span>
                  <div>
                    <p className={`font-display font-bold text-sm ${accentText}`}>{targets.calories} kcal</p>
                    <p className="text-xs text-muted-foreground">
                      {bw ? `${bw} kg · ` : "Basis: 80 kg · "}
                      {goalShortLabel}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/settings/nutrition")}
                  className={`text-xs text-muted-foreground hover:${accentText} flex items-center gap-1 transition-colors`}
                  data-testid="button-nutrition-settings"
                >
                  Anpassen <ChevronRight size={12} />
                </button>
              </div>

              {/* Macro proportion bar — goal-colored protein segment */}
              <div className="flex h-2 rounded-full overflow-hidden">
                <div className={proteinBarColor} style={{ width: `${pct.protein}%` }} />
                <div className="bg-sky-400/70" style={{ width: `${pct.carbs}%` }} />
                <div className="bg-yellow-500/80" style={{ width: `${pct.fat}%` }} />
              </div>

              {/* Macro chips — protein chip uses goal color */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={`${accentBg} rounded-lg p-2`}>
                  <p className={`font-display font-bold text-sm ${accentText}`}>{targets.proteinG}g</p>
                  <p className="text-xs text-muted-foreground">Protein</p>
                </div>
                <div className="bg-sky-500/10 rounded-lg p-2">
                  <p className="font-display font-bold text-sm text-sky-400">{targets.carbsG}g</p>
                  <p className="text-xs text-muted-foreground">Carbs</p>
                </div>
                <div className="bg-yellow-500/10 rounded-lg p-2">
                  <p className="font-display font-bold text-sm text-yellow-400">{targets.fatG}g</p>
                  <p className="text-xs text-muted-foreground">Fett</p>
                </div>
              </div>

              {/* Goal rationale tip */}
              <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
                {goalCfg.rationale.split(".")[0]}.
              </p>
            </div>
          </div>
        );
      })()}

      {/* Challenges widget — mobile-only teaser */}
      {(() => {
        const activeChallenges = (challenges ?? []).filter(c => c.status === "active");
        if (activeChallenges.length === 0) return null;
        // Show up to 2 active challenges
        const shown = activeChallenges.slice(0, 2);
        const TYPE_LABELS: Record<string, string> = {
          volume: "Volumen", consistency: "Konsistenz", pr: "Persönlicher Rekord", streak: "Streak",
        };
        return (
          <div>
            <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
              <Trophy size={16} className="text-primary" />
              Aktive Challenges
              <button
                onClick={() => navigate("/challenges")}
                className="ml-auto text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
              >
                Alle <ChevronRight size={12} />
              </button>
            </h2>
            <div className="space-y-2">
              {shown.map(c => {
                const goal = (() => { try { return JSON.parse(c.goal); } catch { return {}; } })();
                const target = goal.targetValue ?? 100;
                const myMembership = c.members?.find((m: ChallengeMember) => m.userId === user.id);
                const progress = myMembership?.progress ?? 0;
                const pct = Math.min(100, Math.round((progress / target) * 100));
                const daysLeft = Math.max(0, Math.ceil(
                  (new Date(c.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                ));
                return (
                  <div
                    key={c.id}
                    className="stat-card cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => navigate("/challenges")}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {TYPE_LABELS[c.type] ?? c.type} · {daysLeft} Tage verbleibend
                        </p>
                      </div>
                      <span className="text-xs font-bold text-primary font-display ml-2 flex-shrink-0">{pct}%</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {progress} / {target} {goal.unit ?? ""}
                    </p>
                  </div>
                );
              })}
              {activeChallenges.length > 2 && (
                <button
                  onClick={() => navigate("/challenges")}
                  className="w-full text-xs text-muted-foreground hover:text-primary py-2 transition-colors"
                >
                  + {activeChallenges.length - 2} weitere Challenges
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* H2H Live Cards */}
      {(() => {
        const activeH2h = h2hChallenges.filter((c: any) => c.status === "active" || c.status === "pending");
        if (activeH2h.length === 0) return null;
        const METRIC_LABEL: Record<string, string> = { wilks2: "Wilks 2", ipfgl: "IPF GL" };
        return (
          <div>
            <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
              <Swords size={16} className="text-primary" />
              Duelle
              <button
                onClick={() => navigate("/h2h")}
                className="ml-auto text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
              >
                Alle <ChevronRight size={12} />
              </button>
            </h2>
            <div className="space-y-2">
              {activeH2h.slice(0, 2).map((c: any) => {
                const isPending = c.status === "pending";
                const myName = c.isChallenger ? c.challengerName : c.opponentName;
                const theirName = c.isChallenger ? c.opponentName : c.challengerName;
                const myDelta = c.myDelta ?? 0;
                const theirDelta = c.theirDelta ?? 0;
                const isLeading = myDelta >= theirDelta;
                return (
                  <div
                    key={c.id}
                    className="stat-card cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => navigate("/h2h")}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Swords size={13} className="text-primary flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{METRIC_LABEL[c.metric]} · {isPending ? "Ausstehend" : `Woche ${c.currentWeek}/4`}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 text-center">
                        <p className="text-xs text-muted-foreground truncate">{myName} (Du)</p>
                        <p className={`text-sm font-bold tabular-nums ${myDelta > 0 ? "text-green-400" : myDelta < 0 ? "text-red-400" : "text-foreground"}`}>
                          {isPending ? "–" : `${myDelta > 0 ? "+" : ""}${myDelta}%`}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground/50">VS</span>
                      <div className="flex-1 text-center">
                        <p className="text-xs text-muted-foreground truncate">{theirName}</p>
                        <p className={`text-sm font-bold tabular-nums ${theirDelta > 0 ? "text-green-400" : theirDelta < 0 ? "text-red-400" : "text-foreground"}`}>
                          {isPending ? "–" : `${theirDelta > 0 ? "+" : ""}${theirDelta}%`}
                        </p>
                      </div>
                    </div>
                    {!isPending && (
                      <div className="mt-2 pt-2 border-t border-border/40">
                        <div className="flex gap-1 items-end h-5">
                          {[1,2,3,4].map(w => {
                            const myW = c.isChallenger ? c.challengerWeekly : c.opponentWeekly;
                            const val = myW?.[w-1];
                            const isDone = w <= c.currentWeek;
                            const hasData = val !== null && val !== undefined;
                            const h = hasData ? Math.max(15, Math.min(100, (val + 5) * 10)) : isDone ? 30 : 10;
                            return (
                              <div key={w} className="flex-1 bg-muted rounded-sm overflow-hidden" style={{ height: 16 }}>
                                <div
                                  className={`w-full rounded-sm ${hasData && val > 0 ? "bg-green-500/60" : hasData && val < 0 ? "bg-red-500/60" : isDone ? "bg-primary/30" : "bg-border/20"}`}
                                  style={{ height: `${h}%` }}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {isLeading ? "Du führst" : `${theirName} führt`} · {c.endDate ? `${Math.max(0, Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000))} Tage verbleibend` : ""}
                        </p>
                      </div>
                    )}
                    {isPending && !c.isChallenger && (
                      <p className="text-[10px] text-primary mt-2 font-medium">Einladung annehmen →</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Referral CTA — compact dashboard banner */}
      {referral && (() => {
        const hasBonusDays = referral.bonusDaysEarned > 0;
        const nextTier = referral.nextTier;
        const progressPct = referral.progressPct;
        return (
          <button
            onClick={() => navigate("/invite")}
            className="w-full rounded-xl border border-orange-500/25 bg-gradient-to-r from-orange-500/8 to-orange-500/4 p-3.5 text-left hover:border-orange-500/40 hover:from-orange-500/12 transition-all active:scale-[0.99] group"
            data-testid="button-referral-cta"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center flex-shrink-0">
                <Gift size={17} className="text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-xs font-display font-bold">
                    {hasBonusDays
                      ? `${referral.bonusDaysEarned} Tage Pro verdient`
                      : "Freunde einladen · 30 Tage Pro"}
                  </p>
                  {referral.currentTier && (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {referral.currentTier.emoji} {referral.currentTier.label}
                    </span>
                  )}
                </div>
                {nextTier ? (
                  <>
                    <div className="h-1 rounded-full bg-border overflow-hidden mb-0.5">
                      <div
                        className="h-full rounded-full bg-orange-500/70 transition-all duration-700"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {referral.conversionsUntilNext} Freund{referral.conversionsUntilNext !== 1 ? "e" : ""} bis {nextTier.emoji} {nextTier.label}
                    </p>
                  </>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    {referral.rewarded > 0
                      ? `${referral.rewarded} Konversionen · Max. Stufe erreicht ✨`
                      : "Teile deinen Link und verdiene Pro-Zeit"}
                  </p>
                )}
              </div>
              <ChevronRight size={14} className="text-muted-foreground flex-shrink-0 group-hover:text-foreground transition-colors" />
            </div>
          </button>
        );
      })()}

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div>
          <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
            <Calendar size={16} className="text-muted-foreground" />
            Letzte Workouts
          </h2>
          <div className="space-y-2">
            {recentSessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:border-border/80 cursor-pointer transition-colors"
                onClick={() => navigate(`/workout/${s.id}`)}
                data-testid={`row-session-${s.id}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{LIFT_ICONS[s.lift] ?? "🏋️"}</span>
                  <div>
                    <p className="text-sm font-medium">{LIFT_NAMES[s.lift] ?? s.lift}</p>
                    <p className="text-xs text-muted-foreground">
                      {WAVE_NAMES[s.wave - 1]} · {WEEK_NAMES[s.week - 1]} · {s.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Abgeschlossen</Badge>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
