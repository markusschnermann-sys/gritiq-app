/**
 * Einladen (Invite Friends) Page
 * Route: /#/invite
 *
 * Shows:
 *  - Referral code + one-tap share (WhatsApp, SMS, native share, clipboard)
 *  - Bonus Pro days earned so far
 *  - Tier progress bar toward next reward milestone
 *  - Recent activity feed
 */
import { useState, useCallback } from "react";
import { useReferral } from "@/hooks/useReferral";
import type { ReferralTier } from "@/hooks/useReferral";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import MobileHeader from "@/components/MobileHeader";
import {
  Gift, Copy, Check, Share2, MessageCircle, Phone,
  Trophy, Zap, Users, Clock, ChevronRight, Star,
  Sparkles,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────
const APP_URL = "https://www.perplexity.ai/computer/a/gritiq-kraft-tracker-o6hBGiG0TfefyYrNLKzJGw";

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "Kürzlich";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 2)   return "Gerade eben";
  if (mins < 60)  return `vor ${mins} Min.`;
  if (hours < 24) return `vor ${hours} Std.`;
  if (days < 7)   return `vor ${days} Tag${days === 1 ? "" : "en"}`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}

// Tier color palette
function tierColor(id: string) {
  switch (id) {
    case "bronze":  return { bg: "bg-amber-700/20",  border: "border-amber-700/40",  text: "text-amber-600",  fill: "#b45309" };
    case "silver":  return { bg: "bg-slate-400/20",  border: "border-slate-400/40",  text: "text-slate-300",  fill: "#94a3b8" };
    case "gold":    return { bg: "bg-yellow-500/20", border: "border-yellow-500/40", text: "text-yellow-400", fill: "#eab308" };
    case "diamond": return { bg: "bg-cyan-400/20",   border: "border-cyan-400/40",   text: "text-cyan-300",   fill: "#22d3ee" };
    default:        return { bg: "bg-muted",          border: "border-border",         text: "text-muted-foreground", fill: "#6b7280" };
  }
}

// ── Tier badge ────────────────────────────────────────────────────────────────
function TierBadge({ tier, active }: { tier: ReferralTier; active: boolean }) {
  const c = tierColor(tier.id);
  return (
    <div className={`rounded-lg border px-3 py-2 text-center transition-all ${
      active
        ? `${c.bg} ${c.border} scale-105 shadow-sm`
        : "bg-card border-border opacity-40"
    }`}>
      <span className="text-2xl block leading-none mb-1">{tier.emoji}</span>
      <p className={`text-xs font-display font-bold ${active ? c.text : "text-muted-foreground"}`}>
        {tier.label}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">
        {tier.requiredConversions} Freund{tier.requiredConversions !== 1 ? "e" : ""}
      </p>
    </div>
  );
}

// ── Animated progress bar ─────────────────────────────────────────────────────
function TierProgressBar({
  pct, currentTierId, nextTierId,
}: { pct: number; currentTierId?: string; nextTierId?: string }) {
  const c = nextTierId ? tierColor(nextTierId) : tierColor(currentTierId ?? "bronze");
  return (
    <div className="relative h-3 rounded-full bg-border overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${tierColor(currentTierId ?? "bronze").fill}99, ${c.fill})`,
        }}
      />
      {/* Shimmer */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)",
          animation: pct > 0 ? "shimmer 2s infinite" : "none",
        }}
      />
    </div>
  );
}

