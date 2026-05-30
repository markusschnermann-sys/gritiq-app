import { Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { Dumbbell, LayoutDashboard, ClipboardList, History, Settings, ChevronRight, Library, Trophy, Bot, Medal, Swords, ShieldCheck, UserPlus, Crown, Zap } from "lucide-react";
import { GritIQLogo } from "@/App";
import { useSubscription } from "@/hooks/useSubscription";
import type { User } from "@shared/schema";

const WAVE_NAMES = ["10s Wave", "8s Wave", "5s Wave", "3s Wave"];
const WEEK_NAMES = ["Akkumulation", "Intensivierung", "Realisierung", "Deload"];

interface SidebarProps { user: User; }

export const navItems = [
  { href: "/training", label: "Training", icon: Dumbbell },
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/program", label: "Programm", icon: ClipboardList },
  { href: "/exercises", label: "Übungen", icon: Library },
  { href: "/challenges", label: "Challenges", icon: Trophy },
  { href: "/leaderboard", label: "Leaderboard", icon: Medal },
  { href: "/h2h", label: "Duelle", icon: Swords },
  { href: "/coach", label: "ATLAS Coach", icon: Bot },
  { href: "/history", label: "Verlauf", icon: History },
  { href: "/invite", label: "Einladen", icon: UserPlus },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

export default function Sidebar({ user }: SidebarProps) {
  const [location] = useHashLocation();
  const { data: sub } = useSubscription();
  const isPro = !!sub?.isPro;
  const currentWaveName = WAVE_NAMES[(user.currentWave ?? 1) - 1];
  const currentWeekName = WEEK_NAMES[(user.currentWeek ?? 1) - 1];
  const totalWeeks = 16;
  const completedWeeks = ((user.currentWave - 1) * 4) + (user.currentWeek - 1);
  const progressPct = Math.round((completedWeeks / totalWeeks) * 100);

  return (
    <aside className="w-64 flex-shrink-0 border-r border-border bg-card flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <GritIQLogo size={36} />
          <div>
            <h1 className="font-display font-bold text-base text-foreground leading-none">GritIQ</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Kraft-Tracker</p>
          </div>
        </div>
      </div>

      {/* Current phase */}
      <div className="p-4 border-b border-border">
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-foreground/70 uppercase tracking-wider font-medium">Aktuelle Phase</span>
            <span className="text-xs text-primary font-semibold">{progressPct}%</span>
          </div>
          <p className="text-sm font-semibold text-foreground font-display">{currentWaveName}</p>
          <p className="text-xs text-primary">{currentWeekName}</p>
          <div className="mt-2 progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = location === href || (href === "/" && (location === "" || location === "/"));
          return (
            <Link key={href} href={href}>
              <div className={`sidebar-nav-item ${isActive ? "active" : "text-muted-foreground"}`}
                data-testid={`nav-${label.toLowerCase()}`}>
                <Icon size={18} />
                <span>{label}</span>
                {isActive && <ChevronRight size={14} className="ml-auto opacity-60" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Pro upgrade CTA — only for free users */}
      {!isPro && (
        <div className="px-3 pb-2">
          <Link href="/upgrade">
            <div
              className="rounded-lg border border-orange-500/25 bg-orange-500/8 p-3 hover:border-orange-500/40 hover:bg-orange-500/12 transition-all cursor-pointer"
              data-testid="sidebar-upgrade-cta"
            >
              <div className="flex items-center gap-2 mb-1">
                <Crown className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                <span className="text-xs font-bold text-orange-400">Upgrade auf Pro</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                14 Tage gratis · ab 9,99 €/Monat
              </p>
            </div>
          </Link>
        </div>
      )}

      {/* Pro badge — only for Pro users */}
      {isPro && (
        <div className="px-3 pb-2">
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/6 px-3 py-2 flex items-center gap-2">
            <Crown className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
            <span className="text-xs font-bold text-orange-400">GritIQ Pro</span>
          </div>
        </div>
      )}

      {/* Admin tools — only shown to admin users (id 10, 19) */}
      {(user.id === 10 || user.id === 19) && (
        <div className="px-3 pb-2">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground/50 px-2 pb-1 pt-1">Admin</p>
          <Link href="/admin/referrals">
            <div className={`sidebar-nav-item ${
              location === "/admin/referrals" ? "active" : "text-muted-foreground"
            }`}>
              <ShieldCheck size={18} />
              <span>Referral Analytics</span>
              {location === "/admin/referrals" && <ChevronRight size={14} className="ml-auto opacity-60" />}
            </div>
          </Link>
        </div>
      )}

      {/* User info */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full gradient-orange flex items-center justify-center text-white font-bold text-sm font-display">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground">SQ {user.squatMax}kg · BK {user.benchMax}kg</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
