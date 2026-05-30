import { Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { Dumbbell, LayoutDashboard, Medal, Bot, Settings } from "lucide-react";

// Mobile bottom nav — 5 tabs
const mobileNavItems = [
  { href: "/training", label: "Training", icon: Dumbbell },
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leaderboard", label: "Rangliste", icon: Medal },
  { href: "/coach", label: "ATLAS", icon: Bot },
  { href: "/settings", label: "Einstellungen", icon: Settings },
];

export default function BottomNav() {
  const [location] = useHashLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch h-16">
        {mobileNavItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            location === href ||
            (href === "/" && (location === "" || location === "/"));
          return (
            <Link key={href} href={href} className="flex-1">
              <div
                className={`flex flex-col items-center justify-center h-full gap-1 transition-colors relative
                  ${isActive ? "text-primary" : "text-muted-foreground"}`}
                data-testid={`bottom-nav-${label.toLowerCase()}`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 gradient-orange rounded-full" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
