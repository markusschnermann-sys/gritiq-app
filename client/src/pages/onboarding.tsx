import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { GritIQLogo } from "@/App";
import {
  ChevronRight, ChevronLeft, Check, Calculator,
  Zap, Target, TrendingDown, Info, Lightbulb,
  Brain, BarChart2, Dumbbell, Star, Lock, Sparkles,
  UtensilsCrossed, User, Activity, Trophy, Swords,
  Medal, Flame, Utensils, Scale, LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { computeMacros, macroPercentages } from "@/lib/nutrition";

// ── Types ─────────────────────────────────────────────────────────────────────
type Goal = "powerlifting" | "bodybuilding" | "weightloss";

interface FormData {
  name: string;
  goal: Goal | "";
  gender: "male" | "female" | "other";
  age: string;
  bodyweight: string;
  squatMax: string;
  benchMax: string;
  deadliftMax: string;
  ohpMax: string;
}

interface LiftErrors {
  squatMax?: string;
  benchMax?: string;
  deadliftMax?: string;
  ohpMax?: string;
}

// Steps shown in progress bar (0-4). Step 5 = Pro upsell. Step 6 = Success.
// 0=Name  1=Ziel  2=1RM+Gewicht  3=Profil  4=Vorschau
const STEPS = ["Name", "Ziel", "1RM", "Profil", "Vorschau"];

const GOALS: {
  id: Goal; label: string; sublabel: string; description: string;
  icon: React.ReactNode; color: string; border: string; bg: string;
  volumeTag: string; repRange: string; restTime: string;
  programTag: string;
}[] = [
  {
    id: "powerlifting",
    label: "Powerlifting",
    sublabel: "Kraftzuwachs · Wettkampf",
    description: "Maximiere deine 1-RM-Werte in Kniebeuge, Bankdrücken und Kreuzheben. Das klassische Adaptive Waves-Modell: 4 Wellen von 10 bis 3 Wdh. mit AMRAP-Progression.",
    icon: <Zap size={22} />,
    color: "text-orange-400",
    border: "border-orange-500/60",
    bg: "bg-orange-500/10",
    volumeTag: "Hohes Gewicht",
    repRange: "3–10 Wdh.",
    restTime: "3–5 Min.",
    programTag: "4 Wellen · 16 Wochen",
  },
  {
    id: "bodybuilding",
    label: "Bodybuilding",
    sublabel: "Muskelaufbau · Hypertrophie",
    description: "PPL-Split mit wellenbasierter Volumen-Progression. Pump-fokussiert, kontrollierte Exzentrik, progressive Überladung über 15→8 Wdh. Wellen.",
    icon: <Target size={22} />,
    color: "text-blue-400",
    border: "border-blue-500/60",
    bg: "bg-blue-500/10",
    volumeTag: "Hohes Volumen",
    repRange: "8–15 Wdh.",
    restTime: "60–90 Sek.",
    programTag: "PPL-Split · 16 Wochen",
  },
  {
    id: "weightloss",
    label: "Abnehmen",
    sublabel: "Fettabbau · Körperkomposition",
    description: "Metabolisches Ganzkörper-Circuit-Training. 3 rotierende Sessions pro Woche mit kurzen Pausen — maximale Kalorienverbrennung bei Muskelerhalt.",
    icon: <TrendingDown size={22} />,
    color: "text-red-400",
    border: "border-red-500/60",
    bg: "bg-red-500/10",
    volumeTag: "Metabolisch",
    repRange: "10–15 Wdh.",
    restTime: "45–60 Sek.",
    programTag: "Circuit A/B/C · 16 Wochen",
  },
];

const LIFTS = [
  { key: "squatMax" as const, label: "Kniebeuge", emoji: "🏋️", hint: "Tiefe Kniebeuge, 1 Wdh. Maximum" },
  { key: "benchMax" as const, label: "Bankdrücken", emoji: "💪", hint: "Brustberührung, 1 Wdh. Maximum" },
  { key: "deadliftMax" as const, label: "Kreuzheben", emoji: "🔥", hint: "Konventionell oder Sumo, 1 Wdh." },
  { key: "ohpMax" as const, label: "Schulterdrücken", emoji: "⬆️", hint: "Stehend, 1 Wdh. Maximum" },
];

// BW-based 1RM defaults (beginner multipliers)
function defaultMaxes(bwKg: number) {
  const r = (x: number) => String(Math.max(20, Math.round(x / 2.5) * 2.5));
  return {
    squatMax: r(bwKg * 1.00),
    benchMax: r(bwKg * 0.75),
    deadliftMax: r(bwKg * 1.25),
    ohpMax: r(bwKg * 0.50),
  };
}

// Compute IPF GL score for preview (simplified)
function estimateGLScore(sq: number, be: number, dl: number, bw: number, gender: "male" | "female" | "other"): number | null {
  if (!sq || !be || !dl || !bw || bw < 30) return null;
  const total = sq + be + dl;
  // Simplified IPF GL approximation for preview purposes
  const a = gender === "female" ? 676.5075 : 1236.25115;
  const b = gender === "female" ? 17.6076 : 1449.21864;
  const c = gender === "female" ? 0.002315 : 0.01644;
  const bwMale = bw < 59 ? 59 : bw > 120 ? 120 : bw;
  const denom = a - b * Math.exp(-c * bwMale);
  if (denom <= 0) return null;
  const score = (total / denom) * 100;
  return Math.round(score * 10) / 10;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MacroChip({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-2 space-y-0.5 flex flex-col items-center">
      <span className="text-muted-foreground text-xs leading-tight">{label}</span>
      <span className={cn("font-display font-bold text-sm leading-tight", accent)}>{value}</span>
    </div>
  );
}

function StepProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center">
        {STEPS.map((label, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                i < step
                  ? "gradient-orange text-white shadow-[0_0_12px_rgba(255,107,26,0.4)]"
                  : i === step
                  ? "border-2 border-primary text-primary"
                  : "border border-border text-muted-foreground"
              )}
            >
              {i < step ? <Check size={13} strokeWidth={3} /> : i + 1}
            </div>
            <span className={cn(
              "text-[9px] font-medium uppercase tracking-wider hidden sm:block",
              i === step ? "text-primary" : "text-muted-foreground"
            )}>
              {label}
            </span>
          </div>
        ))}
      </div>
      <div className="relative h-1 rounded-full bg-secondary mx-3">
        <div
          className="absolute inset-y-0 left-0 rounded-full gradient-orange transition-all duration-500"
          style={{ width: `${(step / (total - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}

function EstimatorSheet({
  liftLabel,
  onConfirm,
  onClose,
}: {
  liftLabel: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [estimated, setEstimated] = useState<number | null>(null);
  const weightRef = useRef<HTMLInputElement>(null);

  useEffect(() => { weightRef.current?.focus(); }, []);

  const estimateMutation = useMutation({
    mutationFn: async ({ weight, reps }: { weight: number; reps: number }) => {
      const res = await apiRequest("POST", "/api/program/estimate-1rm", { weight, reps });
      return res.json();
    },
    onSuccess: (data) => setEstimated(Math.round(data.oneRM)),
  });

  const canEstimate =
    weight !== "" && reps !== "" &&
    parseFloat(weight) > 0 && parseInt(reps) >= 1 && parseInt(reps) <= 20;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-primary" />
            <h3 className="font-display font-bold text-base">1RM schätzen</h3>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{liftLabel} · Epley-Formel</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Gewicht (kg)</Label>
              <Input
                ref={weightRef}
                type="number"
                inputMode="decimal"
                placeholder="z. B. 100"
                value={weight}
                onChange={(e) => { setWeight(e.target.value); setEstimated(null); }}
                className="h-11 bg-background text-center text-lg font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Wdh.</Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="z. B. 5"
                value={reps}
                onChange={(e) => { setReps(e.target.value); setEstimated(null); }}
                className="h-11 bg-background text-center text-lg font-semibold"
                onKeyDown={(e) => e.key === "Enter" && canEstimate && estimateMutation.mutate({ weight: parseFloat(weight), reps: parseInt(reps) })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            1RM ≈ Gewicht × (1 + Wdh / 30) · GritIQ rechnet mit 90% als TM
          </p>
          <Button
            className="w-full gradient-orange text-white border-0 h-11"
            disabled={!canEstimate || estimateMutation.isPending}
            onClick={() => estimateMutation.mutate({ weight: parseFloat(weight), reps: parseInt(reps) })}
          >
            {estimateMutation.isPending ? "Berechne…" : "1RM berechnen"}
          </Button>
          {estimated !== null && (
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-center space-y-1 animate-in fade-in duration-300">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Geschätzter 1RM</p>
              <p className="text-4xl font-display font-bold text-primary">{estimated} <span className="text-lg font-normal text-muted-foreground">kg</span></p>
              <p className="text-xs text-muted-foreground">Trainingsmaximum: {Math.round(estimated * 0.9)} kg (90%)</p>
              <Button
                className="w-full mt-2 gradient-orange text-white border-0 h-11"
                onClick={() => onConfirm(estimated.toString())}
              >
                <Check size={16} className="mr-2" /> Wert übernehmen
              </Button>
            </div>
          )}
        </div>
        <div className="px-5 pb-5">
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>Abbrechen</Button>
        </div>
      </div>
    </div>
  );
}

// ── Live Dashboard Preview Component ─────────────────────────────────────────
function DashboardPreview({ form }: { form: FormData }) {
  const goal = (form.goal || "powerlifting") as Goal;
  const goalCfg = GOALS.find((g) => g.id === goal)!;
  const bwNum = parseFloat(form.bodyweight);
  const hasBw = !isNaN(bwNum) && bwNum >= 30;
  const sqNum = parseFloat(form.squatMax) || 0;
  const beNum = parseFloat(form.benchMax) || 0;
  const dlNum = parseFloat(form.deadliftMax) || 0;
  const ohpNum = parseFloat(form.ohpMax) || 0;
  const totalKg = sqNum + beNum + dlNum;

  const macros = hasBw
    ? computeMacros(bwNum, goal, {
        gender: form.gender,
        age: form.age ? parseInt(form.age) : undefined,
      })
    : null;

  const glScore = hasBw && sqNum && beNum && dlNum
    ? estimateGLScore(sqNum, beNum, dlNum, bwNum, form.gender === "other" ? "male" : form.gender)
    : null;

  const sqTM = Math.round(sqNum * 0.9);
  const beTM = Math.round(beNum * 0.9);
  const dlTM = Math.round(dlNum * 0.9);

  const firstName = form.name.split(" ")[0] || "Athlet";

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xl">
      {/* Mock nav bar */}
      <div className="bg-secondary/60 px-4 py-2.5 flex items-center gap-2 border-b border-border">
        <GritIQLogo size={22} />
        <span className="font-display font-bold text-sm text-foreground">GritIQ</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-muted-foreground">Dashboard</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Greeting */}
        <div>
          <p className="text-xs text-muted-foreground">Guten Morgen,</p>
          <p className="font-display font-bold text-lg leading-tight">Hey, {firstName} 👋</p>
        </div>

        {/* Wave + goal badge */}
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border", goalCfg.bg, goalCfg.border, goalCfg.color)}>
            {goalCfg.icon}
            <span>{goalCfg.label}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/50 rounded-full px-2.5 py-1">
            <Flame size={11} />
            <span>Wave 1 · Woche 1</span>
          </div>
        </div>

        {/* 1RM quick stat row */}
        {(sqNum > 0 || beNum > 0 || dlNum > 0) && (
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { em: "🏋️", lbl: "Kniebeuge", val: sqNum, tm: sqTM },
              { em: "💪", lbl: "Bankdrücken", val: beNum, tm: beTM },
              { em: "🔥", lbl: "Kreuzheben", val: dlNum, tm: dlTM },
            ].map(({ em, lbl, val, tm }) => (
              <div key={lbl} className="bg-secondary/40 rounded-xl p-2.5 text-center">
                <div className="text-base leading-none mb-0.5">{em}</div>
                <div className="font-display font-bold text-sm text-primary">{val > 0 ? `${val} kg` : "—"}</div>
                <div className="text-[10px] text-muted-foreground">{val > 0 ? `TM: ${tm} kg` : lbl}</div>
              </div>
            ))}
          </div>
        )}

        {/* Macro strip */}
        {macros && (
          <div className={cn("rounded-xl border p-3 space-y-2", goalCfg.border, goalCfg.bg)}>
            <div className="flex items-center gap-1.5">
              <Utensils size={12} className={goalCfg.color} />
              <p className={cn("text-xs font-display font-bold uppercase tracking-wider", goalCfg.color)}>
                Tagesplan · {goalCfg.label}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <MacroChip label="kcal" value={`${macros.calories}`} accent={goalCfg.color} />
              <MacroChip label="Protein" value={`${macros.proteinG}g`} accent={goalCfg.color} />
              <MacroChip label="Carbs" value={`${macros.carbsG}g`} accent="text-sky-400" />
              <MacroChip label="Fett" value={`${macros.fatG}g`} accent="text-yellow-400" />
            </div>
            {/* Macro bar */}
            {(() => {
              const pct = macroPercentages(macros);
              return (
                <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                  <div className="bg-orange-400 rounded-l-full" style={{ width: `${pct.protein}%` }} />
                  <div className="bg-sky-400" style={{ width: `${pct.carbs}%` }} />
                  <div className="bg-yellow-400 rounded-r-full" style={{ width: `${pct.fat}%` }} />
                </div>
              );
            })()}
          </div>
        )}

        {/* IPF GL score teaser */}
        {glScore !== null && (
          <div className="flex items-center gap-3 bg-secondary/40 rounded-xl px-3 py-2.5 border border-border">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Medal size={16} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">IPF Goodlift-Score</p>
              <p className="font-display font-bold text-base text-primary">{glScore}</p>
            </div>
            {totalKg > 0 && (
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-display font-bold text-sm">{totalKg} kg</p>
              </div>
            )}
          </div>
        )}

        {/* Programme week 1 teaser */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Zap size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Wave 1 · Woche 1 · Akkumulation</p>
            <p className="font-display font-semibold text-sm">
              {goal === "powerlifting" && "Kniebeuge · Bankdrücken · Kreuzheben · OHP"}
              {goal === "bodybuilding" && "Brust · Rücken · Beine · Schultern · Arme"}
              {goal === "weightloss" && "Ganzkörper A → B → C (rotierend)"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pro Feature Grid ──────────────────────────────────────────────────────────
const PRO_FEATURES = [
  { icon: <Brain className="h-5 w-5" />, title: "ATLAS KI-Coach", desc: "Unbegrenzte KI-Sessions", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  { icon: <BarChart2 className="h-5 w-5" />, title: "Analytics", desc: "PR Wall & Performance", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { icon: <UtensilsCrossed className="h-5 w-5" />, title: "KI-Ernährungsplan", desc: "Wöchentlich per E-Mail", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
  { icon: <Dumbbell className="h-5 w-5" />, title: "Alle Ziele", desc: "PL · BB · Abnehmen", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  { icon: <Star className="h-5 w-5" />, title: "Challenges", desc: "Social Layer & Ranking", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  { icon: <Sparkles className="h-5 w-5" />, title: "Früher Zugang", desc: "Beta-Features zuerst", color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20" },
];

// ── Main Component ────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { toast } = useToast();
  // 0=Name  1=Ziel  2=1RM+Gewicht  3=Profil  4=Vorschau  5=Pro  6=Done
  const [step, setStep] = useState(0);
  const [onboardingBillingCycle, setOnboardingBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [estimatingLift, setEstimatingLift] = useState<typeof LIFTS[number] | null>(null);
  const [liftErrors, setLiftErrors] = useState<LiftErrors>({});
  const [resumed, setResumed] = useState(false);
  const [previewPulsed, setPreviewPulsed] = useState(false);

  const [form, setForm] = useState<FormData>({
    name: "",
    goal: "",
    gender: "other",
    age: "",
    bodyweight: "",
    squatMax: "",
    benchMax: "",
    deadliftMax: "",
    ohpMax: "",
  });

  // Partial-onboarding resume
  const { data: onboardingState } = useQuery<{
    resumeFromStep: number | null;
    user?: { name?: string; trainingGoal?: string; bodyweight?: number };
  }>({ queryKey: ["/api/user/onboarding-state"], staleTime: Infinity });

  useEffect(() => {
    if (resumed || !onboardingState) return;
    const { resumeFromStep, user: pu } = onboardingState;
    if (resumeFromStep !== null && resumeFromStep !== undefined && resumeFromStep > 0) {
      if (pu) {
        setForm((f) => ({
          ...f,
          name: pu.name ?? f.name,
          goal: (pu.trainingGoal as Goal | "") ?? f.goal,
          bodyweight: pu.bodyweight ? String(pu.bodyweight) : f.bodyweight,
        }));
      }
      setStep(resumeFromStep);
      setResumed(true);
    }
  }, [onboardingState, resumed]);

  // Pulse preview when user enters step 4
  useEffect(() => {
    if (step === 4 && !previewPulsed) {
      setPreviewPulsed(true);
    }
  }, [step, previewPulsed]);

  const createdUserRef = useRef<unknown>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (step === 0) nameRef.current?.focus(); }, [step]);

  const set = (key: keyof FormData, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const validateLifts = () => {
    const errs: LiftErrors = {};
    for (const lift of LIFTS) {
      const v = parseFloat(form[lift.key]);
      if (!form[lift.key] || isNaN(v)) {
        errs[lift.key] = "Pflichtfeld";
      } else if (v < 20) {
        errs[lift.key] = "Mindestens 20 kg";
      } else if (v > 500) {
        errs[lift.key] = "Maximal 500 kg";
      }
    }
    setLiftErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Create user (fires at end of Step 4, before Pro step) ─────────────────
  const createUserMutation = useMutation({
    mutationFn: async () => {
      const data = {
        name: form.name.trim(),
        trainingGoal: form.goal || "powerlifting",
        bodyweight: form.bodyweight ? parseFloat(form.bodyweight) : null,
        squatMax: parseFloat(form.squatMax),
        benchMax: parseFloat(form.benchMax),
        deadliftMax: parseFloat(form.deadliftMax),
        ohpMax: parseFloat(form.ohpMax),
        currentWave: 1,
        currentWeek: 1,
        programStartDate: new Date().toISOString().split("T")[0],
        gender: form.gender,
        age: form.age ? parseInt(form.age) : null,
        cyclePhase: null,
      };
      const res = await apiRequest("POST", "/api/user", data);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (newUser) => {
      createdUserRef.current = newUser;
      setStep(5);
    },
    onError: () => {
      toast({ title: "Fehler", description: "Bitte überprüfe deine Eingaben.", variant: "destructive" });
    },
  });

  // ── Pro trial checkout ─────────────────────────────────────────────────────
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/checkout", { billingCycle: onboardingBillingCycle });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Checkout fehlgeschlagen");
      }
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
      setStep(6);
    },
    onError: (err: Error) => {
      toast({
        title: "Stripe nicht konfiguriert",
        description: err.message.includes("STRIPE_SECRET_KEY")
          ? "Stripe-Keys fehlen noch — Weiter ohne Pro."
          : err.message,
        variant: "destructive",
      });
      setStep(6);
    },
  });

  // ── Go to dashboard ────────────────────────────────────────────────────────
  const handleDashboard = useCallback(async () => {
    // Mark onboarding complete in local auth state (no server round-trip).
    // DO NOT call initAuth() here — in cross-origin iframes the HttpOnly cookie
    // is blocked, so initAuth() returns { user: null } and logs the user out.
    const { markOnboardingComplete } = await import("@/lib/authStore");
    markOnboardingComplete();
    if (createdUserRef.current) {
      queryClient.setQueryData(["/api/user"], createdUserRef.current);
    } else {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    }
    // Navigate to dashboard root. Use hash navigation so wouter
    // (useHashLocation) picks up the route change correctly.
    window.location.hash = "/";
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────
  const canAdvanceStep0 = form.name.trim().length >= 2;
  const canAdvanceStep1 = form.goal !== "";
  const canAdvanceStep2 = (() => {
    const allFilled = LIFTS.every((l) => {
      const v = parseFloat(form[l.key]);
      return form[l.key] !== "" && !isNaN(v) && v >= 20 && v <= 500;
    });
    return allFilled;
  })();
  // Step 3 (profile) is optional — always can advance
  const canAdvanceStep3 = true;

  // ── Step navigation ────────────────────────────────────────────────────────
  const advance = () => {
    if (step === 0 && !canAdvanceStep0) return;
    if (step === 1 && !canAdvanceStep1) return;
    if (step === 2) {
      if (!validateLifts()) return;
    }
    if (step === 4) {
      // Confirm: create user
      if (createUserMutation.isPending) return;
      createUserMutation.mutate();
      return;
    }
    setStep((s) => s + 1);
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

  const selectedGoal = GOALS.find((g) => g.id === form.goal);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-start px-4 py-8 sm:py-12">
      {estimatingLift && (
        <EstimatorSheet
          liftLabel={estimatingLift.label}
          onConfirm={(val) => {
            set(estimatingLift.key, val);
            setLiftErrors((e) => ({ ...e, [estimatingLift.key]: undefined }));
            setEstimatingLift(null);
          }}
          onClose={() => setEstimatingLift(null)}
        />
      )}

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <GritIQLogo size={52} />
        </div>

        {/* Progress — steps 0–4 only */}
        {step < 5 && (
          <div className="mb-8">
            <StepProgress step={step} total={STEPS.length} />
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            STEP 0 — Name (Welcome)
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {step === 0 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="text-center space-y-3">
              <h1 className="font-display text-3xl font-bold">Willkommen bei GritIQ</h1>
              <p className="text-muted-foreground leading-relaxed">
                Periodisiertes Krafttraining — präzise, strukturiert, datenbasiert.<br />
                Erstelle dein Profil in 4 Schritten.
              </p>
            </div>

            {/* Feature teasers */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: <Dumbbell size={18} />, label: "Adaptive Training", color: "text-orange-400", bg: "bg-orange-500/10" },
                { icon: <Utensils size={18} />, label: "KI-Ernährungsplan", color: "text-green-400", bg: "bg-green-500/10" },
                { icon: <Medal size={18} />, label: "IPF Goodlift-Score", color: "text-primary", bg: "bg-primary/10" },
              ].map(({ icon, label, color, bg }) => (
                <div key={label} className={cn("flex flex-col items-center gap-2 p-3 rounded-xl border border-border", bg)}>
                  <span className={color}>{icon}</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight font-medium">{label}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold flex items-center gap-2">
                <User size={14} className="text-primary" />
                Wie heißt du?
              </Label>
              <Input
                ref={nameRef}
                id="name"
                placeholder="z. B. Markus"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canAdvanceStep0 && advance()}
                className={cn(
                  "h-13 text-base bg-card border-border",
                  form.name.length > 0 && form.name.trim().length < 2 && "border-red-500/60"
                )}
                autoComplete="given-name"
                data-testid="input-onboarding-name"
              />
              {form.name.length > 0 && form.name.trim().length < 2 && (
                <p className="text-xs text-red-400">Mindestens 2 Zeichen</p>
              )}
              {form.name.trim().length >= 2 && (
                <p className="text-xs text-green-400 flex items-center gap-1">
                  <Check size={12} /> Hallo, {form.name.split(" ")[0]}!
                </p>
              )}
            </div>

            <Button
              onClick={advance}
              disabled={!canAdvanceStep0}
              className="w-full h-12 gradient-orange text-white border-0 font-display font-semibold text-base hover:opacity-90 disabled:opacity-40"
              data-testid="button-name-next"
            >
              Los geht's <ChevronRight className="ml-1" size={18} />
            </Button>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            STEP 1 — Training Goal
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="text-center space-y-1.5">
              <h2 className="font-display text-2xl font-bold">
                {form.name.split(" ")[0]}, was ist dein Ziel?
              </h2>
              <p className="text-sm text-muted-foreground">
                Das Ziel bestimmt Programm, Periodisierung, Ernährungsplan und Supplements.
              </p>
            </div>

            <div className="space-y-3">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => set("goal", g.id)}
                  data-testid={`goal-card-${g.id}`}
                  className={cn(
                    "w-full text-left rounded-xl border-2 p-4 transition-all duration-200",
                    form.goal === g.id
                      ? `${g.border} ${g.bg}`
                      : "border-border bg-card hover:border-border/80 hover:bg-secondary/40"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
                      form.goal === g.id ? `${g.bg} ${g.color}` : "bg-secondary text-muted-foreground"
                    )}>
                      {g.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={cn("font-display font-bold text-base", form.goal === g.id ? g.color : "text-foreground")}>
                          {g.label}
                        </p>
                        <span className={cn("text-xs font-medium opacity-70", form.goal === g.id ? g.color : "text-muted-foreground")}>
                          {g.sublabel}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{g.description}</p>
                      {form.goal === g.id && (
                        <div className="flex gap-1.5 mt-2 flex-wrap animate-in fade-in duration-200">
                          {[
                            { label: g.repRange, icon: "🔄" },
                            { label: g.restTime, icon: "⏱️" },
                            { label: g.programTag, icon: "📅" },
                          ].map(({ label, icon }) => (
                            <span key={label} className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", g.border, g.bg, g.color)}>
                              {icon} {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 mt-1",
                      form.goal === g.id ? `${g.border} ${g.color}` : "border-border"
                    )}>
                      {form.goal === g.id && <Check size={11} strokeWidth={3} />}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Live macro preview */}
            {form.goal && (() => {
              const previewMacros = computeMacros(80, form.goal as Goal);
              const goalCfg = GOALS.find((g) => g.id === form.goal)!;
              return (
                <div className={cn("rounded-xl border p-3 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300", goalCfg.border, goalCfg.bg)}>
                  <p className={cn("text-xs font-display font-bold uppercase tracking-wider", goalCfg.color)}>
                    Makro-Vorschau (Beispiel 80 kg)
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    <MacroChip label="Kalorien" value={`${previewMacros.calories}`} accent={goalCfg.color} />
                    <MacroChip label="Protein" value={`${previewMacros.proteinG}g`} accent={goalCfg.color} />
                    <MacroChip label="Carbs" value={`${previewMacros.carbsG}g`} accent="text-sky-400" />
                    <MacroChip label="Fett" value={`${previewMacros.fatG}g`} accent="text-yellow-400" />
                  </div>
                  <p className="text-xs text-muted-foreground">Präzisiert mit deinem Körpergewicht im nächsten Schritt.</p>
                </div>
              );
            })()}

            <div className="flex gap-3">
              <Button variant="outline" onClick={back} className="h-12 px-5">
                <ChevronLeft size={18} />
              </Button>
              <Button
                onClick={advance}
                disabled={!canAdvanceStep1}
                className="flex-1 h-12 gradient-orange text-white border-0 font-display font-semibold text-base hover:opacity-90 disabled:opacity-40"
                data-testid="button-goal-next"
              >
                Weiter <ChevronRight className="ml-1" size={18} />
              </Button>
            </div>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            STEP 2 — 1RM Entry + Bodyweight (combined)
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {step === 2 && (() => {
          const bwNum = parseFloat(form.bodyweight);
          const hasBw = !isNaN(bwNum) && bwNum >= 30 && bwNum <= 300;

          const applyDefaults = () => {
            const defaults = defaultMaxes(hasBw ? bwNum : 80);
            setForm((f) => ({ ...f, ...defaults }));
            setLiftErrors({});
          };

          return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="text-center space-y-1">
                <h2 className="font-display text-2xl font-bold">Deine Maximalwerte</h2>
                <p className="text-sm text-muted-foreground">
                  Basis für alle Trainingsgewichte. Kein 1RM? Nutze den Schätzer.
                </p>
              </div>

              {selectedGoal && (
                <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm border w-fit mx-auto", selectedGoal.bg, selectedGoal.border, selectedGoal.color)}>
                  {selectedGoal.icon}
                  <span className="font-semibold">{selectedGoal.label}</span>
                </div>
              )}

              {/* Bodyweight field (inline, compact) */}
              <div className={cn("rounded-xl border bg-card p-3 flex items-center gap-3 transition-all", hasBw ? "border-primary/30" : "border-border")}>
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  <Scale size={16} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-muted-foreground">Körpergewicht (für Startwerte &amp; Makros)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="relative w-28">
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="80"
                        value={form.bodyweight}
                        onChange={(e) => set("bodyweight", e.target.value)}
                        className="h-9 text-sm bg-background pr-10 font-semibold"
                        data-testid="input-onboarding-bodyweight"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
                    </div>
                    {hasBw && (
                      <button
                        onClick={applyDefaults}
                        className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 whitespace-nowrap"
                      >
                        Startwerte generieren
                      </button>
                    )}
                  </div>
                </div>
                {hasBw && <Check size={16} className="text-green-400 flex-shrink-0" />}
              </div>

              {/* Soft escape for beginners */}
              {!canAdvanceStep2 && (
                <button
                  onClick={applyDefaults}
                  data-testid="button-fill-defaults"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors text-left group"
                >
                  <Lightbulb size={16} className="text-primary flex-shrink-0 group-hover:text-primary/80" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display font-semibold text-primary leading-tight">
                      Ich kenne meinen 1RM nicht
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Startwerte auf Basis {hasBw ? `${bwNum} kg` : "80 kg Standardgewicht"} — jederzeit anpassbar
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-primary/60 flex-shrink-0" />
                </button>
              )}

              {/* 1RM inputs */}
              <div className="space-y-2.5">
                {LIFTS.map((lift) => {
                  const err = liftErrors[lift.key];
                  const val = form[lift.key];
                  const isValid = val && !isNaN(parseFloat(val)) && parseFloat(val) >= 20;
                  return (
                    <div
                      key={lift.key}
                      className={cn(
                        "rounded-xl border bg-card p-3.5 transition-all",
                        err ? "border-red-500/50" : isValid ? "border-primary/30" : "border-border"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl leading-none w-7 text-center flex-shrink-0">{lift.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <div>
                              <p className="font-display font-semibold text-sm">{lift.label}</p>
                              <p className="text-[10px] text-muted-foreground">{lift.hint}</p>
                            </div>
                            <button
                              onClick={() => setEstimatingLift(lift)}
                              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 underline underline-offset-2 flex-shrink-0 ml-2"
                            >
                              <Calculator size={11} /> schätzen
                            </button>
                          </div>
                          <div className="relative">
                            <Input
                              type="number"
                              inputMode="decimal"
                              placeholder="kg"
                              value={val}
                              onChange={(e) => {
                                set(lift.key, e.target.value);
                                if (liftErrors[lift.key]) setLiftErrors((er) => ({ ...er, [lift.key]: undefined }));
                              }}
                              className={cn(
                                "h-10 bg-background pr-14 text-base font-semibold",
                                err ? "border-red-500/60 focus-visible:ring-red-500/30" : ""
                              )}
                              data-testid={`input-onboarding-${lift.key}`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kg</span>
                            {isValid && !err && (
                              <div className="absolute right-8 top-1/2 -translate-y-1/2">
                                <Check size={13} className="text-green-400" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {err && <p className="text-xs text-red-400 mt-1.5 ml-10">{err}</p>}
                      {isValid && !err && (
                        <p className="text-xs text-muted-foreground mt-1.5 ml-10">
                          TM: <span className="text-primary font-medium">{Math.round(parseFloat(val) * 0.9)} kg</span> (90%)
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="bg-primary/8 border border-primary/20 rounded-lg p-3 flex gap-2 text-sm">
                <Info size={15} className="text-primary mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  GritIQ rechnet mit <strong className="text-foreground">90%</strong> deines 1RM als Trainingsmaximum. Alle Gewichte werden automatisch berechnet.
                </p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={back} className="h-12 px-5">
                  <ChevronLeft size={18} />
                </Button>
                <Button
                  onClick={advance}
                  className="flex-1 h-12 gradient-orange text-white border-0 font-display font-semibold hover:opacity-90"
                  data-testid="button-rm-next"
                >
                  Weiter <ChevronRight className="ml-1" size={18} />
                </Button>
              </div>
            </div>
          );
        })()}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            STEP 3 — Nutrition Profile (Gender + Age + macros live)
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {step === 3 && (() => {
          const genderOptions: { value: "male" | "female" | "other"; label: string; icon: string; sublabel: string }[] = [
            { value: "male", label: "Männlich", icon: "♂️", sublabel: "Testosteron-angepasste Progression" },
            { value: "female", label: "Weiblich", icon: "♀️", sublabel: "Angepasste Kalorienziele" },
            { value: "other", label: "Divers / k.A.", icon: "⚧️", sublabel: "Neutrale Berechnung" },
          ];
          const ageNum = parseInt(form.age);
          const ageValid = form.age === "" || (!isNaN(ageNum) && ageNum >= 14 && ageNum <= 99);
          const bwNum = parseFloat(form.bodyweight);
          const hasBw = !isNaN(bwNum) && bwNum >= 30;
          const goal = (form.goal || "powerlifting") as Goal;
          const macros = hasBw ? computeMacros(bwNum, goal, {
            gender: form.gender,
            age: form.age ? parseInt(form.age) : undefined,
          }) : null;
          const goalCfg = GOALS.find((g) => g.id === goal)!;

          const methodLabel = form.age && form.gender !== "other"
            ? "Mifflin-St-Jeor TDEE"
            : "kcal/kg-Formel (Fallback)";

          return (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="text-center space-y-1">
                <h2 className="font-display text-2xl font-bold">Ernährungsprofil</h2>
                <p className="text-sm text-muted-foreground">
                  Geschlecht und Alter präzisieren deinen Makroplan. Beide optional.
                </p>
              </div>

              {/* Geschlecht */}
              <div className="space-y-2.5">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <User size={13} className="text-primary" /> Geschlecht
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {genderOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => set("gender", opt.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm font-medium transition-colors",
                        form.gender === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40"
                      )}
                      data-testid={`button-gender-${opt.value}`}
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      <span className="text-xs font-semibold">{opt.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {genderOptions.find((o) => o.value === form.gender)?.sublabel}
                </p>
              </div>

              {/* Alter */}
              <div className="space-y-2">
                <Label htmlFor="age" className="text-sm font-semibold flex items-center gap-2">
                  <Activity size={13} className="text-primary" />
                  Alter <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <div className="flex items-center gap-3">
                  <div className="relative w-32">
                    <Input
                      id="age"
                      type="number"
                      inputMode="numeric"
                      placeholder="28"
                      value={form.age}
                      onChange={(e) => set("age", e.target.value)}
                      className={cn("h-11 text-base bg-card border-border pr-14", form.age && !ageValid && "border-red-500")}
                      min={14}
                      max={99}
                      data-testid="input-onboarding-age"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Jahre</span>
                  </div>
                  <p className="text-xs text-muted-foreground flex-1">
                    Aktiviert Mifflin-St-Jeor BMR für präzisere Kalorienberechnung
                  </p>
                </div>
                {form.age && !ageValid && (
                  <p className="text-xs text-red-400">Bitte einen realistischen Wert eingeben (14–99)</p>
                )}
              </div>

              {/* Live macro preview */}
              {macros ? (
                <div className={cn("rounded-xl border p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300", goalCfg.border, goalCfg.bg)}>
                  <div className="flex items-center justify-between">
                    <p className={cn("text-xs font-display font-bold uppercase tracking-wider", goalCfg.color)}>
                      Dein Tagesplan · {bwNum} kg · {goalCfg.label}
                    </p>
                    <span className="text-[10px] text-muted-foreground">{methodLabel}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MacroChip label="Kalorien" value={`${macros.calories} kcal`} accent={goalCfg.color} />
                    <MacroChip label="Protein" value={`${macros.proteinG} g`} accent={goalCfg.color} />
                    <MacroChip label="Carbs" value={`${macros.carbsG} g`} accent="text-sky-400" />
                    <MacroChip label="Fett" value={`${macros.fatG} g`} accent="text-yellow-400" />
                  </div>
                  {/* Macro distribution bar */}
                  {(() => {
                    const pct = macroPercentages(macros);
                    return (
                      <div>
                        <div className="flex h-2 rounded-full overflow-hidden gap-px mb-1">
                          <div className="bg-orange-400 rounded-l-full transition-all duration-500" style={{ width: `${pct.protein}%` }} />
                          <div className="bg-sky-400 transition-all duration-500" style={{ width: `${pct.carbs}%` }} />
                          <div className="bg-yellow-400 rounded-r-full transition-all duration-500" style={{ width: `${pct.fat}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Protein {pct.protein}%</span>
                          <span>Carbs {pct.carbs}%</span>
                          <span>Fett {pct.fat}%</span>
                        </div>
                      </div>
                    );
                  })()}
                  <p className="text-xs text-muted-foreground">
                    Diese Werte fließen direkt in deinen wöchentlichen Ernährungsplan ein — jeden Montag per E-Mail.
                  </p>
                </div>
              ) : (
                <div className="bg-secondary/40 border border-border rounded-lg p-3 flex gap-2 text-sm">
                  <Info size={15} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    Gib dein Körpergewicht im vorherigen Schritt ein — dann erscheint hier dein Makroplan.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={back} className="h-12 px-5">
                  <ChevronLeft size={18} />
                </Button>
                <Button
                  onClick={advance}
                  className="flex-1 h-12 gradient-orange text-white border-0 font-display font-semibold hover:opacity-90"
                  data-testid="button-profile-next"
                >
                  Zur Vorschau <ChevronRight className="ml-1" size={18} />
                </Button>
              </div>
            </div>
          );
        })()}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            STEP 4 — Personalized Dashboard Preview
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {step === 4 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="text-center space-y-1.5">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                  <LayoutDashboard size={20} className="text-primary" />
                </div>
              </div>
              <h2 className="font-display text-2xl font-bold">
                So sieht dein Dashboard aus
              </h2>
              <p className="text-sm text-muted-foreground">
                Dein personalisiertes Profil — so startest du in GritIQ.
              </p>
            </div>

            {/* Live dashboard preview */}
            <div className={cn("transition-all duration-700", previewPulsed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")}>
              <DashboardPreview form={form} />
            </div>

            {/* Summary chips */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Trainingsziel", value: selectedGoal?.label ?? "—", icon: selectedGoal?.icon, color: selectedGoal?.color },
                { label: "Körpergewicht", value: form.bodyweight ? `${form.bodyweight} kg` : "Nicht angegeben", icon: <Scale size={14} />, color: "text-muted-foreground" },
                { label: "Kniebeuge 1RM", value: form.squatMax ? `${form.squatMax} kg` : "—", icon: <span className="text-sm">🏋️</span>, color: "text-primary" },
                { label: "Kreuzheben 1RM", value: form.deadliftMax ? `${form.deadliftMax} kg` : "—", icon: <span className="text-sm">🔥</span>, color: "text-primary" },
              ].map(({ label, value, icon, color }) => (
                <div key={label} className="bg-secondary/40 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
                  <span className={cn("flex-shrink-0", color)}>{icon}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="text-sm font-display font-semibold truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-primary/8 border border-primary/20 rounded-lg p-3 flex gap-2 text-sm">
              <Check size={15} className="text-green-400 mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground">
                Alles korrekt? Mit <strong className="text-foreground">Profil bestätigen</strong> werden alle Werte in GritIQ gespeichert und dein 16-Wochen-Programm startet.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={back} className="h-12 px-5">
                <ChevronLeft size={18} />
              </Button>
              <Button
                onClick={advance}
                disabled={createUserMutation.isPending}
                className="flex-1 h-12 gradient-orange text-white border-0 font-display font-semibold hover:opacity-90 shadow-[0_4px_20px_rgba(255,107,26,0.35)]"
                data-testid="button-onboarding-finish"
              >
                {createUserMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Speichere…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Check size={18} />
                    Profil bestätigen
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            STEP 5 — Pro Trial Prompt
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {step === 5 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-400">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="p-2.5 rounded-xl bg-orange-500/15 border border-orange-500/25">
                  <Zap className="h-6 w-6 text-orange-400" />
                </div>
              </div>
              <h2 className="font-display text-2xl font-bold">
                Fast fertig, {form.name.split(" ")[0]}!
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Dein Profil ist gespeichert. Hol das Maximum mit GritIQ Pro — 14 Tage komplett kostenlos.
              </p>
            </div>

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setOnboardingBillingCycle("monthly")}
                className={cn(
                  "text-sm font-medium px-3 py-1 rounded-full transition-colors",
                  onboardingBillingCycle === "monthly"
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Monatlich
              </button>
              <button
                onClick={() => setOnboardingBillingCycle("yearly")}
                className={cn(
                  "text-sm font-medium px-3 py-1 rounded-full transition-colors flex items-center gap-1.5",
                  onboardingBillingCycle === "yearly"
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Jährlich
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0 font-bold">
                  −33%
                </Badge>
              </button>
            </div>

            <div className="flex items-center justify-center gap-3">
              <div className="text-center">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="font-display font-bold text-3xl">
                    {onboardingBillingCycle === "monthly" ? "9,99 €" : "6,66 €"}
                  </span>
                  <span className="text-muted-foreground text-sm">/Monat</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {onboardingBillingCycle === "yearly"
                    ? "79,99 €/Jahr · 2 Monate geschenkt"
                    : "oder 79,99 €/Jahr (33 % sparen)"}
                </p>
              </div>
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs font-bold px-3 py-1">
                14 Tage GRATIS
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {PRO_FEATURES.map((f, i) => (
                <div
                  key={i}
                  className={cn("rounded-xl border p-3 flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300", f.border, f.bg)}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className={cn("mt-0.5 flex-shrink-0", f.color)}>{f.icon}</span>
                  <div className="min-w-0">
                    <p className={cn("font-display font-bold text-xs leading-tight", f.color)}>{f.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <Button
                className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-display font-bold text-base shadow-[0_4px_20px_rgba(255,107,26,0.4)] border-0"
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                data-testid="button-pro-trial"
              >
                {checkoutMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Weiterleitung…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    14 Tage kostenlos starten
                  </span>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Keine Kreditkarte für Testzeitraum · Jederzeit kündbar
              </p>
              <button
                onClick={() => setStep(6)}
                className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
                data-testid="button-skip-pro"
              >
                Jetzt überspringen — später upgraden
              </button>
            </div>

            <div className="rounded-lg border border-border bg-secondary/20 p-3 flex items-start gap-2">
              <Lock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Free-Plan:</strong> Wave 1, Trainings-Verlauf & 5 ATLAS-Nachrichten/Monat inklusive — jederzeit upgraden.
              </p>
            </div>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            STEP 6 — Success & Dashboard CTA
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {step === 6 && (
          <div className="space-y-8 text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full gradient-orange flex items-center justify-center shadow-[0_0_40px_rgba(255,107,26,0.4)]">
                  <Check size={44} className="text-white" strokeWidth={2.5} />
                </div>
                <div className="absolute inset-0 rounded-full gradient-orange opacity-20 animate-ping" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-3xl font-bold">
                Bereit, {form.name.split(" ")[0]}!
              </h2>
              <p className="text-muted-foreground">
                Dein GritIQ-Programm ist eingerichtet und dein Dashboard ist befüllt.
              </p>
            </div>

            {/* Summary card */}
            <div className="rounded-xl border border-border bg-card p-4 text-left space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Dein Profil</p>
              {selectedGoal && (
                <div className={cn("flex items-center gap-2 text-sm font-semibold", selectedGoal.color)}>
                  {selectedGoal.icon}
                  <span>{selectedGoal.label}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {LIFTS.map((lift) => (
                  <div key={lift.key} className="flex items-center justify-between bg-secondary/40 rounded-lg px-3 py-2">
                    <span className="text-xs text-muted-foreground">{lift.emoji} {lift.label.split("d")[0]}</span>
                    <span className="text-sm font-display font-bold text-primary">{form[lift.key]} kg</span>
                  </div>
                ))}
              </div>
              {form.bodyweight && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Körpergewicht</span>
                  <span className="font-semibold">{form.bodyweight} kg</span>
                </div>
              )}
            </div>

            {/* First-session preview — goal-aware */}
            {(() => {
              const goal = (form.goal || "powerlifting") as Goal;
              const sqTM = Math.round(parseFloat(form.squatMax || "0") * 0.9);
              const beTM = Math.round(parseFloat(form.benchMax || "0") * 0.9);
              const dlTM = Math.round(parseFloat(form.deadliftMax || "0") * 0.9);
              if (!sqTM && !beTM && !dlTM) return null;

              if (goal === "powerlifting") {
                return (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-left space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-primary" />
                      <p className="text-xs font-display font-bold uppercase tracking-wider text-primary">Dein erstes Workout — Wave 1 · Woche 1</p>
                    </div>
                    <div className="space-y-2">
                      {[
                        { emoji: "🏋️", label: "Kniebeuge", tm: sqTM },
                        { emoji: "💪", label: "Bankdrücken", tm: beTM },
                        { emoji: "🔥", label: "Kreuzheben", tm: dlTM },
                      ].map(({ emoji, label, tm }) => (
                        <div key={label} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{emoji} {label}</span>
                          <div className="flex gap-2">
                            {[0.55, 0.65, 0.75].map((pct, i) => (
                              <span key={i} className={cn("bg-secondary/60 rounded px-2 py-0.5 font-display font-semibold text-xs", i === 2 ? "text-primary" : "")}>
                                {Math.round(tm * pct)} kg
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Letzter Satz: AMRAP — so viele Wdh. wie möglich</p>
                  </div>
                );
              }
              if (goal === "bodybuilding") {
                return (
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-left space-y-2">
                    <div className="flex items-center gap-2">
                      <Target size={14} className="text-blue-400" />
                      <p className="text-xs font-display font-bold uppercase tracking-wider text-blue-400">Deine Splits — Wave 1 · Woche 1</p>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {["🫁 Brust","🔙 Rücken","🦵 Beine","⬆️ Schultern","💪 Arme","🍑 Beine (P.)"].map((s, i) => (
                        <div key={i} className="bg-secondary/40 rounded-lg px-2 py-1.5 text-center">
                          <p className="text-xs text-muted-foreground">{s}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">PPL-Split · 10er-Wellen-Progression</p>
                  </div>
                );
              }
              return (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-left space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingDown size={14} className="text-red-400" />
                    <p className="text-xs font-display font-bold uppercase tracking-wider text-red-400">Dein Zirkel — Wave 1 · Woche 1</p>
                  </div>
                  <div className="flex gap-2">
                    {["🔄 Zirkel A","🔄 Zirkel B","🔄 Zirkel C"].map((s, i) => (
                      <div key={i} className="flex-1 bg-secondary/40 rounded-lg px-2 py-2 text-center">
                        <p className="text-xs text-muted-foreground">{s}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Rotierend · Ganzkörper-Metabolik · 3× pro Woche</p>
                </div>
              );
            })()}

            <div className="space-y-3">
              <Button
                onClick={handleDashboard}
                className="w-full h-13 gradient-orange text-white border-0 font-display font-bold text-base hover:opacity-90 shadow-[0_4px_20px_rgba(255,107,26,0.35)]"
                data-testid="button-goto-dashboard"
              >
                Zum Dashboard <ChevronRight className="ml-2" size={20} />
              </Button>
              <p className="text-xs text-muted-foreground">KRAFT · INTELLIGENZ · PROGRESS</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
