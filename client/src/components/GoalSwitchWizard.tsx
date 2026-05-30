/**
 * GoalSwitchWizard
 *
 * Multi-step transition flow triggered when a user changes their training goal
 * mid-program in Einstellungen.
 *
 * Steps:
 *  1. Goal selection (visual goal cards)
 *  2. Macro diff preview (old → new computed values)
 *  3. Supplement stack swap preview
 *  4. Wave/week warning + reset option
 *  5. Confirm & save (atomic PATCH to /api/user/:id)
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronRight, ChevronLeft, AlertTriangle, RefreshCw, ArrowRight, FlaskConical, Utensils, Zap } from "lucide-react";
import { computeMacros, getGoalConfig } from "@/lib/nutrition";
import { getStack } from "@/lib/supplements";
import type { User as UserType } from "@shared/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

type TrainingGoal = "powerlifting" | "bodybuilding" | "weightloss";

const TRAINING_GOALS: {
  key: TrainingGoal;
  label: string;
  emoji: string;
  desc: string;
  waves: string;
  repSchemeFamily: "power" | "hypertrophy";
  accent: string;
  accentText: string;
  accentBorder: string;
  accentBg: string;
}[] = [
  {
    key: "powerlifting",
    label: "Powerlifting / Kraft",
    emoji: "🏋️",
    desc: "Maximalkraft auf Kniebeuge, Bankdrücken & Kreuzheben. GritIQ 2.0 mit 3er-Wellen und AMRAP-Progression.",
    waves: "10s → 8s → 5s → 3s",
    repSchemeFamily: "power",
    accent: "border-primary/60 bg-primary/10",
    accentText: "text-orange-400",
    accentBorder: "border-orange-500/50",
    accentBg: "bg-orange-500/10",
  },
  {
    key: "bodybuilding",
    label: "Bodybuilding / Muskelaufbau",
    emoji: "💪",
    desc: "Hypertrophie-fokussiert: höheres Volumen, mehr Wiederholungen, kurze Pausen für maximalen Pump.",
    waves: "15s → 12s → 10s → 8s",
    repSchemeFamily: "hypertrophy",
    accent: "border-blue-500/60 bg-blue-500/10",
    accentText: "text-blue-400",
    accentBorder: "border-blue-500/50",
    accentBg: "bg-blue-500/10",
  },
  {
    key: "weightloss",
    label: "Abnehmen / Fettabbau",
    emoji: "🔥",
    desc: "Metabolisches Training: kürzere Pausen, höheres Tempo, mehr Kalorienverbrauch — trotzdem mit Langhantel.",
    waves: "15s → 12s → 10s → 8s",
    repSchemeFamily: "hypertrophy",
    accent: "border-orange-500/60 bg-orange-500/10",
    accentText: "text-red-400",
    accentBorder: "border-red-500/50",
    accentBg: "bg-red-500/10",
  },
];

const WAVE_NAMES = ["10s Wave", "8s Wave", "5s Wave", "3s Wave"];
const WEEK_NAMES = ["Akkumulation", "Intensivierung", "Realisierung", "Deload"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFamily(goal: TrainingGoal) {
  return TRAINING_GOALS.find((g) => g.key === goal)?.repSchemeFamily ?? "power";
}

function needsReset(from: TrainingGoal, to: TrainingGoal) {
  return getFamily(from) !== getFamily(to);
}

function getDiffIcon(val: number) {
  if (val > 0) return <span className="text-green-400 text-xs font-bold">▲ +{val}</span>;
  if (val < 0) return <span className="text-red-400 text-xs font-bold">▼ {val}</span>;
  return <span className="text-muted-foreground text-xs">—</span>;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            i < current ? "bg-primary" : i === current ? "bg-primary/60" : "bg-border"
          }`}
        />
      ))}
    </div>
  );
}

function MacroDiffRow({
  label,
  oldVal,
  newVal,
  unit,
  highlight,
}: {
  label: string;
  oldVal: number;
  newVal: number;
  unit: string;
  highlight?: string;
}) {
  const diff = newVal - oldVal;
  return (
    <div className="flex items-center gap-2 py-2 border-b border-border/50 last:border-0">
      <span className={`text-xs font-display font-semibold w-24 flex-shrink-0 ${highlight ?? "text-muted-foreground"}`}>{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums w-16 text-right flex-shrink-0">{oldVal} {unit}</span>
      <ArrowRight size={12} className="text-muted-foreground flex-shrink-0" />
      <span className={`text-xs font-bold tabular-nums w-16 flex-shrink-0 ${highlight ?? "text-foreground"}`}>{newVal} {unit}</span>
      <div className="ml-auto">{getDiffIcon(diff)}</div>
    </div>
  );
}

function SuppMiniCard({ name, emoji, dose, isNew }: { name: string; emoji: string; dose: string; isNew?: boolean }) {
  return (
    <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${isNew ? "border-green-500/30 bg-green-500/5" : "border-border bg-card"}`}>
      <span className="text-base flex-shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-display font-semibold truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{dose}</p>
      </div>
      {isNew && <Badge className="text-xs border border-green-500/30 bg-green-500/10 text-green-400 px-1.5 py-0 flex-shrink-0">Neu</Badge>}
    </div>
  );
}

// ── Main wizard component ─────────────────────────────────────────────────────

interface GoalSwitchWizardProps {
  user: UserType;
  currentGoal: TrainingGoal;
  onCancel: () => void;
  onConfirm: (payload: Partial<UserType>) => void;
  isPending: boolean;
}

export default function GoalSwitchWizard({
  user,
  currentGoal,
  onCancel,
  onConfirm,
  isPending,
}: GoalSwitchWizardProps) {
  const [step, setStep] = useState(0); // 0=select, 1=macros, 2=supplements, 3=wave, 4=confirm
  const [selectedGoal, setSelectedGoal] = useState<TrainingGoal>(currentGoal);
  const [resetProgram, setResetProgram] = useState(false);

  const TOTAL_STEPS = 5;

  const bw = user.bodyweight ?? 80;
  const oldMacros = computeMacros(bw, currentGoal);
  const newMacros = computeMacros(bw, selectedGoal);
  const oldGoalInfo = TRAINING_GOALS.find((g) => g.key === currentGoal)!;
  const newGoalInfo = TRAINING_GOALS.find((g) => g.key === selectedGoal)!;
  const oldStack = getStack(currentGoal);
  const newStack = getStack(selectedGoal);
  const shouldWarnReset = needsReset(currentGoal, selectedGoal);
  const oldGoalCfg = getGoalConfig(currentGoal);
  const newGoalCfg = getGoalConfig(selectedGoal);

  // Names currently in old stack (for diff)
  const oldSuppNames = new Set(oldStack.supplements.map((s) => s.name));
  const newSuppNames = new Set(newStack.supplements.map((s) => s.name));
  const addedSupps = newStack.supplements.filter((s) => !oldSuppNames.has(s.name));
  const removedSupps = oldStack.supplements.filter((s) => !newSuppNames.has(s.name));
  const retainedSupps = newStack.supplements.filter((s) => oldSuppNames.has(s.name));

  function handleConfirm() {
    const payload: Partial<UserType> = {
      trainingGoal: selectedGoal,
      nutritionPrefs: JSON.stringify({}), // Clear custom nutrition on goal switch
    };
    if (resetProgram) {
      payload.currentWave = 1;
      payload.currentWeek = 1;
    }
    onConfirm(payload);
  }

  // ── Step 0: Goal Selection ─────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="space-y-4">
        <StepIndicator current={0} total={TOTAL_STEPS} />
        <div>
          <h3 className="font-display font-bold text-base mb-0.5">Neues Trainingsziel wählen</h3>
          <p className="text-xs text-muted-foreground">Aktuell: <span className="text-foreground font-semibold">{oldGoalInfo.label}</span></p>
        </div>

        <div className="space-y-2.5">
          {TRAINING_GOALS.map((g) => (
            <button
              key={g.key}
              onClick={() => setSelectedGoal(g.key)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                selectedGoal === g.key
                  ? g.accent + " border-opacity-100"
                  : "border-border bg-card hover:border-muted-foreground/40"
              }`}
              data-testid={`wizard-goal-${g.key}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{g.emoji}</span>
                  <span className="font-display font-bold text-sm">{g.label}</span>
                  {g.key === currentGoal && (
                    <Badge className="text-xs border border-border bg-muted/50 text-muted-foreground px-1.5 py-0">Aktuell</Badge>
                  )}
                </div>
                {selectedGoal === g.key && (
                  <div className="w-5 h-5 rounded-full gradient-orange flex items-center justify-center flex-shrink-0">
                    <Check size={11} className="text-white" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-1.5 leading-relaxed">{g.desc}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Wellen:</span>
                <span className={`text-xs font-semibold font-display ${g.accentText}`}>{g.waves}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="outline" onClick={onCancel} className="flex-1">Abbrechen</Button>
          <Button
            onClick={() => setStep(1)}
            disabled={selectedGoal === currentGoal}
            className="flex-1 gradient-orange text-white border-0 hover:opacity-90"
            data-testid="wizard-next-step1"
          >
            Weiter <ChevronRight size={15} className="ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 1: Macro Diff ─────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="space-y-4">
        <StepIndicator current={1} total={TOTAL_STEPS} />
        <div>
          <h3 className="font-display font-bold text-base mb-0.5">Ernährung ändert sich</h3>
          <p className="text-xs text-muted-foreground">Tages-Makros bei {bw} kg Körpergewicht</p>
        </div>

        {/* Old vs new goal header */}
        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-xl p-3 border ${oldGoalInfo.accentBorder} ${oldGoalInfo.accentBg}`}>
            <p className="text-xs text-muted-foreground mb-0.5">Vorher</p>
            <p className={`font-display font-bold text-sm ${oldGoalInfo.accentText}`}>{oldGoalInfo.emoji} {oldGoalInfo.label.split("/")[0].trim()}</p>
          </div>
          <div className={`rounded-xl p-3 border ${newGoalInfo.accentBorder} ${newGoalInfo.accentBg}`}>
            <p className="text-xs text-muted-foreground mb-0.5">Nachher</p>
            <p className={`font-display font-bold text-sm ${newGoalInfo.accentText}`}>{newGoalInfo.emoji} {newGoalInfo.label.split("/")[0].trim()}</p>
          </div>
        </div>

        {/* Macro diff table */}
        <div className="stat-card space-y-0 py-1">
          <div className="flex items-center gap-2 pb-2 mb-1 border-b border-border">
            <Utensils size={13} className="text-primary flex-shrink-0" />
            <span className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Makro-Vergleich</span>
          </div>
          <MacroDiffRow label="Kalorien" oldVal={oldMacros.calories} newVal={newMacros.calories} unit="kcal" highlight={newGoalInfo.accentText} />
          <MacroDiffRow label="Protein" oldVal={oldMacros.proteinG} newVal={newMacros.proteinG} unit="g" highlight={newGoalInfo.accentText} />
          <MacroDiffRow label="Kohlenhydrate" oldVal={oldMacros.carbsG} newVal={newMacros.carbsG} unit="g" />
          <MacroDiffRow label="Fett" oldVal={oldMacros.fatG} newVal={newMacros.fatG} unit="g" />
        </div>

        {/* Rationale */}
        <div className={`rounded-xl p-3 border ${newGoalInfo.accentBorder} text-xs text-muted-foreground leading-relaxed`}>
          <p className={`font-display font-semibold text-xs mb-1 ${newGoalInfo.accentText}`}>{newGoalInfo.emoji} Warum diese Makros?</p>
          {newGoalCfg.rationale}
        </div>

        <p className="text-xs text-muted-foreground">Deine bisherigen individuellen Anpassungen werden zurückgesetzt. Du kannst sie danach neu eingeben.</p>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
            <ChevronLeft size={14} className="mr-1" /> Zurück
          </Button>
          <Button onClick={() => setStep(2)} className="flex-1 gradient-orange text-white border-0 hover:opacity-90" data-testid="wizard-next-step2">
            Weiter <ChevronRight size={15} className="ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 2: Supplement Stack ───────────────────────────────────────────────
  if (step === 2) {
    return (
      <div className="space-y-4">
        <StepIndicator current={2} total={TOTAL_STEPS} />
        <div>
          <h3 className="font-display font-bold text-base mb-0.5">Supplement-Stack wechselt</h3>
          <p className="text-xs text-muted-foreground">{newStack.tagline}</p>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card">
          <FlaskConical size={14} className="text-primary flex-shrink-0" />
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className={`text-xs font-display font-semibold ${oldGoalInfo.accentText} truncate`}>{oldGoalInfo.emoji} {oldGoalInfo.label.split("/")[0].trim()}</span>
            <ArrowRight size={12} className="text-muted-foreground flex-shrink-0" />
            <span className={`text-xs font-display font-semibold ${newGoalInfo.accentText} truncate`}>{newGoalInfo.emoji} {newGoalInfo.label.split("/")[0].trim()}</span>
          </div>
        </div>

        {/* New supplements */}
        {addedSupps.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-display font-bold text-green-400 uppercase tracking-wider">Hinzugefügt ({addedSupps.length})</p>
            {addedSupps.map((s) => (
              <SuppMiniCard key={s.name} name={s.name} emoji={s.emoji} dose={s.dose} isNew />
            ))}
          </div>
        )}

        {/* Removed supplements */}
        {removedSupps.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Entfernt ({removedSupps.length})</p>
            {removedSupps.map((s) => (
              <div key={s.name} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-card opacity-50">
                <span className="text-base flex-shrink-0">{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-display font-semibold line-through truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.dose}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Retained supplements */}
        {retainedSupps.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Unverändert ({retainedSupps.length})</p>
            {retainedSupps.map((s) => (
              <SuppMiniCard key={s.name} name={s.name} emoji={s.emoji} dose={s.dose} />
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
            <ChevronLeft size={14} className="mr-1" /> Zurück
          </Button>
          <Button onClick={() => setStep(3)} className="flex-1 gradient-orange text-white border-0 hover:opacity-90" data-testid="wizard-next-step3">
            Weiter <ChevronRight size={15} className="ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 3: Wave/Week Warning ──────────────────────────────────────────────
  if (step === 3) {
    return (
      <div className="space-y-4">
        <StepIndicator current={3} total={TOTAL_STEPS} />
        <div>
          <h3 className="font-display font-bold text-base mb-0.5">Programmphase</h3>
          <p className="text-xs text-muted-foreground">Was soll mit deiner aktuellen Phase passieren?</p>
        </div>

        {/* Current phase */}
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-2">Aktuelle Position</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full gradient-orange flex items-center justify-center flex-shrink-0">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <p className="font-display font-bold text-sm">{WAVE_NAMES[user.currentWave - 1]}</p>
              <p className="text-xs text-muted-foreground">{WEEK_NAMES[user.currentWeek - 1]} · Woche {(user.currentWave - 1) * 4 + user.currentWeek} von 16</p>
            </div>
          </div>
        </div>

        {/* Reset warning — only shown when switching rep-scheme families */}
        {shouldWarnReset && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl border border-yellow-500/40 bg-yellow-500/8">
            <AlertTriangle size={15} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-display font-bold text-yellow-400 mb-1">Unterschiedliche Wiederholungs-Wellen</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Du wechselst zwischen <strong>{oldGoalInfo.waves}</strong> (Kraftschema) und <strong>{newGoalInfo.waves}</strong> (Hypertrophieschema).
                Ein Neustart bei Wave 1 / Woche 1 wird empfohlen, damit die Progression passt.
              </p>
            </div>
          </div>
        )}

        {!shouldWarnReset && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card">
            <Check size={15} className="text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-display font-semibold text-foreground mb-1">Gleiche Wellen-Familie</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Beide Ziele nutzen {newGoalInfo.waves}. Du kannst nahtlos in deiner aktuellen Phase weitermachen.
              </p>
            </div>
          </div>
        )}

        {/* Reset toggle */}
        <div className="space-y-2">
          <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Wähle eine Option</p>

          <button
            onClick={() => setResetProgram(false)}
            className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
              !resetProgram ? "border-primary/60 bg-primary/10" : "border-border bg-card hover:border-muted-foreground/40"
            }`}
            data-testid="wizard-continue-phase"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display font-bold text-sm">Phase beibehalten</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Weitermachen mit {WAVE_NAMES[user.currentWave - 1]} · {WEEK_NAMES[user.currentWeek - 1]}
                  {shouldWarnReset ? " (nicht empfohlen)" : ""}
                </p>
              </div>
              {!resetProgram && (
                <div className="w-5 h-5 rounded-full gradient-orange flex items-center justify-center flex-shrink-0 ml-2">
                  <Check size={11} className="text-white" />
                </div>
              )}
            </div>
          </button>

          <button
            onClick={() => setResetProgram(true)}
            className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
              resetProgram ? "border-primary/60 bg-primary/10" : "border-border bg-card hover:border-muted-foreground/40"
            }`}
            data-testid="wizard-reset-phase"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-display font-bold text-sm">Programm neu starten</p>
                  {shouldWarnReset && <Badge className="text-xs border border-primary/30 bg-primary/10 text-primary px-1.5 py-0">Empfohlen</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Zurück zu Wave 1 · Akkumulation</p>
              </div>
              {resetProgram && (
                <div className="w-5 h-5 rounded-full gradient-orange flex items-center justify-center flex-shrink-0 ml-2">
                  <Check size={11} className="text-white" />
                </div>
              )}
            </div>
          </button>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
            <ChevronLeft size={14} className="mr-1" /> Zurück
          </Button>
          <Button onClick={() => setStep(4)} className="flex-1 gradient-orange text-white border-0 hover:opacity-90" data-testid="wizard-next-step4">
            Weiter <ChevronRight size={15} className="ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 4: Confirm Summary ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <StepIndicator current={4} total={TOTAL_STEPS} />
      <div>
        <h3 className="font-display font-bold text-base mb-0.5">Zusammenfassung</h3>
        <p className="text-xs text-muted-foreground">Bitte bestätige alle Änderungen</p>
      </div>

      {/* Goal change */}
      <div className="stat-card space-y-3">
        <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Änderungen</p>

        <div className="flex items-center gap-3">
          <div className={`flex-1 rounded-lg p-2.5 border ${oldGoalInfo.accentBorder} ${oldGoalInfo.accentBg} text-center`}>
            <p className="text-base">{oldGoalInfo.emoji}</p>
            <p className={`text-xs font-display font-bold ${oldGoalInfo.accentText} leading-tight mt-0.5`}>{oldGoalInfo.label.split("/")[0].trim()}</p>
          </div>
          <ArrowRight size={18} className="text-primary flex-shrink-0" />
          <div className={`flex-1 rounded-lg p-2.5 border ${newGoalInfo.accentBorder} ${newGoalInfo.accentBg} text-center`}>
            <p className="text-base">{newGoalInfo.emoji}</p>
            <p className={`text-xs font-display font-bold ${newGoalInfo.accentText} leading-tight mt-0.5`}>{newGoalInfo.label.split("/")[0].trim()}</p>
          </div>
        </div>

        <div className="space-y-2 pt-1 border-t border-border">
          <SummaryLine
            icon="🍽️"
            label="Kalorien"
            value={`${newMacros.calories} kcal/Tag`}
            note={`${newMacros.calories > oldMacros.calories ? "+" : ""}${newMacros.calories - oldMacros.calories} kcal`}
            noteColor={newMacros.calories > oldMacros.calories ? "text-green-400" : "text-red-400"}
          />
          <SummaryLine
            icon="💪"
            label="Protein"
            value={`${newMacros.proteinG} g/Tag`}
            note={`${newMacros.proteinG > oldMacros.proteinG ? "+" : ""}${newMacros.proteinG - oldMacros.proteinG} g`}
            noteColor={newMacros.proteinG > oldMacros.proteinG ? "text-green-400" : "text-red-400"}
          />
          <SummaryLine
            icon="🧪"
            label="Supplement-Stack"
            value={`${addedSupps.length} neu · ${removedSupps.length} entfernt`}
            noteColor="text-muted-foreground"
          />
          <SummaryLine
            icon={resetProgram ? "🔄" : "▶️"}
            label="Programmphase"
            value={resetProgram ? "Neustart: Wave 1 · Akkumulation" : `Weiter: ${WAVE_NAMES[user.currentWave - 1]} · ${WEEK_NAMES[user.currentWeek - 1]}`}
            noteColor={resetProgram ? "text-primary" : "text-muted-foreground"}
          />
        </div>
      </div>

      {/* Reset note */}
      <p className="text-xs text-muted-foreground leading-relaxed px-1">
        Deine individuellen Makro-Anpassungen werden zurückgesetzt. Trainingspläne und 1RM-Werte bleiben unverändert.
      </p>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(3)} className="flex-1" disabled={isPending}>
          <ChevronLeft size={14} className="mr-1" /> Zurück
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isPending}
          className="flex-1 gradient-orange text-white border-0 hover:opacity-90"
          data-testid="wizard-confirm"
        >
          {isPending ? (
            <><RefreshCw size={14} className="mr-2 animate-spin" /> Speichert…</>
          ) : (
            <><Check size={14} className="mr-2" /> Bestätigen</>
          )}
        </Button>
      </div>
    </div>
  );
}

function SummaryLine({
  icon,
  label,
  value,
  note,
  noteColor,
}: {
  icon: string;
  label: string;
  value: string;
  note?: string;
  noteColor?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm flex-shrink-0 w-5 text-center">{icon}</span>
      <span className="text-xs text-muted-foreground flex-shrink-0 w-24">{label}</span>
      <span className="text-xs font-display font-semibold flex-1 truncate">{value}</span>
      {note && <span className={`text-xs font-semibold flex-shrink-0 ${noteColor}`}>{note}</span>}
    </div>
  );
}
