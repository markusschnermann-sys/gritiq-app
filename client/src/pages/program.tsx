import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import MobileHeader from "@/components/MobileHeader";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProGate, ProBadge } from "@/components/ProGate";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/UpgradeModal";
import { Lock, Zap, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "@shared/schema";
import type { CyclePhase } from "@/lib/adaptations";
import {
  getAgeAdaptations,
  getCyclePhaseAdaptations,
  isOver40DeloadWeek,
  getEffectiveAmrapPct,
  getEffectiveSets,
} from "@/lib/adaptations";

const WAVE_NAMES = ["10s Wave", "8s Wave", "5s Wave", "3s Wave"];
const WEEK_NAMES = ["Akkumulation", "Intensivierung", "Realisierung", "Deload"];
const WAVE_DESCRIPTIONS = [
  "Hypertrophie & Arbeitskapazität — hohe Sätze mit 60-75% des TM",
  "Hypertrophie + steigende Intensität — 65-80% des TM",
  "Kraft-Geschwindigkeits-Übergang — 70-85% des TM",
  "Maximalkraft — 75-90% des TM, AMRAP-Satz",
];
const WEEK_DESCRIPTIONS = [
  "Hohes Volumen, moderate Intensität — mehrere Arbeitssätze",
  "~60% des Akkumulationsvolumens, höhere Intensität",
  "Niedrigstes Volumen, maximale Intensität — AMRAP-Satz!",
  "Leichte Erholung — 40-60% des TM",
];
const LIFT_NAMES: Record<string, string> = {
  squat: "Kniebeuge", bench: "Bankdrücken", deadlift: "Kreuzheben", ohp: "Schulterdrücken",
};

const prescriptions: Record<number, Record<number, Array<{ pct: number; reps: number; amrap?: boolean }>>> = {
  1: {
    1: [{ pct: 60, reps: 10 }, { pct: 60, reps: 10 }, { pct: 60, reps: 10 }, { pct: 60, reps: 10 }, { pct: 60, reps: 10, amrap: true }],
    2: [{ pct: 65, reps: 10 }, { pct: 65, reps: 10 }, { pct: 65, reps: 10, amrap: true }],
    3: [{ pct: 75, reps: 10, amrap: true }],
    4: [{ pct: 40, reps: 5 }, { pct: 50, reps: 5 }, { pct: 60, reps: 5 }],
  },
  2: {
    1: [{ pct: 65, reps: 8 }, { pct: 65, reps: 8 }, { pct: 65, reps: 8 }, { pct: 65, reps: 8 }, { pct: 65, reps: 8, amrap: true }],
    2: [{ pct: 70, reps: 8 }, { pct: 70, reps: 8 }, { pct: 70, reps: 8, amrap: true }],
    3: [{ pct: 80, reps: 8, amrap: true }],
    4: [{ pct: 40, reps: 5 }, { pct: 50, reps: 5 }, { pct: 60, reps: 5 }],
  },
  3: {
    1: [{ pct: 70, reps: 5 }, { pct: 70, reps: 5 }, { pct: 70, reps: 5 }, { pct: 70, reps: 5 }, { pct: 70, reps: 5 }, { pct: 70, reps: 5, amrap: true }],
    2: [{ pct: 75, reps: 5 }, { pct: 75, reps: 5 }, { pct: 75, reps: 5 }, { pct: 75, reps: 5, amrap: true }],
    3: [{ pct: 85, reps: 5, amrap: true }],
    4: [{ pct: 40, reps: 5 }, { pct: 50, reps: 5 }, { pct: 60, reps: 5 }],
  },
  4: {
    1: [{ pct: 75, reps: 3 }, { pct: 75, reps: 3 }, { pct: 75, reps: 3 }, { pct: 75, reps: 3 }, { pct: 75, reps: 3 }, { pct: 75, reps: 3, amrap: true }],
    2: [{ pct: 80, reps: 3 }, { pct: 80, reps: 3 }, { pct: 80, reps: 3 }, { pct: 80, reps: 3 }, { pct: 80, reps: 3, amrap: true }],
    3: [{ pct: 90, reps: 3, amrap: true }],
    4: [{ pct: 40, reps: 5 }, { pct: 50, reps: 5 }, { pct: 60, reps: 5 }],
  },
};

// ── Adaptation Banner ─────────────────────────────────────────────────────────

function AdaptationBanner({
  user,
  cyclePhase,
  onCyclePhaseChange,
}: {
  user: User;
  cyclePhase: CyclePhase | null;
  onCyclePhaseChange: (phase: CyclePhase) => void;
}) {
  const age = (user as any).age as number | undefined;
  const gender = user.gender ?? "other";
  const ageAdapts = getAgeAdaptations(age);
  const cycleAdapts = getCyclePhaseAdaptations(cyclePhase, gender);
  const isFemale = gender === "female";

  if (!ageAdapts.isOver40 && !isFemale) return null;

  return (
    <div className="space-y-2" data-testid="adaptation-banner">
      {/* 40+ badge */}
      {ageAdapts.isOver40 && (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3">
          <span className="text-base mt-0.5">⚡</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-display font-bold text-xs text-yellow-400">40+ Trainingsprotokoll aktiv</p>
              <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs">Masters</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Deload alle 3 Wochen (Woche 3 = Extra-Deload) · AMRAP −5% · 10 min Gelenkwarm-up vor jedem Training
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Häkkinen et al. (2000) · Kraemer &amp; Fleck (2007)
            </p>
          </div>
        </div>
      )}

      {/* Cycle phase toggle — female only */}
      {isFemale && (
        <div className="flex items-start gap-3 rounded-xl border border-pink-500/30 bg-pink-500/5 p-3">
          <span className="text-base mt-0.5">{cycleAdapts.phase === "luteal" ? "🌙" : "☀️"}</span>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-xs text-pink-400 mb-1.5">Zyklusphase</p>
            <div className="flex gap-2">
              <button
                onClick={() => onCyclePhaseChange("follicular")}
                className={cn(
                  "flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all",
                  cyclePhase === "follicular"
                    ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
                    : "border-border text-muted-foreground hover:border-pink-500/40"
                )}
                data-testid="button-phase-follicular"
              >
                ☀️ Follikelphase
              </button>
              <button
                onClick={() => onCyclePhaseChange("luteal")}
                className={cn(
                  "flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all",
                  cyclePhase === "luteal"
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                    : "border-border text-muted-foreground hover:border-pink-500/40"
                )}
                data-testid="button-phase-luteal"
              >
                🌙 Lutealphase
              </button>
            </div>
            {cyclePhase && (
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                {cyclePhase === "follicular"
                  ? "Normales Volumen · Optimal für PRs (McNulty et al., 2020)"
                  : "Volumen −10% · Fokus auf Technik (Romero-Moraleda et al., 2019)"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── WaveCard ──────────────────────────────────────────────────────────────────

function WaveCard({
  wave,
  tm,
  user,
  locked,
  onUpgrade,
  cyclePhase,
}: {
  wave: number;
  tm: Record<string, number>;
  user: User;
  locked: boolean;
  onUpgrade: () => void;
  cyclePhase: CyclePhase | null;
}) {
  const isCurrentWave = wave === user.currentWave;
  const round = (n: number) => Math.round(n / 2.5) * 2.5;

  const age = (user as any).age as number | undefined;
  const gender = user.gender ?? "other";
  const ageAdapts = getAgeAdaptations(age);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card overflow-hidden transition-all",
        isCurrentWave ? "border-primary/50" : "border-border",
        locked && "opacity-70"
      )}
      data-testid={`wave-card-${wave}`}
    >
      <div
        className={cn(
          "px-5 py-4 border-b border-border flex items-center justify-between",
          isCurrentWave ? "bg-primary/10" : "bg-card"
        )}
      >
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-base">{WAVE_NAMES[wave - 1]}</h2>
            {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{WAVE_DESCRIPTIONS[wave - 1]}</p>
        </div>
        <div className="flex items-center gap-2">
          {locked && (
            <button
              onClick={onUpgrade}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold hover:bg-orange-500/20 transition-colors"
              data-testid={`button-unlock-wave-${wave}`}
            >
              <Zap className="h-3 w-3" />
              Pro
            </button>
          )}
          {isCurrentWave && !locked && (
            <Badge className="bg-primary text-primary-foreground text-xs">Aktiv</Badge>
          )}
          <Badge variant="outline" className="text-xs">Wochen {(wave - 1) * 4 + 1}–{wave * 4}</Badge>
        </div>
      </div>

      <div className={cn("grid grid-cols-2 lg:grid-cols-4 divide-x divide-border", locked && "pointer-events-none")}>
        {[1, 2, 3, 4].map((week) => {
          const isCurrentWeek = isCurrentWave && week === user.currentWeek;
          const waveData = prescriptions[wave][week];

          // Adaptation overlays
          const isExtraDeload = isOver40DeloadWeek(week, ageAdapts.isOver40);
          const isLuteal = getCyclePhaseAdaptations(cyclePhase, gender).phase === "luteal";

          // For 40+ week 3 becomes a deload — show adapted set count (same sets, but note)
          // For luteal, show reduced working sets
          const effectiveSets = isLuteal
            ? getEffectiveSets(waveData.filter(s => !s.amrap).length, cyclePhase, gender)
            : waveData.filter(s => !s.amrap).length;

          return (
            <div
              key={week}
              className={cn(
                "p-4 relative",
                isCurrentWeek && !locked && "bg-primary/5",
                isExtraDeload && "bg-yellow-500/5",
              )}
              data-testid={`week-cell-w${wave}-wk${week}`}
            >
              <div className="mb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-display font-bold text-xs text-foreground">{WEEK_NAMES[week - 1]}</p>
                  {isExtraDeload && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded px-1 py-0 font-semibold leading-4">
                      +Deload
                    </span>
                  )}
                  {isLuteal && week !== 4 && !isExtraDeload && (
                    <span className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded px-1 py-0 font-semibold leading-4">
                      −10%
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isExtraDeload ? "Erholungswoche (40+)" : WEEK_DESCRIPTIONS[week - 1]}
                </p>
                {isCurrentWeek && !locked && (
                  <Badge className="mt-1 bg-primary/20 text-primary border-primary/30 text-xs">← Aktuell</Badge>
                )}
              </div>
              <div className="space-y-1">
                {waveData.map((s, i) => {
                  const effectivePct = s.amrap && ageAdapts.isOver40
                    ? getEffectiveAmrapPct(s.pct, age)
                    : s.pct;
                  const isReducedAmrap = s.amrap && ageAdapts.isOver40 && effectivePct !== s.pct;

                  return (
                    <div
                      key={i}
                      className={cn(
                        "text-xs flex items-center gap-1",
                        s.amrap ? "text-orange-400 font-semibold" : "text-muted-foreground",
                        locked && "blur-[2px]"
                      )}
                    >
                      <span className="w-3 text-center">{i + 1}.</span>
                      <span>
                        {s.reps}{s.amrap ? "+" : ""} × {effectivePct}%TM
                        {isReducedAmrap && (
                          <span className="text-yellow-400 ml-1 text-xs">(−5%)</span>
                        )}
                      </span>
                      {s.amrap && <span className="text-orange-400">⚡</span>}
                    </div>
                  );
                })}
                {isLuteal && week !== 4 && effectiveSets < waveData.filter(s => !s.amrap).length && (
                  <p className="text-xs text-indigo-400 mt-1">
                    Arbeits-Sätze: {effectiveSets} (Lutealphase)
                  </p>
                )}
                <div className="mt-2 pt-2 border-t border-border">
                  <p className={cn("text-xs text-muted-foreground/70", locked && "blur-[2px]")}>
                    SQ: {round(tm.squat * waveData[0].pct / 100)}–{round(tm.squat * waveData[waveData.length - 1].pct / 100)} kg
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProgramPage() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/user"],
    queryFn: async () => (await apiRequest("GET", "/api/user")).json(),
  });
  const { data: sub } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showWarmup, setShowWarmup] = useState(false);

  // Local cycle phase state — reflects server value on load, but changes
  // are sent to server via PATCH. We keep a local copy so toggling is instant.
  const serverPhase = (user as any)?.cyclePhase as CyclePhase | null ?? null;
  const [cyclePhase, setCyclePhase] = useState<CyclePhase | null>(null);
  const [phaseSynced, setPhaseSynced] = useState(false);
  if (user && !phaseSynced) {
    setCyclePhase(serverPhase);
    setPhaseSynced(true);
  }

  if (isLoading) return <div className="p-6 space-y-4"><Skeleton className="h-96" /></div>;
  if (!user) return null;

  const isPro = !!sub?.isPro;
  const age = (user as any).age as number | undefined;
  const gender = user.gender ?? "other";
  const ageAdapts = getAgeAdaptations(age);

  const tm = {
    squat: Math.round(user.squatMax * 0.9),
    bench: Math.round(user.benchMax * 0.9),
    deadlift: Math.round(user.deadliftMax * 0.9),
    ohp: Math.round(user.ohpMax * 0.9),
  };

  const round = (n: number) => Math.round(n / 2.5) * 2.5;

  const handlePhaseChange = async (phase: CyclePhase) => {
    setCyclePhase(phase);
    // Persist to server
    await apiRequest("PATCH", `/api/user/${user.id}`, { cyclePhase: phase });
  };

  return (
    <div>
      <MobileHeader user={user} title="Programm" />
      <div className="p-4 md:p-6 max-w-5xl space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-bold">GritIQ Method 2.0</h1>
            {!isPro && (
              <button
                onClick={() => setShowUpgrade(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold hover:bg-orange-500/20 transition-colors"
                data-testid="button-program-upgrade-banner"
              >
                <Lock className="h-3 w-3" />
                Wave 2–4 gesperrt
              </button>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">16-Wochen-Programm · 4 Übungen · AMRAP-Progression</p>
          {!isPro && (
            <p className="text-xs text-muted-foreground/70 mt-1">
              Free-Plan: Wave 1 verfügbar · <button onClick={() => setShowUpgrade(true)} className="text-orange-400 underline underline-offset-2 hover:text-orange-300">Pro freischalten</button> für alle 4 Wellen
            </p>
          )}
        </div>

        {/* Training Maxes */}
        <div className="stat-card">
          <h2 className="font-display font-bold text-sm mb-3 text-muted-foreground uppercase tracking-wider">Deine Trainingsmaxima (90% des 1RM)</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(tm).map(([lift, val]) => (
              <div key={lift} className="text-center">
                <p className="text-xl font-bold font-display text-foreground">{val} kg</p>
                <p className="text-xs text-primary mt-0.5">{LIFT_NAMES[lift]}</p>
                <p className="text-xs text-muted-foreground">1RM: {(user as any)[`${lift}Max`]} kg</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Adaptation Banner ───────────────────────────────────────────────── */}
        <AdaptationBanner
          user={user}
          cyclePhase={cyclePhase}
          onCyclePhaseChange={handlePhaseChange}
        />

        {/* 40+ Warm-up card (collapsible) */}
        {ageAdapts.isOver40 && (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 overflow-hidden">
            <button
              onClick={() => setShowWarmup(w => !w)}
              className="w-full flex items-center justify-between p-4 text-left"
              data-testid="button-toggle-warmup"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🔥</span>
                <p className="font-display font-bold text-sm text-yellow-400">Gelenk-Warm-up Protokoll (40+)</p>
              </div>
              <ChevronDown size={16} className={cn("text-yellow-400 transition-transform", showWarmup && "rotate-180")} />
            </button>
            {showWarmup && (
              <div className="px-4 pb-4 space-y-2 border-t border-yellow-500/20">
                <p className="text-xs text-muted-foreground pt-3">Vor jedem Hauptlift durchführen — ca. 10 Minuten:</p>
                <ol className="space-y-1.5">
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

        {/* Waves */}
        <div className="space-y-6">
          {[1, 2, 3, 4].map((wave) => (
            <WaveCard
              key={wave}
              wave={wave}
              tm={tm}
              user={user}
              locked={!isPro && wave > 1}
              onUpgrade={() => setShowUpgrade(true)}
              cyclePhase={cyclePhase}
            />
          ))}
        </div>

        {/* Pro upsell banner for free users */}
        {!isPro && (
          <div className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-display font-bold text-sm text-foreground">Wave 2–4 freischalten</p>
              <p className="text-xs text-muted-foreground mt-0.5">8er, 5er und 3er-Welle — der komplette 16-Wochen-Zyklus mit AMRAP-Progression</p>
            </div>
            <button
              onClick={() => setShowUpgrade(true)}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors"
              data-testid="button-program-cta"
            >
              <Zap className="h-4 w-4" />
              Pro
            </button>
          </div>
        )}

        {/* Info Box */}
        <div className="stat-card border-primary/20 bg-primary/5">
          <h3 className="font-display font-bold text-sm mb-2">📖 Progressionsformel</h3>
          <p className="text-sm text-muted-foreground">
            Nach dem AMRAP-Satz in Woche 3 (Realisierung): <strong className="text-foreground">(AMRAP-Wdh. − Zielwdh.) × Inkrement = 1RM-Steigerung</strong>
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc list-inside">
            <li>Kniebeuge &amp; Kreuzheben: 2,5 kg pro Extra-Wiederholung</li>
            <li>Bankdrücken &amp; OHP: 1,25 kg pro Extra-Wiederholung</li>
            <li>Maximal 10 Extra-Wdh. werden angerechnet</li>
          </ul>
        </div>
      </div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} reason="goal" />
    </div>
  );
}
