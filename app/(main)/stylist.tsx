import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useWardrobe, ClothingItem } from "@/contexts/WardrobeContext";
import { apiRequest } from "@/lib/query-client";

const OCCASIONS = [
  "Casual Day Out",
  "Business Meeting",
  "Evening Gala",
  "Date Night",
  "Weekend Brunch",
  "Beach Day",
  "Cocktail Party",
  "Travel",
];

function SelectableClothingItem({
  item,
  selected,
  onToggle,
}: {
  item: ClothingItem;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={() => { onToggle(); Haptics.selectionAsync(); }}
      style={[styles.selectableItem, selected && styles.selectableItemActive]}
    >
      {item.imageUri ? (
        <Image source={{ uri: item.imageUri }} style={styles.selectableImage} contentFit="cover" />
      ) : (
        <View style={styles.selectablePlaceholder}>
          <MaterialCommunityIcons name="hanger" size={20} color={Colors.textMuted} />
        </View>
      )}
      <Text style={styles.selectableText} numberOfLines={1}>{item.name}</Text>
      {selected && (
        <View style={styles.checkBadge}>
          <Ionicons name="checkmark" size={12} color={Colors.black} />
        </View>
      )}
    </Pressable>
  );
}

export default function StylistScreen() {
  const insets = useSafeAreaInsets();
  const { items, addOutfit } = useWardrobe();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [occasion, setOccasion] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const toggleItem = useCallback((id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const handleStyle = useCallback(async () => {
    if (selectedItems.length === 0 && !customPrompt.trim()) {
      Alert.alert("Error", "Please select items from your wardrobe or describe what you'd like to style");
      return;
    }

    setLoading(true);
    setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const selectedClothing = items.filter((i) => selectedItems.includes(i.id));
      const response = await apiRequest("POST", "/api/style", {
        items: selectedClothing.map((i) => ({
          name: i.name,
          category: i.category,
          color: i.color,
          description: i.description,
        })),
        occasion: occasion || "Any occasion",
        customPrompt: customPrompt.trim(),
      });

      const data = await response.json();
      setResult(data);

      await addOutfit({
        items: selectedClothing,
        occasion: occasion || "Any occasion",
        description: data.description,
        stylingTips: data.tips || [],
        imageBase64: data.imageBase64,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.error("Style error:", e);
      Alert.alert("Error", "Failed to generate styling. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [selectedItems, occasion, customPrompt, items, addOutfit]);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeIn.duration(600)} style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
          <Text style={styles.headerLabel}>AI Personal Stylist</Text>
          <Text style={styles.headerTitle}>Style Me</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Describe Your Look</Text>
          <TextInput
            style={styles.promptInput}
            value={customPrompt}
            onChangeText={setCustomPrompt}
            placeholder="e.g., A chic outfit for a winter evening, using my black coat and gold accessories..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
          />
        </Animated.View>

        {items.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.section}>
            <Text style={styles.sectionTitle}>
              Select Items ({selectedItems.length} selected)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemsScroll}>
              {items.map((item) => (
                <SelectableClothingItem
                  key={item.id}
                  item={item}
                  selected={selectedItems.includes(item.id)}
                  onToggle={() => toggleItem(item.id)}
                />
              ))}
            </ScrollView>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Occasion</Text>
          <View style={styles.occasionGrid}>
            {OCCASIONS.map((o) => (
              <Pressable
                key={o}
                onPress={() => { setOccasion(occasion === o ? "" : o); Haptics.selectionAsync(); }}
                style={[styles.occasionChip, occasion === o && styles.occasionChipActive]}
              >
                <Text style={[styles.occasionText, occasion === o && styles.occasionTextActive]}>{o}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.section}>
          <Pressable
            onPress={handleStyle}
            disabled={loading}
            style={({ pressed }) => [
              styles.styleButton,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              loading && { opacity: 0.7 },
            ]}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={Colors.black} />
                <Text style={styles.styleButtonText}>Creating your look...</Text>
              </View>
            ) : (
              <View style={styles.loadingRow}>
                <Ionicons name="sparkles" size={20} color={Colors.black} />
                <Text style={styles.styleButtonText}>Generate Outfit</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {result && (
          <Animated.View entering={FadeInDown.duration(600)} style={styles.resultSection}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Your Styled Look</Text>
              <View style={styles.resultBadge}>
                <Ionicons name="sparkles" size={14} color={Colors.accent} />
                <Text style={styles.resultBadgeText}>AI Styled</Text>
              </View>
            </View>

            {result.imageBase64 && (
              <View style={styles.resultImageContainer}>
                <Image
                  source={{ uri: `data:image/png;base64,${result.imageBase64}` }}
                  style={styles.resultImage}
                  contentFit="cover"
                />
              </View>
            )}

            <Text style={styles.resultDescription}>{result.description}</Text>

            {result.tips && result.tips.length > 0 && (
              <View style={styles.tipsContainer}>
                <Text style={styles.tipsTitle}>Styling Tips</Text>
                {result.tips.map((tip: string, i: number) => (
                  <View key={i} style={styles.tipRow}>
                    <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        )}
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
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  promptInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.white,
    minHeight: 80,
    textAlignVertical: "top",
  },
  itemsScroll: { gap: 12, paddingRight: 20 },
  selectableItem: {
    width: 90,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectableItemActive: { borderColor: Colors.accent },
  selectableImage: { width: "100%", height: 100 },
  selectablePlaceholder: {
    width: "100%",
    height: 100,
    backgroundColor: Colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
  },
  selectableText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.textSecondary,
    padding: 6,
    textAlign: "center",
  },
  checkBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  occasionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  occasionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  occasionChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  occasionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  occasionTextActive: { color: Colors.black },
  styleButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  styleButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.black,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultSection: {
    margin: 20,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  resultTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
    color: Colors.white,
  },
  resultBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(201, 169, 110, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resultBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.accent,
  },
  resultImageContainer: { borderRadius: 14, overflow: "hidden", marginBottom: 16 },
  resultImage: { width: "100%", aspectRatio: 3 / 4, borderRadius: 14 },
  resultDescription: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  tipsContainer: { gap: 10 },
  tipsTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.white,
    marginBottom: 4,
  },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
});
