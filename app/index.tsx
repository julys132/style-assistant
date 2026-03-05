import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { API_BASE_URL, apiClient } from "@/lib/api-client";

export default function IndexScreen() {
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        try {
          const health = await apiClient.healthCheck();
          console.log("[startup] API reachable", { baseUrl: API_BASE_URL, health });
        } catch (healthError) {
          console.warn("[startup] API health check failed", {
            baseUrl: API_BASE_URL,
            message: healthError instanceof Error ? healthError.message : String(healthError),
          });
        }

        await apiClient.init();

        if (!apiClient.isAuthenticated()) {
          if (mounted) router.replace("/(auth)/login");
          return;
        }

        await apiClient.getProfile();
        if (mounted) router.replace("/(tabs)/wardrobe");
      } catch {
        await apiClient.clearAuth();
        if (mounted) router.replace("/(auth)/login");
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color="#C9A96E" />
    </View>
  );
}

