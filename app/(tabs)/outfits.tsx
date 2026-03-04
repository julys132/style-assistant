import { View, Text, FlatList, Pressable, StyleSheet, Platform, Alert } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useWardrobe, OutfitResult } from "@/contexts/WardrobeContext";
import { useCallback } from "react";

function EmptyOutfits() {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="layers-outline" size={64} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>No Outfits Yet</Text>
      <Text style={styles.emptySubtitle}>
        Head to the Stylist tab to create your first AI-styled outfit
      </Text>
    </View>
  );
}

function OutfitCard({ outfit, onDelete, onDownload }: { outfit: OutfitResult; onDelete: () => void; onDownload: () => void }) {
  const date = new Date(outfit.createdAt);
  const formattedDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.outfitCard}>
      {outfit.imageBase64 && (
        <Image
          source={{ uri: `data:image/png;base64,${outfit.imageBase64}` }}
          style={styles.outfitImage}
          contentFit="cover"
        />
      )}

      <View style={styles.outfitContent}>
        <View style={styles.outfitMeta}>
          <View style={styles.occasionBadge}>
            <Text style={styles.occasionBadgeText}>{outfit.occasion}</Text>
          </View>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>

        <Text style={styles.outfitDesc} numberOfLines={3}>{outfit.description}</Text>

        {outfit.items.length > 0 && (
          <View style={styles.itemsList}>
            {outfit.items.slice(0, 3).map((item, i) => (
              <View key={i} style={styles.itemTag}>
                <Text style={styles.itemTagText}>{item.name}</Text>
              </View>
            ))}
            {outfit.items.length > 3 && (
              <Text style={styles.moreItems}>+{outfit.items.length - 3} more</Text>
            )}
          </View>
        )}

        {outfit.stylingTips.length > 0 && (
          <View style={styles.tipsPreview}>
            <Ionicons name="sparkles" size={12} color={Colors.accent} />
            <Text style={styles.tipPreviewText} numberOfLines={1}>
              {outfit.stylingTips[0]}
            </Text>
          </View>
        )}

        <View style={styles.cardActions}>
          {outfit.imageBase64 && (
            <Pressable
              onPress={() => { Haptics.selectionAsync(); onDownload(); }}
              style={({ pressed }) => [styles.cardActionBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="download-outline" size={16} color={Colors.accent} />
              <Text style={styles.cardActionText}>Download</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onDelete(); }}
            style={({ pressed }) => [styles.cardActionBtn, styles.cardDeleteBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="trash-outline" size={16} color="#FF4444" />
            <Text style={[styles.cardActionText, { color: "#FF4444" }]}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

export default function OutfitsScreen() {
  const insets = useSafeAreaInsets();
  const { outfits, removeOutfit } = useWardrobe();

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const performDelete = useCallback(async (id: string) => {
    try {
      await removeOutfit(id);
    } catch (error) {
      console.error("Delete outfit failed:", error);
      Alert.alert("Error", "Could not delete this outfit. Please try again.");
    }
  }, [removeOutfit]);

  const handleDelete = useCallback((id: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const confirmed = window.confirm("Are you sure you want to delete this outfit?");
      if (!confirmed) return;
      void performDelete(id);
      return;
    }

    Alert.alert("Delete Outfit", "Are you sure you want to delete this outfit?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void performDelete(id);
        },
      },
    ]);
  }, [performDelete]);

  const handleDownload = useCallback(async (outfit: OutfitResult) => {
    if (!outfit.imageBase64) return;
    try {
      if (Platform.OS === "web") {
        const link = document.createElement("a");
        link.href = `data:image/png;base64,${outfit.imageBase64}`;
        link.download = `outfit_${outfit.id}.png`;
        link.click();
        Alert.alert("Success", "Image downloaded!");
      } else {
        const fileUri = FileSystem.documentDirectory + `outfit_${outfit.id}.png`;
        await FileSystem.writeAsStringAsync(fileUri, outfit.imageBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert("Saved", "Outfit image saved.");
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Error", "Failed to download image.");
    }
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(600)} style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
        <Text style={styles.headerLabel}>Collection</Text>
        <Text style={styles.headerTitle}>My Outfits</Text>
      </Animated.View>

      <FlatList
        data={outfits}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OutfitCard
            outfit={item}
            onDelete={() => handleDelete(item.id)}
            onDownload={() => handleDownload(item)}
          />
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
        ListEmptyComponent={<EmptyOutfits />}
        showsVerticalScrollIndicator={false}
      />
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
  listContent: { paddingHorizontal: 20, paddingTop: 16 },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 120,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: Colors.white,
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  outfitCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  outfitImage: {
    width: "100%",
    aspectRatio: 4 / 3,
  },
  outfitContent: { padding: 16, gap: 10 },
  outfitMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  occasionBadge: {
    backgroundColor: "rgba(201, 169, 110, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  occasionBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.accent,
  },
  dateText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  outfitDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  itemsList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  itemTag: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  itemTagText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
  },
  moreItems: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    alignSelf: "center",
  },
  tipsPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 4,
  },
  tipPreviewText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.accent,
    flex: 1,
    fontStyle: "italic",
  },
  cardActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  cardActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(201, 169, 110, 0.1)",
  },
  cardDeleteBtn: {
    backgroundColor: "rgba(255, 68, 68, 0.1)",
    marginLeft: "auto",
  },
  cardActionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.accent,
  },
});
