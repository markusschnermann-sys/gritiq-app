/**
 * H2H — Head-to-Head Strength Challenge page
 * Allows athletes to challenge each other to 4-week coefficient improvement duels.
 */
import { useState, useSyncExternalStore } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getState, subscribe } from "@/lib/authStore";
import {
  Swords, Trophy, Clock, CheckCircle2, XCircle, TrendingUp, TrendingDown,
  ChevronRight, User, BarChart2, Camera, Crown, Minus, AlertCircle, Plus,
  MessageCircle, Zap, Flame, ChevronDown, ChevronUp as ChevronUpIcon, Bell, BellOff, Lock,
} from "lucide-react";
import MobileHeader from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/UpgradeModal";
import { ProBadge } from "@/components/ProGate";
import type { User as UserType } from "@shared/schema";

// ── Preset comebacks ─────────────────────────────────────────────────────────
const COMEBACKS = [
  "Das war nur Aufwärmen — jetzt fange ich erst an! 🔥",
  "Genieße die Sicht von vorne, es wird nicht lange dauern. 😈",
  "Meine Bestleistungen kommen erst in Woche 3. Geduld! 💪",
  "Der Hase schläft — und ich bin die Schildkröte. 🐢",
  "Dein Vorsprung macht mich nur wütender. Danke! 🤬",
  "Ich traile absichtlich — macht das Comeback epischer. ⚡",
  "Spar dich für die Feier — du wirst sie brauchen. 🍾",
  "Koeffizient oder nicht, ich pull mehr als du dir träumst. 🏋️",
];

// ── H2H Event type ────────────────────────────────────────────────────────────
type H2hEvent = {
  id: number;
  challengeId: number;
  fromUserId: number | null;
  toUserId: number | null;
  type: "taunt" | "reaction" | "milestone";
  message: string;
  readAt: string | null;
  createdAt: string;
};

// ── Types ──────────────────────────────────────────────────────────────────────
type LeaderboardEntry = {
  rank: number;
  userId: number | null;
  displayName: string | null;
  isMe: boolean;
  isAnonymous: boolean;
  score: number;
  totalKg: number;
};

type H2hChallenge = {
  id: number;
  challengerId: number;
  opponentId: number;
  challengerName: string;
  opponentName: string;
  metric: "wilks2" | "ipfgl";
  status: "pending" | "active" | "completed" | "declined";
  startDate: string | null;
  endDate: string | null;
  currentWeek: number;
  isChallenger: boolean;
  myDelta: number;
  theirDelta: number;
  challengerDelta: number;
  opponentDelta: number;
  challengerWeekly: (number | null)[];
  opponentWeekly: (number | null)[];
  challengerBaseline: any;
  opponentBaseline: any;
  challengerLatest: any;
  opponentLatest: any;
  winnerId: number | null;
  winnerName: string | null;
  createdAt: string;
  completedAt: string | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const METRIC_LABEL: Record<string, string> = {
  wilks2: "Wilks 2",
  ipfgl: "IPF GL",
};

function deltaColor(d: number) {
  if (d > 0) return "text-green-400";
  if (d < 0) return "text-red-400";
  return "text-muted-foreground";
}

function deltaIcon(d: number) {
  if (d > 0) return <TrendingUp size={13} className="text-green-400" />;
  if (d < 0) return <TrendingDown size={13} className="text-red-400" />;
  return <Minus size={13} className="text-muted-foreground" />;
}

function formatDelta(d: number) {
  return d === 0 ? "±0%" : `${d > 0 ? "+" : ""}${d}%`;
}

function daysLeft(end: string | null): number {
  if (!end) return 0;
  return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000));
}