// ── Share sheet ───────────────────────────────────────────────────────────────
function ShareSheet({ referralUrl, code, onClose }: {
  referralUrl: string;
  code: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const message = encodeURIComponent(
    `Hey! Ich trainiere mit GritIQ – dem KI-Kraft-Tracker. Tritt mit meinem Link bei und wir bekommen beide 30 Tage Pro gratis! 💪\n\n${referralUrl}`
  );

  const actions = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: "💬",
      color: "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20",
      action: () => {
        window.open(`https://wa.me/?text=${message}`, "_blank");
        onClose();
      },
    },
    {
      id: "sms",
      label: "SMS",
      icon: "📱",
      color: "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20",
      action: () => {
        window.open(`sms:?body=${message}`, "_blank");
        onClose();
      },
    },
    {
      id: "native",
      label: navigator.share ? "Teilen..." : "Kopieren",
      icon: navigator.share ? "↑" : "📋",
      color: "bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20",
      action: async () => {
        if (navigator.share) {
          try {
            await navigator.share({
              title: "GritIQ – KI-Kraft-Tracker",
              text: "30 Tage Pro gratis – komm ins Team!",
              url: referralUrl,
            });
          } catch { /* cancelled */ }
        } else {
          await copyToClipboard(referralUrl);
        }
        onClose();
      },
    },
  ];

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link kopiert ✓" });
    } catch {
      toast({ title: "Link manuell kopieren", description: text, duration: 8000 });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-md rounded-t-2xl bg-card border-t border-border px-5 pt-4 pb-8 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />

        <h3 className="font-display font-bold text-base mb-1">Freund einladen</h3>
        <p className="text-xs text-muted-foreground mb-5">
          Wähle, wie du deinen Link teilen möchtest:
        </p>

        {/* Share options */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {actions.map(a => (
            <button
              key={a.id}
              onClick={a.action}
              className={`flex flex-col items-center gap-2 rounded-xl border py-4 transition-all active:scale-95 ${a.color}`}
            >
              <span className="text-2xl leading-none">{a.icon}</span>
              <span className="text-xs font-semibold">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Code display */}
        <div className="rounded-xl bg-muted/60 border border-border px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Dein Code</p>
            <p className="font-mono font-bold text-sm tracking-widest text-orange-400 truncate">{code}</p>
          </div>
          <button
            onClick={() => copyToClipboard(referralUrl)}
            className="flex-shrink-0 p-2 rounded-lg hover:bg-border transition-colors"
          >
            {copied
              ? <Check size={16} className="text-green-400" />
              : <Copy size={16} className="text-muted-foreground" />}
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-3">
          Dein Freund bekommt 14 Tage gratis · Du bekommst 30 Tage Pro
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function InvitePage() {
  const { data, isLoading } = useReferral();
  const { toast } = useToast();
  const [showSheet, setShowSheet] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCode = useCallback(async () => {
    if (!data?.referralUrl) return;
    try {
      await navigator.clipboard.writeText(data.referralUrl);
      setCopied(true);
      toast({ title: "Link kopiert ✓", description: "30 Tage Pro für dich und deinen Freund!" });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: "Link manuell kopieren", description: data.referralUrl, duration: 8000 });
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [data, toast]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <MobileHeader title="Freunde einladen" />
        <div className="p-4 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="h-12 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const {
    code, referralUrl, pending, rewarded, bonusDaysEarned,
    tiers, currentTier, nextTier, progressPct, conversionsUntilNext,
    recentRewarded,
  } = data;

  const isMaxTier = !nextTier;

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-24">
      <MobileHeader title="Freunde einladen" />

      <div className="p-4 max-w-lg mx-auto w-full space-y-4">

        {/* ── Hero card ── */}
        <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/8 to-orange-500/3 overflow-hidden">
          {/* Top strip */}
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Gift size={18} className="text-orange-400" />
                  <h2 className="font-display font-bold text-base">Freunde einladen</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Du bekommst <strong className="text-foreground">30 Tage Pro</strong> für jeden Freund,
                  der sich anmeldet und ein Abo startet.
                </p>
              </div>
              {bonusDaysEarned > 0 && (
                <div className="flex-shrink-0 rounded-xl bg-orange-500/20 border border-orange-500/30 px-3 py-2 text-center">
                  <p className="text-xl font-display font-bold text-orange-400 leading-none">{bonusDaysEarned}</p>
                  <p className="text-[10px] text-orange-300/80 mt-0.5">Tage<br/>verdient</p>
                </div>
              )}
            </div>

            {/* Code pill */}
            <div className="flex items-center gap-2 rounded-xl bg-black/30 border border-orange-500/20 px-4 py-3 mb-3">
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Dein Code</p>
                <p className="font-mono font-bold text-lg tracking-[0.15em] text-orange-400 select-all">{code}</p>
              </div>
              <button
                onClick={copyCode}
                className="p-2 rounded-lg hover:bg-border transition-colors flex-shrink-0"
                aria-label="Link kopieren"
              >
                {copied
                  ? <Check size={18} className="text-green-400" />
                  : <Copy size={18} className="text-muted-foreground" />
                }
              </button>
            </div>

            {/* Share button */}
            <Button
              className="w-full h-11 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-transform"
              onClick={() => setShowSheet(true)}
            >
              <Share2 size={16} className="mr-2" />
              Jetzt teilen
              <ChevronRight size={14} className="ml-auto opacity-70" />
            </Button>
          </div>

          {/* Stats strip */}
          {(pending > 0 || rewarded > 0) && (
            <div className="border-t border-orange-500/15 px-5 py-3 flex items-center gap-6">
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-yellow-500" />
                <span className="text-xs">
                  <span className="font-semibold text-yellow-500">{pending}</span>
                  <span className="text-muted-foreground"> ausstehend</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users size={13} className="text-green-400" />
                <span className="text-xs">
                  <span className="font-semibold text-green-400">{rewarded}</span>
                  <span className="text-muted-foreground"> konvertiert</span>
                </span>
              </div>
              {bonusDaysEarned > 0 && (
                <div className="flex items-center gap-1.5">
                  <Zap size={13} className="text-orange-400" />
                  <span className="text-xs">
                    <span className="font-semibold text-orange-400">{bonusDaysEarned}d</span>
                    <span className="text-muted-foreground"> Pro verdient</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Tier progress ── */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Trophy size={15} className="text-orange-400" />
            <p className="text-sm font-display font-semibold">Belohnungs-Stufen</p>
            {currentTier && (
              <Badge className={`ml-auto text-[10px] px-2 py-0.5 ${tierColor(currentTier.id).bg} ${tierColor(currentTier.id).border} ${tierColor(currentTier.id).text}`}>
                {currentTier.emoji} {currentTier.label}
              </Badge>
            )}
          </div>

          {/* Tier icons row */}
          <div className="grid grid-cols-4 gap-2">
            {tiers.map(tier => (
              <TierBadge
                key={tier.id}
                tier={tier}
                active={rewarded >= tier.requiredConversions}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {rewarded} / {nextTier?.requiredConversions ?? tiers[tiers.length - 1].requiredConversions} Konversionen
              </span>
              {!isMaxTier ? (
                <span className={tierColor(nextTier!.id).text + " font-semibold"}>
                  Nächste: {nextTier!.emoji} {nextTier!.label}
                </span>
              ) : (
                <span className="text-cyan-300 font-semibold flex items-center gap-1">
                  <Sparkles size={11} /> Max. Stufe erreicht!
                </span>
              )}
            </div>

            <TierProgressBar
              pct={progressPct}
              currentTierId={currentTier?.id}
              nextTierId={nextTier?.id}
            />

            {!isMaxTier && (
              <p className="text-xs text-muted-foreground">
                Noch{" "}
                <strong className={tierColor(nextTier!.id).text}>
                  {conversionsUntilNext} Freund{conversionsUntilNext !== 1 ? "e" : ""}
                </strong>
                {" "}bis {nextTier!.emoji} {nextTier!.label} (+{nextTier!.bonusDays} Tage gesamt)
              </p>
            )}
          </div>
        </div>

        {/* ── How it works ── */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-display font-semibold flex items-center gap-2">
            <Star size={14} className="text-orange-400" />
            So funktioniert es
          </p>
          <div className="space-y-3">
            {[
              {
                num: "1", icon: <Share2 size={14} className="text-orange-400" />,
                title: "Link teilen",
                desc: "Schick deinen persönlichen Einladungslink per WhatsApp, SMS oder teile ihn direkt.",
              },
              {
                num: "2", icon: <Users size={14} className="text-blue-400" />,
                title: "Freund registriert sich",
                desc: "Dein Freund öffnet den Link, legt ein Konto an und startet die 14-tägige Testphase.",
              },
              {
                num: "3", icon: <Zap size={14} className="text-green-400" />,
                title: "Ihr bekommt beide Pro",
                desc: "Sobald dein Freund ein Abo abschließt, werden dir automatisch 30 Tage Pro gutgeschrieben.",
              },
            ].map(step => (
              <div key={step.num} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-orange-400">{step.num}</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {step.icon}
                    <p className="text-xs font-semibold">{step.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Recent activity ── */}
        {recentRewarded.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-display font-semibold flex items-center gap-2">
              <Zap size={14} className="text-green-400" />
              Letzte Belohnungen
            </p>
            <div className="space-y-2">
              {recentRewarded.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                      <Check size={11} className="text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">Freund konvertiert</p>
                      <p className="text-[10px] text-muted-foreground">{fmtRelative(r.rewardedAt)}</p>
                    </div>
                  </div>
                  <Badge className="bg-green-500/15 text-green-400 border-green-500/25 text-[10px] px-2">
                    +{r.bonusDays}d Pro
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Empty state (no activity yet) ── */}
        {rewarded === 0 && pending === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center space-y-2">
            <Gift size={28} className="text-muted-foreground/50 mx-auto" />
            <p className="text-sm font-medium text-muted-foreground">Noch keine Einladungen</p>
            <p className="text-xs text-muted-foreground/70">
              Teile deinen Link und verdiene 30 Tage Pro pro Freund. Je mehr du einlädst, desto höher die Stufe.
            </p>
            <Button
              size="sm"
              className="mt-2 bg-orange-500 hover:bg-orange-600 text-white text-xs h-8"
              onClick={() => setShowSheet(true)}
            >
              <Share2 size={12} className="mr-1.5" />
              Erste Einladung senden
            </Button>
          </div>
        )}

        {/* Quick share shortcuts (persistent bottom row) */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => {
              const msg = encodeURIComponent(
                `Hey! Ich trainiere mit GritIQ. Tritt mit meinem Link bei – wir bekommen beide 30 Tage Pro gratis 💪\n\n${referralUrl}`
              );
              window.open(`https://wa.me/?text=${msg}`, "_blank");
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 py-3 text-sm font-semibold hover:bg-green-500/20 transition-colors active:scale-[0.97]"
          >
            <MessageCircle size={16} />
            WhatsApp
          </button>
          <button
            onClick={() => {
              const msg = encodeURIComponent(
                `Hey! Ich trainiere mit GritIQ – 30 Tage Pro gratis für dich: ${referralUrl}`
              );
              window.open(`sms:?body=${msg}`, "_blank");
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 py-3 text-sm font-semibold hover:bg-blue-500/20 transition-colors active:scale-[0.97]"
          >
            <Phone size={16} />
            SMS
          </button>
        </div>

      </div>

      {/* Share sheet overlay */}
      {showSheet && (
        <ShareSheet
          referralUrl={referralUrl}
          code={code}
          onClose={() => setShowSheet(false)}
        />
      )}
    </div>
  );
}
