import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Zap, Check, X, Brain, BarChart2, Dumbbell, UtensilsCrossed, Star, Sparkles, Lock, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHashLocation } from "wouter/use-hash-location";
import { cn } from "@/lib/utils";

export type UpgradeReason = "atlas" | "goal" | "history" | "supplements" | "challenges" | "h2h" | "generic";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: UpgradeReason;
}

const REASONS: Record<UpgradeReason, { title: string; description: string; icon: React.ReactNode }> = {
  atlas: {
    title: "ATLAS-Limit erreicht",
    description: "Du hast deine 5 kostenlosen ATLAS-Nachrichten diesen Monat verbraucht. Upgraden für unbegrenzte KI-Coaching-Sessions.",
    icon: <Brain className="h-6 w-6 text-violet-400" />,
  },
  goal: {
    title: "Pro-Trainingsziel",
    description: "Bodybuilding- und Abnehmen-Programme sind Teil von GritIQ Pro. Upgraden für alle 3 Ziele.",
    icon: <Dumbbell className="h-6 w-6 text-orange-400" />,
  },
  history: {
    title: "Advanced Analytics",
    description: "PR Wall, Strength Standards und vollständige Performance-Analyse – exklusiv für Pro-Mitglieder.",
    icon: <BarChart2 className="h-6 w-6 text-blue-400" />,
  },
  supplements: {
    title: "Supplement-Stack freischalten",
    description: "Evidenzbasierte Supplement-Empfehlungen nach ISSN, zielspezifisch mit Timing und Dosierungen.",
    icon: <Star className="h-6 w-6 text-yellow-400" />,
  },
  challenges: {
    title: "Eigene Challenges erstellen",
    description: "Als Pro-Mitglied kannst du Challenges erstellen und andere Athleten herausfordern.",
    icon: <Star className="h-6 w-6 text-yellow-400" />,
  },
  h2h: {
    title: "Duell starten",
    description: "Head-to-Head Kraft-Duelle sind ein Pro-Feature. Fordere andere Athleten zu einem 4-Wochen-Koeffizient-Duell heraus.",
    icon: <Zap className="h-6 w-6 text-orange-400" />,
  },
  generic: {
    title: "GritIQ Pro freischalten",
    description: "Hol dir unbegrenzte KI-Coaching-Sessions, alle Trainingsziele und deinen vollständigen Verlauf.",
    icon: <Zap className="h-6 w-6 text-orange-400" />,
  },
};

// ── Free vs Pro comparison table ─────────────────────────────────────────────
const COMPARISON = [
  {
    category: "Training",
    rows: [
      { label: "Trainingsprogramm (Wave 1)", free: true, pro: true },
      { label: "Alle 4 Wellen (16 Wochen)", free: false, pro: true },
      { label: "Alle Ziele (PL · BB · Abnehmen)", free: false, pro: true },
      { label: "AMRAP-Progression", free: true, pro: true },
    ],
  },
  {
    category: "ATLAS KI-Coach",
    rows: [
      { label: "5 Nachrichten / Monat", free: true, pro: false },
      { label: "Unbegrenzte KI-Sessions", free: false, pro: true },
      { label: "Trainingsanalyse & Coaching", free: false, pro: true },
    ],
  },
  {
    category: "Ernährung & Supplements",
    rows: [
      { label: "Wöchentlicher KI-Ernährungsplan", free: false, pro: true },
      { label: "Kalorienziel-Übersicht", free: true, pro: true },
      { label: "Evidenzbasierter Supplement-Stack", free: false, pro: true },
    ],
  },
  {
    category: "Analytics & Social",
    rows: [
      { label: "Trainings-Verlauf (letzte 7 Tage)", free: true, pro: true },
      { label: "PR Wall & vollständige Analytics", free: false, pro: true },
      { label: "Challenges beitreten", free: true, pro: true },
      { label: "Challenges erstellen & Duelle", free: false, pro: true },
    ],
  },
];

