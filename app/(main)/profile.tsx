import { View, Text, Pressable, ScrollView, StyleSheet, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useWardrobe } from "@/contexts/WardrobeContext";
import { useCredits, SUBSCRIPTION_PLANS } from "@/contexts/CreditsContext";

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as any} size={22} color={Colors.accent} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({ icon, label, onPress, color }: { icon: string; label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon as any} size={22} color={color || Colors.textSecondary} />
      <Text style={[styles.menuLabel, color ? { color } : undefined]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, deleteAccount } = useAuth();
  const { items, outfits } = useWardrobe();
  const { credits, subscription } = useCredits();

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const activeSub = SUBSCRIPTION_PLANS.find(p => p.id === subscription);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account, wardrobe, and all saved outfits. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              "All your data will be permanently lost.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete Everything",
                  style: "destructive",
                  onPress: async () => {
                    await deleteAccount();
                    router.replace("/(auth)/login");
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Animated.View entering={FadeIn.duration(600)} style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
          <Text style={styles.headerLabel}>Personal</Text>
          <Text style={styles.headerTitle}>Profile</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
          <Text style={styles.profileName}>{user?.name || "Guest"}</Text>
          <Text style={styles.profileEmail}>{user?.email || ""}</Text>
          {user?.provider && user.provider !== "email" && (
            <View style={styles.providerBadge}>
              <Ionicons
                name={user.provider === "apple" ? "logo-apple" : "logo-google"}
                size={14}
                color={Colors.accent}
              />
              <Text style={styles.providerText}>
                {user.provider === "apple" ? "Apple" : "Google"} Account
              </Text>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.creditsCard}>
          <View style={styles.creditsRow}>
            <View>
              <Text style={styles.creditsLabel}>Available Credits</Text>
              <Text style={styles.creditsValue}>{credits}</Text>
            </View>
            <Pressable
              onPress={() => router.push("/(main)/credits" as any)}
              style={({ pressed }) => [styles.buyCreditsBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="add" size={18} color={Colors.black} />
              <Text style={styles.buyCreditsText}>Get More</Text>
            </Pressable>
          </View>
          {activeSub && (
            <View style={styles.subBadge}>
              <Ionicons name="diamond" size={14} color={Colors.accent} />
              <Text style={styles.subBadgeText}>{activeSub.name} Plan Active</Text>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.statsRow}>
          <StatCard label="Items" value={items.length.toString()} icon="shirt-outline" />
          <StatCard label="Outfits" value={outfits.length.toString()} icon="layers-outline" />
          <StatCard label="Credits" value={credits.toString()} icon="sparkles-outline" />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.menuSection}>
          <MenuItem icon="diamond-outline" label="Credits & Subscription" onPress={() => router.push("/(main)/credits" as any)} />
          <MenuItem icon="color-palette-outline" label="Style Preferences" onPress={() => {}} />
          <MenuItem icon="heart-outline" label="Favorites" onPress={() => {}} />
          <MenuItem icon="notifications-outline" label="Notifications" onPress={() => {}} />
          <MenuItem icon="help-circle-outline" label="Help & Support" onPress={() => {}} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.dangerSection}>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="log-out-outline" size={20} color="#FF4444" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </Pressable>

          <Pressable
            onPress={handleDeleteAccount}
            style={({ pressed }) => [styles.deleteAccountButton, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="trash-outline" size={20} color="#FF6666" />
            <Text style={styles.deleteAccountText}>Delete Account</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
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
  profileCard: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  avatarText: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: Colors.black,
  },
  profileName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    color: Colors.white,
  },
  profileEmail: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  providerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(201, 169, 110, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  providerText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.accent,
  },
  creditsCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.accent,
    marginBottom: 16,
    gap: 12,
  },
  creditsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  creditsLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  creditsValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 32,
    color: Colors.accent,
  },
  buyCreditsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  buyCreditsText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.black,
  },
  subBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(201, 169, 110, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  subBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.accent,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    color: Colors.white,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
  },
  menuSection: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  menuLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.white,
    flex: 1,
  },
  dangerSection: {
    marginHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,68,68,0.3)",
    backgroundColor: "rgba(255,68,68,0.08)",
  },
  logoutText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#FF4444",
  },
  deleteAccountButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,102,102,0.2)",
    backgroundColor: "rgba(255,102,102,0.05)",
  },
  deleteAccountText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FF6666",
  },
});
