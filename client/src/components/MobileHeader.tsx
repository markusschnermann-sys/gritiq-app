import { Link } from "wouter";
import { GritIQLogo } from "@/App";
import type { User } from "@shared/schema";

const WAVE_NAMES = ["10s", "8s", "5s", "3s"];
const WEEK_NAMES = ["Akkumulation", "Intensivierung", "Realisierung", "Deload"];

interface MobileHeaderProps {
  user?: User;
  title?: string;
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
}

export default function MobileHeader({ user, title, backHref, backLabel, onBack }: MobileHeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 md:hidden bg-card/95 backdrop-blur border-b border-border px-4 flex items-end justify-between"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        height: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
        paddingBottom: '0.5rem',
      }}
    >
      <div className="flex items-center gap-3">
        {(backHref || onBack) ? (
          onBack ? (
            <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground -ml-1 p-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              {backLabel && <span className="text-sm">{backLabel}</span>}
            </button>
          ) : (
          <Link href={backHref!}>
            <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground -ml-1 p-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              {backLabel && <span className="text-sm">{backLabel}</span>}
            </button>
          </Link>
          )
        ) : (
          <GritIQLogo size={28} />
        )}
        {title && <span className="font-display font-bold text-base">{title}</span>}
        {!title && !backHref && (
          <span className="font-display font-bold text-base">GritIQ</span>
        )}
      </div>
      {user && !backHref && (
        <div className="flex items-center gap-2">
          {user.currentWave && (
            <span className="text-xs font-semibold text-primary bg-primary/15 px-2 py-0.5 rounded-full">
              {WAVE_NAMES[user.currentWave - 1]} Wave · {WEEK_NAMES[user.currentWeek - 1].substring(0, 3)}.
            </span>
          )}
          <div className="w-7 h-7 rounded-full gradient-orange flex items-center justify-center text-white font-bold text-xs font-display">
            {user.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
    </header>
  );
}
