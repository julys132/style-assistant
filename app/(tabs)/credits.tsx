import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { resolveIapProductId, useIAP } from "@/hooks/useIAP";
import {
  useCredits,
  CREDIT_PACKAGES,
  SUBSCRIPTION_PLANS,
  CreditPackage,
  SubscriptionPlan,
} from "@/contexts/CreditsContext";

WebBrowser.maybeCompleteAuthSession();

function PackageCard({
  pkg,
  onPurchase,
  loading,
}: {
  pkg: CreditPackage;
  onPurchase: () => void;
  loading: boolean;
}) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPurchase(); }}
      disabled={loading}
      style={({ pressed }) => [
        styles.packageCard,
        pkg.popular && styles.packageCardPopular,
        pressed && { opacity: 0.85 },
      ]}
    >
      {pkg.popular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>Most Popular</Text>
        </View>
      )}
      <Text style={styles.packageName}>{pkg.name}</Text>
      <Text style={styles.packageCredits}>{pkg.credits}</Text>
      <Text style={styles.packageCreditsLabel}>credits</Text>
      <View style={styles.packagePriceRow}>
        <Text style={styles.packagePrice}>${pkg.price.toFixed(2)}</Text>
        <Text style={styles.packagePerCredit}>
          ${(pkg.price / pkg.credits).toFixed(2)}/credit
        </Text>
      </View>
    </Pressable>
  );
}

