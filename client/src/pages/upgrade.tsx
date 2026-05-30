import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useHashLocation } from "wouter/use-hash-location";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";
import MobileHeader from "@/components/MobileHeader";
import {
  Zap,
  Brain,
  BarChart2,
  Dumbbell,
  UtensilsCrossed,
  Star,
  Sparkles,
  Check,
  X,
  Gift,
  Trophy,
  Swords,
  Crown,
  ChevronLeft,
  ArrowRight,
} from "lucide-react";

// ── Feature comparison table ─────────────────────────────────────────────────
const COMPARISON = [
  {
    category: "Training",
    rows: [
      { label: "Trainingsprogramm (Wave 1 · 4 Wochen)", free: true, pro: true },
      { label: "Volles 16-Wochen-Programm (alle 4 Wellen)", free: false, pro: true },
      { label: "Alle Trainingsziele (Powerlifting · BB · Abnehmen)", free: false, pro: true },
      { label: "AMRAP-Progression & Gewichtsanpassung", free: true, pro: true },
      { label: "Trainings-Verlauf (letzte 4 Wochen)", free: true, pro: true },
      { label: "Kompletter Trainings-Verlauf (unbegrenzt)", free: false, pro: true },
    ],
  },
  {
    category: "ATLAS KI-Coach",
    rows: [
      { label: "5 Nachrichten / Monat", free: true, pro: false },
      { label: "Unbegrenzte KI-Coaching-Sessions", free: false, pro: true },
      { label: "Personalisiertes Coaching auf Trainingsdaten", free: false, pro: true },
      { label: "Übertrainingserkennung & proaktive Insights", free: false, pro: true },
    ],
  },
  {
    category: "Analytics & Performance",
    rows: [
      { label: "Lift-Übersicht & aktuelle 1RM", free: true, pro: true },
      { label: "Performance-Graphen & Trendanalyse", free: false, pro: true },
      { label: "PR Wall & persönliche Bestleistungen", free: false, pro: true },
      { label: "Strength Standards (Kraftklassen-Einordnung)", free: false, pro: true },
      { label: "IPF GL Score & Koeffizient-Tracking", free: true, pro: true },
    ],
  },
  {
    category: "Ernährung & Supplements",
    rows: [
      { label: "Wöchentlicher KI-Ernährungsplan (E-Mail)", free: false, pro: true },
      { label: "Makro-Kalkulator & Kalorienziel", free: false, pro: true },
      { label: "Evidenzbasierter Supplement-Stack (ISSN)", free: false, pro: true },
      { label: "Zielspezifische Supplement-Timing-Pläne", free: false, pro: true },
    ],
  },
  {
    category: "Community & Social",
    rows: [
      { label: "Challenges beitreten & Rangliste", free: true, pro: true },
      { label: "Eigene Challenges erstellen", free: false, pro: true },
      { label: "Head-to-Head Kraft-Duelle", free: false, pro: true },
      { label: "Früher Zugang zu neuen Features", free: false, pro: true },
    ],
  },
];

