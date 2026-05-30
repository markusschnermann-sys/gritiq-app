/**
 * Referral Analytics Dashboard
 * Admin-only page — accessible only to users with admin IDs.
 * Route: /#/admin/referrals
 */
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import {
  Users, Gift, TrendingUp, Clock, Crown, Copy, Check,
  AlertTriangle, BarChart3, Calendar, Zap,
} from "lucide-react";
import { useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface KPIs {
  total: number;
  rewarded: number;
  pending: number;
  convRate: number;
  totalBonusDays: number;
  avgBonusDays: number;
  avgConvertHours: number | null;
}
interface LeaderboardRow {
  rank: number;
  referrerId: number;
  name: string;
  code: string;
  sent: number;
  rewarded: number;
  pending: number;
  bonusDaysEarned: number;
  convRate: number;
  firstReferralAt: string | null;
  lastReferralAt: string | null;
}
interface DailySeries { date: string; sent: number; rewarded: number; }
interface Stats { kpis: KPIs; leaderboard: LeaderboardRow[]; dailySeries: DailySeries[]; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "2-digit" });
}
function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}

// ── Mini sparkline bar chart (pure SVG, no dep) ───────────────────────────────
function BarSparkline({ data }: { data: DailySeries[] }) {
  const MAX_BARS = 30;
  const bars = data.slice(-MAX_BARS);
  const maxVal = Math.max(...bars.map(d => d.sent), 1);
  const W = 100, H = 48, gap = 1;
  const barW = (W - gap * (bars.length - 1)) / bars.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-12">
      {bars.map((d, i) => {
        const x = i * (barW + gap);
        const sentH = Math.max((d.sent / maxVal) * (H - 2), d.sent > 0 ? 2 : 0);
        const rewH = Math.max((d.rewarded / maxVal) * (H - 2), d.rewarded > 0 ? 2 : 0);
        return (
          <g key={d.date}>
            {/* sent (background) */}
            {d.sent > 0 && (
              <rect x={x} y={H - sentH} width={barW} height={sentH}
                rx={1} fill="hsl(25 100% 55% / 0.25)" />
            )}
            {/* rewarded (foreground) */}
            {d.rewarded > 0 && (
              <rect x={x} y={H - rewH} width={barW} height={rewH}
                rx={1} fill="hsl(25 100% 55% / 0.85)" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Donut chart (pure SVG) ────────────────────────────────────────────────────
function DonutChart({ rewarded, pending, total }: { rewarded: number; pending: number; total: number }) {
  const R = 36, cx = 44, cy = 44, stroke = 14;
  const circ = 2 * Math.PI * R;
  if (total === 0) {
    return (
      <svg viewBox="0 0 88 88" className="w-24 h-24">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke} />
        <text x={cx} y={cy + 5} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11" fontFamily="sans-serif">0%</text>
      </svg>
    );
  }
  const rewardedPct = rewarded / total;
  const pendingPct  = pending  / total;
  const rewardedDash = rewardedPct * circ;
  const pendingDash  = pendingPct  * circ;
  const startPending = -Math.PI / 2;
  const startRewarded = startPending + pendingPct * 2 * Math.PI;

  const arc = (start: number, dashLen: number, color: string) => {
    const offset = circ - dashLen;
    const rot = (start * 180 / Math.PI) + 90;
    return (
      <circle cx={cx} cy={cy} r={R} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dashLen} ${circ - dashLen}`}
        strokeDashoffset={0}
        transform={`rotate(${rot}, ${cx}, ${cy})`}
        strokeLinecap="butt"
      />
    );
  };

  return (
    <svg viewBox="0 0 88 88" className="w-24 h-24">
      {/* track */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke} />
      {/* pending slice (muted orange) */}
      {pending > 0 && arc(startPending, pendingDash, "hsl(25 100% 55% / 0.25)")}
      {/* rewarded slice (orange) */}
      {rewarded > 0 && arc(startRewarded, rewardedDash, "hsl(25 100% 55%)")}
      {/* center label */}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="13" fontWeight="700" fontFamily="sans-serif">
        {Math.round(rewardedPct * 100)}%
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="8" fontFamily="sans-serif">
        Conv.
      </text>
    </svg>
  );
}

// ── Horizontal bar for per-referrer conv rate ─────────────────────────────────
function ConvBar({ pct, size = "md" }: { pct: number; size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-1" : "h-1.5";
  return (
    <div className={`w-full bg-border rounded-full overflow-hidden ${h}`}>
      <div
        className={`${h} rounded-full transition-all duration-500`}
        style={{
          width: `${pct}%`,
          background: pct >= 75
            ? "hsl(142 71% 45%)"
            : pct >= 40
              ? "hsl(25 100% 55%)"
              : "hsl(25 100% 55% / 0.4)",
        }}
      />
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, sub, accent = false,
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${accent ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={14} className={accent ? "text-orange-400" : ""} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-display font-bold leading-none ${accent ? "text-orange-400" : "text-foreground"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
    </button>
  );
}

// ── Rank medal ────────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-yellow-400 font-bold text-sm">🥇</span>;
  if (rank === 2) return <span className="text-slate-300 font-bold text-sm">🥈</span>;
  if (rank === 3) return <span className="text-orange-600 font-bold text-sm">🥉</span>;
  return (
    <span className="text-muted-foreground font-mono text-xs w-5 text-center">
      #{rank}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReferralAnalyticsPage() {
  const { data, isLoading, error } = useQuery<Stats>({
    queryKey: ["admin-referral-stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/referral-stats");
      if (!res.ok) {
        const msg = await res.json().catch(() => ({ message: "Fehler" }));
        throw new Error(msg.message ?? "Fehler beim Laden");
      }
      return res.json();
    },
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000, // auto-refresh every 60s
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="space-y-1 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-muted-foreground mt-2">Lade Analytics…</p>
        </div>
      </div>
    );
  }

  if (error) {
    const is403 = (error as Error).message.includes("Admin");
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2 max-w-xs">
          <AlertTriangle size={32} className="text-red-400 mx-auto" />
          <p className="font-display font-semibold">
            {is403 ? "Kein Zugriff" : "Ladefehler"}
          </p>
          <p className="text-xs text-muted-foreground">
            {is403
              ? "Diese Seite ist nur für Admins zugänglich."
              : (error as Error).message}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, leaderboard, dailySeries } = data;
  const activeDays = dailySeries.filter(d => d.sent > 0).length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 pb-24">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={18} className="text-orange-400" />
            <h1 className="font-display font-bold text-lg">Referral Analytics</h1>
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1.5">
              Admin
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Echtzeit-Daten · Auto-Refresh alle 60 s
          </p>
        </div>
        <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-xs px-3 py-1">
          {kpis.total} Einladungen gesamt
        </Badge>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Gesamt" value={kpis.total}
          sub={`${activeDays} aktive Tage (30d)`} />
        <KpiCard icon={Gift} label="Konvertiert" value={kpis.rewarded}
          sub={`${kpis.pending} ausstehend`} accent />
        <KpiCard icon={TrendingUp} label="Conv-Rate" value={`${kpis.convRate}%`}
          sub="pending → rewarded" accent={kpis.convRate >= 50} />
        <KpiCard icon={Clock}
          label="Ø Zeit bis Conv."
          value={kpis.avgConvertHours !== null
            ? kpis.avgConvertHours < 24
              ? `${kpis.avgConvertHours}h`
              : `${Math.round(kpis.avgConvertHours / 24)}d`
            : "—"
          }
          sub="created → rewarded" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard icon={Zap} label="Bonus-Tage vergeben" value={kpis.totalBonusDays}
          sub={`Ø ${kpis.avgBonusDays} Tage / Konversion`} accent />
        <KpiCard icon={Crown} label="Top Referrer" value={leaderboard[0]?.name ?? "—"}
          sub={leaderboard[0] ? `${leaderboard[0].rewarded} Konv. · ${leaderboard[0].bonusDaysEarned}d` : ""} />
      </div>

      {/* Donut + Activity chart */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Donut */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Konversions-Mix
          </p>
          <div className="flex items-center gap-6">
            <DonutChart rewarded={kpis.rewarded} pending={kpis.pending} total={kpis.total} />
            <div className="space-y-2 text-sm flex-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                  Rewarded
                </span>
                <span className="font-semibold text-orange-400">{kpis.rewarded}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500/25 inline-block" />
                  Pending
                </span>
                <span className="font-semibold text-muted-foreground">{kpis.pending}</span>
              </div>
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Gesamt</span>
                <span className="font-semibold">{kpis.total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Activity chart */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Aktivität (letzte 30 Tage)
            </p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-orange-500/25" /> Gesendet
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-orange-500" /> Conv.
              </span>
            </div>
          </div>
          <BarSparkline data={dailySeries} />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{fmtShortDate(dailySeries[0].date)}</span>
            <span>{fmtShortDate(dailySeries[dailySeries.length - 1].date)}</span>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Crown size={14} className="text-orange-400" />
          <p className="text-sm font-semibold font-display">Top Referrer</p>
          <Badge className="bg-secondary text-muted-foreground border-border text-[10px] px-1.5 ml-auto">
            {leaderboard.length} Nutzer
          </Badge>
        </div>

        {leaderboard.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            Noch keine Referrals
          </div>
        ) : (
          <div className="divide-y divide-border">
            {leaderboard.map(row => (
              <div key={row.referrerId}
                className="px-4 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors">

                {/* Rank */}
                <div className="w-7 flex-shrink-0 flex items-center justify-center">
                  <RankBadge rank={row.rank} />
                </div>

                {/* Avatar */}
                <div className="w-8 h-8 rounded-full gradient-orange flex-shrink-0 flex items-center justify-center text-white font-bold text-sm font-display">
                  {row.name.charAt(0).toUpperCase()}
                </div>

                {/* Name + code */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{row.name}</p>
                    {row.rank === 1 && (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] px-1.5">
                        #1
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <code className="text-[10px] text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded">
                      {row.code}
                    </code>
                    <CopyButton text={row.code} />
                    <span className="text-[10px] text-muted-foreground ml-1">
                      Seit {fmtDate(row.firstReferralAt)}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden sm:grid grid-cols-3 gap-4 text-center flex-shrink-0">
                  <div>
                    <p className="text-xs font-bold text-foreground">{row.sent}</p>
                    <p className="text-[10px] text-muted-foreground">Gesendet</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-orange-400">{row.rewarded}</p>
                    <p className="text-[10px] text-muted-foreground">Konv.</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-green-400">{row.bonusDaysEarned}d</p>
                    <p className="text-[10px] text-muted-foreground">Bonus</p>
                  </div>
                </div>

                {/* Conv rate bar */}
                <div className="w-20 flex-shrink-0 space-y-1 hidden md:block">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Conv.</span>
                    <span className={`font-semibold ${row.convRate >= 75 ? "text-green-400" : row.convRate >= 40 ? "text-orange-400" : "text-muted-foreground"}`}>
                      {row.convRate}%
                    </span>
                  </div>
                  <ConvBar pct={row.convRate} />
                </div>

                {/* Mobile quick stats */}
                <div className="sm:hidden flex-shrink-0 text-right">
                  <p className="text-xs font-bold text-orange-400">{row.rewarded}<span className="text-muted-foreground">/{row.sent}</span></p>
                  <p className="text-[10px] text-muted-foreground">{row.convRate}%</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raw table — all referrals */}
      <details className="rounded-xl border border-border bg-card overflow-hidden">
        <summary className="px-4 py-3 cursor-pointer text-sm font-semibold flex items-center gap-2 select-none hover:bg-secondary/30 transition-colors">
          <Calendar size={14} className="text-muted-foreground" />
          Alle Referral-Rows
          <Badge className="bg-secondary text-muted-foreground border-border text-[10px] px-1.5 ml-auto">
            {kpis.total}
          </Badge>
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-t border-b border-border bg-secondary/30 text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Code</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Bonus</th>
                <th className="px-3 py-2 text-left font-medium">Erstellt</th>
                <th className="px-3 py-2 text-left font-medium">Konv. am</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leaderboard.flatMap(row =>
                // We reconstruct per-row data from the leaderboard (summary only)
                // so we show row-level summary per referrer, not individual rows
                [{
                  code: row.code,
                  status: `${row.rewarded}✓ / ${row.pending}⏳`,
                  bonusDays: row.bonusDaysEarned,
                  createdAt: row.firstReferralAt,
                  rewardedAt: row.lastReferralAt,
                  referrerName: row.name,
                }]
              ).map((r, i) => (
                <tr key={i} className="hover:bg-secondary/20">
                  <td className="px-3 py-2 font-mono text-orange-400">
                    {r.code}
                    <span className="text-muted-foreground ml-1">({r.referrerName})</span>
                  </td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2 text-green-400 font-semibold">{r.bonusDays}d</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(r.createdAt)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(r.rewardedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

    </div>
  );
}