function SubPlanCard({
  plan,
  active,
  onSubscribe,
  loading,
}: {
  plan: SubscriptionPlan;
  active: boolean;
  onSubscribe: () => void;
  loading: boolean;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[styles.subCard, plan.popular && styles.subCardPopular, active && styles.subCardActive]}
    >
      {plan.popular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>Best Value</Text>
        </View>
      )}
      <Text style={styles.subName}>{plan.name}</Text>
      <View style={styles.subPriceRow}>
        <Text style={styles.subPrice}>${plan.price.toFixed(2)}</Text>
        <Text style={styles.subPricePeriod}>/month</Text>
      </View>
      <Text style={styles.subCredits}>{plan.creditsPerMonth === 999 ? "Unlimited" : plan.creditsPerMonth} outfits/month</Text>

      <View style={styles.featuresList}>
        {plan.features.map((feature, i) => (
          <View key={i} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.accent} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSubscribe(); }}
        disabled={loading || active}
        style={({ pressed }) => [
          styles.subButton,
          active && styles.subButtonActive,
          pressed && { opacity: 0.85 },
          loading && { opacity: 0.6 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={Colors.black} />
        ) : (
          <Text style={[styles.subButtonText, active && styles.subButtonTextActive]}>
            {active ? "Current Plan" : "Subscribe"}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function CreditsScreen() {
  const insets = useSafeAreaInsets();
  const {
    credits,
    subscription,
    purchasePackage,
    subscribeToPlan,
    verifyPaymentSession,
    grantDevCredits,
    refreshCredits,
  } = useCredits();
  const iap = useIAP();
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [subLoading, setSubLoading] = useState<string | null>(null);
  const [devGrantLoading, setDevGrantLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"credits" | "subscription">("credits");
  const showDevCreditTools = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_DEV_CREDITS === "true";
  const nativePlatform = Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  function getCheckoutUrls() {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const origin = window.location.origin;
      return {
        successUrl: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/credits`,
        redirectUrl: `${origin}/payment-success`,
      };
    }

    const redirectUrl = Linking.createURL("payment-success");
    const separator = redirectUrl.includes("?") ? "&" : "?";
    return {
      successUrl: `${redirectUrl}${separator}session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${redirectUrl}${separator}cancelled=1`,
      redirectUrl,
    };
  }

  async function runCheckout(
    url: string,
    redirectUrl: string,
  ): Promise<{ sessionId: string | null; cancelled: boolean }> {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.location.assign(url);
      }
      return { sessionId: null, cancelled: false };
    }

    const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
    if (result.type !== "success" || !result.url) {
      return {
        sessionId: null,
        cancelled: result.type === "cancel" || result.type === "dismiss",
      };
    }

    const parsed = Linking.parse(result.url);
    const rawSessionId = parsed.queryParams?.session_id;
    const rawCancelled = parsed.queryParams?.cancelled;
    const sessionId =
      typeof rawSessionId === "string"
        ? rawSessionId
        : Array.isArray(rawSessionId) && typeof rawSessionId[0] === "string"
          ? rawSessionId[0]
          : null;
    const cancelledValue =
      typeof rawCancelled === "string"
        ? rawCancelled
        : Array.isArray(rawCancelled) && typeof rawCancelled[0] === "string"
          ? rawCancelled[0]
          : "";
    const cancelled = cancelledValue === "1" || cancelledValue.toLowerCase() === "true";
    return { sessionId, cancelled };
  }

  async function handlePurchase(pkg: CreditPackage) {
    setPurchaseLoading(pkg.id);
    try {
      if (nativePlatform) {
        const iapProductId = resolveIapProductId(pkg.id, nativePlatform);
        if (iap.isAvailable && iapProductId) {
          const iapResult = await iap.purchaseProduct(iapProductId);
          if (iapResult.cancelled) {
            Alert.alert("Purchase canceled", "No payment was processed.");
            return;
          }
          if (!iapResult.success) {
            throw new Error(iapResult.error || "In-app purchase failed.");
          }

          await refreshCredits();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Success", `${pkg.credits} credits added to your account!`);
          return;
        }
      }

      const checkoutUrls = getCheckoutUrls();
      const checkout = await purchasePackage(pkg.id, {
        successUrl: checkoutUrls.successUrl,
        cancelUrl: checkoutUrls.cancelUrl,
      });
      if (!checkout.url) throw new Error("Checkout URL unavailable");
      const { sessionId, cancelled } = await runCheckout(checkout.url, checkoutUrls.redirectUrl);
      if (cancelled) {
        Alert.alert("Checkout canceled", "No payment was processed.");
        return;
      }
      if (!sessionId) return;

      const result = await verifyPaymentSession(sessionId);
      if (!result.success) {
        Alert.alert("Payment Pending", "Payment was not completed.");
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", `${pkg.credits} credits added to your account!`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Purchase failed. Please try again.");
    } finally {
      setPurchaseLoading(null);
    }
  }

  async function handleSubscribe(plan: SubscriptionPlan) {
    setSubLoading(plan.id);
    try {
      const checkoutUrls = getCheckoutUrls();
      const checkout = await subscribeToPlan(plan.id, {
        successUrl: checkoutUrls.successUrl,
        cancelUrl: checkoutUrls.cancelUrl,
      });
      if (!checkout.url) throw new Error("Checkout URL unavailable");
      const { sessionId, cancelled } = await runCheckout(checkout.url, checkoutUrls.redirectUrl);
      if (cancelled) {
        Alert.alert("Checkout canceled", "No subscription payment was processed.");
        return;
      }
      if (!sessionId) return;

      const result = await verifyPaymentSession(sessionId);
      if (!result.success) {
        Alert.alert("Payment Pending", "Subscription payment was not completed.");
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", `Subscribed to ${plan.name} plan!`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Subscription failed. Please try again.");
    } finally {
      setSubLoading(null);
    }
  }

  async function handleGrantDevCredits() {
    setDevGrantLoading(true);
    try {
      const result = await grantDevCredits(50);
      Alert.alert(
        "Test Credits Added",
        `${result.grantedCredits} credits were added. Current balance: ${result.credits}.`,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not add test credits.");
    } finally {
      setDevGrantLoading(false);
    }
  }

  async function handleRestorePurchases() {
    setRestoreLoading(true);
    try {
      await iap.restorePurchases();
      await refreshCredits();
    } finally {
      setRestoreLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Animated.View entering={FadeIn.duration(600)} style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </Pressable>
          <View>
            <Text style={styles.headerLabel}>Credits & Plans</Text>
            <Text style={styles.headerTitle}>Get Credits</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.balanceCard}>
          <Ionicons name="sparkles" size={28} color={Colors.accent} />
          <View>
            <Text style={styles.balanceLabel}>Current Balance</Text>
            <Text style={styles.balanceValue}>{credits} Credits</Text>
          </View>
        </Animated.View>

        {showDevCreditTools && (
          <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.devToolsCard}>
            <View style={styles.devToolsHeader}>
              <Ionicons name="flask-outline" size={16} color={Colors.accent} />
              <Text style={styles.devToolsTitle}>Developer Testing</Text>
            </View>
            <Text style={styles.devToolsText}>
              Add test credits instantly to verify styling requests and credit deductions.
            </Text>
            <Pressable
              onPress={handleGrantDevCredits}
              disabled={devGrantLoading}
              style={({ pressed }) => [
                styles.devGrantButton,
                pressed && { opacity: 0.85 },
                devGrantLoading && { opacity: 0.7 },
              ]}
            >
              {devGrantLoading ? (
                <ActivityIndicator color={Colors.black} />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={18} color={Colors.black} />
                  <Text style={styles.devGrantButtonText}>Add 50 Test Credits</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        )}

        <View style={styles.tabs}>
          <Pressable
            onPress={() => setActiveTab("credits")}
            style={[styles.tab, activeTab === "credits" && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === "credits" && styles.tabTextActive]}>Credit Packs</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("subscription")}
            style={[styles.tab, activeTab === "subscription" && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === "subscription" && styles.tabTextActive]}>Subscriptions</Text>
          </Pressable>
        </View>

        {activeTab === "credits" ? (
          <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.packagesGrid}>
            {CREDIT_PACKAGES.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                onPurchase={() => handlePurchase(pkg)}
                loading={purchaseLoading === pkg.id || iap.isPurchasing}
              />
            ))}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.subsSection}>
            {SUBSCRIPTION_PLANS.map((plan) => (
              <SubPlanCard
                key={plan.id}
                plan={plan}
                active={subscription === plan.id}
                onSubscribe={() => handleSubscribe(plan)}
                loading={subLoading === plan.id}
              />
            ))}
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.paymentInfo}>
          <Text style={styles.paymentInfoTitle}>Payment Methods</Text>
          <View style={styles.paymentRow}>
            {nativePlatform === "ios" ? (
              <>
                <View style={styles.paymentMethod}>
                  <Ionicons name="logo-apple" size={20} color={Colors.white} />
                  <Text style={styles.paymentMethodText}>
                    {iap.isAvailable ? "Apple In-App Purchase" : "Apple IAP (not configured)"}
                  </Text>
                </View>
                <View style={styles.paymentMethod}>
                  <Ionicons name="card-outline" size={20} color={Colors.white} />
                  <Text style={styles.paymentMethodText}>Stripe</Text>
                </View>
              </>
            ) : nativePlatform === "android" ? (
              <>
                <View style={styles.paymentMethod}>
                  <Ionicons name="logo-google" size={20} color={Colors.white} />
                  <Text style={styles.paymentMethodText}>
                    {iap.isAvailable ? "Google Play Billing" : "Google Play IAP (not configured)"}
                  </Text>
                </View>
                <View style={styles.paymentMethod}>
                  <Ionicons name="card-outline" size={20} color={Colors.white} />
                  <Text style={styles.paymentMethodText}>Stripe</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.paymentMethod}>
                  <Ionicons name="card-outline" size={20} color={Colors.white} />
                  <Text style={styles.paymentMethodText}>Stripe</Text>
                </View>
              </>
            )}
          </View>
          <Text style={styles.paymentNote}>
            {nativePlatform
              ? "In-app purchases are used on mobile when configured. Stripe checkout remains available as fallback."
              : "Secure Stripe checkout for web purchases."}
          </Text>
          {nativePlatform && !iap.isLoading && !iap.isAvailable && iap.error ? (
            <Text style={styles.paymentWarning}>{iap.error}</Text>
          ) : null}
          {nativePlatform && iap.isAvailable && (
            <Pressable
              onPress={handleRestorePurchases}
              disabled={restoreLoading}
              style={({ pressed }) => [
                styles.restoreButton,
                pressed && { opacity: 0.85 },
                restoreLoading && { opacity: 0.7 },
              ]}
            >
              {restoreLoading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="refresh" size={16} color={Colors.white} />
                  <Text style={styles.restoreButtonText}>Restore Purchases</Text>
                </>
              )}
            </Pressable>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 16,
  },
  backBtn: { paddingBottom: 4 },
  headerLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.accent,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: Colors.white,
  },
  balanceCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.accent,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  balanceLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  balanceValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: Colors.accent,
  },
  devToolsCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 10,
    marginBottom: 20,
  },
  devToolsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  devToolsTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.accent,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  devToolsText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  devGrantButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  devGrantButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.black,
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: Colors.accent,
  },
  tabText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.black,
  },
  packagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    gap: 12,
  },
  packageCard: {
    width: "47%",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: "center",
    gap: 4,
  },
  packageCardPopular: {
    borderColor: Colors.accent,
    backgroundColor: "rgba(201, 169, 110, 0.08)",
  },
  popularBadge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
  },
  popularText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.black,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  packageName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.white,
  },
  packageCredits: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 36,
    color: Colors.accent,
  },
  packageCreditsLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: -4,
  },
  packagePriceRow: { alignItems: "center", gap: 2, marginTop: 8 },
  packagePrice: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: Colors.white,
  },
  packagePerCredit: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  subsSection: {
    paddingHorizontal: 20,
    gap: 16,
  },
  subCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 8,
  },
  subCardPopular: {
    borderColor: Colors.accent,
    backgroundColor: "rgba(201, 169, 110, 0.06)",
  },
  subCardActive: {
    borderColor: Colors.success,
    backgroundColor: "rgba(76, 175, 80, 0.06)",
  },
  subName: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: Colors.white,
  },
  subPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  subPrice: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 28,
    color: Colors.accent,
  },
  subPricePeriod: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  subCredits: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  featuresList: { gap: 8, marginTop: 8 },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  subButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  subButtonActive: {
    backgroundColor: "rgba(76, 175, 80, 0.2)",
    borderWidth: 1,
    borderColor: Colors.success,
  },
  subButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.black,
  },
  subButtonTextActive: {
    color: Colors.success,
  },
  paymentInfo: {
    marginHorizontal: 20,
    marginTop: 28,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 12,
  },
  paymentInfoTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.white,
  },
  paymentRow: {
    flexDirection: "row",
    gap: 12,
  },
  paymentMethod: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  paymentMethodText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.white,
  },
  paymentNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  paymentWarning: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#FFD7A0",
    lineHeight: 18,
  },
  restoreButton: {
    marginTop: 2,
    alignSelf: "flex-start",
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.surfaceLight,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  restoreButtonText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.white,
  },
});
