/**
 * CalorieCyclingSection
 *
 * Renders inside the Ernährungsplan settings section.
 * Lets users:
 *  1. Toggle calorie cycling on/off
 *  2. Pick which weekdays are training days
 *  3. Choose mode: Moderat (±150) / Standard (±300) / Aggressiv (±500)
 *  4. View a scrollable 7-day grid with per-day kcal + macro breakdown
 *
 * Preferences are persisted to SQLite via PATCH /api/user.
 */

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  computeWeeklyCyclingPlan,
  parseCalorieCyclingPrefs,
  CYCLING_MODE_CONFIG,
  DAY_LABELS,
  DEFAULT_CYCLING_PREFS,
  type MacroTargets,
  type CalorieCyclingPrefs,
  type CyclingMode,
  type WeekDay,
  type DayPlan,
} from "@/lib/nutrition";
import { TrendingUp, Flame, Dumbbell, Moon, ChevronDown, ChevronUp, Info } from "lucide-react";

interface CalorieCyclingSectionProps {
  baseTargets: MacroTargets;
  initialPrefs: CalorieCyclingPrefs;
  accentText: string;
  accentBg: string;
  accentBorder: string;
}

// ── Day Toggle Button ─────────────────────────────────────────────────────────

function DayButton({
  day,
  isSelected,
  onToggle,
}: {
  day: { label: string; short: string };
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex-1 flex flex-col items-center py-2.5 px-1 rounded-xl text-xs font-display font-bold transition-all duration-150 border ${
        isSelected
          ? "bg-primary/15 text-primary border-primary/40"
          : "bg-muted/20 text-muted-foreground border-transparent hover:border-border"
      }`}
      data-testid={`day-toggle-${day.short.toLowerCase()}`}
      aria-pressed={isSelected}
    >
      <span className="text-[10px] uppercase tracking-wider opacity-70">{day.short}</span>
      <span className={`mt-1 w-1.5 h-1.5 rounded-full ${isSelected ? "bg-primary" : "bg-muted-foreground/30"}`} />
    </button>
  );
}

// ── Mode Selector Button ──────────────────────────────────────────────────────

function ModeButton({
  mode,
  isSelected,
  onClick,
}: {
  mode: CyclingMode;
  isSelected: boolean;
  onClick: () => void;
}) {
  const cfg = CYCLING_MODE_CONFIG[mode];
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center py-3 px-2 rounded-xl border text-xs font-display font-bold transition-all duration-150 ${
        isSelected
          ? "bg-primary/15 text-primary border-primary/40"
          : "bg-muted/20 text-muted-foreground border-transparent hover:border-border"
      }`}
      data-testid={`mode-${mode}`}
    >
      <span className={`text-base ${
        mode === "moderate" ? "text-green-400" : mode === "standard" ? "text-yellow-400" : "text-red-400"
      }`}>
        {mode === "moderate" ? "🌊" : mode === "standard" ? "⚡" : "🔥"}
      </span>
      <span className="mt-1 leading-tight text-center">
        {mode === "moderate" ? "±150" : mode === "standard" ? "±300" : "±500"}
      </span>
      <span className="text-[9px] opacity-60 mt-0.5 uppercase tracking-wider">kcal</span>
    </button>
  );
}

// ── Weekly Grid Card ──────────────────────────────────────────────────────────

