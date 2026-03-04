import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { apiClient } from "@/lib/api-client";

export default function IndexScreen() {
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
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

