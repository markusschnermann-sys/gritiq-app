import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface ReferralTier {
  id: string;
  label: string;
  requiredConversions: number;
  bonusDays: number;
  emoji: string;
}

export interface ReferralStatus {
  code: string;
  referralUrl: string;
  pending: number;          // invites sent but not yet converted
  rewarded: number;         // converted + bonus credited
  bonusDaysEarned: number;  // total days earned from referrals
  bonusDaysTotal: number;   // same (cumulative, server-side)
  // Tier progression
  tiers: ReferralTier[];
  currentTier: ReferralTier | null;
  nextTier: ReferralTier | null;
  progressPct: number;       // 0-100 toward next tier
  conversionsUntilNext: number;
  recentRewarded: { bonusDays: number; rewardedAt: string | null }[];
}

export function useReferral() {
  return useQuery<ReferralStatus>({
    queryKey: ["/api/referral"],
    queryFn: async () => (await apiRequest("GET", "/api/referral")).json(),
    staleTime: 60_000,
    retry: false,
  });
}
