import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import { apiClient } from "@/lib/api-client";

type NativePlatform = "ios" | "android";

type PurchaseResult = {
  success: boolean;
  credits?: number;
  cancelled?: boolean;
  error?: string;
};

type IapProduct = {
  productId: string;
  title: string;
  description: string;
  localizedPrice: string;
  currency?: string;
};

type EventSubscription = {
  remove: () => void;
};

const DEFAULT_IOS_PRODUCT_MAP: Record<string, string> = {
  pack_5: "com.iulia.muse.credits.5",
  pack_15: "com.iulia.muse.credits.15",
  pack_30: "com.iulia.muse.credits.30",
  pack_100: "com.iulia.muse.credits.100",
};

const DEFAULT_ANDROID_PRODUCT_MAP: Record<string, string> = {
  pack_5: "com.iulia.muse.credits.5",
  pack_15: "com.iulia.muse.credits.15",
  pack_30: "com.iulia.muse.credits.30",
  pack_100: "com.iulia.muse.credits.100",
};

function parseProductMap(raw: string | undefined): Record<string, string> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, string>>((acc, [k, v]) => {
      if (typeof k === "string" && typeof v === "string" && k.trim() && v.trim()) {
        acc[k.trim()] = v.trim();
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
}

const IOS_PRODUCT_MAP = {
  ...DEFAULT_IOS_PRODUCT_MAP,
  ...parseProductMap(process.env.EXPO_PUBLIC_IOS_IAP_PRODUCT_MAP),
  ...parseProductMap(process.env.EXPO_PUBLIC_IAP_PRODUCT_MAP),
};

const ANDROID_PRODUCT_MAP = {
  ...DEFAULT_ANDROID_PRODUCT_MAP,
  ...parseProductMap(process.env.EXPO_PUBLIC_ANDROID_IAP_PRODUCT_MAP),
  ...parseProductMap(process.env.EXPO_PUBLIC_IAP_PRODUCT_MAP),
};

function getProductMapForPlatform(platform: NativePlatform): Record<string, string> {
  return platform === "ios" ? IOS_PRODUCT_MAP : ANDROID_PRODUCT_MAP;
}

export function resolveIapProductId(packageId: string, platform: NativePlatform): string | null {
  const map = getProductMapForPlatform(platform);
  return map[packageId] || null;
}

export function useIAP() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [products, setProducts] = useState<IapProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  const iapModuleRef = useRef<any>(null);
  const purchaseUpdatedSubscription = useRef<EventSubscription | null>(null);
  const purchaseErrorSubscription = useRef<EventSubscription | null>(null);
  const pendingResolve = useRef<((result: PurchaseResult) => void) | null>(null);

  const platform = (Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web") as
    | NativePlatform
    | "web";

  const resolvePending = useCallback((result: PurchaseResult) => {
    const resolver = pendingResolve.current;
    pendingResolve.current = null;
    setIsPurchasing(false);
    resolver?.(result);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      if (platform === "web") {
        setIsLoading(false);
        setIsAvailable(false);
        return;
      }

      try {
        const RNIap = await import("react-native-iap");
        if (cancelled) return;
        iapModuleRef.current = RNIap;

        await RNIap.initConnection();

        const productIds = Object.values(getProductMapForPlatform(platform));
        const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean)));

        const fetchedProducts = uniqueProductIds.length > 0
          ? await RNIap.fetchProducts({ skus: uniqueProductIds })
          : [];

        const normalizedProducts: IapProduct[] = (Array.isArray(fetchedProducts) ? fetchedProducts : []).map(
          (entry: any) => ({
            productId: String(entry.productId || entry.id || ""),
            title: String(entry.title || entry.localizedTitle || entry.displayName || "Credits"),
            description: String(entry.description || entry.localizedDescription || ""),
            localizedPrice: String(entry.localizedPrice || entry.displayPrice || entry.price || ""),
            currency: typeof entry.currency === "string" ? entry.currency : undefined,
          }),
        ).filter((entry) => entry.productId.length > 0);

        purchaseUpdatedSubscription.current = RNIap.purchaseUpdatedListener(async (purchase: any) => {
          const productId = String(purchase?.productId || purchase?.productIdentifier || "");
          let receipt = "";

          if (platform === "ios") {
            receipt = String(purchase?.transactionReceipt || "");
            if (!receipt && iapModuleRef.current?.getReceiptIOS) {
              try {
                receipt = String(await iapModuleRef.current.getReceiptIOS());
              } catch {
                receipt = "";
              }
            }
          } else {
            receipt = String(purchase?.purchaseToken || "");
          }

          if (!productId || !receipt) {
            resolvePending({ success: false, error: "Missing receipt or product ID." });
            return;
          }

          try {
            const verificationResult =
              platform === "ios"
                ? await apiClient.verifyApplePurchase(receipt, productId)
                : await apiClient.verifyGooglePurchase(receipt, productId);

            if (!verificationResult?.success) {
              resolvePending({
                success: false,
                error: verificationResult?.error || "Purchase verification failed.",
              });
              return;
            }

            try {
              await RNIap.finishTransaction({ purchase, isConsumable: true });
            } catch {
              // Credits are already granted server-side; do not fail user flow on finishTransaction errors.
            }

            resolvePending({
              success: true,
              credits: typeof verificationResult.credits === "number" ? verificationResult.credits : undefined,
            });
          } catch (verificationError: any) {
            resolvePending({
              success: false,
              error: verificationError?.message || "Could not verify purchase.",
            });
          }
        });

        purchaseErrorSubscription.current = RNIap.purchaseErrorListener((purchaseError: any) => {
          const code = String(purchaseError?.code || "");
          resolvePending({
            success: false,
            cancelled: code === "E_USER_CANCELLED",
            error: purchaseError?.message || "Purchase failed.",
          });
        });

        setProducts(normalizedProducts);
        setIsAvailable(normalizedProducts.length > 0);
        setError(
          normalizedProducts.length > 0
            ? null
            : "No in-app products are available. Store products may not be configured yet.",
        );
      } catch (initError: any) {
        if (cancelled) return;
        setIsAvailable(false);
        setError(initError?.message || "Could not initialize in-app purchases.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initialize();

    return () => {
      cancelled = true;
      purchaseUpdatedSubscription.current?.remove?.();
      purchaseErrorSubscription.current?.remove?.();
      try {
        iapModuleRef.current?.endConnection?.();
      } catch {
        // no-op
      }
    };
  }, [platform, resolvePending]);

  const purchaseProduct = useCallback(
    async (productId: string): Promise<PurchaseResult> => {
      if (platform === "web") {
        return { success: false, error: "In-app purchases are only available on mobile apps." };
      }

      if (!isAvailable || !iapModuleRef.current) {
        return { success: false, error: error || "In-app purchases are unavailable right now." };
      }

      if (!productId) {
        return { success: false, error: "Missing product ID." };
      }

      if (isPurchasing) {
        return { success: false, error: "A purchase is already in progress." };
      }

      setIsPurchasing(true);

      return new Promise<PurchaseResult>((resolve) => {
        pendingResolve.current = resolve;

        iapModuleRef.current
          .requestPurchase({
            type: "in-app",
            request: {
              apple: {
                sku: productId,
                andDangerouslyFinishTransactionAutomaticallyIOS: false,
              },
              google: {
                skus: [productId],
              },
            },
          })
          .catch((requestError: any) => {
            const code = String(requestError?.code || "");
            resolvePending({
              success: false,
              cancelled: code === "E_USER_CANCELLED",
              error: requestError?.message || "Failed to start purchase.",
            });
          });
      });
    },
    [platform, isAvailable, error, isPurchasing, resolvePending],
  );

  const restorePurchases = useCallback(async () => {
    if (platform === "web") return;
    const RNIap = iapModuleRef.current;
    if (!RNIap || !isAvailable) {
      Alert.alert("Unavailable", "In-app purchases are not available right now.");
      return;
    }

    try {
      const purchases = await RNIap.getAvailablePurchases();
      const purchaseList = Array.isArray(purchases) ? purchases : [];

      if (purchaseList.length === 0) {
        Alert.alert("No Purchases Found", "There are no previous purchases to restore.");
        return;
      }

      let restoredCount = 0;
      let failedCount = 0;

      for (const purchase of purchaseList) {
        const productId = String(purchase?.productId || purchase?.productIdentifier || "");
        if (!productId) {
          failedCount += 1;
          continue;
        }

        let receipt = "";
        if (platform === "ios") {
          receipt = String(purchase?.transactionReceipt || "");
          if (!receipt && iapModuleRef.current?.getReceiptIOS) {
            try {
              receipt = String(await iapModuleRef.current.getReceiptIOS());
            } catch {
              receipt = "";
            }
          }
        } else {
          receipt = String(purchase?.purchaseToken || "");
        }

        if (!receipt) {
          failedCount += 1;
          continue;
        }

        try {
          const verification =
            platform === "ios"
              ? await apiClient.verifyApplePurchase(receipt, productId)
              : await apiClient.verifyGooglePurchase(receipt, productId);

          if (!verification?.success) {
            failedCount += 1;
            continue;
          }

          restoredCount += 1;
          try {
            await RNIap.finishTransaction({ purchase, isConsumable: true });
          } catch {
            // no-op
          }
        } catch {
          failedCount += 1;
        }
      }

      if (restoredCount > 0) {
        Alert.alert(
          "Restore Complete",
          `Restored ${restoredCount} purchase(s)${failedCount > 0 ? `, ${failedCount} failed` : ""}.`,
        );
      } else {
        Alert.alert("Nothing Restored", "No new purchases needed restoring.");
      }
    } catch (restoreError: any) {
      Alert.alert("Restore Failed", restoreError?.message || "Could not restore purchases.");
    }
  }, [platform, isAvailable]);

  return {
    platform,
    isLoading,
    isAvailable,
    isPurchasing,
    products,
    error,
    purchaseProduct,
    restorePurchases,
  };
}
