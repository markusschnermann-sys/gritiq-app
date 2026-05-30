/**
 * ChallengesPage — Create/join group challenges, track leaderboard progress, activity feed.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trophy, Users, Plus, Flame, CheckCircle2, Clock, ChevronRight, Target, Zap, Calendar, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/UpgradeModal";
import { ProBadge } from "@/components/ProGate";
import type { User } from "@shared/schema";

type ChallengeWithMeta = {
  id: number; name: string; description?: string; type: string;
  goal: string; startDate: string; endDate: string;
  status: string; memberCount: number; creatorId: number;
  members: { userId: number; progress: number; completed: number }[];
  membership?: { progress: number; completed: number };
};

type FeedEntry = {
  id: number; userId: number; type: string;
  payload: Record<string, any>; createdAt: string; isOwn: boolean;
};

const TYPE_ICONS: Record<string, typeof Flame> = {
  volume: Zap, consistency: Calendar, pr: Trophy, streak: Flame,
};
const TYPE_LABELS: Record<string, string> = {
  volume: "Volumen", consistency: "Konstanz", pr: "Bestleistung", streak: "Streak",
};
const TYPE_COLORS: Record<string, string> = {
  volume: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  consistency: "bg-green-500/20 text-green-400 border-green-500/30",
  pr: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  streak: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const FEED_MESSAGES: Record<string, (p: any, isOwn: boolean, name: string) => string> = {
  challenge_create: (p, isOwn, name) => isOwn ? `Du hast Challenge "${p.name}" erstellt` : `${name} hat Challenge "${p.name}" erstellt`,
  challenge_join: (p, isOwn, name) => isOwn ? `Du bist Challenge beigetreten` : `${name} ist einer Challenge beigetreten`,
  challenge_complete: (p, isOwn, name) => isOwn ? `Du hast "${p.name}" abgeschlossen 🎉` : `${name} hat "${p.name}" abgeschlossen 🎉`,
  session: (p, isOwn, name) => isOwn ? `Du hast ${p.lift}-Training abgeschlossen` : `${name} hat ${p.lift}-Training abgeschlossen`,
  pr: (p, isOwn, name) => isOwn ? `Neuer PR: ${p.lift} ${p.weight}kg 🔥` : `${name}: neuer PR ${p.lift} ${p.weight}kg`,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `vor ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours}h`;
  return `vor ${Math.floor(hours / 24)}d`;
}

function daysLeft(end: string): number {
  return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000));
}

export default function ChallengesPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"challenges" | "feed">("challenges");
  const [showCreate, setShowCreate] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const { data: sub } = useSubscription();
  const [form, setForm] = useState({
    name: "", description: "", type: "consistency",
    targetValue: "20", unit: "sessions",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
    queryFn: async () => { const r = await fetch("/api/user"); if (r.status === 404) return null; return r.json(); },
    placeholderData: (prev) => prev,
  });

  const { data: challenges = [], isLoading } = useQuery<ChallengeWithMeta[]>({
    queryKey: ["/api/challenges"],
    queryFn: async () => (await apiRequest("GET", "/api/challenges")).json(),
    staleTime: 0,
    placeholderData: (prev) => prev,
  });

  const { data: feed = [] } = useQuery<FeedEntry[]>({
    queryKey: ["/api/feed"],
    queryFn: async () => (await apiRequest("GET", "/api/feed")).json(),
    staleTime: 0,
    placeholderData: (prev) => prev,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/challenges", {
      name: form.name,
      description: form.description || null,
      type: form.type,
      goal: JSON.stringify({ targetValue: parseInt(form.targetValue), unit: form.unit }),
      startDate: form.startDate,
      endDate: form.endDate,
      isPublic: 1,
    })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      setShowCreate(false);
      toast({ title: "Challenge erstellt!" });
    },
    onError: () => toast({ title: "Fehler", variant: "destructive" }),
  });

  const joinMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/challenges/${id}/join`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      toast({ title: "Challenge beigetreten!" });
    },
    onError: (err: any) => toast({ title: "Fehler", description: err.message, variant: "destructive" }),
  });

  const updateProgress = useMutation({
    mutationFn: async ({ id, progress }: { id: number; progress: number }) =>
      (await apiRequest("PATCH", `/api/challenges/${id}/progress`, { progress })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
    },
  });

  const myChallenges = challenges.filter(c => c.membership);
  const openChallenges = challenges.filter(c => !c.membership && c.status === "active");

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-5">
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} reason="challenges" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Challenges</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{myChallenges.length} aktiv · {openChallenges.length} offen</p>
        </div>
        <Button
          size="sm"
          onClick={() => sub?.isPro ? setShowCreate(v => !v) : setShowUpgrade(true)}
          className="gradient-orange text-white border-0 hover:opacity-90 font-display font-semibold min-h-[44px] relative"
          data-testid="button-create-challenge"
        >
          {sub?.isPro ? (
            <><Plus size={16} className="mr-1" />Neu</>
          ) : (
            <><Lock size={14} className="mr-1" />Neu <ProBadge className="ml-0.5" /></>
          )}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="stat-card border-primary/30 space-y-3">
          <p className="font-display font-bold text-sm text-primary">Neue Challenge</p>
          <Input
            placeholder="Name (z.B. 30-Tage Konsistenz-Challenge)"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className="h-10 bg-background"
          />
          <Input
            placeholder="Beschreibung (optional)"
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="h-10 bg-background"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
              className="h-10 rounded-md border border-input bg-background px-3 text-base text-foreground"
            >
              <option value="consistency">Konstanz</option>
              <option value="volume">Volumen</option>
              <option value="pr">Bestleistung</option>
              <option value="streak">Streak</option>
            </select>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Ziel"
                value={form.targetValue}
                onChange={e => setForm(p => ({ ...p, targetValue: e.target.value }))}
                className="h-10 bg-background w-20"
              />
              <Input
                placeholder="Einheit"
                value={form.unit}
                onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                className="h-10 bg-background flex-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start</label>
              <Input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} className="h-10 bg-background" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ende</label>
              <Input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} className="h-10 bg-background" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button
              className="flex-1 gradient-orange text-white border-0 hover:opacity-90"
              disabled={!form.name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Erstelle…" : "Challenge starten"}
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
        {(["challenges", "feed"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-md text-sm font-display font-semibold transition-colors ${
              tab === t ? "gradient-orange text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "challenges" ? "Challenges" : "Aktivität"}
          </button>
        ))}
      </div>

      {tab === "challenges" && (
        <div className="space-y-5">
          {/* My challenges */}
          {myChallenges.length > 0 && (
            <div className="space-y-3">
              <p className="font-display font-bold text-xs uppercase tracking-wider text-muted-foreground">Meine Challenges</p>
              {myChallenges.map(c => (
                <ChallengeCard
                  key={c.id}
                  challenge={c}
                  isMember
                  userId={user?.id ?? 0}
                  onUpdateProgress={(p) => updateProgress.mutate({ id: c.id, progress: p })}
                />
              ))}
            </div>
          )}

          {/* Open challenges */}
          {openChallenges.length > 0 && (
            <div className="space-y-3">
              <p className="font-display font-bold text-xs uppercase tracking-wider text-muted-foreground">Offene Challenges</p>
              {openChallenges.map(c => (
                <ChallengeCard
                  key={c.id}
                  challenge={c}
                  isMember={false}
                  userId={user?.id ?? 0}
                  onJoin={() => joinMutation.mutate(c.id)}
                />
              ))}
            </div>
          )}

          {challenges.length === 0 && !isLoading && (
            <div className="stat-card text-center py-12">
              <Trophy size={32} className="mx-auto mb-3 text-muted-foreground/50" />
              <p className="font-display font-bold text-sm">Noch keine Challenges</p>
              <p className="text-xs text-muted-foreground mt-1">Erstelle die erste Challenge für dich und andere Athleten</p>
            </div>
          )}
        </div>
      )}

      {tab === "feed" && (
        <div className="space-y-2">
          {feed.length === 0 ? (
            <div className="stat-card text-center py-12">
              <Zap size={32} className="mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Noch keine Aktivitäten</p>
            </div>
          ) : (
            feed.map(entry => {
              const msg = FEED_MESSAGES[entry.type]?.(entry.payload, entry.isOwn, entry.payload.userName ?? "Athlet") ?? entry.type;
              return (
                <div key={entry.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${entry.isOwn ? "border-primary/20 bg-primary/5" : "border-border bg-card"}`}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${entry.isOwn ? "bg-primary" : "bg-muted-foreground/40"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{msg}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(entry.createdAt)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function ChallengeCard({ challenge: c, isMember, userId, onJoin, onUpdateProgress }: {
  challenge: ChallengeWithMeta;
  isMember: boolean;
  userId: number;
  onJoin?: () => void;
  onUpdateProgress?: (p: number) => void;
}) {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const goal = JSON.parse(c.goal) as { targetValue: number; unit: string; lift?: string };
  const TypeIcon = TYPE_ICONS[c.type] ?? Trophy;
  const membership = c.membership;
  const progressPct = membership ? Math.min(100, Math.round((membership.progress / goal.targetValue) * 100)) : 0;
  const days = daysLeft(c.endDate);
  const isCompleted = membership?.completed === 1;

  const sortedMembers = [...c.members].sort((a, b) => b.progress - a.progress);

  return (
    <div className={`stat-card space-y-3 ${isCompleted ? "border-green-500/30 bg-green-500/5" : isMember ? "border-primary/30" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[c.type] ?? "bg-muted/30"}`}>
            <TypeIcon size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display font-bold text-sm text-foreground">{c.name}</span>
              {isCompleted && <CheckCircle2 size={14} className="text-green-400" />}
            </div>
            {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[c.type] ?? ""}`}>{TYPE_LABELS[c.type] ?? c.type}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Users size={10} />{c.memberCount}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={10} />{days}d</span>
            </div>
          </div>
        </div>
      </div>

      {/* Goal */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Ziel: <strong className="text-foreground">{goal.targetValue} {goal.unit}</strong></span>
        {isMember && <span className="text-primary font-semibold">{membership!.progress.toFixed(0)} / {goal.targetValue}</span>}
      </div>

      {/* Progress bar */}
      {isMember && (
        <div className="space-y-1">
          <div className="progress-bar">
            <div className={`h-full rounded-full transition-all duration-500 ${isCompleted ? "bg-green-500" : "gradient-orange"}`} style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{progressPct}% abgeschlossen</span>
            {!isCompleted && onUpdateProgress && (
              <button
                onClick={() => onUpdateProgress(membership!.progress + 1)}
                className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
              >
                +1 {goal.unit}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!isMember && onJoin && (
          <Button size="sm" onClick={onJoin} className="gradient-orange text-white border-0 hover:opacity-90 text-xs min-h-[44px] flex-1 font-display font-semibold">
            Beitreten
          </Button>
        )}
        <button
          onClick={() => setShowLeaderboard(v => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors p-2 -m-2"
        >
          Rangliste <ChevronRight size={12} className={`transition-transform ${showLeaderboard ? "rotate-90" : ""}`} />
        </button>
      </div>

      {/* Leaderboard */}
      {showLeaderboard && sortedMembers.length > 0 && (
        <div className="border-t border-border pt-3 space-y-1.5">
          <p className="font-display font-bold text-xs text-muted-foreground uppercase tracking-wider">Rangliste</p>
          {sortedMembers.map((m, i) => (
            <div key={m.userId} className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${m.userId === userId ? "bg-primary/10 border border-primary/20" : ""}`}>
              <span className={`text-xs font-bold font-display w-5 text-center ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                {i + 1}
              </span>
              <div className="flex-1">
                <div className="progress-bar h-1.5">
                  <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${Math.min(100, (m.progress / goal.targetValue) * 100)}%` }} />
                </div>
              </div>
              <span className="text-xs text-foreground font-semibold font-display w-12 text-right">{m.progress.toFixed(0)}/{goal.targetValue}</span>
              {m.completed ? <CheckCircle2 size={12} className="text-green-400" /> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
