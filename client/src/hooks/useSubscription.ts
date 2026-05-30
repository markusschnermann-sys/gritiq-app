import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface SubscriptionStatus {
  isPro: boolean;
  status: "none" | "active" | "trialing" | "canceled" | "past_due" | "referral_bonus";
  plan: "monthly" | "annual" | null;
  renewalDate: string | null;   // ISO datetime of next charge / period end
  expiresAt: string | null;     // set when canceled — access until this date
  atlasUsed: number;
  atlasLimit: number | null;    // null = unlimited
}

export function useSubscription() {
  return useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription"],
    queryFn: async () => (await apiRequest("GET", "/api/subscription")).json(),
    staleTime: 30_000, // revalidate every 30s
    retry: false,
  });
}