function statusBadge(status: H2hChallenge["status"]) {
  const MAP: Record<string, { label: string; class: string }> = {
    pending:   { label: "Ausstehend",  class: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    active:    { label: "Aktiv",       class: "bg-green-500/20 text-green-400 border-green-500/30" },
    completed: { label: "Abgeschlossen", class: "bg-primary/20 text-primary border-primary/30" },
    declined:  { label: "Abgelehnt",   class: "bg-muted text-muted-foreground border-border" },
  };
  const m = MAP[status] ?? MAP.declined;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${m.class}`}>
      {m.label}
    </span>
  );
}

// ── Week Progress Bar ─────────────────────────────────────────────────────────
function WeekBar({ weekly, currentWeek }: { weekly: (number | null)[]; currentWeek: number }) {
  return (
    <div className="flex gap-1 items-end h-8">
      {[1, 2, 3, 4].map((w) => {
        const val = weekly[w - 1];
        const isDone = w <= currentWeek;
        const hasData = val !== null && val !== undefined;
        const pct = hasData ? Math.min(100, Math.max(0, val! + 5) * 10) : 0;
        return (
          <div key={w} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full bg-muted rounded-sm overflow-hidden" style={{ height: 24 }}>
              <div
                className={`w-full rounded-sm transition-all duration-500 ${
                  hasData && val! > 0 ? "bg-green-500/70" :
                  hasData && val! < 0 ? "bg-red-500/70" :
                  isDone ? "bg-primary/30" : "bg-border/30"
                }`}
                style={{ height: hasData ? `${Math.max(10, pct)}%` : isDone ? "30%" : "10%" }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground">W{w}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── H2H Card ──────────────────────────────────────────────────────────────────
// ── Event Feed ───────────────────────────────────────────────────────────────
function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade";
  if (mins < 60) return `vor ${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `vor ${h}h`;
  return `vor ${Math.floor(h / 24)}d`;
}

function EventBubble({ event, myId }: { event: H2hEvent; myId: number }) {
  const isFromMe = event.fromUserId === myId;
  const isTaunt = event.type === "taunt";
  const isReaction = event.type === "reaction";
  const isMilestone = event.type === "milestone";

  if (isMilestone) {
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="flex-1 border-t border-border/30" />
        <span className="text-[10px] text-muted-foreground/60 text-center px-2 shrink-0">{event.message}</span>
        <div className="flex-1 border-t border-border/30" />
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isFromMe ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
        isFromMe ? "bg-primary/20" : isTaunt ? "bg-red-500/20" : "bg-muted"
      }`}>
        {isTaunt ? <Flame size={11} className="text-red-400" /> :
         isReaction ? <Zap size={11} className="text-yellow-400" /> :
         <MessageCircle size={11} className="text-muted-foreground" />}
      </div>
      <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
        isFromMe
          ? "bg-primary/15 border border-primary/20"
          : isTaunt
          ? "bg-red-500/10 border border-red-500/20"
          : "bg-muted border border-border/40"
      }`}>
        <p className="text-xs text-foreground leading-relaxed">{event.message}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgoShort(event.createdAt)}</p>
      </div>
    </div>
  );
}

