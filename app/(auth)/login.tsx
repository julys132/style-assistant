import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, socialLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(main)/wardrobe");
    } catch (e: any) {
      Alert.alert("Error", e.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleLogin() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const name = credential.fullName
        ? `${credential.fullName.givenName || ""} ${credential.fullName.familyName || ""}`.trim()
        : "Apple User";
      await socialLogin({
        id: credential.user,
        email: credential.email || `apple_${credential.user.substring(0, 8)}@private.apple`,
        name: name || "Apple User",
        provider: "apple",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(main)/wardrobe");
    } catch (e: any) {
      if (e.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Error", "Apple Sign-In failed. Please try again.");
      }
    }
  }

  async function handleGoogleLogin() {
    try {
      const id = Crypto.randomUUID();
      await socialLogin({
        id: `google_${id}`,
        email: `google_user_${id.substring(0, 6)}@gmail.com`,
        name: "Google User",
        provider: "google",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(main)/wardrobe");
    } catch (e: any) {
      Alert.alert("Error", "Google Sign-In failed. Please try again.");
    }
  }

  const showApple = Platform.OS === "ios";
  const showGoogle = Platform.OS !== "ios";

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#000000", "#0A0A0A", "#111111"]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + webTopInset + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(800)} style={styles.brandSection}>
            <Text style={styles.brandLabel}>AI Personal Stylist</Text>
            <Text style={styles.brandTitle}>The Stylist</Text>
            <View style={styles.brandLine} />
            <Text style={styles.brandQuote}>
              "Style is the art of being yourself."
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.formSection}>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textMuted} />
              </Pressable>
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.loginButton,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                loading && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.loginButtonText}>
                {loading ? "Signing in..." : "Sign In"}
              </Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialButtons}>
              {showApple && (
                <Pressable
                  onPress={handleAppleLogin}
                  style={({ pressed }) => [styles.socialButton, styles.appleButton, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
                  <Text style={styles.socialButtonText}>Apple</Text>
                </Pressable>
              )}
              {showGoogle && (
                <Pressable
                  onPress={handleGoogleLogin}
                  style={({ pressed }) => [styles.socialButton, styles.googleButton, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name="logo-google" size={20} color="#FFFFFF" />
                  <Text style={styles.socialButtonText}>Google</Text>
                </Pressable>
              )}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(500).duration(600)} style={[styles.footer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20) }]}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <Pressable onPress={() => router.push("/(auth)/register")}>
              <Text style={styles.footerLink}>Create Account</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  keyboardView: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 28 },
  brandSection: { marginBottom: 40 },
  brandLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.accent,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  brandTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 42,
    color: Colors.white,
    marginBottom: 16,
  },
  brandLine: {
    width: 40,
    height: 2,
    backgroundColor: Colors.accent,
    marginBottom: 16,
  },
  brandQuote: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 16,
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
  formSection: { gap: 16 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.white,
    height: "100%",
  },
  eyeBtn: { padding: 4 },
  loginButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  loginButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.black,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.cardBorder,
  },
  dividerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
  },
  socialButtons: {
    flexDirection: "row",
    gap: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
  },
  appleButton: {
    backgroundColor: "#1A1A1A",
    borderColor: "#333",
  },
  googleButton: {
    backgroundColor: "#1A1A1A",
    borderColor: "#333",
  },
  socialButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.white,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: "auto",
    paddingTop: 24,
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  footerLink: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.accent,
  },
});
