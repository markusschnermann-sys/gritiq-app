/**
 * TrainingPage — Tab 1 primary action screen.
 * Today's lifts are front-and-center in the thumb zone.
 * One tap to start any lift. Zero scroll required on typical iPhones.
 */
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useHashLocation } from "wouter/use-hash-location";
import { Play, Zap, ChevronRight, TrendingUp } from "lucide-react";
import MobileHeader from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { User, WorkoutSession } from "@shared/schema";

const WAVE_NAMES: Record<string, string[]> = {
  powerlifting: ["10s Wave", "8s Wave", "5s Wave", "3s Wave"],
  bodybuilding:  ["15s Wave", "12s Wave", "10s Wave", "8s Wave"],
  weightloss:    ["15s Wave", "12s Wave", "10s Wave", "8s Wave"],
};
const WEEK_NAMES = ["Akkumulation", "Intensivierung", "Realisierung", "Deload"];

// Lift key → display label (covers all goals: PL, BB, WL)
const LIFT_NAMES: Record<string, string> = {
  squat:      "Kniebeuge",
  bench:      "Bankdrücken",
  deadlift:   "Kreuzheben",
  ohp:        "OHP",
  chest:      "Brust",
  back:       "Rücken",
  legs:       "Beine (Quad)",
  shoulders:  "Schultern",
  arms:       "Arme",
  glutes:     "Beine (Post.)",
  fullbody_a: "Ganzkörper A",
  fullbody_b: "Ganzkörper B",
  fullbody_c: "Ganzkörper C",
};

interface LiftConfig {
  key: string;
  label: string;
  icon: string;
  muscleGroup: string;
  primaryExercise: string;
  description: string;
}

export default function TrainingPage() {
  const { toast } = useToast();
  const [, navigate] = useHashLocation();

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
      <div className="p-4 space-y-4">
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!user) return null;

  const wave = user.currentWave as 1 | 2 | 3 | 4;
  const week = user.currentWeek as 1 | 2 | 3 | 4;
  const goal = (user.trainingGoal ?? "powerlifting") as string;
  const waveName = (WAVE_NAMES[goal] ?? WAVE_NAMES.powerlifting)[wave - 1];
  const weekName = WEEK_NAMES[week - 1];
  const todaysLifts = goalLifts;
  const totalLifts = todaysLifts.length || 4;

  const completedToday = todaysLifts.filter((lc) =>
    sessions?.some(s => s.lift === lc.key && s.wave === wave && s.week === week && s.status === "completed")
  ).length;
  const allDoneToday = completedToday === totalLifts;

  // In-progress session — resume if one exists
  const inProgress = sessions?.find(s => s.status === "in_progress");

  const totalWeeks = 16;
  const completedWeeks = ((wave - 1) * 4) + (week - 1);
  const progressPct = Math.round((completedWeeks / totalWeeks) * 100);

  return (
    <div>
      <MobileHeader user={user} />
      <div className="p-4 md:p-6 max-w-2xl space-y-4">

        {/* Phase header — compact, stays near top */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Training</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {waveName} · {weekName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {allDoneToday ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 font-display">
                ✓ Heute fertig
              </Badge>
            ) : (
              <Badge className="bg-primary/15 text-primary border-primary/20 font-display font-semibold">
                {completedToday}/{totalLifts} heute
              </Badge>
            )}
          </div>
        </div>

        {/* Resume banner — shown when a session is in progress */}
        {inProgress && (
          <button
            onClick={() => navigate(`/workout/${inProgress.id}`)}
            className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-primary/60 bg-primary/10 hover:bg-primary/15 transition-colors"
            data-testid="button-resume-workout"
          >
            <div className="w-10 h-10 rounded-full gradient-orange flex items-center justify-center flex-shrink-0">
              <Play size={18} className="text-white ml-0.5" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-display font-bold text-sm text-primary">Training fortsetzen</p>
              <p className="text-xs text-muted-foreground">
                {LIFT_NAMES[inProgress.lift] ?? inProgress.lift} · läuft noch
              </p>
            </div>
            <ChevronRight size={18} className="text-primary" />
          </button>
        )}

        {/* Today's lifts — goal-specific grid */}
        <div className={`grid gap-3 ${
          todaysLifts.length <= 4 ? "grid-cols-2" :
          todaysLifts.length === 6 ? "grid-cols-2 sm:grid-cols-3" :
          "grid-cols-2"
        }`}>
          {todaysLifts.map((lc) => {
            const isCompleted = sessions?.some(
              s => s.lift === lc.key && s.wave === wave && s.week === week && s.status === "completed"
            );
            const isRunning = inProgress?.lift === lc.key;
            return (
              <div
                key={lc.key}
                className={`lift-card relative flex flex-col min-h-[130px] ${isCompleted ? "opacity-60" : ""}`}
                onClick={() => {
                  if (isCompleted) return;
                  if (isRunning) { navigate(`/workout/${inProgress!.id}`); return; }
                  startWorkoutMutation.mutate({ lift: lc.key, wave, week });
                }}
                data-testid={`card-lift-${lc.key}`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between mb-1.5">
                  <span className="text-2xl">{lc.icon}</span>
                  {isCompleted ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">✓ Fertig</Badge>
                  ) : isRunning ? (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs animate-pulse">Läuft</Badge>
                  ) : (
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">{waveName}</Badge>
                  )}
                </div>
                {/* Lift name */}
                <p className="font-display font-bold text-sm">{lc.label}</p>
                {/* Primary exercise hint */}
                <p className="text-[10px] text-primary/80 font-medium mt-0.5 leading-tight">{lc.primaryExercise}</p>
                {/* Description */}
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight flex-1">{lc.description}</p>

                {/* CTA — bottom of card */}
                {!isCompleted && (
                  <Button
                    size="sm"
                    className="w-full gradient-orange text-white border-0 hover:opacity-90 text-xs min-h-[40px] font-display font-semibold mt-2"
                    disabled={startWorkoutMutation.isPending}
                    data-testid={`button-start-${lc.key}`}
                  >
                    {isRunning ? (
                      <>Fortsetzen</>
                    ) : startWorkoutMutation.isPending ? (
                      "Starte…"
                    ) : (
                      <><Play size={12} className="mr-1" />Starten</>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress strip — compact, not dominant */}
        <div className="stat-card py-3 px-4 flex items-center gap-3">
          <TrendingUp size={15} className="text-primary flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Programm-Fortschritt</span>
              <span className="text-xs font-bold text-primary font-display">{progressPct}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <button
            onClick={() => navigate("/program")}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors flex-shrink-0 p-2 -m-2"
            data-testid="button-view-program"
          >
            Plan <ChevronRight size={12} />
          </button>
        </div>

      </div>
    </div>
  );
}