export function UpgradeModal({ open, onClose, reason = "generic" }: UpgradeModalProps) {
  const { toast } = useToast();
  const [, navigate] = useHashLocation();
  const info = REASONS[reason];
  const [showComparison, setShowComparison] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const hashSearch = window.location.hash.includes("?")
        ? new URLSearchParams(window.location.hash.split("?")[1])
        : null;
      const refCode = new URLSearchParams(window.location.search).get("ref")
        ?? hashSearch?.get("ref") ?? null;

      if (refCode) {
        try { await apiRequest("POST", "/api/referral/use", { referralCode: refCode }); } catch {}
      }

      const res = await apiRequest("POST", "/api/subscription/checkout", { billingCycle });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Checkout fehlgeschlagen");
      }
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (err: Error) => {
      toast({
        title: "Fehler beim Checkout",
        description: err.message.includes("STRIPE_SECRET_KEY")
          ? "Stripe ist noch nicht konfiguriert."
          : err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md border-orange-500/20 bg-[hsl(var(--card))] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            {info.icon}
            <DialogTitle className="text-lg font-semibold leading-tight">{info.title}</DialogTitle>
          </div>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-1 mb-4 leading-relaxed">{info.description}</p>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={cn(
              "text-sm font-medium px-3 py-1 rounded-full transition-colors",
              billingCycle === "monthly"
                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Monatlich
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={cn(
              "text-sm font-medium px-3 py-1 rounded-full transition-colors flex items-center gap-1.5",
              billingCycle === "yearly"
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

        {/* Pricing card */}
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 mb-4">
          <div className="flex items-end justify-between mb-1">
            <div>
              <span className="text-3xl font-bold font-display">
                {billingCycle === "monthly" ? "9,99 €" : "6,66 €"}
              </span>
              <span className="text-muted-foreground text-sm ml-1">/Monat</span>
            </div>
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs font-semibold">
              14 Tage gratis
            </Badge>
          </div>
          {billingCycle === "yearly" && (
            <p className="text-xs text-green-400 mb-3">79,99 €/Jahr · 2 Monate geschenkt</p>
          )}
          {billingCycle === "monthly" && (
            <p className="text-xs text-muted-foreground mb-3">oder 79,99 €/Jahr (33 % sparen)</p>
          )}

          {/* Quick feature bullets */}
          <ul className="space-y-1.5">
            {[
              { icon: <Brain className="h-3.5 w-3.5" />, text: "ATLAS KI-Coach — unbegrenzt" },
              { icon: <Dumbbell className="h-3.5 w-3.5" />, text: "Alle 3 Trainingsziele · 16 Wochen" },
              { icon: <BarChart2 className="h-3.5 w-3.5" />, text: "PR Wall & vollständige Analytics" },
              { icon: <UtensilsCrossed className="h-3.5 w-3.5" />, text: "Wöchentlicher KI-Ernährungsplan" },
              { icon: <Star className="h-3.5 w-3.5" />, text: "Challenges erstellen & Duelle" },
              { icon: <Sparkles className="h-3.5 w-3.5" />, text: "Früher Zugang zu neuen Features" },
            ].map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="text-orange-400 flex-shrink-0">{f.icon}</span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <Button
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-11 text-base"
          onClick={() => checkoutMutation.mutate()}
          disabled={checkoutMutation.isPending}
          data-testid="button-upgrade-pro"
        >
          {checkoutMutation.isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Weiterleitung...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              14 Tage kostenlos starten
            </span>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-1">
          14 Tage kostenlos · Keine Kreditkarte nötig · Jederzeit kündbar
        </p>

        {/* Free vs Pro comparison toggle */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setShowComparison(v => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            data-testid="button-toggle-comparison"
          >
            <Lock className="h-3 w-3" />
            {showComparison ? "Vergleich ausblenden" : "Free vs. Pro"}
          </button>
          <button
            onClick={() => { onClose(); navigate("/upgrade"); }}
            className="text-xs text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1"
            data-testid="button-goto-upgrade-page"
          >
            Alle Details
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* Comparison table */}
        {showComparison && (
          <div className="mt-3 rounded-xl border border-border overflow-hidden text-xs" data-testid="comparison-table">
            {/* Header */}
            <div className="grid grid-cols-3 bg-secondary/50 px-3 py-2 font-semibold text-muted-foreground">
              <span className="col-span-1">Feature</span>
              <span className="text-center">Free</span>
              <span className="text-center text-orange-400">Pro</span>
            </div>

            {COMPARISON.map((section) => (
              <div key={section.category}>
                <div className="px-3 py-1.5 bg-secondary/30 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px]">
                  {section.category}
                </div>
                {section.rows.map((row, i) => (
                  <div
                    key={i}
                    className={cn(
                      "grid grid-cols-3 px-3 py-2 items-center border-t border-border/50",
                      !row.free && row.pro && "bg-orange-500/3"
                    )}
                  >
                    <span className="col-span-1 text-foreground/80 leading-tight pr-2">{row.label}</span>
                    <span className="flex justify-center">
                      {row.free
                        ? <Check className="h-3.5 w-3.5 text-green-400" />
                        : <X className="h-3.5 w-3.5 text-muted-foreground/40" />}
                    </span>
                    <span className="flex justify-center">
                      {row.pro
                        ? <Check className="h-3.5 w-3.5 text-orange-400" />
                        : <X className="h-3.5 w-3.5 text-muted-foreground/40" />}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