function DayCard({ day, isToday }: { day: DayPlan; isToday: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const calDiff = day.isTraining
    ? `+${(CYCLING_MODE_CONFIG as any) ? "" : ""}` // placeholder, computed externally
    : "";

  return (
    <div
      className={`snap-start flex-shrink-0 w-[135px] rounded-2xl border overflow-hidden transition-all duration-150 ${
        day.isTraining
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-card"
      } ${isToday ? "ring-1 ring-primary" : ""}`}
      data-testid={`day-card-${day.shortLabel.toLowerCase()}`}
    >
      {/* Header */}
      <div className={`px-3 py-2 flex items-center justify-between ${
        day.isTraining ? "bg-primary/10" : "bg-muted/20"
      }`}>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">{day.shortLabel}</p>
          <p className={`text-xs font-display font-bold ${day.isTraining ? "text-primary" : "text-foreground"}`}>
            {day.label.slice(0, 2)}
          </p>
        </div>
        <span className={`text-sm ${day.isTraining ? "" : "opacity-40"}`}>
          {day.isTraining ? <Dumbbell size={14} className="text-primary" /> : <Moon size={14} className="text-muted-foreground" />}
        </span>
      </div>

      {/* Calorie big number */}
      <div className="px-3 py-2.5 space-y-1">
        <p className={`font-display font-bold text-lg leading-none ${day.isTraining ? "text-primary" : "text-foreground"}`}>
          {day.calories.toLocaleString("de-DE")}
        </p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">kcal</p>

        {/* Mini macro bars */}
        <div className="mt-2 space-y-1">
          <MacroBar label="P" value={day.proteinG} unit="g" color="bg-orange-400" max={400} />
          <MacroBar label="C" value={day.carbsG} unit="g" color="bg-sky-400" max={700} />
          <MacroBar label="F" value={day.fatG} unit="g" color="bg-yellow-400" max={200} />
        </div>
      </div>

      {/* Expandable detail */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground hover:text-foreground border-t border-border/40 transition-colors"
        data-testid={`day-card-expand-${day.shortLabel.toLowerCase()}`}
      >
        <span>Details</span>
        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1 border-t border-border/30">
          <DetailRow label="Protein" value={`${day.proteinG}g`} color="text-orange-400" />
          <DetailRow label="Carbs" value={`${day.carbsG}g`} color="text-sky-400" />
          <DetailRow label="Fett" value={`${day.fatG}g`} color="text-yellow-400" />
          <DetailRow label="Typ" value={day.isTraining ? "Trainingstag" : "Ruhetag"} color={day.isTraining ? "text-primary" : "text-muted-foreground"} />
        </div>
      )}
    </div>
  );
}

function MacroBar({ label, value, unit, color, max }: { label: string; value: number; unit: string; color: string; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-muted-foreground w-2.5 font-display font-bold">{label}</span>
      <div className="flex-1 h-1 bg-muted/40 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-muted-foreground w-7 text-right">{value}{unit}</span>
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between mt-1.5">
      <span className="text-[9px] text-muted-foreground font-display uppercase tracking-wider">{label}</span>
      <span className={`text-[10px] font-display font-bold ${color}`}>{value}</span>
    </div>
  );
}

// ── Weekly Summary Stats ──────────────────────────────────────────────────────

function WeeklySummary({ plan, base }: { plan: DayPlan[]; base: MacroTargets }) {
  const total = plan.reduce((s, d) => s + d.calories, 0);
  const avg = Math.round(total / 7);
  const trainDays = plan.filter(d => d.isTraining);
  const restDays = plan.filter(d => !d.isTraining);
  const trainAvg = trainDays.length ? Math.round(trainDays.reduce((s, d) => s + d.calories, 0) / trainDays.length) : 0;
  const restAvg = restDays.length ? Math.round(restDays.reduce((s, d) => s + d.calories, 0) / restDays.length) : 0;

  return (
    <div className="grid grid-cols-3 gap-2">
      <SummaryCard label="Ø / Tag" value={avg.toLocaleString("de-DE")} unit="kcal" highlight={Math.abs(avg - base.calories) < 10} />
      <SummaryCard label="Ø Training" value={trainAvg.toLocaleString("de-DE")} unit="kcal" accent="text-primary" />
      <SummaryCard label="Ø Ruhetag" value={restAvg.toLocaleString("de-DE")} unit="kcal" accent="text-muted-foreground" />
    </div>
  );
}

