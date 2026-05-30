import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, Timer, Zap, ChevronDown, ChevronUp, PlayCircle, Trophy, SkipForward } from "lucide-react";
import MobileHeader from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import type { WorkoutSession, Set as WorkoutSet, User } from "@shared/schema";
import SwipeableSetRow from "@/components/SwipeableSetRow";
import {
  getAgeAdaptations,
  getCyclePhaseAdaptations,
  getAdaptationNotes,
  type CyclePhase,
} from "@/lib/adaptations";

const WAVE_NAMES = ["10s Wave", "8s Wave", "5s Wave", "3s Wave"];
const WEEK_NAMES = ["Akkumulation", "Intensivierung", "Realisierung", "Deload"];
const LIFT_NAMES: Record<string, string> = {
  squat: "Kniebeuge", bench: "Bankdrücken", deadlift: "Kreuzheben", ohp: "Schulterdrücken",
};

// ── Adaptation Header Component ──────────────────────────────────────────────

function AdaptationHeader({ user }: { user: User }) {
  const age = (user as any).age as number | undefined;
  const gender = user.gender ?? "other";
  const cyclePhase = (user as any).cyclePhase as CyclePhase | null ?? null;
  const notes = getAdaptationNotes(age, gender, cyclePhase);
  const ageAdapts = getAgeAdaptations(age);
  const [showWarmup, setShowWarmup] = useState(false);

  if (notes.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="workout-adaptation-header">
      {notes.map((note, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-xs ${
            note.type === "warning"
              ? "border-yellow-500/30 bg-yellow-500/8 text-yellow-300"
              : note.type === "phase" && cyclePhase === "luteal"
              ? "border-indigo-500/30 bg-indigo-500/8 text-indigo-300"
              : "border-green-500/30 bg-green-500/8 text-green-300"
          }`}
          data-testid={`adaptation-note-${i}`}
        >
          <span className="text-sm flex-shrink-0">{note.icon}</span>
          <span className="leading-relaxed font-medium">{note.text}</span>
        </div>
      ))}

      {/* Warm-up card for 40+ */}
      {ageAdapts.isOver40 && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 overflow-hidden">
          <button
            onClick={() => setShowWarmup(w => !w)}
            className="w-full flex items-center justify-between px-3 py-2 text-left"
            data-testid="button-workout-toggle-warmup"
          >
            <span className="text-xs font-display font-bold text-yellow-400">🔥 Warm-up Protokoll anzeigen</span>
            <ChevronDown size={14} className={`text-yellow-400 transition-transform ${showWarmup ? "rotate-180" : ""}`} />
          </button>
          {showWarmup && (
            <div className="px-3 pb-3 border-t border-yellow-500/20">
              <ol className="pt-2 space-y-1.5">
                {ageAdapts.warmupProtocol.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="text-yellow-400 font-bold flex-shrink-0">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getRpeColor(rpe: number): string {
  if (rpe <= 6) return "rpe-low";
  if (rpe <= 7.5) return "rpe-mid";
  if (rpe <= 9) return "rpe-high";
  return "rpe-max";
}

export default function WorkoutPage() {
  const [, params] = useRoute("/workout/:id");
  const [, navigate] = useHashLocation();
  const { toast } = useToast();
  const sessionId = parseInt(params?.id ?? "0");

  const [activeSetId, setActiveSetId] = useState<number | null>(null);
  const [setInputs, setSetInputs] = useState<Record<number, { reps: string; weight: string; rpe: number }>>({});
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [restActive, setRestActive] = useState(false);
  const [showAmrapDialog, setShowAmrapDialog] = useState(false);
  const [amrapSet, setAmrapSet] = useState<WorkoutSet | null>(null);
  const [readiness, setReadiness] = useState({ sleep: 3, nutrition: 3, motivation: 3, fatigue: 3 });
  const [readinessDone, setReadinessDone] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [sessionDifficulty, setSessionDifficulty] = useState(7);

  const { data: sessionData, isLoading } = useQuery<WorkoutSession & { sets: WorkoutSet[] }>({
    queryKey: ["/api/sessions", sessionId],
    queryFn: async () => (await apiRequest("GET", `/api/sessions/${sessionId}`)).json(),
    enabled: !!sessionId,
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const res = await fetch("/api/user");
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    // Keep previous data during invalidation so the workout page
    // doesn’t lose the user reference mid-session
    placeholderData: (prev) => prev,
  });

  const currentLift = sessionData?.lift;
  const { data: videos } = useQuery<{ title: string; channel: string; url: string }[]>({
    queryKey: ["/api/exercises/videos", currentLift],
    queryFn: async () => (await apiRequest("GET", `/api/exercises/videos?lift=${currentLift}`)).json(),
    enabled: !!currentLift,
  });

  // Rest timer countdown
  useEffect(() => {
    if (!restActive || restTimer === null) return;
    if (restTimer <= 0) { setRestActive(false); return; }
    const t = setTimeout(() => setRestTimer((r) => (r ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [restActive, restTimer]);

  const updateSetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/sets/${id}`, data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId] }),
  });

  const updateSessionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/sessions/${sessionId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId] });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/user/${id}`, data);
      return res.json();
    },
    onSuccess: (updatedUser) => {
      // Write updated user directly into cache — avoids a re-fetch that could
      // transiently set user=undefined while navigating back to dashboard
      queryClient.setQueryData(["/api/user"], updatedUser);
    },
  });

  const progressMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/program/progress", body);
      return res.json();
    },
  });

  const handleReadinessDone = () => {
    const score = Math.round((readiness.sleep + readiness.nutrition + readiness.motivation + (6 - readiness.fatigue)) / 4);
    updateSessionMutation.mutate({
      sleepScore: readiness.sleep,
      nutritionScore: readiness.nutrition,
      motivationScore: readiness.motivation,
      fatigueScore: readiness.fatigue,
      readinessScore: score,
      status: "in_progress",
    });
    setReadinessDone(true);
  };

  const handleSkip = (set: WorkoutSet) => {
    setActiveSetId(null);
    toast({ title: "Satz übersprungen", description: `Satz ${set.setNumber} wurde übersprungen — du kannst ihn später nachholen.`, variant: "default" });
  };

  const handleCompleteSet = (set: WorkoutSet) => {
    const input = setInputs[set.id] ?? {};
    const actualReps = parseInt(input.reps) || set.targetReps;
    const actualWeight = parseFloat(input.weight) || set.targetWeight;
    const rpe = input.rpe ?? 8;

    updateSetMutation.mutate({
      id: set.id,
      data: { actualReps, actualWeight, rpe, isCompleted: 1 },
    });

    // Start rest timer
    const restSecs = sessionData?.week === 3 ? 180 : 120;
    setRestTimer(restSecs);
    setRestActive(true);
    setActiveSetId(null);

    // If AMRAP, show progression dialog
    if (set.isAmrap && sessionData?.week === 3) {
      setAmrapSet({ ...set, actualReps });
      setTimeout(() => setShowAmrapDialog(true), 500);
    }

    toast({ title: "Satz abgeschlossen ✓", description: `${actualReps} × ${actualWeight} kg` });
  };

  const handleAmrapProgression = async () => {
    if (!amrapSet || !user || !sessionData) return;
    const amrapReps = setInputs[amrapSet.id]?.reps
      ? parseInt(setInputs[amrapSet.id].reps)
      : amrapSet.targetReps;

    const result = await progressMutation.mutateAsync({
      currentMax: getLiftMax(),
      amrapReps,
      wave: sessionData.wave,
      lift: sessionData.lift,
    });

    if (result.increase > 0) {
      const maxKey = `${sessionData.lift}Max` as "squatMax" | "benchMax" | "deadliftMax" | "ohpMax";
      await updateUserMutation.mutateAsync({
        id: user.id,
        data: { [maxKey]: result.newMax },
      });
      toast({
        title: "🏆 Neues Maximum!",
        description: `Dein ${LIFT_NAMES[sessionData.lift]} 1RM steigt um ${result.increase} kg auf ${result.newMax} kg!`,
      });
    }
    setShowAmrapDialog(false);
  };

  const getLiftMax = () => {
    if (!user || !sessionData) return 0;
    const map: Record<string, number> = {
      squat: user.squatMax, bench: user.benchMax, deadlift: user.deadliftMax, ohp: user.ohpMax,
    };
    return map[sessionData.lift] ?? 0;
  };

  const handleFinishSession = async () => {
    setShowFinishDialog(false);

    // 1. Mark session completed — await so cache is fresh before navigating
    await updateSessionMutation.mutateAsync({
      status: "completed",
      sessionDifficulty,
    });

    // 2. Advance wave/week counter — writes result directly into cache (no re-fetch)
    if (user) {
      let newWave = user.currentWave;
      let newWeek = user.currentWeek + 1;
      if (newWeek > 4) { newWeek = 1; newWave = Math.min(user.currentWave + 1, 4); }

      await updateUserMutation.mutateAsync({
        id: user.id,
        data: { currentWave: newWave, currentWeek: newWeek },
      });
    }

    // 3. Navigate only after both mutations have settled — no flicker race
    navigate("/training");
  };

  if (isLoading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-64" /></div>;
  }

  if (!sessionData) return <div className="p-6 text-muted-foreground">Session nicht gefunden.</div>;

  const completedCount = sessionData.sets.filter(s => s.isCompleted).length;
  const totalSets = sessionData.sets.length;
  const pct = totalSets > 0 ? Math.round((completedCount / totalSets) * 100) : 0;
  const allDone = completedCount === totalSets && totalSets > 0;

  // ── P2: Completed session — separate read-only view ──────────────────────
  if (sessionData.status === "completed") {
    const setsDone = sessionData.sets.filter(s => s.isCompleted);
    return (
      <div>
        <MobileHeader
          backHref="/history"
          backLabel="Verlauf"
          title={LIFT_NAMES[sessionData.lift] ?? sessionData.lift}
        />
        <div className="p-4 md:p-6 max-w-2xl space-y-5">
          {/* Desktop back */}
          <button
            onClick={() => navigate("/history")}
            className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm"
          >
            <ArrowLeft size={16} /> Zurück zu Verlauf
          </button>

          {/* Summary header */}
          <div className="stat-card border-green-500/30 bg-green-500/5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Trophy size={22} className="text-green-400" />
            </div>
            <div className="flex-1">
              <p className="font-display font-bold text-base text-green-400">
                {LIFT_NAMES[sessionData.lift] ?? sessionData.lift} — Abgeschlossen
              </p>
              <p className="text-xs text-muted-foreground">
                {WAVE_NAMES[sessionData.wave - 1]} · {WEEK_NAMES[sessionData.week - 1]} · {sessionData.date}
              </p>
            </div>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs flex-shrink-0">✓ Fertig</Badge>
          </div>

          {/* Stats row */}
          {(sessionData.readinessScore != null || sessionData.sessionDifficulty != null) && (
            <div className="grid grid-cols-3 gap-3">
              {sessionData.readinessScore != null && (
                <div className="stat-card text-center">
                  <p className="text-xl font-bold font-display text-primary">{sessionData.readinessScore}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Readiness</p>
                </div>
              )}
              {sessionData.sessionDifficulty != null && (
                <div className="stat-card text-center">
                  <p className="text-xl font-bold font-display text-foreground">{sessionData.sessionDifficulty}/10</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Schwierigkeit</p>
                </div>
              )}
              <div className="stat-card text-center">
                <p className="text-xl font-bold font-display text-foreground">{setsDone.length}/{totalSets}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Sätze</p>
              </div>
            </div>
          )}

          {/* Set log — read-only */}
          <div className="space-y-3">
            <h2 className="font-display font-bold text-sm text-muted-foreground uppercase tracking-wider">Protokoll</h2>
            {sessionData.sets.map((set) => (
              <div
                key={set.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  set.isCompleted ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
                }`}>
                  {set.isCompleted ? <Check size={12} /> : set.setNumber}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold">
                    {set.targetReps}{set.isAmrap ? "+" : ""} × {set.targetWeight} kg
                  </span>
                  {set.isCompleted && set.actualReps != null && (
                    <p className="text-xs text-green-400">
                      ✓ {set.actualReps} × {set.actualWeight} kg
                      {set.rpe ? ` · RPE ${set.rpe}` : ""}
                    </p>
                  )}
                </div>
                {set.isAmrap ? (
                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">AMRAP</Badge>
                ) : null}
              </div>
            ))}
          </div>

          {/* Back to history CTA — sticky-style at bottom */}
          <Button
            variant="outline"
            onClick={() => navigate("/history")}
            className="w-full h-11 font-display"
            data-testid="button-back-to-history"
          >
            <ArrowLeft size={16} className="mr-2" /> Zurück zu Verlauf
          </Button>
        </div>
      </div>
    );
  }

  // ── Readiness check-in — with P5 Skip option ────────────────────────────
  if (!readinessDone) {
    return (
      <div>
      <MobileHeader backHref="/training" backLabel="Zurück" title={LIFT_NAMES[sessionData?.lift ?? ""] ?? "Workout"} />
      <div className="p-4 md:p-6 max-w-lg mx-auto space-y-6">
        <button onClick={() => navigate("/training")} className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm">
          <ArrowLeft size={16} /> Zurück
        </button>

        {/* Title row with Skip */}
        <div className="flex items-start justify-between">
          <div className="text-center flex-1">
            <p className="text-muted-foreground text-sm mb-1">
              {WAVE_NAMES[(sessionData.wave - 1)]} · {WEEK_NAMES[(sessionData.week - 1)]}
            </p>
            <h1 className="font-display text-xl font-bold">{LIFT_NAMES[sessionData.lift] ?? sessionData.lift}</h1>
            <p className="text-muted-foreground text-sm mt-1">Wie fühlst du dich heute?</p>
          </div>
          {/* P5: Skip button — ghost, top-right */}
          <button
            onClick={() => setReadinessDone(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-1"
            data-testid="button-readiness-skip"
          >
            <SkipForward size={13} /> Überspringen
          </button>
        </div>

        <div className="space-y-5">
          {[
            { key: "sleep", label: "Schlaf", emoji: "😴", desc: "Wie gut hast du geschlafen?" },
            { key: "nutrition", label: "Ernährung", emoji: "🥗", desc: "Hast du genug gegessen?" },
            { key: "motivation", label: "Motivation", emoji: "🔥", desc: "Wie motiviert bist du?" },
            { key: "fatigue", label: "Erschöpfung", emoji: "😮‍💨", desc: "Wie erschöpft/müde bist du?" },
          ].map(({ key, label, emoji, desc }) => (
            <div key={key} className="stat-card">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{emoji}</span>
                <div>
                  <p className="font-semibold text-sm font-display">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <span className="ml-auto font-bold text-primary font-display">{(readiness as any)[key]}/5</span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => setReadiness(r => ({ ...r, [key]: v }))}
                    className={`flex-1 h-9 rounded-lg border text-sm font-semibold transition-all ${
                      (readiness as any)[key] === v
                        ? "gradient-orange text-white border-transparent"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                    data-testid={`readiness-${key}-${v}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={handleReadinessDone}
          className="w-full h-12 gradient-orange text-white border-0 hover:opacity-90 font-display font-bold"
          data-testid="button-readiness-done"
        >
          Workout beginnen <Zap className="ml-2" size={16} />
        </Button>
      </div>
    </div>
    );
  }

  return (
    <div>
    <MobileHeader backHref="/training" backLabel="Training" title={LIFT_NAMES[sessionData.lift] ?? sessionData.lift} />
    <div className="p-4 md:p-6 max-w-2xl space-y-5">
      {/* Desktop Header */}
      <div className="hidden md:flex items-center gap-3">
        <button onClick={() => navigate("/training")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">
            {WAVE_NAMES[(sessionData.wave - 1)]} · {WEEK_NAMES[(sessionData.week - 1)]}
          </p>
          <h1 className="font-display text-lg font-bold">{LIFT_NAMES[sessionData.lift] ?? sessionData.lift}</h1>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-primary font-display">{pct}%</p>
          <p className="text-xs text-muted-foreground">{completedCount}/{totalSets} Sätze</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* Adaptation notes — 40+ and cycle phase */}
      {user && <AdaptationHeader user={user} />}

      {/* Rest timer */}
      {/* Rest timer overlay — click anywhere (backdrop or button) to dismiss */}
      {restActive && restTimer !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center pb-10 px-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setRestActive(false)}
          data-testid="rest-timer-overlay"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-primary/30 bg-card shadow-2xl p-5 flex flex-col items-center gap-4 animate-in slide-in-from-bottom-4 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Icon + title */}
            <div className="flex items-center gap-3 w-full">
              <div className="w-11 h-11 rounded-full gradient-orange flex items-center justify-center flex-shrink-0">
                <Timer size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Pause</p>
                <p className="text-xs text-muted-foreground">Nächster Satz startet automatisch</p>
              </div>
            </div>

            {/* Countdown */}
            <div className="text-5xl font-bold font-display text-primary tabular-nums tracking-tight">
              {Math.floor(restTimer / 60)}:{String(restTimer % 60).padStart(2, "0")}
            </div>

            {/* Skip button */}
            <button
              className="w-full h-11 rounded-xl bg-secondary hover:bg-secondary/80 active:opacity-70 transition-all text-sm font-semibold font-display"
              onClick={() => setRestActive(false)}
            >
              Pause überspringen
            </button>

            <p className="text-xs text-muted-foreground">
              Tipp: Einfach irgendwo tippen zum Schließen
            </p>
          </div>
        </div>
      )}

      {/* Instruction Videos */}
      {videos && videos.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-display font-bold text-sm text-muted-foreground uppercase tracking-wider">Instruktionsvideos</h2>
          <div className="space-y-2">
            {videos.map((v, i) => (
              <a
                key={i}
                href={v.url}
                target="_top"
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors group"
                data-testid={`video-link-${i}`}
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <PlayCircle size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold font-display truncate leading-tight">{v.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{v.channel}</p>
                </div>
                <ChevronDown size={14} className="text-muted-foreground rotate-[-90deg] flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Set list */}
      <div className="space-y-3">
        <h2 className="font-display font-bold text-sm text-muted-foreground uppercase tracking-wider">Sätze</h2>
        {sessionData.sets.map((set) => {
          const isActive = activeSetId === set.id;
          const input = setInputs[set.id] ?? {};

          return (
            <SwipeableSetRow
              key={set.id}
              set={set}
              isActive={isActive}
              input={input}
              onToggleExpand={() => setActiveSetId(isActive ? null : set.id)}
              onComplete={handleCompleteSet}
              onSkip={handleSkip}
              onInputChange={(id, patch) =>
                setSetInputs(prev => ({
                  ...prev,
                  [id]: { ...prev[id], ...patch },
                }))
              }
              isPending={updateSetMutation.isPending}
            />
          );
        })}
      </div>

      {/* Finish button */}
      {allDone && (
        <Button
          onClick={() => setShowFinishDialog(true)}
          className="w-full h-12 gradient-orange text-white border-0 hover:opacity-90 font-display font-bold"
          data-testid="button-finish-session"
        >
          Workout abschließen 🏆
        </Button>
      )}

      {/* AMRAP Progression Dialog */}
      <Dialog open={showAmrapDialog} onOpenChange={setShowAmrapDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">🏆 Progression berechnen</DialogTitle>
            <DialogDescription>
              Dein AMRAP-Satz ist abgeschlossen. Wie viele Wiederholungen hast du gemacht?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              type="number"
              placeholder="Wiederholungen"
              value={amrapSet ? (setInputs[amrapSet.id]?.reps ?? "") : ""}
              onChange={(e) => amrapSet && setSetInputs(prev => ({
                ...prev, [amrapSet.id]: { ...prev[amrapSet.id], reps: e.target.value }
              }))}
              className="bg-background border-border"
              data-testid="input-amrap-reps"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAmrapDialog(false)}>Später</Button>
            <Button
              onClick={handleAmrapProgression}
              className="gradient-orange text-white border-0"
              disabled={progressMutation.isPending}
              data-testid="button-apply-progression"
            >
              {progressMutation.isPending ? "Berechne…" : "1RM aktualisieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finish Session Dialog */}
      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Workout beenden</DialogTitle>
            <DialogDescription>Wie schwer war die heutige Session?</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Leicht</span>
              <span className="font-bold text-primary font-display">{sessionDifficulty}/10</span>
              <span>Max</span>
            </div>
            <Slider
              min={5} max={10} step={1}
              value={[sessionDifficulty]}
              onValueChange={([v]) => setSessionDifficulty(v)}
              data-testid="slider-difficulty"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinishDialog(false)}>Zurück</Button>
            <Button
              onClick={handleFinishSession}
              className="gradient-orange text-white border-0"
              disabled={updateSessionMutation.isPending}
              data-testid="button-confirm-finish"
            >
              Abschließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}
