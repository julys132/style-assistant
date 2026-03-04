import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useCredits } from "@/contexts/CreditsContext";
import { useAuth } from "@/contexts/AuthContext";

type Status = "loading" | "success" | "error";

export default function PaymentSuccessScreen() {
  const params = useLocalSearchParams<{
    session_id?: string | string[];
    cancelled?: string | string[];
  }>();
  const { user, isLoading: authLoading } = useAuth();
  const { verifyPaymentSession } = useCredits();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Verifying payment...");

  const sessionId = useMemo(() => {
    const raw = params.session_id;
    if (!raw) return "";
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.session_id]);

  const cancelled = useMemo(() => {
    const raw = params.cancelled;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value === "1" || value === "true";
  }, [params.cancelled]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }

    if (cancelled) {
      setStatus("error");
      setMessage("Payment was canceled.");
      return;
    }

    if (!sessionId) {
      setStatus("error");
      setMessage("Missing payment session ID.");
      return;
    }

    (async () => {
      try {
        const result = await verifyPaymentSession(sessionId);
        if (!result.success) {
          setStatus("error");
          setMessage("Payment is not completed yet.");
          return;
        }
        setStatus("success");
        setMessage("Payment confirmed. Credits were added to your account.");
      } catch (error: any) {
        setStatus("error");
        setMessage(error?.message || "Failed to verify payment.");
      }
    })();
  }, [authLoading, cancelled, user?.id, sessionId]);

  return (
    <View style={styles.container}>
      {status === "loading" ? (
        <ActivityIndicator size="large" color={Colors.accent} />
      ) : (
        <Ionicons
          name={status === "success" ? "checkmark-circle-outline" : "alert-circle-outline"}
          size={44}
          color={status === "success" ? Colors.accent : "#FF9A9A"}
        />
      )}
      <Text style={styles.title}>{status === "success" ? "Payment Success" : "Payment Verification"}</Text>
      <Text style={styles.message}>{message}</Text>

      <Pressable
        onPress={() => router.replace("/(tabs)/credits")}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.buttonText}>Back to Credits</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 14,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 30,
    color: Colors.white,
    textAlign: "center",
  },
  message: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  button: {
    marginTop: 8,
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.black,
    fontSize: 15,
  },
});