function EventFeed({ challengeId, myId, isTrailing }: { challengeId: number; myId: number; isTrailing: boolean }) {
  const [open, setOpen] = useState(false);
  const [showReact, setShowReact] = useState(false);
  const { toast } = useToast();

  const { data: events = [], refetch } = useQuery<H2hEvent[]>({
    queryKey: ["/api/h2h", challengeId, "events"],
    queryFn: async () => {
      const { authFetch } = await import("@/lib/authStore");
      const r = await authFetch(`/api/h2h/${challengeId}/events`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 15_000,
    enabled: open,
  });

  const unreadCount = events.filter(e => e.toUserId === myId && !e.readAt && e.type !== "milestone").length;

  const react = useMutation({
    mutationFn: async (message: string) => {
      const r = await apiRequest("POST", `/api/h2h/${challengeId}/react`, { message });
      if (!r.ok) throw new Error("Fehler");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/h2h", challengeId, "events"] });
      refetch();
      setShowReact(false);
      toast({ title: "Comeback gesendet 💬" });
    },
    onError: () => toast({ title: "Fehler beim Senden", variant: "destructive" }),
  });

  return (
    <div className="border-t border-border/40 pt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-1 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <MessageCircle size={12} />
          <span>Trash-Talk & Events</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        {open ? <ChevronUpIcon size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="space-y-2 mt-2">
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">
                Noch keine Events. Snapshot erfassen um Trash-Talk auszulösen!
              </p>
            ) : (
              events.map(e => <EventBubble key={e.id} event={e} myId={myId} />)
            )}
          </div>

          {!showReact ? (
            <button
              onClick={() => setShowReact(true)}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary border border-dashed border-border hover:border-primary/40 rounded-lg py-2 transition-all"
            >
              <Zap size={11} />
              {isTrailing ? "Comeback abfeuern" : "Antwort senden"}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground font-medium">Wähle dein Comeback:</p>
              <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1">
                {COMEBACKS.map((cb, i) => (
                  <button
                    key={i}
                    onClick={() => react.mutate(cb)}
                    disabled={react.isPending}
                    className="text-left text-xs bg-muted hover:bg-muted/70 border border-border hover:border-primary/30 rounded-lg px-3 py-2 transition-all"
                  >
                    {cb}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowReact(false)}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function H2hCard({
  challenge,
  onAccept,
  onDecline,
  onSnapshot,
  accepting,
  declining,
  snapshotting,
  myId,
}: {
  challenge: H2hChallenge;
  onAccept: (id: number) => void;
  onDecline: (id: number) => void;
  onSnapshot: (id: number) => void;
  accepting: boolean;
  declining: boolean;
  snapshotting: boolean;
  myId: number;
}) {
  const myName = challenge.isChallenger ? challenge.challengerName : challenge.opponentName;
  const theirName = challenge.isChallenger ? challenge.opponentName : challenge.challengerName;
  const myWeekly = challenge.isChallenger ? challenge.challengerWeekly : challenge.opponentWeekly;
  const theirWeekly = challenge.isChallenger ? challenge.opponentWeekly : challenge.challengerWeekly;
  const isWinner = challenge.winnerId !== null &&
    ((challenge.isChallenger && challenge.winnerId === challenge.challengerId) ||
     (!challenge.isChallenger && challenge.winnerId === challenge.opponentId));

  return (
    <div className={`rounded-xl border bg-card overflow-hidden ${
      challenge.status === "active" ? "border-primary/30" :
      challenge.status === "completed" ? "border-border" : "border-border/50"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-2">
          <Swords size={14} className="text-primary flex-shrink-0" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Duell · {METRIC_LABEL[challenge.metric]}
          </span>
        </div>
        {statusBadge(challenge.status)}
      </div>

      <div className="p-4 space-y-3">
        {/* VS block */}
        <div className="flex items-center gap-3">
          {/* Me */}
          <div className="flex-1 text-center space-y-0.5">
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User size={14} className="text-primary" />
              </div>
            </div>
            <p className="text-xs font-semibold text-foreground truncate">{myName}</p>
            <p className="text-xs text-muted-foreground">(Du)</p>
            {challenge.status !== "pending" && (
              <div className={`text-sm font-bold tabular-nums ${deltaColor(challenge.myDelta)}`}>
                {formatDelta(challenge.myDelta)}
              </div>
            )}
          </div>

          {/* VS divider */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <span className="text-lg font-black text-muted-foreground/50">VS</span>
            {challenge.status === "active" && (
              <span className="text-[10px] text-muted-foreground">W{challenge.currentWeek}/4</span>
            )}
          </div>

          {/* Opponent */}
          <div className="flex-1 text-center space-y-0.5">
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <User size={14} className="text-muted-foreground" />
              </div>
            </div>
            <p className="text-xs font-semibold text-foreground truncate">{theirName}</p>
            <p className="text-xs text-muted-foreground">Gegner</p>
            {challenge.status !== "pending" && (
              <div className={`text-sm font-bold tabular-nums ${deltaColor(challenge.theirDelta)}`}>
                {formatDelta(challenge.theirDelta)}
              </div>
            )}
          </div>
        </div>

        {/* Progress bars — only when active/completed */}
        {(challenge.status === "active" || challenge.status === "completed") && (
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/40">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Dein Fortschritt</p>
              <WeekBar weekly={myWeekly} currentWeek={challenge.currentWeek} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Gegner</p>
              <WeekBar weekly={theirWeekly} currentWeek={challenge.currentWeek} />
            </div>
          </div>
        )}

        {/* Winner banner */}
        {challenge.status === "completed" && challenge.winnerName && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
            isWinner ? "bg-primary/10 border border-primary/30" : "bg-muted border border-border"
          }`}>
            <Crown size={14} className={isWinner ? "text-yellow-400" : "text-muted-foreground"} />
            <p className={`text-xs font-semibold ${isWinner ? "text-primary" : "text-muted-foreground"}`}>
              {isWinner ? "Du hast gewonnen! 🎉" : `${challenge.winnerName} gewinnt`}
            </p>
          </div>
        )}

        {/* Active info */}
        {challenge.status === "active" && challenge.endDate && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={11} />
            <span>Noch {daysLeft(challenge.endDate)} Tage</span>
          </div>
        )}

        {/* Actions */}
        {/* Pending — opponent sees accept/decline */}
        {challenge.status === "pending" && !challenge.isChallenger && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 text-xs h-8"
              onClick={() => onAccept(challenge.id)}
              disabled={accepting}
            >
              <CheckCircle2 size={12} className="mr-1" />
              Annehmen
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs h-8"
              onClick={() => onDecline(challenge.id)}
              disabled={declining}
            >
              <XCircle size={12} className="mr-1" />
              Ablehnen
            </Button>
          </div>
        )}

        {/* Pending — challenger waits */}
        {challenge.status === "pending" && challenge.isChallenger && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            <Clock size={12} />
            <span>Warte auf Antwort von {theirName}…</span>
          </div>
        )}

        {/* Event feed with trash-talk + reactions — only for active/completed */}
        {(challenge.status === "active" || challenge.status === "completed") && (
          <EventFeed
            challengeId={challenge.id}
            myId={myId}
            isTrailing={challenge.myDelta < challenge.theirDelta}
          />
        )}

        {/* Active — snapshot button */}
        {challenge.status === "active" && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs h-8"
            onClick={() => onSnapshot(challenge.id)}
            disabled={snapshotting}
          >
            <Camera size={12} className="mr-1.5" />
            {snapshotting ? "Wird gespeichert…" : "Fortschritt jetzt erfassen"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Challenge Invite Modal ─────────────────────────────────────────────────────
function InviteModal({
  entries,
  onSend,
  onClose,
  sending,
}: {
  entries: LeaderboardEntry[];
  onSend: (opponentId: number, metric: string) => void;
  onClose: () => void;
  sending: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [metric, setMetric] = useState<"wilks2" | "ipfgl">("wilks2");
  const opponents = entries.filter(e => !e.isMe && !e.isAnonymous && e.userId !== null);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm space-y-4 p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords size={16} className="text-primary" />
            <p className="font-display font-bold text-sm text-foreground">Duell starten</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <XCircle size={18} />
          </button>
        </div>

        {/* Metric selector */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Metrik</p>
          <div className="flex bg-muted rounded-lg p-1 gap-1">
            {(["wilks2", "ipfgl"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                  metric === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {METRIC_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        {/* Opponent list */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Gegner wählen</p>
          {opponents.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <AlertCircle className="mx-auto text-muted-foreground/40" size={28} />
              <p className="text-xs text-muted-foreground">
                Keine öffentlichen Athleten verfügbar. Nur nicht-anonyme Athleten können herausgefordert werden.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {opponents.map(e => (
                <button
                  key={e.userId}
                  onClick={() => setSelected(e.userId)}
                  className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                    selected === e.userId
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:border-border/60 hover:bg-muted/30"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-muted-foreground">#{e.rank}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{e.displayName}</p>
                    <p className="text-[10px] text-muted-foreground">{METRIC_LABEL[metric]}: {e.score}</p>
                  </div>
                  {selected === e.userId && (
                    <CheckCircle2 size={14} className="text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          className="w-full text-sm"
          disabled={selected === null || sending}
          onClick={() => selected !== null && onSend(selected, metric)}
        >
          <Swords size={14} className="mr-2" />
          {sending ? "Wird gesendet…" : "Duell-Einladung senden"}
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function H2hPage() {
  const { toast } = useToast();
  const [showInvite, setShowInvite] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [tab, setTab] = useState<"active" | "history">("active");
  const { data: sub } = useSubscription();
  const authState = useSyncExternalStore(subscribe, getState);
  const myId = authState.user?.id ?? 0;

  const { data: challenges = [], isLoading } = useQuery<H2hChallenge[]>({
    queryKey: ["/api/h2h"],
    queryFn: async () => {
      const { authFetch } = await import("@/lib/authStore");
      const r = await authFetch("/api/h2h");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 30_000,
  });

  const { data: leaderboard } = useQuery<{ entries: LeaderboardEntry[] }>({
    queryKey: ["/api/leaderboard", "wilks2"],
    queryFn: async () => {
      const { authFetch } = await import("@/lib/authStore");
      const r = await authFetch("/api/leaderboard?metric=wilks2");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  const sendInvite = useMutation({
    mutationFn: async ({ opponentId, metric }: { opponentId: number; metric: string }) => {
      const r = await apiRequest("POST", "/api/h2h", { opponentId, metric });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message ?? "Fehler beim Senden");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/h2h"] });
      setShowInvite(false);
      toast({ title: "Einladung gesendet ✓", description: "Warte auf Antwort des Gegners." });
    },
    onError: (e: any) => {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    },
  });

  const acceptChallenge = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/h2h/${id}/accept`, {});
      if (!r.ok) throw new Error("Fehler beim Annehmen");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/h2h"] });
      toast({ title: "Duell gestartet! 🔥", description: "Baseline wurde erfasst. 4 Wochen laufen." });
    },
    onError: () => {
      toast({ title: "Fehler", description: "Konnte Challenge nicht annehmen.", variant: "destructive" });
    },
  });

  const declineChallenge = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/h2h/${id}/decline`, {});
      if (!r.ok) throw new Error("Fehler beim Ablehnen");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/h2h"] });
      toast({ title: "Abgelehnt", description: "Einladung wurde abgelehnt." });
    },
  });

  const takeSnapshot = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/h2h/${id}/snapshot`, {});
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message ?? "Fehler");
      }
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/h2h"] });
      toast({
        title: `Woche ${data.week} erfasst ✓`,
        description: "Dein Fortschritt wurde gespeichert.",
      });
    },
    onError: (e: any) => {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    },
  });

  const active = challenges.filter(c => c.status === "active" || c.status === "pending");
  const history = challenges.filter(c => c.status === "completed" || c.status === "declined");
  const displayed = tab === "active" ? active : history;

  return (
    <div className="flex flex-col h-full">
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} reason="h2h" />
      <MobileHeader title="Duelle" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 md:pb-4">

        {/* Header + invite button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-lg text-foreground">Head-to-Head</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              4-Wochen-Duell nach Koeffizient-Fortschritt
            </p>
          </div>
          <Button
            size="sm"
            className="text-xs h-8 gap-1.5"
            onClick={() => sub?.isPro ? setShowInvite(true) : setShowUpgrade(true)}
            data-testid="button-start-duel"
          >
            {sub?.isPro ? (
              <><Plus size={13} />Duell starten</>
            ) : (
              <><Lock size={12} />Duell starten<ProBadge /></>
            )}
          </Button>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-muted rounded-xl p-1 gap-1">
          {(["active", "history"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all relative ${
                tab === t
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "active" ? "Aktiv" : "Verlauf"}
              {t === "active" && active.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-foreground/20 text-[10px] font-bold">
                  {active.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Challenge cards */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Swords className="mx-auto text-muted-foreground/30" size={40} />
            {tab === "active" ? (
              <>
                <p className="text-sm font-medium text-foreground">Noch keine aktiven Duelle</p>
                <p className="text-xs text-muted-foreground">
                  Fordere einen Athleten aus dem Leaderboard heraus.
                </p>
                <Button size="sm" className="text-xs mt-2" onClick={() => sub?.isPro ? setShowInvite(true) : setShowUpgrade(true)}>
                  {sub?.isPro ? (
                    <><Plus size={12} className="mr-1" /> Erstes Duell starten</>
                  ) : (
                    <><Lock size={12} className="mr-1" /> Duell starten <ProBadge /></>
                  )}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">Noch kein Duell-Verlauf</p>
                <p className="text-xs text-muted-foreground">
                  Abgeschlossene und abgelehnte Duelle erscheinen hier.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(c => (
              <H2hCard
                key={c.id}
                challenge={c}
                onAccept={acceptChallenge.mutate}
                onDecline={declineChallenge.mutate}
                onSnapshot={takeSnapshot.mutate}
                accepting={acceptChallenge.isPending}
                declining={declineChallenge.isPending}
                snapshotting={takeSnapshot.isPending}
                myId={myId}
              />
            ))}
          </div>
        )}

        {/* How it works */}
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
          <p className="text-xs font-bold text-foreground font-display">So funktioniert ein Duell</p>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p>1. Wähle einen Athleten aus dem Leaderboard und sende eine Einladung.</p>
            <p>2. Sobald der Gegner annimmt, werden eure aktuellen Koeffizienten als Baseline gespeichert.</p>
            <p>3. Erfasse jede Woche deinen Fortschritt — nach neuen 1RM-Updates einfach „Fortschritt erfassen" tippen.</p>
            <p>4. Nach 4 Wochen gewinnt der Athlet mit der größten <strong className="text-foreground">prozentualen Verbesserung</strong> des Koeffizienten.</p>
          </div>
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <InviteModal
          entries={leaderboard?.entries ?? []}
          onSend={(opponentId, metric) => sendInvite.mutate({ opponentId, metric })}
          onClose={() => setShowInvite(false)}
          sending={sendInvite.isPending}
        />
      )}
    </div>
  );
}
