import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(user?.notificationsEnabled ?? true);
  }, [user?.id, user?.notificationsEnabled]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({ notificationsEnabled: enabled });
      Alert.alert("Saved", "Notification preferences were updated.");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Could not save notification preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </Pressable>
          <View>
            <Text style={styles.headerLabel}>My Profile</Text>
            <Text style={styles.headerTitle}>Notifications</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Style Tips & Updates</Text>
              <Text style={styles.rowSubtitle}>
                Receive useful reminders for credits, new features, and style recommendations.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              thumbColor={enabled ? Colors.accent : "#888"}
              trackColor={{ false: "#444", true: "rgba(201, 169, 110, 0.4)" }}
            />
          </View>
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.85 }, saving && { opacity: 0.6 }]}
        >
          <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Changes"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  backButton: { padding: 6, marginLeft: -6 },
  headerLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.accent,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    color: Colors.white,
  },
  section: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  rowTitle: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
    fontSize: 15,
    marginBottom: 4,
  },
  rowSubtitle: {
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  saveButton: {
    marginHorizontal: 20,
    marginTop: 18,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.black,
  },
});
