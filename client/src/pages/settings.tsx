import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/authStore";
import { useToast } from "@/hooks/use-toast";
import MobileHeader from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ChevronRight, RefreshCw, User, Dumbbell, Calendar, Target, Utensils, RotateCcw, FlaskConical, Info, AlertTriangle, Zap, CreditCard, Lock, Eye, EyeOff, Trophy, Brain, BarChart2, UtensilsCrossed } from "lucide-react";
import GoalSwitchWizard from "@/components/GoalSwitchWizard";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/UpgradeModal";
import { ReferralCard } from "@/components/ReferralCard";
import { ProGate, ProBadge } from "@/components/ProGate";
import type { SubscriptionStatus } from "@/hooks/useSubscription";
import type { User as UserType } from "@shared/schema";
import {
  computeMacros, resolveTargets, getGoalConfig, parseNutritionPrefs, macroPercentages,
  parseCalorieCyclingPrefs,
  type NutritionPrefs, type TrainingGoal as NutriGoal,
} from "@/lib/nutrition";
import { CalorieCyclingSection } from "@/components/CalorieCyclingSection";
import {
  getStack, EVIDENCE_LABELS,
  type Supplement, type GoalSupplementStack,
} from "@/lib/supplements";

const WAVE_NAMES = ["10s Wave", "8s Wave", "5s Wave", "3s Wave"];
const WEEK_NAMES = ["Akkumulation", "Intensivierung", "Realisierung", "Deload"];

const lifts = [
  { key: "squatMax", label: "Kniebeuge", emoji: "🏋️" },
  { key: "benchMax", label: "Bankdrücken", emoji: "💪" },
  { key: "deadliftMax", label: "Kreuzheben", emoji: "🔥" },
  { key: "ohpMax", label: "Schulterdrücken", emoji: "⬆️" },
];

type TrainingGoal = "powerlifting" | "bodybuilding" | "weightloss";

const TRAINING_GOALS: { key: TrainingGoal; label: string; emoji: string; desc: string; waves: string; accent: string }[] = [
  {
    key: "powerlifting",
    label: "Powerlifting / Kraft",
    emoji: "🏋️",
    desc: "Maximalkraft auf Kniebeuge, Bankdrücken & Kreuzheben. GritIQ 2.0 mit 3er-Wellen und AMRAP-Progression.",
    waves: "10s → 8s → 5s → 3s",
    accent: "border-primary/60 bg-primary/10",
  },
  {
    key: "bodybuilding",
    label: "Bodybuilding / Muskelaufbau",
    emoji: "💪",
    desc: "Hypertrophie-fokussiert: höheres Volumen, mehr Wiederholungen, kurze Pausen für maximalen Pump.",
    waves: "15s → 12s → 10s → 8s",
    accent: "border-blue-500/60 bg-blue-500/10",
  },
  {
    key: "weightloss",
    label: "Abnehmen / Fettabbau",
    emoji: "🔥",
    desc: "Metabolisches Training: kürzere Pausen, höheres Tempo, mehr Kalorienverbrauch — trotzdem mit Langhantel.",
    waves: "15s → 12s → 10s → 8s",
    accent: "border-orange-500/60 bg-orange-500/10",
  },
];

const GOAL_LABELS: Record<TrainingGoal, string> = {
  powerlifting: "Powerlifting / Kraft",
  bodybuilding: "Bodybuilding / Muskelaufbau",
  weightloss: "Abnehmen / Fettabbau",
};

type Section = "overview" | "profile" | "maxes" | "phase" | "goal" | "nutrition";

// ── Subscription Card ─────────────────────────────────────────────────────

// ── helper: format a date as "dd. Monat YYYY" ────────────────────────────────
function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
}

