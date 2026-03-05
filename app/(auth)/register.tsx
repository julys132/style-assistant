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

WebBrowser.maybeCompleteAuthSession();

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { register, socialLogin } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  async function handleRegister() {
    setErrorMessage(null);
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/wardrobe");
    } catch (e: any) {
      const message = e?.message || "Registration failed. Please try again.";
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
      const fullName = credential.fullName
        ? `${credential.fullName.givenName || ""} ${credential.fullName.familyName || ""}`.trim()
        : "Apple User";
      if (!credential.identityToken) {
        throw new Error("Apple identity token not returned");
      }
      await socialLogin({
        provider: "apple",
        identityToken: credential.identityToken,
        email: credential.email || undefined,
        name: fullName || "Apple User",
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
          contentContainerStyle={[styles.content, { paddingTop: insets.top + webTopInset + 30 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </Pressable>

          <Animated.View entering={FadeIn.duration(800)} style={styles.brandSection}>
            <Text style={styles.brandLabel}>Join Us</Text>
            <Text style={styles.brandTitle}>Create Account</Text>
            <View style={styles.brandLine} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.formSection}>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={Colors.textMuted}
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="words"
              />
            </View>

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
                placeholder="Password (min 8 characters)"
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
              onPress={handleRegister}
              disabled={loading}
              style={({ pressed }) => [
                styles.registerButton,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                loading && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.registerButtonText}>
                {loading ? "Creating Account..." : "Create Account"}
              </Text>
            </Pressable>

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign up with</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialButtons}>
              {showApple && (
                <Pressable
                  onPress={handleAppleLogin}
                  style={({ pressed }) => [styles.socialButton, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
                  <Text style={styles.socialButtonText}>Apple</Text>
                </Pressable>
              )}
              {showGoogle && (
                <Pressable
                  onPress={handleGoogleLogin}
                  style={({ pressed }) => [styles.socialButton, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name="logo-google" size={20} color="#FFFFFF" />
                  <Text style={styles.socialButtonText}>Google</Text>
                </Pressable>
              )}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(600)} style={[styles.footer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20) }]}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.footerLink}>Sign In</Text>
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
  backBtn: { marginBottom: 20 },
  brandSection: { marginBottom: 32 },
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
    fontSize: 36,
    color: Colors.white,
    marginBottom: 16,
  },
  brandLine: {
    width: 40,
    height: 2,
    backgroundColor: Colors.accent,
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
  registerButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  registerButtonText: {
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
    marginVertical: 4,
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
    borderColor: "#333",
    backgroundColor: "#1A1A1A",
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

