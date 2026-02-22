import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";

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
  useCredit: () => Promise<boolean>;
  addCredits: (amount: number) => Promise<void>;
  setSubscription: (planId: string | null) => Promise<void>;
  purchasePackage: (packageId: string) => Promise<void>;
  subscribeToPlan: (planId: string) => Promise<void>;
}

const CreditsContext = createContext<CreditsContextValue | null>(null);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [credits, setCredits] = useState(3);
  const [subscription, setSubscriptionState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadCredits();
    } else {
      setCredits(3);
      setSubscriptionState(null);
      setIsLoading(false);
    }
  }, [user?.id]);

  async function loadCredits() {
    try {
      const key = `@stylist_credits_${user?.id}`;
      const subKey = `@stylist_sub_${user?.id}`;
      const [storedCredits, storedSub] = await Promise.all([
        AsyncStorage.getItem(key),
        AsyncStorage.getItem(subKey),
      ]);
      if (storedCredits !== null) {
        setCredits(parseInt(storedCredits, 10));
      } else {
        await AsyncStorage.setItem(key, "3");
        setCredits(3);
      }
      if (storedSub) setSubscriptionState(storedSub);
    } catch (e) {
      console.error("Failed to load credits:", e);
    } finally {
      setIsLoading(false);
    }
  }

  const saveCredits = useCallback(async (amount: number) => {
    if (!user) return;
    await AsyncStorage.setItem(`@stylist_credits_${user.id}`, amount.toString());
  }, [user]);

  const useCredit = useCallback(async () => {
    if (credits < 1) return false;
    const newCredits = credits - 1;
    setCredits(newCredits);
    await saveCredits(newCredits);
    return true;
  }, [credits, saveCredits]);

  const addCredits = useCallback(async (amount: number) => {
    const newCredits = credits + amount;
    setCredits(newCredits);
    await saveCredits(newCredits);
  }, [credits, saveCredits]);

  const setSubscription = useCallback(async (planId: string | null) => {
    if (!user) return;
    setSubscriptionState(planId);
    if (planId) {
      await AsyncStorage.setItem(`@stylist_sub_${user.id}`, planId);
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
      if (plan) {
        await addCredits(plan.creditsPerMonth);
      }
    } else {
      await AsyncStorage.removeItem(`@stylist_sub_${user.id}`);
    }
  }, [user, addCredits]);

  const purchasePackage = useCallback(async (packageId: string) => {
    const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
    if (!pkg) throw new Error("Invalid package");
    await addCredits(pkg.credits);
  }, [addCredits]);

  const subscribeToPlan = useCallback(async (planId: string) => {
    await setSubscription(planId);
  }, [setSubscription]);

  const value = useMemo(
    () => ({
      credits,
      subscription,
      isLoading,
      useCredit,
      addCredits,
      setSubscription,
      purchasePackage,
      subscribeToPlan,
    }),
    [credits, subscription, isLoading, useCredit, addCredits, setSubscription, purchasePackage, subscribeToPlan]
  );

  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>;
}

export function useCredits() {
  const context = useContext(CreditsContext);
  if (!context) throw new Error("useCredits must be used within CreditsProvider");
  return context;
}