// ── helper: days remaining until ISO date ─────────────────────────────────────
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function SubscriptionCard({ sub, onUpgrade }: { sub: SubscriptionStatus | undefined; onUpgrade: () => void }) {
  const { toast } = useToast();

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/portal");
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (err: Error) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  if (!sub) return null;

  // ── PRO / TRIALING ────────────────────────────────────────────────────────
  if (sub.isPro || sub.status === "trialing") {
    const isTrialing    = sub.status === "trialing";
    const isCanceled    = sub.status === "canceled"; // access until expiresAt
    const isReferral    = sub.status === "referral_bonus";
    const isPastDue     = sub.status === "past_due";
    const planLabel  = sub.plan === "annual" ? "Jährlich" : "Monatlich";
    const trialDays  = isTrialing ? daysUntil(sub.renewalDate) : null;

    return (
      <div className={cn(
        "rounded-xl border p-4 space-y-3",
        isPastDue
          ? "border-red-500/30 bg-red-500/5"
          : isTrialing
            ? "border-blue-500/30 bg-blue-500/5"
            : "border-orange-500/30 bg-orange-500/5"
      )}>
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Zap className={cn("h-4 w-4", isPastDue ? "text-red-400" : isTrialing ? "text-blue-400" : "text-orange-400")} />
            <span className="font-display font-bold text-sm">GritIQ Pro</span>

            {isTrialing && (
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] px-1.5">
                Probephase
              </Badge>
            )}
            {!isTrialing && !isPastDue && sub.isPro && !isReferral && (
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] px-1.5">
                Aktiv
              </Badge>
            )}
            {isReferral && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5">
                Empfehlungsbonus
              </Badge>
            )}
            {isPastDue && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5">
                Zahlung ausstehend
              </Badge>
            )}
            {sub.plan && !isReferral && (
              <Badge className="bg-secondary text-muted-foreground border-border text-[10px] px-1.5">
                {planLabel}
              </Badge>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className={cn(
              "text-xs h-7",
              isPastDue
                ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                : "border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
            )}
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            data-testid="button-manage-subscription"
          >
            <CreditCard className="h-3 w-3 mr-1" />
            {portalMutation.isPending ? "Laden..." : "Verwalten"}
          </Button>
        </div>

        {/* Feature summary */}
        <p className="text-xs text-muted-foreground">
          Unbegrenzte ATLAS-Sessions · Alle 3 Trainingsziele · PR Wall & Analytics
        </p>

        {/* Trialing countdown */}
        {isTrialing && trialDays !== null && (
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2">
            <p className="text-xs text-blue-300 font-medium">
              {trialDays === 0
                ? "Testphase endet heute"
                : `${trialDays} Tag${trialDays === 1 ? "" : "e"} Testphase verbleibend`
              }
            </p>
            {sub.renewalDate && (
              <p className="text-[11px] text-blue-400/70 mt-0.5">
                Erste Abbuchung am {fmtDate(sub.renewalDate)}
              </p>
            )}
          </div>
        )}

        {/* Active renewal info */}
        {!isTrialing && sub.renewalDate && !isCanceled && !isReferral && (
          <p className="text-xs text-muted-foreground">
            Nächste Verlängerung: <span className="text-foreground">{fmtDate(sub.renewalDate)}</span>
          </p>
        )}

        {/* Referral bonus — access until */}
        {isReferral && sub.expiresAt && (
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
            <p className="text-xs text-green-300 font-medium">
              🎁 30 Tage Pro durch Empfehlung
            </p>
            <p className="text-[11px] text-green-400/70 mt-0.5">
              Zugang bis <span className="text-green-300 font-medium">{fmtDate(sub.expiresAt)}</span>
            </p>
            <button
              className="text-[11px] text-orange-400 underline underline-offset-2 mt-1 hover:text-orange-300"
              onClick={() => portalMutation.mutate()}
            >
              Auf Pro upgraden
            </button>
          </div>
        )}

        {/* Canceled — access until */}
        {isCanceled && sub.expiresAt && (
          <div className="rounded-lg bg-secondary/50 border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Abo gekündigt · Zugang bis <span className="text-foreground font-medium">{fmtDate(sub.expiresAt)}</span>
            </p>
            <button
              className="text-[11px] text-orange-400 underline underline-offset-2 mt-1 hover:text-orange-300"
              onClick={() => portalMutation.mutate()}
            >
              Abo reaktivieren
            </button>
          </div>
        )}

        {/* Past due warning */}
        {isPastDue && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
            <p className="text-xs text-red-300 font-medium">Zahlung fehlgeschlagen</p>
            <p className="text-[11px] text-red-400/70 mt-0.5">
              Bitte aktualisiere deine Zahlungsdaten, um den Zugang zu behalten.
            </p>
            <button
              className="text-[11px] text-red-400 underline underline-offset-2 mt-1 hover:text-red-300"
              onClick={() => portalMutation.mutate()}
            >
              Zahlungsmethode aktualisieren
            </button>
          </div>
        )}

        {/* Manage footer */}
        <p className="text-[11px] text-muted-foreground/60">
          Abonnement verwalten, kündigen oder Zahlungsmethode ändern über den{" "}
          <button
            className="underline underline-offset-2 hover:text-muted-foreground"
            onClick={() => portalMutation.mutate()}
          >
            Stripe-Kundenbereich
          </button>
        </p>
      </div>
    );
  }

  // ── FREE ──────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="font-display font-bold text-sm">Free Plan</span>
        </div>
        <Button
          size="sm"
          className="text-xs h-7 bg-orange-500 hover:bg-orange-600 text-white"
          onClick={onUpgrade}
          data-testid="button-upgrade-settings"
        >
          <Zap className="h-3 w-3 mr-1" />
          14 Tage gratis testen
        </Button>
      </div>

      {/* ATLAS usage bar */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <p className="text-xs text-muted-foreground">ATLAS KI-Coach</p>
          <p className="text-xs font-medium">{sub.atlasUsed} / {sub.atlasLimit} Nachrichten</p>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className="bg-orange-500 h-1.5 rounded-full transition-all"
            style={{ width: `${Math.min(100, ((sub.atlasUsed ?? 0) / (sub.atlasLimit ?? 5)) * 100)}%` }}
          />
        </div>
      </div>

      {/* Locked feature hints */}
      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
        {[
          { icon: <Brain className="h-3 w-3" />, label: "Unbegrenzt ATLAS" },
          { icon: <Dumbbell className="h-3 w-3" />, label: "Alle 3 Ziele" },
          { icon: <BarChart2 className="h-3 w-3" />, label: "PR Wall & Analytics" },
          { icon: <UtensilsCrossed className="h-3 w-3" />, label: "Ernährungsplan" },
        ].map((f, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="text-orange-400/60">{f.icon}</span>
            {f.label}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground/60">
        9,99 € / Monat · oder 79,99 € / Jahr (33 % sparen) · 14 Tage kostenlos
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [, navigate] = useHashLocation();
  const [, params] = useRoute("/settings/:sub");

  // Derive section from URL: /#/settings → overview, /#/settings/nutrition → nutrition, etc.
  const urlSection = (params?.sub ?? "overview") as Section;
  const validSections: Section[] = ["overview", "profile", "maxes", "phase", "goal", "nutrition"];
  const section: Section = validSections.includes(urlSection) ? urlSection : "overview";

  // Navigate helper — pushes hash URL so browser back / iOS swipe-back works
  const setSection = (s: Section) => {
    if (s === "overview") navigate("/settings");
    else navigate(`/settings/${s}`);
  };
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const { data: sub, refetch: refetchSub } = useSubscription();

  // ── Handle post-Stripe-checkout redirect params (‘?upgrade=success‘ / ‘?upgrade=cancelled‘) ──
  useEffect(() => {
    const hashQuery = window.location.hash.includes("?")
      ? new URLSearchParams(window.location.hash.split("?")[1])
      : null;
    const upgradeParam = hashQuery?.get("upgrade");
    if (upgradeParam === "success") {
      // Stripe checkout completed — refetch subscription status
      refetchSub();
      toast({
        title: "GritIQ Pro aktiviert ✓",
        description: "Willkommen in der Pro-Zone! Dein 14-tägiger Testzeitraum hat begonnen.",
      });
      // Remove query param from URL without reload
      window.history.replaceState(null, "", window.location.pathname + window.location.search + "#/settings");
    } else if (upgradeParam === "cancelled") {
      toast({
        title: "Upgrade abgebrochen",
        description: "Kein Problem — du kannst jederzeit upgraden.",
        variant: "default",
      });
      window.history.replaceState(null, "", window.location.pathname + window.location.search + "#/settings");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [maxInputs, setMaxInputs] = useState<Record<string, string>>({});
  const [selectedWave, setSelectedWave] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState(1);
  // Nutrition section state
  const [genderInput, setGenderInput] = useState<"male" | "female" | "other">("other");
  const [ageInput, setAgeInput] = useState("");
  const [cyclePhaseInput, setCyclePhaseInput] = useState<"follicular" | "luteal" | "">("" );
  const [bodyweightInput, setBodyweightInput] = useState("");
  const [customCalories, setCustomCalories] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [customFat, setCustomFat] = useState("");
  const [showTiming, setShowTiming] = useState(false);
  const [timingDay, setTimingDay] = useState<"training" | "rest">("training");
  const [showSupplements, setShowSupplements] = useState(false);
  const [expandedSupp, setExpandedSupp] = useState<string | null>(null);

  const { data: user, isLoading } = useQuery<UserType>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const res = await fetch("/api/user");
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    // Keep stale data during re-fetch so the page doesn’t flash to null
    // while a settings save is in flight
    placeholderData: (prev) => prev,
  });

  // Re-sync local form state whenever section changes (e.g. navigating back in)
  useEffect(() => { setSynced(false); }, [section]);

  // Sync local state when user data loads
  const [synced, setSynced] = useState(false);
  if (user && !synced) {
    setNameInput(user.name);
    setMaxInputs({
      squatMax: user.squatMax.toString(),
      benchMax: user.benchMax.toString(),
      deadliftMax: user.deadliftMax.toString(),
      ohpMax: user.ohpMax.toString(),
    });
    setSelectedWave(user.currentWave);
    setSelectedWeek(user.currentWeek);
    // Nutrition prefs
    const prefs = parseNutritionPrefs(user.nutritionPrefs);
    if (user.gender) setGenderInput((user.gender as "male" | "female" | "other") ?? "other");
    if ((user as any).age) setAgeInput(String((user as any).age));
    if ((user as any).cyclePhase) setCyclePhaseInput((user as any).cyclePhase ?? "");
    if (user.bodyweight) setBodyweightInput(user.bodyweight.toString());
    if (prefs.customCalories) setCustomCalories(prefs.customCalories.toString());
    if (prefs.customProteinG) setCustomProtein(prefs.customProteinG.toString());
    if (prefs.customCarbsG) setCustomCarbs(prefs.customCarbsG.toString());
    if (prefs.customFatG) setCustomFat(prefs.customFatG.toString());
    setSynced(true);
  }

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<UserType>) => {
      const res = await apiRequest("PATCH", `/api/user/${user!.id}`, data);
      return res.json();
    },
    onSuccess: (updatedUser) => {
      // Write result directly into cache — no re-fetch means no user=null
      // flash while navigating back to overview
      queryClient.setQueryData(["/api/user"], updatedUser);
      // Invalidate goal-lifts so Training/Dashboard refetch after a goal switch
      queryClient.invalidateQueries({ queryKey: ["/api/goal-lifts"] });
      // Reset synced so local form state re-syncs from the new user data
      setSynced(false);
      toast({ title: "Gespeichert ✓", description: "Deine Einstellungen wurden aktualisiert." });
      setSection("overview");
    },
    onError: () => toast({ title: "Fehler", description: "Speichern fehlgeschlagen.", variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/user", { confirm: "DELETE_MY_DATA" });
      return res.json();
    },
    onSuccess: () => {
      // resetQueries clears error state + cached data, then triggers a fresh fetch
      // (invalidateQueries alone keeps stale error state → blank page after 404)
      queryClient.resetQueries({ queryKey: ["/api/user"] });
    },
    onError: () => toast({ title: "Fehler", description: "Reset fehlgeschlagen.", variant: "destructive" }),
  });

  if (isLoading) return <div className="p-4 space-y-4"><Skeleton className="h-64" /></div>;
  if (!user) return null;

  const handleSaveName = () => {
    if (!nameInput.trim()) return;
    const age = parseInt(ageInput);
    updateMutation.mutate({
      name: nameInput.trim(),
      gender: genderInput,
      // Always send age — null when empty/invalid to clear the field
      age: (!isNaN(age) && age > 0 && age < 120) ? age : null,
      // Only save cyclePhase for female users; clear for others
      cyclePhase: genderInput === "female" && cyclePhaseInput ? cyclePhaseInput : null,
    } as any);
  };

  const handleSaveMaxes = () => {
    const data: Partial<UserType> = {};
    for (const l of lifts) {
      const val = parseFloat(maxInputs[l.key]);
      if (!isNaN(val) && val > 0) (data as any)[l.key] = val;
    }
    updateMutation.mutate(data);
  };

  const handleSavePhase = () => {
    updateMutation.mutate({ currentWave: selectedWave, currentWeek: selectedWeek });
  };

  const handleSaveNutrition = () => {
    const bw = parseFloat(bodyweightInput);
    const prefs: NutritionPrefs = {};
    if (customCalories) prefs.customCalories = parseInt(customCalories);
    if (customProtein) prefs.customProteinG = parseInt(customProtein);
    if (customCarbs) prefs.customCarbsG = parseInt(customCarbs);
    if (customFat) prefs.customFatG = parseInt(customFat);
    updateMutation.mutate({
      bodyweight: !isNaN(bw) && bw > 0 ? bw : null,
      nutritionPrefs: JSON.stringify(prefs),
    });
  };

  const handleResetNutrition = () => {
    setCustomCalories("");
    setCustomProtein("");
    setCustomCarbs("");
    setCustomFat("");
    updateMutation.mutate({ nutritionPrefs: JSON.stringify({}) });
    toast({ title: "Zurückgesetzt", description: "Makros werden wieder automatisch berechnet." });
  };

  // ── Overview ──────────────────────────────────────────────────────────────
  if (section === "overview") {
    return (
      <div>
        <UpgradeModal open={showUpgradeModal} onClose={() => { setShowUpgradeModal(false); refetchSub(); }} />
        <MobileHeader user={user} title="Einstellungen" />
        <div className="p-4 md:p-6 max-w-lg space-y-4">
          <div className="hidden md:block">
            <h1 className="font-display text-xl font-bold">Einstellungen</h1>
            <p className="text-muted-foreground text-sm mt-1">Personalisiere dein Training</p>
          </div>

          {/* Profile card */}
          <div className="stat-card flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-full gradient-orange flex items-center justify-center text-white font-bold text-lg font-display flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-display font-bold text-base">{user.name}</p>
              <p className="text-xs text-muted-foreground">
                {WAVE_NAMES[user.currentWave - 1]} · {WEEK_NAMES[user.currentWeek - 1]}
              </p>
            </div>
          </div>

          {/* Menu items */}
          <div className="space-y-2">
            <SettingRow
              icon={<User size={18} />}
              label="Profil bearbeiten"
              description={user.name}
              onClick={() => { setNameInput(user.name); setSection("profile"); }}
            />
            <SettingRow
              icon={<Dumbbell size={18} />}
              label="1RM Maximalwerte"
              description={`SQ ${user.squatMax} · BK ${user.benchMax} · KH ${user.deadliftMax} · OHP ${user.ohpMax} kg`}
              onClick={() => {
                setMaxInputs({
                  squatMax: user.squatMax.toString(),
                  benchMax: user.benchMax.toString(),
                  deadliftMax: user.deadliftMax.toString(),
                  ohpMax: user.ohpMax.toString(),
                });
                setSection("maxes");
              }}
            />
            <SettingRow
              icon={<Target size={18} />}
              label="Trainingsziel"
              description={GOAL_LABELS[(user.trainingGoal as TrainingGoal) ?? "powerlifting"]}
              onClick={() => setSection("goal")}
            />
            <SettingRow
              icon={<Utensils size={18} />}
              label="Ernährungsplan & Supplemente"
              description={user.bodyweight ? `${user.bodyweight} kg Körpergewicht · Makros & Supplement-Stack` : "Kalorienplan, Makros & Supplement-Empfehlungen"}
              onClick={() => setSection("nutrition")}
              badge={!sub?.isPro ? <ProBadge /> : undefined}
            />
            <SettingRow
              icon={<Calendar size={18} />}
              label="Programmphase anpassen"
              description={`${WAVE_NAMES[user.currentWave - 1]} · ${WEEK_NAMES[user.currentWeek - 1]}`}
              onClick={() => { setSelectedWave(user.currentWave); setSelectedWeek(user.currentWeek); setSection("phase"); }}
            />
            <SettingRow
              icon={<RefreshCw size={18} />}
              label="Programm neu starten"
              description="Setzt Wave und Woche auf Anfang zurück"
              destructive
              onClick={() => {
                updateMutation.mutate({ currentWave: 1, currentWeek: 1 });
              }}
            />
          </div>

          {/* Subscription card */}
          <SubscriptionCard sub={sub} onUpgrade={() => setShowUpgradeModal(true)} />

          {/* Referral card */}
          <ReferralCard />

          {/* Leaderboard Privacy */}
          <LeaderboardPrivacyCard currentVisibility={(user as any).leaderboardVisibility ?? "hidden"} />

          {/* Logout */}
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
            <Button
              variant="outline"
              className="w-full h-10 text-sm"
              onClick={async () => {
                await logout();
                queryClient.clear();
              }}
            >
              <Lock size={14} className="mr-2" />
              Abmelden
            </Button>
          </div>

          {/* Reset / Onboarding-Test */}
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <RotateCcw size={15} className="text-red-400 flex-shrink-0" />
              <p className="font-display font-bold text-sm text-red-400">Profil zurücksetzen</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Löscht Profil, alle Sessions und Sets vollständig. Das Onboarding startet neu.
            </p>

            {!showResetConfirm ? (
              <Button
                variant="outline"
                className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 text-sm h-10"
                onClick={() => setShowResetConfirm(true)}
              >
                <RotateCcw size={14} className="mr-2" />
                Profil löschen & Onboarding neu starten
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-red-400 text-center">Wirklich löschen? Alle Daten gehen verloren.</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-10 text-sm"
                    onClick={() => setShowResetConfirm(false)}
                    disabled={resetMutation.isPending}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    className="flex-1 h-10 bg-red-500 hover:bg-red-600 text-white border-0 text-sm"
                    onClick={() => resetMutation.mutate()}
                    disabled={resetMutation.isPending}
                  >
                    {resetMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Lösche…
                      </span>
                    ) : "Ja, löschen"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Current maxes overview */}
          <div className="stat-card mt-4">
            <p className="font-display font-bold text-sm mb-3">Trainingsmaxima (90% × 1RM)</p>
            <div className="grid grid-cols-2 gap-3">
              {lifts.map((l) => (
                <div key={l.key} className="flex items-center gap-2">
                  <span className="text-lg">{l.emoji}</span>
                  <div>
                    <p className="text-sm font-bold font-display">{(user as any)[l.key]} kg</p>
                    <p className="text-xs text-muted-foreground">{l.label}</p>
                    <p className="text-xs text-primary">TM: {Math.round((user as any)[l.key] * 0.9)} kg</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Profile ───────────────────────────────────────────────────────────────
  if (section === "profile") {
    const genderOptions: { value: "male" | "female" | "other"; label: string; icon: string }[] = [
      { value: "male", label: "Männlich", icon: "♂️" },
      { value: "female", label: "Weiblich", icon: "♀️" },
      { value: "other", label: "Divers / k.A.", icon: "⚧️" },
    ];
    return (
      <div>
        <MobileHeader title="Profil bearbeiten" onBack={() => setSection('overview')} backLabel="Zurück" />
        <div className="p-4 md:p-6 max-w-lg space-y-5">
          <button onClick={() => setSection("overview")} className="hidden md:flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm">
            ← Zurück
          </button>
          <h2 className="font-display text-lg font-bold hidden md:block">Profil bearbeiten</h2>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name-input">Name</Label>
            <Input
              id="name-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              className="h-11 bg-card border-border"
              data-testid="input-settings-name"
            />
          </div>

          {/* Geschlecht */}
          <div className="space-y-2">
            <Label>Geschlecht</Label>
            <p className="text-xs text-muted-foreground">Wird für die präzise Kalorienberechnung (Mifflin-St-Jeor) verwendet.</p>
            <div className="grid grid-cols-3 gap-2">
              {genderOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setGenderInput(opt.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-sm font-medium transition-colors ${
                    genderInput === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  }`}
                  data-testid={`button-gender-${opt.value}`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Alter */}
          <div className="space-y-2">
            <Label htmlFor="age-input">Alter</Label>
            <p className="text-xs text-muted-foreground">Beeinflusst BMR-Berechnung und Trainingsempfehlungen.</p>
            <div className="relative max-w-[140px]">
              <Input
                id="age-input"
                type="number"
                placeholder="z.B. 28"
                value={ageInput}
                onChange={(e) => setAgeInput(e.target.value)}
                className="h-11 bg-card border-border pr-12"
                min={14}
                max={99}
                data-testid="input-settings-age"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Jahre</span>
            </div>
          </div>

          {/* Zyklusphase — nur für weibliche Nutzerinnen */}
          {genderInput === "female" && (
            <div className="space-y-2">
              <Label>Zyklusphase</Label>
              <p className="text-xs text-muted-foreground">
                Ermöglicht phasenspezifische Volumenanpassungen im Trainingsplan.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCyclePhaseInput(cyclePhaseInput === "follicular" ? "" : "follicular")}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-sm font-medium transition-colors ${
                    cyclePhaseInput === "follicular"
                      ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400"
                      : "border-border bg-card text-muted-foreground hover:border-yellow-500/30"
                  }`}
                  data-testid="button-cyclephase-follicular"
                >
                  <span className="text-lg">☀️</span>
                  <span className="text-xs">Follikelphase</span>
                  <span className="text-xs opacity-70">Tag 1–14</span>
                </button>
                <button
                  onClick={() => setCyclePhaseInput(cyclePhaseInput === "luteal" ? "" : "luteal")}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-sm font-medium transition-colors ${
                    cyclePhaseInput === "luteal"
                      ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-400"
                      : "border-border bg-card text-muted-foreground hover:border-indigo-500/30"
                  }`}
                  data-testid="button-cyclephase-luteal"
                >
                  <span className="text-lg">🌙</span>
                  <span className="text-xs">Lutealphase</span>
                  <span className="text-xs opacity-70">Tag 15–28</span>
                </button>
              </div>
              {cyclePhaseInput && (
                <p className="text-xs text-muted-foreground bg-card border border-border rounded-lg p-2">
                  {cyclePhaseInput === "follicular"
                    ? "☀️ Normales Volumen · Östrogen steigt · Optimale Zeit für PRs"
                    : "🌙 Volumen −10% · Progesteron dominant · Technikfokus"}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setSection("overview")} className="flex-1">Abbrechen</Button>
            <Button
              onClick={handleSaveName}
              disabled={updateMutation.isPending || !nameInput.trim()}
              className="flex-1 gradient-orange text-white border-0 hover:opacity-90"
              data-testid="button-save-name"
            >
              {updateMutation.isPending ? "Speichert…" : "Speichern"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Maxes ─────────────────────────────────────────────────────────────────
  if (section === "maxes") {
    return (
      <div>
        <MobileHeader title="1RM Maximalwerte" onBack={() => setSection('overview')} backLabel="Zurück" />
        <div className="p-4 md:p-6 max-w-lg space-y-4">
          <button onClick={() => setSection("overview")} className="hidden md:flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm">
            ← Zurück
          </button>
          <p className="text-sm text-muted-foreground">
            Aktualisiere deine 1-Wiederholungs-Maxima. Das Trainingsmaximum (TM = 90%) wird automatisch neu berechnet.
          </p>
          {lifts.map((l) => (
            <div key={l.key} className="stat-card">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{l.emoji}</span>
                <Label className="font-display font-semibold">{l.label}</Label>
                <span className="ml-auto text-xs text-primary">
                  TM: {maxInputs[l.key] ? Math.round(parseFloat(maxInputs[l.key]) * 0.9) : "—"} kg
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="kg"
                  value={maxInputs[l.key] ?? ""}
                  onChange={(e) => setMaxInputs((prev) => ({ ...prev, [l.key]: e.target.value }))}
                  className="h-11 bg-background border-border pr-10"
                  data-testid={`input-max-${l.key}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kg</span>
              </div>
            </div>
          ))}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setSection("overview")} className="flex-1">Abbrechen</Button>
            <Button
              onClick={handleSaveMaxes}
              disabled={updateMutation.isPending}
              className="flex-1 gradient-orange text-white border-0 hover:opacity-90"
              data-testid="button-save-maxes"
            >
              {updateMutation.isPending ? "Speichert…" : "Speichern"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Goal (wizard) ──────────────────────────────────────────────────────────
  if (section === "goal") {
    const currentGoal = (user.trainingGoal ?? "powerlifting") as TrainingGoal;

    return (
      <div>
        <MobileHeader title="Trainingsziel wechseln" onBack={() => setSection("overview")} backLabel="Zurück" />
        <div className="p-4 md:p-6 max-w-lg">
          <button onClick={() => setSection("overview")} className="hidden md:flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-4">← Zurück</button>
          <GoalSwitchWizard
            user={user}
            currentGoal={currentGoal}
            onCancel={() => setSection("overview")}
            onConfirm={(payload) => updateMutation.mutate(payload)}
            isPending={updateMutation.isPending}
          />
        </div>
      </div>
    );
  }

  // ── Nutrition ──────────────────────────────────────────────────────────────
  if (section === "nutrition") {
    const goal = (user.trainingGoal ?? "powerlifting") as NutriGoal;
    const goalCfg = getGoalConfig(goal);
    const bw = parseFloat(bodyweightInput) || user.bodyweight || 80;
    const userAge = (user as any).age as number | undefined;
    const userGender = (user.gender ?? "other") as "male" | "female" | "other";
    const macroOpts = { gender: userGender, age: userAge };
    const computed = computeMacros(bw, goal, macroOpts);
    const targets = resolveTargets(bw, goal, {
      customCalories: customCalories ? parseInt(customCalories) : undefined,
      customProteinG: customProtein ? parseInt(customProtein) : undefined,
      customCarbsG: customCarbs ? parseInt(customCarbs) : undefined,
      customFatG: customFat ? parseInt(customFat) : undefined,
    }, macroOpts);
    const pct = macroPercentages(targets);
    const hasCustom = !!(customCalories || customProtein || customCarbs || customFat);

    // Goal-specific accent colors
    const accentText = goalCfg.accentText;
    const accentBg = goalCfg.accentBg;
    const accentBorder = goalCfg.accentBorder;

    // Active timing entries based on day tab
    const timingEntries = timingDay === "training" ? goalCfg.mealTiming : (goalCfg as any).restDayTiming ?? goalCfg.mealTiming;

    return (
      <div>
        <MobileHeader title="Ernährung & Supplemente" onBack={() => setSection("overview")} backLabel="Zurück" />
        <div className="p-4 md:p-6 max-w-lg space-y-5">
          <button onClick={() => setSection("overview")} className="hidden md:flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm">← Zurück</button>

          <ProGate feature="nutrition">
          {/* Goal badge — goal-colored */}
          <div className={`flex items-center gap-3 stat-card border ${accentBorder}`}>
            <span className="text-2xl">{goalCfg.emoji}</span>
            <div>
              <p className={`font-display font-bold text-sm ${accentText}`}>{goalCfg.label}</p>
              <p className="text-xs text-muted-foreground">Zielspezifische Ernährungsempfehlungen</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed bg-card border border-border rounded-xl p-3">
            {goalCfg.rationale}
          </p>

          {/* Bodyweight input */}
          <div className="stat-card space-y-3">
            <p className="font-display font-bold text-sm">Körpergewicht</p>
            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                <Input
                  type="number"
                  placeholder="z.B. 80"
                  value={bodyweightInput}
                  onChange={(e) => setBodyweightInput(e.target.value)}
                  className="h-11 bg-background border-border pr-10"
                  data-testid="input-bodyweight"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kg</span>
              </div>
              <p className="text-xs text-muted-foreground flex-1">Basis für automatische Makroberechnung</p>
            </div>
          </div>

          {/* Macro targets */}
          <div className="stat-card space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-display font-bold text-sm">Tages-Makros</p>
              {hasCustom && (
                <button
                  onClick={handleResetNutrition}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  data-testid="button-reset-nutrition"
                >
                  <RotateCcw size={12} /><span className="ml-1">Auto-Reset</span>
                </button>
              )}
            </div>

            {/* Macro proportion bar — goal-colored protein segment */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Protein <span className={`${accentText} font-bold`}>{pct.protein}%</span></span>
                <span>Carbs <span className="text-blue-400 font-bold">{pct.carbs}%</span></span>
                <span>Fett <span className="text-yellow-400 font-bold">{pct.fat}%</span></span>
              </div>
              <div className="flex h-2.5 rounded-full overflow-hidden">
                <div className={`${
                  goal === "powerlifting" ? "bg-orange-500/80"
                  : goal === "bodybuilding" ? "bg-blue-500/80"
                  : "bg-red-500/80"
                } transition-all duration-300`} style={{ width: `${pct.protein}%` }} />
                <div className="bg-sky-400/70 transition-all duration-300" style={{ width: `${pct.carbs}%` }} />
                <div className="bg-yellow-500/80 transition-all duration-300" style={{ width: `${pct.fat}%` }} />
              </div>
            </div>

            {/* 4 editable macro fields */}
            <div className="grid grid-cols-2 gap-3">
              <MacroField label="Kalorien" unit="kcal" color={accentText}
                value={customCalories} placeholder={computed.calories.toString()}
                onChange={setCustomCalories} testId="input-nutrition-calories" />
              <MacroField label="Protein" unit="g" color={accentText}
                value={customProtein} placeholder={computed.proteinG.toString()}
                onChange={setCustomProtein} testId="input-nutrition-protein" />
              <MacroField label="Kohlenhydrate" unit="g" color="text-sky-400"
                value={customCarbs} placeholder={computed.carbsG.toString()}
                onChange={setCustomCarbs} testId="input-nutrition-carbs" />
              <MacroField label="Fett" unit="g" color="text-yellow-400"
                value={customFat} placeholder={computed.fatG.toString()}
                onChange={setCustomFat} testId="input-nutrition-fat" />
            </div>

            <p className="text-xs text-muted-foreground">
              Basis: {bw} kg{userAge ? `, ${userAge} J.` : ""}{userGender !== "other" ? `, ${userGender === "male" ? "♂" : "♀"}` : ""}
              {userAge ? " · Mifflin-St-Jeor TDEE" : " · kcal/kg-Schätzung (Alter fehlt)"}
              · leere Felder = automatisch berechnet
            </p>
          </div>

          {/* Save button */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setSection("overview")} className="flex-1">Abbrechen</Button>
            <Button
              onClick={handleSaveNutrition}
              disabled={updateMutation.isPending}
              className="flex-1 gradient-orange text-white border-0 hover:opacity-90"
              data-testid="button-save-nutrition"
            >
              {updateMutation.isPending ? "Speichert…" : "Speichern"}
            </Button>
          </div>

          {/* Calorie Cycling Calculator */}
          <CalorieCyclingSection
            baseTargets={targets}
            initialPrefs={parseCalorieCyclingPrefs((user as any).calorieCyclingPrefs)}
            accentText={accentText}
            accentBg={accentBg}
            accentBorder={accentBorder}
          />

          {/* Meal timing guide — with Trainingstag / Ruhetag tab toggle */}
          <div className="space-y-3">
            <button
              onClick={() => setShowTiming(t => !t)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border bg-card transition-colors ${
                showTiming ? `${accentBorder} hover:${accentBorder}` : "border-border hover:border-primary/40"
              }`}
              data-testid="button-toggle-timing"
            >
              <div className="flex items-center gap-2">
                <Utensils size={16} className={showTiming ? accentText : "text-primary"} />
                <span className="font-display font-bold text-sm">Mahlzeiten-Timing</span>
                <Badge className={`text-xs border ${
                  timingDay === "training"
                    ? `${accentBg} ${accentText} ${accentBorder}`
                    : "bg-muted/50 text-muted-foreground border-border"
                }`}>
                  {timingDay === "training" ? "Trainingstag" : "Ruhetag"}
                </Badge>
              </div>
              <ChevronRight size={16} className={`transition-transform duration-200 ${
                showTiming ? `${accentText}` : "text-muted-foreground"
              } ${showTiming ? "rotate-90" : ""}`} />
            </button>

            {showTiming && (
              <div className="space-y-3">
                {/* Tab switcher */}
                <div className="flex gap-2 p-1 bg-muted/30 rounded-xl border border-border">
                  <button
                    onClick={() => setTimingDay("training")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-display font-bold transition-all ${
                      timingDay === "training"
                        ? `${accentBg} ${accentText} border ${accentBorder}`
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid="button-timing-training"
                  >
                    Trainingstag
                  </button>
                  <button
                    onClick={() => setTimingDay("rest")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-display font-bold transition-all ${
                      timingDay === "rest"
                        ? "bg-muted/60 text-foreground border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid="button-timing-rest"
                  >
                    Ruhetag
                  </button>
                </div>

                {timingEntries.map((entry: any, i: number) => (
                  <div key={`${timingDay}-${i}`} className={`stat-card space-y-2 border ${
                    timingDay === "training" ? accentBorder : "border-border"
                  }`} data-testid={`timing-entry-${i}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">{entry.icon}</span>
                      <div className="flex-1">
                        <p className={`text-xs font-semibold font-display ${
                          timingDay === "training" ? accentText : "text-muted-foreground"
                        }`}>{entry.time}</p>
                        <p className="font-display font-bold text-sm">{entry.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">{entry.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Supplement Section ─────────────────────────────────────────── */}
          {(() => {
            const stack = getStack(goal);
            const core = stack.supplements.filter(s => s.priority === "core");
            const optional = stack.supplements.filter(s => s.priority === "optional");
            return (
              <div className="space-y-3">
                {/* Section toggle header */}
                <button
                  onClick={() => setShowSupplements(v => !v)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors"
                  data-testid="button-toggle-supplements"
                >
                  <div className="flex items-center gap-2">
                    <FlaskConical size={16} className="text-primary" />
                    <span className="font-display font-bold text-sm">Supplement-Stack</span>
                    <Badge className={`text-xs border ${
                      goal === "powerlifting" ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                      : goal === "bodybuilding" ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                      : "bg-red-500/15 text-red-400 border-red-500/30"
                    }`}>{stack.tagline.split(",")[0]}</Badge>
                  </div>
                  <ChevronRight size={16} className={`text-muted-foreground transition-transform duration-200 ${showSupplements ? "rotate-90" : ""}`} />
                </button>

                {showSupplements && (
                  <div className="space-y-4">
                    {/* Disclaimer */}
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                      <Info size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Evidenzbasierte Empfehlungen nach ISSN-Richtlinien. Kein Ersatz für ärztlichen Rat. Qualitätsprodukte (3rd-party tested) bevorzugen.
                      </p>
                    </div>

                    {/* Core supplements */}
                    <div className="space-y-2">
                      <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Core Stack — Essentiell</p>
                      {core.map((supp) => (
                        <SuppCard
                          key={supp.name}
                          supp={supp}
                          isOpen={expandedSupp === supp.name}
                          onToggle={() => setExpandedSupp(prev => prev === supp.name ? null : supp.name)}
                          goal={goal}
                        />
                      ))}
                    </div>

                    {/* Optional supplements */}
                    {optional.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Optional Stack — Erweiterung</p>
                        {optional.map((supp) => (
                          <SuppCard
                            key={supp.name}
                            supp={supp}
                            isOpen={expandedSupp === supp.name}
                            onToggle={() => setExpandedSupp(prev => prev === supp.name ? null : supp.name)}
                            goal={goal}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          </ProGate>
        </div>
      </div>
    );
  }

  // ── Phase ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <MobileHeader title="Programmphase" onBack={() => setSection('overview')} backLabel="Zurück" />
      <div className="p-4 md:p-6 max-w-lg space-y-5">
        <button onClick={() => setSection("overview")} className="hidden md:flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm">
          ← Zurück
        </button>
        <p className="text-sm text-muted-foreground">
          Passe deine aktuelle Position im 16-Wochen-Zyklus an.
        </p>

        <div className="space-y-3">
          <Label className="font-display font-semibold">Wave (Monat)</Label>
          <div className="grid grid-cols-2 gap-2">
            {WAVE_NAMES.map((name, i) => (
              <button
                key={i}
                onClick={() => setSelectedWave(i + 1)}
                className={`p-3 rounded-lg border text-sm font-semibold transition-all text-left ${
                  selectedWave === i + 1
                    ? "gradient-orange text-white border-transparent"
                    : "border-border text-muted-foreground hover:border-primary/50 bg-card"
                }`}
                data-testid={`button-wave-${i + 1}`}
              >
                <div className="font-display font-bold">{name}</div>
                <div className="text-xs opacity-75 mt-0.5">Wochen {i * 4 + 1}–{(i + 1) * 4}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="font-display font-semibold">Woche</Label>
          <div className="grid grid-cols-2 gap-2">
            {WEEK_NAMES.map((name, i) => (
              <button
                key={i}
                onClick={() => setSelectedWeek(i + 1)}
                className={`p-3 rounded-lg border text-sm font-semibold transition-all text-left ${
                  selectedWeek === i + 1
                    ? "gradient-orange text-white border-transparent"
                    : "border-border text-muted-foreground hover:border-primary/50 bg-card"
                }`}
                data-testid={`button-week-${i + 1}`}
              >
                <div className="font-display font-bold text-xs">{name}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="stat-card text-center">
          <p className="text-xs text-muted-foreground mb-1">Neue Phase</p>
          <p className="font-display font-bold text-base text-primary">
            {WAVE_NAMES[selectedWave - 1]} · {WEEK_NAMES[selectedWeek - 1]}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Woche {(selectedWave - 1) * 4 + selectedWeek} von 16
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setSection("overview")} className="flex-1">Abbrechen</Button>
          <Button
            onClick={handleSavePhase}
            disabled={updateMutation.isPending}
            className="flex-1 gradient-orange text-white border-0 hover:opacity-90"
            data-testid="button-save-phase"
          >
            {updateMutation.isPending ? "Speichert…" : "Speichern"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SuppCard({
  supp, isOpen, onToggle, goal,
}: {
  supp: Supplement;
  isOpen: boolean;
  onToggle: () => void;
  goal: string;
}) {
  const ev = EVIDENCE_LABELS[supp.evidence];
  const borderColor = goal === "powerlifting" ? "border-orange-500/30"
    : goal === "bodybuilding" ? "border-blue-500/30"
    : "border-red-500/30";
  const priorityColor = supp.priority === "core"
    ? "bg-primary/10 text-primary border-primary/20"
    : "bg-muted/50 text-muted-foreground border-border";

  return (
    <div
      className={`rounded-xl border bg-card overflow-hidden transition-all ${
        isOpen ? borderColor : "border-border"
      }`}
      data-testid={`supp-card-${supp.name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {/* Card header — always visible, clickable */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/20 transition-colors"
      >
        <span className="text-xl flex-shrink-0">{supp.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold text-sm">{supp.name}</span>
            <Badge className={`text-xs border px-1.5 py-0 ${ev.color}`}>{supp.evidence}</Badge>
            {supp.priority === "core" && (
              <Badge className={`text-xs border px-1.5 py-0 ${priorityColor}`}>Core</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{supp.dose} · {supp.timing.split("(")[0].trim()}</p>
        </div>
        <ChevronRight size={14} className={`text-muted-foreground flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
      </button>

      {/* Expanded details */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {/* Dose + Timing */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/30 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Dosierung</p>
              <p className="text-xs font-semibold font-display mt-0.5">{supp.dose}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Einnahme-Zeitpunkt</p>
              <p className="text-xs font-semibold font-display mt-0.5 leading-tight">{supp.timing}</p>
            </div>
          </div>

          {/* Mechanism */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-1">Wirkungsweise</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{supp.mechanism}</p>
          </div>

          {/* Evidence note */}
          <div className={`rounded-lg p-2.5 border ${ev.color}`}>
            <p className="text-xs font-semibold mb-0.5">Evidenz ({supp.evidence}) — {EVIDENCE_LABELS[supp.evidence].label}</p>
            <p className="text-xs opacity-80 leading-relaxed">{supp.evidenceNote}</p>
          </div>

          {/* Caution if present */}
          {supp.caution && (
            <div className="flex items-start gap-2 rounded-lg p-2.5 border border-yellow-500/30 bg-yellow-500/8">
              <AlertTriangle size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-400 leading-relaxed">{supp.caution}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MacroField({
  label, unit, color, value, placeholder, onChange, testId,
}: {
  label: string; unit: string; color: string;
  value: string; placeholder: string;
  onChange: (v: string) => void; testId: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className={`text-xs font-display font-semibold ${color}`}>{label}</Label>
        {!value && <span className="text-xs text-muted-foreground italic">Auto</span>}
      </div>
      <div className="relative">
        <Input
          type="number"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 bg-background border-border pr-12 text-base"
          data-testid={testId}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function SettingRow({
  icon, label, description, onClick, destructive = false, badge,
}: {
  icon: ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  destructive?: boolean;
  badge?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-border/70 transition-colors text-left ${
        destructive ? "hover:border-destructive/50" : ""
      }`}
    >
      <div className={`${destructive ? "text-destructive" : "text-primary"}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold font-display ${destructive ? "text-destructive" : ""}`}>{label}</p>
          {badge}
        </div>
        {description && <p className="text-xs text-muted-foreground truncate mt-0.5">{description}</p>}
      </div>
      <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
    </button>
  );
}

// ── Leaderboard Privacy Card ──────────────────────────────────────────────────
type Visibility = "public" | "anonymous" | "hidden";

const VISIBILITY_OPTIONS: { value: Visibility; label: string; desc: string; icon: ReactNode }[] = [
  {
    value: "public",
    label: "Öffentlich",
    desc: "Dein Name & Score sind für alle sichtbar",
    icon: <Eye size={15} className="text-primary" />,
  },
  {
    value: "anonymous",
    label: "Anonym",
    desc: "Score sichtbar, Name verborgen",
    icon: <EyeOff size={15} className="text-yellow-400" />,
  },
  {
    value: "hidden",
    label: "Versteckt",
    desc: "Nicht in der Rangliste angezeigt",
    icon: <Lock size={15} className="text-muted-foreground" />,
  },
];

function LeaderboardPrivacyCard({ currentVisibility }: { currentVisibility: Visibility }) {
  const [selected, setSelected] = useState<Visibility>(currentVisibility);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function handleChange(v: Visibility) {
    setSelected(v);
    setSaving(true);
    try {
      const res = await apiRequest("PATCH", "/api/leaderboard/visibility", { visibility: v });
      if (!res.ok) throw new Error();
      toast({ title: "Gespeichert ✓", description: `Leaderboard: ${VISIBILITY_OPTIONS.find(o => o.value === v)?.label}` });
    } catch {
      toast({ title: "Fehler", description: "Einstellung konnte nicht gespeichert werden.", variant: "destructive" });
      setSelected(currentVisibility); // revert
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy size={15} className="text-primary flex-shrink-0" />
        <p className="font-display font-bold text-sm text-foreground">Leaderboard</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Wähle, wie du in der Rangliste erscheinst. Dein eigener Rang ist immer für dich sichtbar.
      </p>
      <div className="grid grid-cols-1 gap-2">
        {VISIBILITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => !saving && handleChange(opt.value)}
            disabled={saving}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
              selected === opt.value
                ? "border-primary/50 bg-primary/5"
                : "border-border hover:border-border/70 hover:bg-muted/30"
            }`}
          >
            <div className="flex-shrink-0">{opt.icon}</div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${selected === opt.value ? "text-primary" : "text-foreground"}`}>
                {opt.label}
              </p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </div>
            {selected === opt.value && (
              <div className="w-4 h-4 rounded-full bg-primary flex-shrink-0 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
