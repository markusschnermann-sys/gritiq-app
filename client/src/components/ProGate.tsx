import { useState } from "react";
import { Lock, Zap, Brain, BarChart2, Dumbbell, Star, UtensilsCrossed, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UpgradeModal, type UpgradeReason } from "@/components/UpgradeModal";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";

type ProFeature = "nutrition" | "program" | "analytics" | "supplements" | "atlas" | "challenges" | "h2h" | "generic";

const FEATURE_META: Record<ProFeature, {
  icon: React.ReactNode;
  title: string;
  description: string;
  reason: UpgradeReason;
  bullets: { icon: React.ReactNode; text: string }[];
}> = {
  nutrition: {
    icon: <UtensilsCrossed className="h-8 w-8 text-orange-400" />,
    title: "Ernährungsplan freischalten",
    description: "Dein zielspezifischer Makroplan, wöchentliche KI-Ernährungs-E-Mail und personalisierter Supplement-Stack – alles in GritIQ Pro.",
    reason: "generic",
    bullets: [
      { icon: <UtensilsCrossed className="h-3.5 w-3.5" />, text: "Automatisch berechnete Kalorien & Makros nach Ziel" },
      { icon: <Brain className="h-3.5 w-3.5" />, text: "Wöchentliche KI-Ernährungs-E-Mail jeden Montag" },
      { icon: <Star className="h-3.5 w-3.5" />, text: "Evidenzbasierter Supplement-Stack (ISSN)" },
    ],
  },
  supplements: {
    icon: <Star className="h-8 w-8 text-orange-400" />,
    title: "Supplement-Stack freischalten",
    description: "Evidenzbasierte Supplement-Empfehlungen nach ISSN, abgestimmt auf dein Trainingsziel.",
    reason: "generic",
    bullets: [
      { icon: <Star className="h-3.5 w-3.5" />, text: "Zielspezifische Supplement-Prioritäten" },
      { icon: <Brain className="h-3.5 w-3.5" />, text: "Kontraindikationen & Sicherheitshinweise" },
      { icon: <Zap className="h-3.5 w-3.5" />, text: "Timing-Empfehlungen & Dosierungen" },
    ],
  },
  program: {
    icon: <Dumbbell className="h-8 w-8 text-orange-400" />,
    title: "Volles 16-Wochen-Programm",
    description: "Free-User starten mit Wave 1. Mit Pro-Zugang schaltest du alle 4 Wellen des Adaptive Strength Waves-Zyklus frei.",
    reason: "goal",
    bullets: [
      { icon: <Dumbbell className="h-3.5 w-3.5" />, text: "Wellen 2–4: 8er, 5er und 3er-Welle" },
      { icon: <BarChart2 className="h-3.5 w-3.5" />, text: "AMRAP-Progression & Trainingsmax-Anpassung" },
      { icon: <Star className="h-3.5 w-3.5" />, text: "Alle 3 Trainingsziele (Powerlifting · BB · Abnehmen)" },
    ],
  },
  analytics: {
    icon: <BarChart2 className="h-8 w-8 text-orange-400" />,
    title: "Advanced Analytics freischalten",
    description: "PR Wall, Strength Standards und vollständige Performance-Analyse – exklusiv für Pro-Mitglieder.",
    reason: "history",
    bullets: [
      { icon: <BarChart2 className="h-3.5 w-3.5" />, text: "Performance-Graphen über alle Übungen" },
      { icon: <Star className="h-3.5 w-3.5" />, text: "PR Wall & persönliche Bestleistungen" },
      { icon: <Dumbbell className="h-3.5 w-3.5" />, text: "Strength Standards: Einordnung nach Kraftklasse" },
    ],
  },
  atlas: {
    icon: <Brain className="h-8 w-8 text-violet-400" />,
    title: "ATLAS-Limit erreicht",
    description: "Du hast deine 5 kostenlosen Nachrichten für diesen Monat verbraucht. Mit Pro coacht ATLAS dich unbegrenzt.",
    reason: "atlas",
    bullets: [
      { icon: <Brain className="h-3.5 w-3.5" />, text: "Unbegrenzte KI-Coaching-Sessions" },
      { icon: <Zap className="h-3.5 w-3.5" />, text: "Personalisiert auf deine Trainingsdaten" },
      { icon: <Star className="h-3.5 w-3.5" />, text: "Proaktive Insights & Übertrainingserkennung" },
    ],
  },
  challenges: {
    icon: <Star className="h-8 w-8 text-yellow-400" />,
    title: "Challenge erstellen",
    description: "Erstelle eigene Challenges und fordere andere Athleten heraus — exklusiv für Pro-Mitglieder.",
    reason: "challenges",
    bullets: [
      { icon: <Star className="h-3.5 w-3.5" />, text: "Eigene Challenges erstellen & verwalten" },
      { icon: <Dumbbell className="h-3.5 w-3.5" />, text: "Alle bestehenden Challenges beitreten (kostenlos)" },
      { icon: <BarChart2 className="h-3.5 w-3.5" />, text: "Rangliste & Aktivitäts-Feed" },
    ],
  },
  h2h: {
    icon: <Swords className="h-8 w-8 text-orange-400" />,
    title: "Duell starten",
    description: "Head-to-Head Kraft-Duelle sind ein Pro-Feature. Fordere andere Athleten zu einem 4-Wochen-Koeffizient-Duell heraus.",
    reason: "h2h",
    bullets: [
      { icon: <Swords className="h-3.5 w-3.5" />, text: "4-Wochen Koeffizient-Wettkampf" },
      { icon: <BarChart2 className="h-3.5 w-3.5" />, text: "Live-Tracking & Ranglistenintegration" },
      { icon: <Zap className="h-3.5 w-3.5" />, text: "Trash Talk & Push-Benachrichtigungen" },
    ],
  },
  generic: {
    icon: <Zap className="h-8 w-8 text-orange-400" />,
    title: "GritIQ Pro freischalten",
    description: "Schalte alle Pro-Features frei und hol das Maximum aus deinem Training heraus.",
    reason: "generic",
    bullets: [
      { icon: <Brain className="h-3.5 w-3.5" />, text: "ATLAS KI-Coach — unbegrenzt" },
      { icon: <Dumbbell className="h-3.5 w-3.5" />, text: "Alle 3 Trainingsziele" },
      { icon: <BarChart2 className="h-3.5 w-3.5" />, text: "Vollständige Analytics & PR Wall" },
    ],
  },
};

