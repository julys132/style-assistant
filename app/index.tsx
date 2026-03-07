import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { API_BASE_URL, apiClient } from "@/lib/api-client";

export default function IndexScreen() {
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        try {
          const health = await apiClient.healthCheck();
          console.log("[startup] API reachable", {
            baseUrl: API_BASE_URL,
            health,
          });
        } catch (healthError) {
          console.warn("[startup] API health check failed", {
            baseUrl: API_BASE_URL,
            message:
              healthError instanceof Error
                ? healthError.message
                : String(healthError),
          });
        }

        await apiClient.init();

        if (apiClient.isAuthenticated()) {
          await apiClient.getProfile();
          if (mounted) router.replace("/(tabs)/wardrobe");
          return;
        }

        if (mounted) router.replace("/welcome");
      } catch {
        await apiClient.clearAuth();
        if (mounted) router.replace("/welcome");
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={styles.loaderWrap}>
      <ActivityIndicator size="large" color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  loaderWrap: {
    flex: 1,
    backgroundColor: "#0A0A0F",
    alignItems: "center",
    justifyContent: "center",
  },
});

