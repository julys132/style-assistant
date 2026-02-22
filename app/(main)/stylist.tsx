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
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useWardrobe, ClothingItem } from "@/contexts/WardrobeContext";
import { useCredits } from "@/contexts/CreditsContext";
import { apiRequest } from "@/lib/query-client";
import { router } from "expo-router";

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
  const { credits, useCredit } = useCredits();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [occasion, setOccasion] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [modifyPrompt, setModifyPrompt] = useState("");
  const [showModifyModal, setShowModifyModal] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const toggleItem = useCallback((id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const pickPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setUploadedPhotos((prev) => [...prev, result.assets[0].uri]);
      Haptics.selectionAsync();
    }
  }, []);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setUploadedPhotos((prev) => [...prev, result.assets[0].uri]);
      Haptics.selectionAsync();
    }
  }, []);

  const removePhoto = useCallback((index: number) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStyle = useCallback(async () => {
    if (selectedItems.length === 0 && !customPrompt.trim() && uploadedPhotos.length === 0) {
      Alert.alert("Error", "Please add photos, select items, or describe what you'd like to style");
      return;
    }

    if (credits < 1) {
      Alert.alert(
        "No Credits",
        "You need at least 1 credit to generate an outfit. Would you like to get more credits?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Get Credits", onPress: () => router.push("/(main)/credits" as any) },
        ]
      );
      return;
    }

    setLoading(true);
    setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const hasCredit = await useCredit();
      if (!hasCredit) {
        Alert.alert("Error", "Failed to use credit. Please try again.");
        setLoading(false);
        return;
      }

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
        hasPhotos: uploadedPhotos.length > 0,
        photoCount: uploadedPhotos.length,
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
  }, [selectedItems, occasion, customPrompt, items, addOutfit, credits, useCredit, uploadedPhotos]);

  const handleDownload = useCallback(async () => {
    if (!result?.imageBase64) return;
    try {
      if (Platform.OS === "web") {
        const link = document.createElement("a");
        link.href = `data:image/png;base64,${result.imageBase64}`;
        link.download = "outfit.png";
        link.click();
        Alert.alert("Success", "Image downloaded!");
      } else {
        const fileUri = FileSystem.documentDirectory + `outfit_${Date.now()}.png`;
        await FileSystem.writeAsStringAsync(fileUri, result.imageBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert("Saved", "Outfit image saved to your device.");
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Error", "Failed to download image.");
    }
  }, [result]);

  const handleModify = useCallback(async () => {
    if (!modifyPrompt.trim()) {
      Alert.alert("Error", "Please describe the changes you'd like");
      return;
    }

    if (credits < 1) {
      Alert.alert(
        "No Credits",
        "Modifying an outfit costs 1 credit.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Get Credits", onPress: () => router.push("/(main)/credits" as any) },
        ]
      );
      return;
    }

    setModifying(true);
    setShowModifyModal(false);

    try {
      const hasCredit = await useCredit();
      if (!hasCredit) {
        setModifying(false);
        return;
      }

      const selectedClothing = items.filter((i) => selectedItems.includes(i.id));
      const response = await apiRequest("POST", "/api/style/modify", {
        originalDescription: result?.description || "",
        originalTips: result?.tips || [],
        modifyRequest: modifyPrompt.trim(),
        items: selectedClothing.map((i) => ({
          name: i.name,
          category: i.category,
          color: i.color,
          description: i.description,
        })),
        occasion: occasion || "Any occasion",
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

      setModifyPrompt("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Error", "Failed to modify outfit. Please try again.");
    } finally {
      setModifying(false);
    }
  }, [modifyPrompt, result, items, selectedItems, occasion, credits, useCredit, addOutfit]);

  const handleSaveOutfit = useCallback(() => {
    if (result) {
      Alert.alert("Saved", "This outfit has been saved to your collection.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [result]);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeIn.duration(600)} style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
          <View>
            <Text style={styles.headerLabel}>AI Personal Stylist</Text>
            <Text style={styles.headerTitle}>Style Me</Text>
          </View>
          <View style={styles.creditsBadge}>
            <Ionicons name="sparkles" size={14} color={Colors.accent} />
            <Text style={styles.creditsText}>{credits}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Add Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosScroll}>
            {uploadedPhotos.map((uri, index) => (
              <View key={index} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.photoThumbImage} contentFit="cover" />
                <Pressable onPress={() => removePhoto(index)} style={styles.removePhotoBtn}>
                  <Ionicons name="close" size={14} color={Colors.white} />
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={pickPhoto}
              style={styles.addPhotoBtn}
            >
              <Ionicons name="image-outline" size={24} color={Colors.textMuted} />
              <Text style={styles.addPhotoText}>Gallery</Text>
            </Pressable>
            <Pressable
              onPress={takePhoto}
              style={styles.addPhotoBtn}
            >
              <Ionicons name="camera-outline" size={24} color={Colors.textMuted} />
              <Text style={styles.addPhotoText}>Camera</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.section}>
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
              Select From Wardrobe ({selectedItems.length} selected)
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
                <View style={styles.creditCostBadge}>
                  <Text style={styles.creditCostText}>1 credit</Text>
                </View>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {(result || modifying) && (
          <Animated.View entering={FadeInDown.duration(600)} style={styles.resultSection}>
            {modifying ? (
              <View style={styles.modifyingContainer}>
                <ActivityIndicator size="large" color={Colors.accent} />
                <Text style={styles.modifyingText}>Modifying your outfit...</Text>
              </View>
            ) : (
              <>
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

                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={handleSaveOutfit}
                    style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="bookmark-outline" size={20} color={Colors.accent} />
                    <Text style={styles.actionBtnText}>Save</Text>
                  </Pressable>

                  {result.imageBase64 && (
                    <Pressable
                      onPress={handleDownload}
                      style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                    >
                      <Ionicons name="download-outline" size={20} color={Colors.accent} />
                      <Text style={styles.actionBtnText}>Download</Text>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={() => setShowModifyModal(true)}
                    style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="create-outline" size={20} color={Colors.accent} />
                    <Text style={styles.actionBtnText}>Modify</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Animated.View>
        )}
      </ScrollView>

      <Modal visible={showModifyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modify Outfit</Text>
              <Pressable onPress={() => setShowModifyModal(false)}>
                <Ionicons name="close" size={24} color={Colors.white} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>Describe the changes you'd like</Text>
              <TextInput
                style={styles.modifyInput}
                value={modifyPrompt}
                onChangeText={setModifyPrompt}
                placeholder="e.g., Make it more casual, swap the heels for sneakers, add a denim jacket..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={4}
              />
              <Pressable
                onPress={handleModify}
                style={({ pressed }) => [styles.modifyButton, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="sparkles" size={18} color={Colors.black} />
                <Text style={styles.modifyButtonText}>Apply Changes</Text>
                <View style={styles.creditCostBadge}>
                  <Text style={styles.creditCostText}>1 credit</Text>
                </View>
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
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
  creditsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(201, 169, 110, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 4,
  },
  creditsText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.accent,
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
  photosScroll: { gap: 10 },
  photoThumb: {
    width: 80,
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
  },
  photoThumbImage: { width: "100%", height: "100%" },
  removePhotoBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  addPhotoBtn: {
    width: 80,
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: "dashed",
    backgroundColor: Colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  addPhotoText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
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
  creditCostBadge: {
    backgroundColor: "rgba(0,0,0,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  creditCostText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.black,
  },
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
  actionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  actionBtn: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.accent,
  },
  modifyingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 16,
  },
  modifyingText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.textSecondary,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    color: Colors.white,
  },
  modalBody: { paddingHorizontal: 20, paddingBottom: 20, gap: 16 },
  modalSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  modifyInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.white,
    minHeight: 100,
    textAlignVertical: "top",
  },
  modifyButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    height: 52,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  modifyButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.black,
  },
});