// ── Pro feature cards ────────────────────────────────────────────────────────
const PRO_FEATURES = [
  {
    icon: <Brain className="h-5 w-5 text-violet-400" />,
    title: "ATLAS KI-Coach",
    description: "Unbegrenzte Coaching-Sessions, personalisiert auf deine Trainingsdaten.",
    badge: "Beliebt",
    badgeColor: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  },
  {
    icon: <Dumbbell className="h-5 w-5 text-orange-400" />,
    title: "16-Wochen-Programm",
    description: "Alle 4 Wellen & alle 3 Trainingsziele: Powerlifting, Bodybuilding, Abnehmen.",
    badge: null,
    badgeColor: "",
  },
  {
    icon: <BarChart2 className="h-5 w-5 text-blue-400" />,
    title: "Advanced Analytics",
    description: "PR Wall, Strength Standards und Performance-Graphen für jeden Lift.",
    badge: null,
    badgeColor: "",
  },
  {
    icon: <UtensilsCrossed className="h-5 w-5 text-green-400" />,
    title: "Wöchentlicher Ernährungsplan",
    description: "KI-generierter Makroplan jeden Montag per E-Mail — auf dein Ziel abgestimmt.",
    badge: "Neu",
    badgeColor: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  {
    icon: <Star className="h-5 w-5 text-yellow-400" />,
    title: "Supplement-Stack",
    description: "Evidenzbasierte ISSN-Empfehlungen mit Timing, Dosierungen und Sicherheitshinweisen.",
    badge: null,
    badgeColor: "",
  },
  {
    icon: <Swords className="h-5 w-5 text-orange-400" />,
    title: "Challenges & Duelle",
    description: "Erstelle Challenges und starte Head-to-Head Kraft-Duelle gegen andere Athleten.",
    badge: null,
    badgeColor: "",
  },
];

export default function UpgradePage() {
  const { toast } = useToast();
  const [, navigate] = useHashLocation();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const { data: sub } = useSubscription();
  const isPro = !!sub?.isPro;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const hashSearch = window.location.hash.includes("?")
        ? new URLSearchParams(window.location.hash.split("?")[1])
        : null;
      const refCode =
        new URLSearchParams(window.location.search).get("ref") ??
        hashSearch?.get("ref") ??
        null;

      if (refCode) {
        try {
          await apiRequest("POST", "/api/referral/use", { referralCode: refCode });
        } catch {}
      }

      const res = await apiRequest("POST", "/api/subscription/checkout", { billingCycle });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Checkout fehlgeschlagen");
      }
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
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

  // Already Pro — redirect to settings
  if (isPro) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <MobileHeader title="GritIQ Pro" onBack={() => navigate("/settings")} backLabel="Einstellungen" />
        <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
          <div className="p-5 rounded-2xl bg-orange-500/10 border border-orange-500/20">
            <Crown className="h-10 w-10 text-orange-400" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display font-bold text-xl">Du bist bereits Pro!</h2>
            <p className="text-muted-foreground text-sm max-w-xs">
              Alle Pro-Features sind für dich freigeschaltet. Genieße unbegrenztes Training.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/settings")}
            className="gap-2"
            data-testid="button-goto-settings"
          >
            <ArrowRight className="h-4 w-4" />
            Abonnement verwalten
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-20">
      {/* Mobile header */}
      <MobileHeader title="GritIQ Pro" onBack={() => navigate(-1 as any)} backLabel="Zurück" />

      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-8">

        {/* ── Hero ── */}
        <div className="text-center space-y-3 pt-2 md:pt-6">
          <div className="flex justify-center">
            <div className="relative">
              <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                <Crown className="h-9 w-9 text-orange-400" />
              </div>
              <div className="absolute -top-1 -right-1">
                <span className="flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-40" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500" />
                </span>
              </div>
            </div>
          </div>
          <h1 className="font-display font-bold text-xl">
            Werde GritIQ Pro
          </h1>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
            Schalte alle Features frei — KI-Coach, vollständiges 16-Wochen-Programm, Analytics und wöchentliche Ernährungspläne.
          </p>
          {/* Referral nudge */}
          <div className="inline-flex items-center gap-1.5 text-xs text-orange-400/80 bg-orange-500/8 border border-orange-500/15 rounded-full px-3 py-1">
            <Gift className="h-3 w-3" />
            Freunde einladen = 30 Tage Pro gratis pro Conversion
          </div>
        </div>

        {/* ── Billing toggle + Pricing card ── */}
        <div className="space-y-3">
          {/* Toggle */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-1 p-1 rounded-full bg-secondary/60 border border-border">
              <button
                onClick={() => setBillingCycle("monthly")}
                data-testid="toggle-billing-monthly"
                className={cn(
                  "text-sm font-medium px-4 py-1.5 rounded-full transition-all duration-200",
                  billingCycle === "monthly"
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Monatlich
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                data-testid="toggle-billing-yearly"
                className={cn(
                  "text-sm font-medium px-4 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5",
                  billingCycle === "yearly"
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Jährlich
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0 font-bold">
                  −33%
                </Badge>
              </button>
            </div>
          </div>

          {/* Pricing card */}
          <div
            className="relative rounded-2xl border-2 border-orange-500/40 bg-gradient-to-br from-orange-500/8 via-transparent to-transparent p-5 overflow-hidden"
            data-testid="pricing-card"
          >
            {/* Glow accent */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              {/* Trial badge */}
              <div className="flex items-center justify-between mb-4">
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 font-bold">
                  GritIQ Pro
                </Badge>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs font-semibold">
                  ✓ 14 Tage gratis
                </Badge>
              </div>

              {/* Price */}
              <div className="flex items-end gap-1.5 mb-1">
                <span className="text-4xl font-bold font-display">
                  {billingCycle === "monthly" ? "9,99 €" : "6,66 €"}
                </span>
                <span className="text-muted-foreground text-sm mb-1.5">/Monat</span>
              </div>
              {billingCycle === "yearly" ? (
                <p className="text-xs text-green-400 mb-4">
                  79,99 €/Jahr · 2 Monate geschenkt · 33 % günstiger
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mb-4">
                  oder 79,99 €/Jahr — 2 Monate geschenkt
                </p>
              )}

              {/* Feature list */}
              <ul className="space-y-2 mb-5">
                {[
                  { icon: <Brain className="h-3.5 w-3.5 text-violet-400" />, text: "ATLAS KI-Coach — unbegrenzt" },
                  { icon: <Dumbbell className="h-3.5 w-3.5 text-orange-400" />, text: "Alle 3 Ziele · 16-Wochen-Programm" },
                  { icon: <BarChart2 className="h-3.5 w-3.5 text-blue-400" />, text: "PR Wall & vollständige Analytics" },
                  { icon: <UtensilsCrossed className="h-3.5 w-3.5 text-green-400" />, text: "Wöchentlicher KI-Ernährungsplan" },
                  { icon: <Star className="h-3.5 w-3.5 text-yellow-400" />, text: "Evidenzbasierter Supplement-Stack" },
                  { icon: <Sparkles className="h-3.5 w-3.5 text-orange-400" />, text: "Früher Zugang zu neuen Features" },
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm">
                    {f.icon}
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 text-base rounded-xl shadow-lg shadow-orange-500/20"
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                data-testid="button-checkout-upgrade"
              >
                {checkoutMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Weiterleitung zu Stripe...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    14 Tage kostenlos starten
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </span>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground mt-2.5">
                14 Tage kostenlos · Keine Kreditkarte nötig · Jederzeit kündbar
              </p>
            </div>
          </div>
        </div>

        {/* ── Referral alternative ── */}
        <div
          className="rounded-xl border border-dashed border-orange-500/25 bg-orange-500/4 p-4 flex items-start gap-3 cursor-pointer hover:border-orange-500/40 transition-colors"
          onClick={() => navigate("/invite")}
          data-testid="card-referral-alternative"
        >
          <div className="p-2 rounded-lg bg-orange-500/10 flex-shrink-0">
            <Gift className="h-4 w-4 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Kein Geld ausgeben?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lade 1 Freund ein und erhalte 30 Tage GritIQ Pro gratis. Für jeden weiteren Freund nochmal 30 Tage.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        </div>

        {/* ── Pro feature cards ── */}
        <div className="space-y-3">
          <h2 className="font-display font-bold text-base">Was du freischaltest</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRO_FEATURES.map((f, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-4 space-y-2"
                data-testid={`feature-card-${i}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="p-2 rounded-lg bg-secondary/60 flex-shrink-0">
                    {f.icon}
                  </div>
                  {f.badge && (
                    <Badge className={cn("text-[10px] font-bold px-1.5 py-0 flex-shrink-0", f.badgeColor)}>
                      {f.badge}
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold font-display">{f.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Full comparison table ── */}
        <div className="space-y-3">
          <h2 className="font-display font-bold text-base">Free vs. Pro im Vergleich</h2>
          <div className="rounded-xl border border-border overflow-hidden text-xs" data-testid="full-comparison-table">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto] bg-secondary/50 px-4 py-3">
              <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Feature</span>
              <span className="text-center font-semibold text-muted-foreground text-xs uppercase tracking-wider w-14">Free</span>
              <span className="text-center font-semibold text-orange-400 text-xs uppercase tracking-wider w-14">Pro</span>
            </div>

            {COMPARISON.map((section) => (
              <div key={section.category}>
                {/* Section header */}
                <div className="px-4 py-2 bg-secondary/25 font-semibold text-muted-foreground/60 uppercase tracking-widest text-[10px] border-t border-border">
                  {section.category}
                </div>
                {section.rows.map((row, i) => (
                  <div
                    key={i}
                    className={cn(
                      "grid grid-cols-[1fr_auto_auto] px-4 py-2.5 items-center border-t border-border/40",
                      !row.free && row.pro && "bg-orange-500/3"
                    )}
                  >
                    <span className="text-foreground/80 leading-tight pr-3">{row.label}</span>
                    <span className="flex justify-center w-14">
                      {row.free ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted-foreground/35" />
                      )}
                    </span>
                    <span className="flex justify-center w-14">
                      {row.pro ? (
                        <Check className="h-3.5 w-3.5 text-orange-400" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted-foreground/35" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom CTA ── */}
        <div className="space-y-3 pb-4">
          <Button
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold h-12 text-base rounded-xl shadow-lg shadow-orange-500/20"
            onClick={() => checkoutMutation.mutate()}
            disabled={checkoutMutation.isPending}
            data-testid="button-checkout-bottom"
          >
            {checkoutMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Weiterleitung...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Jetzt Pro werden — 14 Tage gratis
              </span>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Keine Kreditkarte nötig im Test · Jederzeit kündbar · Sicher via Stripe
          </p>
        </div>

      </div>
    </div>
  );
}