function SummaryCard({ label, value, unit, highlight, accent }: {
  label: string; value: string; unit: string; highlight?: boolean; accent?: string;
}) {
  return (
    <div className={`rounded-xl border p-2.5 text-center space-y-0.5 ${highlight ? "border-primary/20 bg-primary/5" : "border-border bg-card"}`}>
      <p className={`font-display font-bold text-sm ${accent ?? "text-foreground"}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{unit}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CalorieCyclingSection({
  baseTargets,
  initialPrefs,
  accentText,
  accentBg,
  accentBorder,
}: CalorieCyclingSectionProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  // Local state — mirrors what's persisted
  const [prefs, setPrefs] = useState<CalorieCyclingPrefs>(initialPrefs);

  // Derive weekly plan
  const plan = computeWeeklyCyclingPlan(baseTargets, prefs);

  // Today's index (Mon=0 … Sun=6, matching our schema)
  const todayIndex = ((new Date().getDay() + 6) % 7) as WeekDay;

  // Toggle a specific training day
  const toggleDay = useCallback((idx: WeekDay) => {
    setPrefs(p => {
      const has = p.trainingDays.includes(idx);
      const next = has
        ? p.trainingDays.filter(d => d !== idx)
        : ([...p.trainingDays, idx].sort() as WeekDay[]);
      return { ...p, trainingDays: next };
    });
  }, []);

  // Mutation to persist to server
  const saveMutation = useMutation({
    mutationFn: (newPrefs: CalorieCyclingPrefs) =>
      apiRequest("PATCH", "/api/user", {
        calorieCyclingPrefs: JSON.stringify(newPrefs),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Gespeichert", description: "Calorie Cycling aktualisiert." });
    },
    onError: () => {
      toast({ title: "Fehler", description: "Speichern fehlgeschlagen.", variant: "destructive" });
    },
  });

  const handleSave = () => saveMutation.mutate(prefs);
  const handleToggleEnabled = (val: boolean) => {
    const next = { ...prefs, enabled: val };
    setPrefs(next);
    saveMutation.mutate(next); // auto-save on toggle
  };

  const trainCount = prefs.trainingDays.length;
  const modeCfg = CYCLING_MODE_CONFIG[prefs.mode];

  return (
    <div className="space-y-0">
      {/* ── Collapsible Header ──────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className={`w-full flex items-center justify-between p-4 rounded-xl border bg-card transition-colors ${
          isOpen ? `${accentBorder}` : "border-border hover:border-primary/30"
        }`}
        data-testid="button-toggle-cycling"
      >
        <div className="flex items-center gap-2.5">
          <TrendingUp size={16} className={prefs.enabled ? "text-primary" : "text-muted-foreground"} />
          <div className="text-left">
            <span className="font-display font-bold text-sm">Calorie Cycling</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {prefs.enabled
                ? `${modeCfg.label} · ${trainCount} Trainingstage / Woche`
                : "Automatische Wochen-Verteilung"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {prefs.enabled && (
            <Badge className="text-[10px] border bg-primary/15 text-primary border-primary/30">
              Aktiv
            </Badge>
          )}
          {isOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>

      {isOpen && (
        <div className="space-y-4 pt-3">
          {/* Enable toggle */}
          <div className="flex items-center justify-between stat-card">
            <div>
              <p className="font-display font-bold text-sm">Calorie Cycling aktivieren</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kalorien automatisch auf Trainings- und Ruhetage verteilen
              </p>
            </div>
            <Switch
              checked={prefs.enabled}
              onCheckedChange={handleToggleEnabled}
              data-testid="switch-cycling-enabled"
            />
          </div>

          {/* Info box */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/30 border border-border">
            <Info size={13} className="text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Der Wochenschnitt bleibt exakt gleich — nur Carbs werden täglich angepasst.
              Protein und Fett bleiben stabil (Hormonsystem & Muskelproteinsynthese).
            </p>
          </div>

          {/* ── Mode Selector ──────────────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider px-1">Intensität</p>
            <div className="flex gap-2">
              {(["moderate", "standard", "aggressive"] as CyclingMode[]).map((m) => (
                <ModeButton
                  key={m}
                  mode={m}
                  isSelected={prefs.mode === m}
                  onClick={() => setPrefs(p => ({ ...p, mode: m }))}
                />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
              {modeCfg.description}
            </p>
          </div>

          {/* ── Training Day Picker ─────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider">Trainingstage</p>
              <span className="text-[10px] text-muted-foreground">{trainCount} von 7</span>
            </div>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((day, i) => (
                <DayButton
                  key={i}
                  day={day}
                  isSelected={prefs.trainingDays.includes(i as WeekDay)}
                  onToggle={() => toggleDay(i as WeekDay)}
                />
              ))}
            </div>
          </div>

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="w-full gradient-orange text-white border-0 hover:opacity-90 h-11"
            data-testid="button-save-cycling"
          >
            {saveMutation.isPending ? "Speichert…" : "Plan speichern"}
          </Button>

          {/* ── Weekly Summary ──────────────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider px-1">
              Wochenübersicht
            </p>
            <WeeklySummary plan={plan} base={baseTargets} />
          </div>

          {/* ── 7-Day Scrollable Grid ───────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider px-1">
              Tagesplan · KW {getCurrentWeek()}
            </p>

            {/* Horizontal scroll container */}
            <div
              className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
              style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
              data-testid="cycling-day-grid"
            >
              {plan.map((day) => (
                <DayCard
                  key={day.dayIndex}
                  day={day}
                  isToday={day.dayIndex === todayIndex}
                />
              ))}
            </div>

            {/* Scroll hint */}
            <p className="text-[10px] text-muted-foreground text-center">
              ← scrollbar zum Durchblättern →
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-1">
            <div className="flex items-center gap-1.5">
              <Dumbbell size={11} className="text-primary" />
              <span className="text-[10px] text-muted-foreground">Trainingstag</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Moon size={11} className="text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Ruhetag</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded ring-1 ring-primary inline-block" />
              <span className="text-[10px] text-muted-foreground">Heute</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility: ISO week number
function getCurrentWeek(): number {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
}
