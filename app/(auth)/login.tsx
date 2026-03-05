import { useEffect, useState } from "react";
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
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import * as Haptics from "expo-haptics";
import { apiClient } from "@/lib/api-client";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, socialLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [googleNativeModule, setGoogleNativeModule] =
    useState<typeof import("@react-native-google-signin/google-signin") | null>(null);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AppleAuthentication.isAvailableAsync()
      .then((available) => setAppleAuthAvailable(available))
      .catch(() => setAppleAuthAvailable(false));
  }, []);

  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const resolvedGoogleWebClientId =
    googleWebClientId || "placeholder.apps.googleusercontent.com";
  const nativeGoogleWebClientId = googleWebClientId || "";
  const googleIosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || googleWebClientId;
  const googleAndroidClientId =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || googleWebClientId;
  const googleAuthSessionConfigured = Boolean(
    googleWebClientId || googleIosClientId || googleAndroidClientId,
  );
  const googleNativeConfigured = nativeGoogleWebClientId.length > 0;
  const googleIsConfigured =
    Platform.OS === "android" ? googleNativeConfigured : googleAuthSessionConfigured;

  const googleAuthConfig: any = {
    ...(resolvedGoogleWebClientId
      ? {
          clientId: resolvedGoogleWebClientId,
          webClientId: resolvedGoogleWebClientId,
        }
      : {}),
    ...(googleIosClientId ? { iosClientId: googleIosClientId } : {}),
    ...(googleAndroidClientId ? { androidClientId: googleAndroidClientId } : {}),
    redirectUri:
      Platform.OS === "web" && typeof window !== "undefined"
        ? `${window.location.origin}/`
        : makeRedirectUri({ scheme: "muse" }),
    selectAccount: true,
  };
  const [googleRequest, , promptGoogleAuth] = Google.useIdTokenAuthRequest(googleAuthConfig);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    if (Platform.OS !== "android" || !googleNativeConfigured) return;
    let cancelled = false;

    (async () => {
      try {
        const googleSigninModule = await import("@react-native-google-signin/google-signin");
        if (cancelled) return;

        googleSigninModule.GoogleSignin.configure({
          webClientId: nativeGoogleWebClientId,
          offlineAccess: false,
          forceCodeForRefreshToken: false,
        });

        setGoogleNativeModule(googleSigninModule);
      } catch (error) {
        console.warn("Native Google Sign-In module unavailable on this build", error);
        setGoogleNativeModule(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [googleNativeConfigured, nativeGoogleWebClientId]);

  async function handleLogin() {
    setErrorMessage(null);
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/wardrobe");
    } catch (e: any) {
      const message = e?.message || "Login failed. Please try again.";
      setErrorMessage(message);
      Alert.alert("Error", message);
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
      if (!credential.identityToken) {
        throw new Error("Apple identity token not returned");
      }
      await socialLogin({
        provider: "apple",
        identityToken: credential.identityToken,
        email: credential.email || undefined,
        name: name || "Apple User",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/wardrobe");
    } catch (e: any) {
      if (e.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Error", "Apple Sign-In failed. Please try again.");
      }
    }
  }

  async function handleGoogleLogin() {
    try {
      if (Platform.OS === "android") {
        if (!googleNativeConfigured) {
          throw new Error(
            "Google Sign-In is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID for Android native sign-in.",
          );
        }
        if (!googleNativeModule) {
          Alert.alert(
            "Google Sign-In unavailable",
            "This build does not include native Google Sign-In. Use email login or run an Android development build.",
          );
          return;
        }

        const { GoogleSignin } = googleNativeModule;

        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });

        await GoogleSignin.signIn();
        const tokens = await GoogleSignin.getTokens();
        if (!tokens.idToken) {
          throw new Error("Google did not return an ID token");
        }

        await socialLogin({
          provider: "google",
          idToken: tokens.idToken,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)/wardrobe");
        return;
      }

      if (!googleAuthSessionConfigured) {
        throw new Error(
          "Google Sign-In is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID.",
        );
      }
      if (!googleRequest) {
        throw new Error("Google Sign-In is not ready yet");
      }

      const result: any = await promptGoogleAuth();
      if (result?.type !== "success") {
        return;
      }

      const idToken = result?.params?.id_token || result?.authentication?.idToken;
      if (!idToken) {
        throw new Error("Google did not return an ID token");
      }

      await socialLogin({
        provider: "google",
        idToken,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/wardrobe");
    } catch (e: any) {
      if (Platform.OS === "android") {
        const code = e?.code;
        const statusCodes = googleNativeModule?.statusCodes;
        if (
          code === statusCodes?.SIGN_IN_CANCELLED ||
          code === statusCodes?.IN_PROGRESS ||
          code === "SIGN_IN_CANCELLED" ||
          code === "IN_PROGRESS"
        ) {
          return;
        }
        if (
          code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE ||
          code === "PLAY_SERVICES_NOT_AVAILABLE"
        ) {
          Alert.alert("Error", "Google Play Services are not available on this device.");
          return;
        }
      }
      Alert.alert("Error", "Google Sign-In failed. Please try again.");
    }
  }

  async function handleResetPassword() {
    if (!resetEmail.trim() || !resetPasswordValue.trim() || !resetPasswordConfirm.trim()) {
      Alert.alert("Error", "Please complete all reset password fields.");
      return;
    }
    if (resetPasswordValue.length < 8) {
      Alert.alert("Error", "New password must be at least 8 characters.");
      return;
    }
    if (resetPasswordValue !== resetPasswordConfirm) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    setResetLoading(true);
    try {
      await apiClient.resetPassword(resetEmail.trim(), resetPasswordValue);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowResetModal(false);
      setResetPasswordValue("");
      setResetPasswordConfirm("");
      setPassword("");
      Alert.alert("Success", "Password updated. You can now sign in with the new password.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to reset password. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setResetLoading(false);
    }
  }

  const showApple = Platform.OS === "ios" && appleAuthAvailable;
  const showGoogle =
    Platform.OS === "web"
      ? true
      : Platform.OS === "android"
        ? googleIsConfigured && !!googleNativeModule
        : googleIsConfigured;

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
                onChangeText={(value) => {
                  setEmail(value);
                  if (errorMessage) setErrorMessage(null);
                }}
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
                onChangeText={(value) => {
                  setPassword(value);
                  if (errorMessage) setErrorMessage(null);
                }}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textMuted} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                setResetEmail((prev) => prev || email.trim());
                setShowResetModal(true);
              }}
              style={styles.forgotPasswordBtn}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </Pressable>

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

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

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

      <Modal visible={showResetModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <Pressable onPress={() => setShowResetModal(false)}>
                <Ionicons name="close" size={22} color={Colors.white} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Enter your account email and choose a new password.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Email"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={resetEmail}
              onChangeText={setResetEmail}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="New password (min 8 chars)"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              value={resetPasswordValue}
              onChangeText={setResetPasswordValue}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Confirm new password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              value={resetPasswordConfirm}
              onChangeText={setResetPasswordConfirm}
            />

            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowResetModal(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleResetPassword}
                disabled={resetLoading}
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  pressed && { opacity: 0.85 },
                  resetLoading && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.modalConfirmText}>
                  {resetLoading ? "Updating..." : "Reset"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  forgotPasswordBtn: {
    alignSelf: "flex-end",
    marginTop: -6,
  },
  forgotPasswordText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.accent,
  },
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
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#FF9A9A",
    lineHeight: 18,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    color: Colors.white,
  },
  modalSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 6,
  },
  modalInput: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBg,
    paddingHorizontal: 14,
    color: Colors.white,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCancelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  modalConfirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  modalConfirmText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.black,
  },
});

