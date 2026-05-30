import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { initAuth, getState, subscribe, logout } from "@/lib/authStore";

// Eager-load the two screens shown before user state is resolved
import OnboardingPage from "@/pages/onboarding";
import DashboardPage from "@/pages/dashboard";
import AuthPage from "@/pages/auth";

// P5: Lazy-load all remaining routes — split into separate JS chunks
const TrainingPage   = lazy(() => import("@/pages/training"));
const ProgramPage    = lazy(() => import("@/pages/program"));
const WorkoutPage    = lazy(() => import("@/pages/workout"));
const HistoryPage    = lazy(() => import("@/pages/history"));
const SettingsPage   = lazy(() => import("@/pages/settings"));
const ExercisesPage  = lazy(() => import("@/pages/exercises"));
const ChallengesPage  = lazy(() => import("@/pages/challenges"));
const CoachPage       = lazy(() => import("@/pages/coach"));
const LeaderboardPage = lazy(() => import("@/pages/leaderboard"));
const H2hPage               = lazy(() => import("@/pages/h2h"));
const ReferralAnalyticsPage = lazy(() => import("@/pages/referral-analytics"));
const InvitePage            = lazy(() => import("@/pages/invite"));
const UpgradePage           = lazy(() => import("@/pages/upgrade"));
const NotFound              = lazy(() => import("@/pages/not-found"));

import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import PwaBanner from "@/components/PwaBanner";
import { useToast } from "@/hooks/use-toast";

// Minimal inline fallback — shown during lazy chunk download (rare after first visit)
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/** Initialise auth once when the module loads */
const authInitPromise = initAuth();

function AppInner() {
  const { toast } = useToast();

  // Subscribe to auth store changes
  const authState = useSyncExternalStore(subscribe, getState);

  // Block render until initAuth() resolves
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    authInitPromise.then(() => setAuthReady(true));
  }, []);

  // Referral toast
  useEffect(() => {
    if (!authState.user) return;
    const urlParams = new URLSearchParams(window.location.search);
    const hashSearch = window.location.hash.includes("?")
      ? new URLSearchParams(window.location.hash.split("?")[1])
      : null;
    const refCode = urlParams.get("ref") ?? hashSearch?.get("ref");
    if (refCode) {
      setTimeout(() => {
        toast({
          title: "Du wurdest eingeladen!",
          description: `Upgrade auf GritIQ Pro und ihr beide bekommt 30 Tage gratis! Code: ${refCode}`,
        });
      }, 1500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.user?.id]);

  // Fetch full user profile (includes maxes, wave, week, etc.) for Sidebar + pages
  // Called unconditionally before all early returns to satisfy Rules of Hooks.
  const { data: fullUser, isLoading: profileLoading } = useQuery<any>({
    queryKey: ["/api/user"],
    enabled: !!authState.user,
    placeholderData: (prev: any) => prev,
    staleTime: 30_000,
  });

  // Loading splash
  if (!authReady || authState.loading) {
    return (
      <div className="flex items-center justify-center h-dvh bg-background">
        <div className="flex flex-col items-center gap-4">
          <GritIQLogo size={48} />
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Not authenticated — show auth page
  if (!authState.user) {
    return (
      <Router hook={useHashLocation}>
        <Switch>
          <Route path="/" component={AuthPage} />
          <Route component={AuthPage} />
        </Switch>
      </Router>
    );
  }

  const authUser = authState.user;

  if (profileLoading && !fullUser) {
    return (
      <div className="flex items-center justify-center h-dvh bg-background">
        <div className="flex flex-col items-center gap-4">
          <GritIQLogo size={48} />
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const user = fullUser ?? authUser;

  // Authenticated but hasn't set 1RMs yet — show onboarding
  if (!authUser?.hasMaxes) {
    return (
      <Router hook={useHashLocation}>
        <Switch>
          <Route path="/" component={OnboardingPage} />
          <Route component={OnboardingPage} />
        </Switch>
      </Router>
    );
  }

  return (
    <Router hook={useHashLocation}>
      {/* Desktop: sidebar layout; Mobile: full-screen + bottom nav */}
      <div className="flex h-dvh bg-background overflow-hidden">
        {/* Sidebar — hidden on mobile */}
        <div className="hidden md:flex md:flex-shrink-0">
          <Sidebar user={user} />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto main-scroll-area">
          <Suspense fallback={<PageLoader />}>
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/training" component={TrainingPage} />
              <Route path="/program" component={ProgramPage} />
              <Route path="/workout/:id" component={WorkoutPage} />
              <Route path="/history" component={HistoryPage} />
              <Route path="/exercises" component={ExercisesPage} />
              <Route path="/challenges" component={ChallengesPage} />
              <Route path="/coach" component={CoachPage} />
              <Route path="/leaderboard" component={LeaderboardPage} />
              <Route path="/h2h" component={H2hPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/settings/:sub" component={SettingsPage} />
              <Route path="/invite" component={InvitePage} />
              <Route path="/upgrade" component={UpgradePage} />
              <Route path="/admin/referrals" component={ReferralAnalyticsPage} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </main>
      </div>

      {/* Bottom nav — only on mobile */}
      <BottomNav />
    </Router>
  );
}

export function GritIQLogo({ size = 32 }: { size?: number }) {
  const rx = Math.round(size * 0.22);
  const s = size;
  const cx = s / 2, cy = s / 2;
  const outerR = s * 0.33;
  const innerR = s * 0.21;
  const ang = (60 * Math.PI) / 180;
  const oxTop = cx + outerR * Math.cos(-ang);
  const oyTop = cy + outerR * Math.sin(-ang);
  const ixTop = cx + innerR * Math.cos(-ang);
  const iyTop = cy + innerR * Math.sin(-ang);
  const oxBot = cx + outerR * Math.cos(ang);
  const oyBot = cy + outerR * Math.sin(ang);
  const ixBot = cx + innerR * Math.cos(ang);
  const iyBot = cy + innerR * Math.sin(ang);
  const cbX = ixTop;
  const cbY = cy - s * 0.06;
  const cbW = s * 0.23;
  const cbH = s * 0.12;
  const cbRx = cbH * 0.35;
  const collarX = cbX + cbW - cbH;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${s} ${s}`} fill="none"
      aria-label="GritIQ" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="30%" y1="20%" x2="70%" y2="80%">
          <stop offset="0%" stopColor="#FF8C42" />
          <stop offset="100%" stopColor="#E8541A" />
        </linearGradient>
      </defs>
      <rect width={s} height={s} rx={rx} fill="#1B1F2A" />
      <path
        fill="url(#logoGrad)"
        d={`M ${oxTop},${oyTop} A ${outerR},${outerR} 0 1,0 ${oxBot},${oyBot} L ${ixBot},${iyBot} A ${innerR},${innerR} 0 1,1 ${ixTop},${iyTop} Z`}
      />
      <rect x={cbX} y={cbY} width={cbW} height={cbH} rx={cbRx} fill="url(#logoGrad)" />
      <rect x={collarX} y={cbY} width={cbH * 0.9} height={cbH} rx={cbH * 0.45} fill="#FF8C42" />
    </svg>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
      <Toaster />
      <PwaBanner />
    </QueryClientProvider>
  );
}
