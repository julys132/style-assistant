import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  popular?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  creditsPerMonth: number;
  price: number;
  features: string[];
  popular?: boolean;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "pack_5", name: "Starter", credits: 5, price: 2.99 },
  { id: "pack_15", name: "Style Pack", credits: 15, price: 6.99, popular: true },
  { id: "pack_30", name: "Fashion Pack", credits: 30, price: 11.99 },
  { id: "pack_100", name: "Pro Pack", credits: 100, price: 34.99 },
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "sub_basic",
    name: "Basic",
    creditsPerMonth: 10,
    price: 4.99,
    features: ["10 outfits/month", "Basic styling tips", "Save outfits"],
  },
  {
    id: "sub_premium",
    name: "Premium",
    creditsPerMonth: 30,
    price: 9.99,
    features: ["30 outfits/month", "Advanced AI styling", "Download outfits", "Priority support"],
    popular: true,
  },
  {
    id: "sub_unlimited",
    name: "Unlimited",
    creditsPerMonth: 999,
    price: 19.99,
    features: ["Unlimited outfits", "Premium AI models", "All features", "VIP support"],
  },
];

interface CreditsContextValue {
  credits: number;
  subscription: string | null;
  isLoading: boolean;
  refreshCredits: () => Promise<void>;
  useCredit: (feature?: string) => Promise<boolean>;
  purchasePackage: (
    packageId: string,
    urls?: { successUrl?: string; cancelUrl?: string },
  ) => Promise<{ url: string; sessionId: string }>;
  subscribeToPlan: (
    planId: string,
    urls?: { successUrl?: string; cancelUrl?: string },
  ) => Promise<{ url: string; sessionId: string }>;
  verifyPaymentSession: (
    sessionId: string | string[],
  ) => Promise<{ success: boolean; credits: number; subscription: string | null }>;
  grantDevCredits: (amount?: number) => Promise<{ success: boolean; grantedCredits: number; credits: number }>;
}

const CreditsContext = createContext<CreditsContextValue | null>(null);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [credits, setCredits] = useState(0);
  const [subscription, setSubscription] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setCredits(0);
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    refreshCredits()
      .catch((error) => {
        const status = (error as { status?: number } | null)?.status;
        if (status === 401) {
          setCredits(0);
          setSubscription(null);
          return;
        }
        console.error("Failed to load credits:", error);
      })
      .finally(() => setIsLoading(false));
  }, [authLoading, user?.id]);

  async function refreshCredits() {
    const data = await apiClient.getCredits();
    setCredits(data.credits ?? 0);
    setSubscription(data.subscription ?? null);
  }

  async function useCredit(feature: string = "style_generation"): Promise<boolean> {
    const data = await apiClient.useCredit(feature);
    setCredits(data.credits ?? 0);
    return true;
  }

  async function purchasePackage(
    packageId: string,
    urls?: { successUrl?: string; cancelUrl?: string },
  ): Promise<{ url: string; sessionId: string }> {
    return apiClient.createCheckoutSession({
      itemType: "package",
      itemId: packageId,
      successUrl: urls?.successUrl,
      cancelUrl: urls?.cancelUrl,
    });
  }

  async function subscribeToPlan(
    planId: string,
    urls?: { successUrl?: string; cancelUrl?: string },
  ): Promise<{ url: string; sessionId: string }> {
    return apiClient.createCheckoutSession({
      itemType: "subscription",
      itemId: planId,
      successUrl: urls?.successUrl,
      cancelUrl: urls?.cancelUrl,
    });
  }

  async function verifyPaymentSession(sessionId: string | string[]) {
    const result = await apiClient.verifyPaymentSession(sessionId);
    setCredits(result.credits ?? 0);
    setSubscription(result.subscription ?? null);
    return result;
  }

  async function grantDevCredits(amount?: number) {
    const result = await apiClient.grantDevCredits(amount);
    setCredits(result.credits ?? 0);
    return result;
  }

  const value = useMemo(
    () => ({
      credits,
      subscription,
      isLoading,
      refreshCredits,
      useCredit,
      purchasePackage,
      subscribeToPlan,
      verifyPaymentSession,
      grantDevCredits,
    }),
    [credits, subscription, isLoading],
  );

  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>;
}

export function useCredits() {
  const context = useContext(CreditsContext);
  if (!context) throw new Error("useCredits must be used within CreditsProvider");
  return context;
}
