import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useReferral } from "@/hooks/useReferral";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Gift, Users, Clock, Share2, ChevronDown, ChevronUp } from "lucide-react";

export function ReferralCard() {
  const { data, isLoading } = useReferral();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function copyLink() {
    if (!data?.referralUrl) return;
    try {
      await navigator.clipboard.writeText(data.referralUrl);
      setCopied(true);
      toast({ title: "Link kopiert ✓", description: "Teile ihn mit Freunden für 30 Tage Pro!" });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API blocked (e.g. sandboxed iFrame) — show URL for manual copy
      toast({
        title: "Link manuell kopieren",
        description: data.referralUrl,
        duration: 8000,
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  async function shareLink() {
    if (!data) return;
    if (navigator.share) {
      await navigator.share({
        title: "GritIQ – Dein KI-Kraft-Tracker",
        text: `Ich trainiere mit GritIQ. Tritt mit meinem Link bei und wir bekommen beide 30 Tage Pro gratis!`,
        url: data.referralUrl,
      }).catch(() => {});
    } else {
      copyLink();
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-3" />
        <div className="h-10 bg-muted rounded mb-2" />
        <div className="h-8 bg-muted rounded" />
      </div>
    );
  }

  if (!data) return null;

  const hasActivity = data.pending > 0 || data.rewarded > 0;

  return (
    <div className="rounded-xl border border-orange-500/20 bg-card overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-orange-400" />
            <span className="font-display font-bold text-sm">Freunde einladen</span>
          </div>
          {data.rewarded > 0 && (
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
              +{data.bonusDaysEarned} Tage verdient
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Für jede erfolgreiche Einladung bekommst du <strong className="text-foreground">30 Tage Pro gratis</strong>.
        </p>
      </div>

      {/* Code display + copy button */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 rounded-lg bg-muted/60 border border-border px-3 py-2 mb-2">
          <span className="font-mono font-bold text-sm tracking-widest text-orange-400 flex-1 select-all">
            {data.code}
          </span>
          <button
            onClick={copyLink}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1"
            title="Code kopieren"
          >
            {copied
              ? <Check className="h-4 w-4 text-green-400" />
              : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
            onClick={copyLink}
            data-testid="button-copy-referral-link"
          >
            {copied ? <Check className="h-3 w-3 mr-1.5" /> : <Copy className="h-3 w-3 mr-1.5" />}
            {copied ? "Kopiert!" : "Link kopieren"}
          </Button>
          <Button
            size="sm"
            className="flex-1 h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white"
            onClick={shareLink}
            data-testid="button-share-referral"
          >
            <Share2 className="h-3 w-3 mr-1.5" />
            Teilen
          </Button>
        </div>
      </div>

      {/* Stats row */}
      {hasActivity && (
        <>
          <div className="border-t border-border/60 px-4 py-2.5">
            <button
              className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setExpanded(!expanded)}
              data-testid="button-referral-expand"
            >
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-yellow-500" />
                  <span className="text-yellow-500 font-medium">{data.pending} ausstehend</span>
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-green-400" />
                  <span className="text-green-400 font-medium">{data.rewarded} belohnt</span>
                </span>
              </span>
              {expanded
                ? <ChevronUp className="h-3 w-3" />
                : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          {expanded && (
            <div className="border-t border-border/40 px-4 py-3 bg-muted/20 space-y-2">
              <ReferralStatRow
                icon={<Clock className="h-3.5 w-3.5 text-yellow-500" />}
                label="Einladungen angenommen (Zahlung ausstehend)"
                value={data.pending}
                color="text-yellow-500"
              />
              <ReferralStatRow
                icon={<Check className="h-3.5 w-3.5 text-green-400" />}
                label="Konvertiert – Bonus gutgeschrieben"
                value={data.rewarded}
                color="text-green-400"
              />
              <ReferralStatRow
                icon={<Gift className="h-3.5 w-3.5 text-orange-400" />}
                label="Gesamt-Bonustage verdient"
                value={`${data.bonusDaysEarned} Tage`}
                color="text-orange-400"
              />
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!hasActivity && (
        <div className="border-t border-border/40 px-4 py-2.5">
          <p className="text-xs text-muted-foreground text-center">
            Noch keine Einladungen — teile deinen Link und verdiene 30 Tage Pro pro Freund 🎯
          </p>
        </div>
      )}
    </div>
  );
}

function ReferralStatRow({
  icon, label, value, color
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className={`text-xs font-bold ${color}`}>{value}</span>
    </div>
  );
}