interface ProGateProps {
  feature: ProFeature;
  /** Rendered only when the user IS Pro */
  children: React.ReactNode;
  /** Optional: always show the children but add a "blurred + locked" overlay */
  blurChildren?: React.ReactNode;
  className?: string;
}

/**
 * ProGate wraps content that is Pro-only.
 * - If the user IS Pro → renders children directly.
 * - If the user is NOT Pro → renders a beautiful locked-state card with upgrade CTA.
 *   Optionally blur-previews content behind the gate via `blurChildren`.
 */
export function ProGate({ feature, children, blurChildren, className }: ProGateProps) {
  const { data: sub, isLoading } = useSubscription();
  const [showModal, setShowModal] = useState(false);
  const meta = FEATURE_META[feature];

  if (isLoading) {
    return (
      <div className={cn("rounded-2xl bg-secondary/30 animate-pulse h-48", className)} />
    );
  }

  if (sub?.isPro) {
    return <>{children}</>;
  }

  return (
    <>
      <div className={cn("relative rounded-2xl overflow-hidden", className)} data-testid={`progate-${feature}`}>
        {/* Blurred preview layer */}
        {blurChildren && (
          <div className="absolute inset-0 pointer-events-none select-none">
            <div className="blur-sm opacity-40 scale-100 origin-top">
              {blurChildren}
            </div>
          </div>
        )}

        {/* Locked overlay */}
        <div className={cn(
          "relative z-10 flex flex-col items-center justify-center text-center px-6 py-10 gap-5",
          blurChildren && "bg-background/80 backdrop-blur-sm min-h-[280px]"
        )}>
          {/* Icon + lock badge */}
          <div className="relative">
            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
              {meta.icon}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-background border border-border rounded-full p-1">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-2">
              <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/25 text-xs font-semibold px-2 py-0.5">
                PRO
              </Badge>
            </div>
            <h3 className="font-display font-bold text-base text-foreground">{meta.title}</h3>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{meta.description}</p>
          </div>

          {/* Feature bullets */}
          <ul className="space-y-2 text-left w-full max-w-xs">
            {meta.bullets.map((b, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <span className="text-orange-400 flex-shrink-0">{b.icon}</span>
                <span>{b.text}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <Button
            className="w-full max-w-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold h-10"
            onClick={() => setShowModal(true)}
            data-testid={`button-progate-upgrade-${feature}`}
          >
            <Zap className="h-4 w-4 mr-2" />
            Pro freischalten — 14 Tage gratis
          </Button>

          <p className="text-xs text-muted-foreground">
            9,99 €/Monat · 79,99 €/Jahr · Jederzeit kündbar
          </p>
        </div>
      </div>

      <UpgradeModal
        open={showModal}
        onClose={() => setShowModal(false)}
        reason={meta.reason}
      />
    </>
  );
}

/**
 * Inline lock badge — use to mark nav items or cards as Pro
 * without fully blocking them (e.g., a tab that shows the gate when clicked).
 */
export function ProBadge({ className }: { className?: string }) {
  return (
    <Badge className={cn("bg-orange-500/15 text-orange-400 border-orange-500/25 text-[10px] font-bold px-1.5 py-0 ml-1.5", className)}>
      PRO
    </Badge>
  );
}
