import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useWardrobe } from "@/contexts/WardrobeContext";

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();
  const { outfits } = useWardrobe();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFavorites(Array.isArray(user?.favoriteLooks) ? user.favoriteLooks : []);
  }, [user?.id, JSON.stringify(user?.favoriteLooks || [])]);

  const sortedOutfits = useMemo(
    () => [...outfits].sort((a, b) => b.createdAt - a.createdAt),
    [outfits],
  );

  function toggleFavorite(outfitId: string) {
    setFavorites((prev) => (prev.includes(outfitId) ? prev.filter((id) => id !== outfitId) : [...prev, outfitId]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({ favoriteLooks: favorites });
      Alert.alert("Saved", "Your favorites were updated.");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Could not save favorites.");
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
            <Text style={styles.headerTitle}>Favorites</Text>
          </View>
        </View>

        <View style={styles.section}>
          {sortedOutfits.length === 0 ? (
            <Text style={styles.emptyText}>No saved outfits yet. Generate outfits in Stylist first.</Text>
          ) : (
            sortedOutfits.map((outfit) => {
              const isFavorite = favorites.includes(outfit.id);
              return (
                <Pressable
                  key={outfit.id}
                  onPress={() => toggleFavorite(outfit.id)}
                  style={({ pressed }) => [styles.item, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.itemContent}>
                    <Text style={styles.itemTitle}>{outfit.occasion}</Text>
                    <Text style={styles.itemSubtitle} numberOfLines={2}>
                      {outfit.description}
                    </Text>
                  </View>
                  <Ionicons
                    name={isFavorite ? "heart" : "heart-outline"}
                    size={22}
                    color={isFavorite ? "#FF6666" : Colors.textMuted}
                  />
                </Pressable>
              );
            })
          )}
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.85 }, saving && { opacity: 0.6 }]}
        >
          <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save Favorites"}</Text>
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
    overflow: "hidden",
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    padding: 16,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    gap: 12,
  },
  itemContent: { flex: 1 },
  itemTitle: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
    fontSize: 14,
    marginBottom: 2,
  },
  itemSubtitle: {
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
