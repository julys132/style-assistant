import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useWardrobe, ClothingItem } from "@/contexts/WardrobeContext";

const CATEGORIES = ["Top", "Bottom", "Dress", "Outerwear", "Shoes", "Accessory", "Bag"];
const COLORS_LIST = ["Black", "White", "Navy", "Gray", "Beige", "Brown", "Red", "Blue", "Green", "Pink", "Gold", "Silver"];

function EmptyWardrobe() {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="shirt-outline" size={64} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>Your Wardrobe is Empty</Text>
      <Text style={styles.emptySubtitle}>
        Add your clothing items to start creating stunning outfits
      </Text>
    </View>
  );
}

function ClothingCard({ item, onDelete }: { item: ClothingItem; onDelete: (id: string) => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.clothingCard}>
      {item.imageUri ? (
        <Image source={{ uri: item.imageUri }} style={styles.clothingImage} contentFit="cover" />
      ) : (
        <View style={styles.clothingImagePlaceholder}>
          <MaterialCommunityIcons name="hanger" size={32} color={Colors.textMuted} />
        </View>
      )}
      <View style={styles.clothingInfo}>
        <Text style={styles.clothingName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.clothingMeta}>{item.category} / {item.color}</Text>
      </View>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onDelete(item.id);
        }}
        style={styles.deleteBtn}
      >
        <Ionicons name="close" size={18} color={Colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

export default function WardrobeScreen() {
  const insets = useSafeAreaInsets();
  const { items, addItem, removeItem } = useWardrobe();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("");
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
      base64: true,
    });
    const selectedAsset = !result.canceled && result.assets[0] ? result.assets[0] : null;
    if (selectedAsset?.uri) {
      setImageUri(selectedAsset.uri);
    } else if (!result.canceled) {
      Alert.alert("Image error", "Could not read the selected image. Please try again.");
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a name for your item");
      return;
    }
    if (!category) {
      Alert.alert("Error", "Please select a category");
      return;
    }
    if (!color) {
      Alert.alert("Error", "Please select a color");
      return;
    }
    setSaving(true);
    try {
      await addItem({ name: name.trim(), category, color, imageUri, description: description.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
      setShowModal(false);
    } catch {
      Alert.alert("Error", "Failed to save item");
    } finally {
      setSaving(false);
    }
  }, [name, category, color, imageUri, description, addItem]);

  const resetForm = () => {
    setName("");
    setCategory("");
    setColor("");
    setImageUri(undefined);
    setDescription("");
  };

  const performDelete = useCallback(async (id: string) => {
    try {
      await removeItem(id);
    } catch (error) {
      console.error("Remove item failed:", error);
      Alert.alert("Error", "Could not remove this item. Please try again.");
    }
  }, [removeItem]);

  const handleDelete = useCallback((id: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const confirmed = window.confirm("Are you sure you want to remove this item?");
      if (!confirmed) return;
      void performDelete(id);
      return;
    }

    Alert.alert("Remove Item", "Are you sure you want to remove this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void performDelete(id);
        },
      },
    ]);
  }, [performDelete]);

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(600)} style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}>
        <View>
          <Text style={styles.headerLabel}>Digital Wardrobe</Text>
          <Text style={styles.headerTitle}>My Closet</Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowModal(true);
          }}
          style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
        >
          <Ionicons name="add" size={24} color={Colors.black} />
        </Pressable>
      </Animated.View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ClothingCard item={item} onDelete={handleDelete} />}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
        ListEmptyComponent={<EmptyWardrobe />}
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Item</Text>
              <Pressable onPress={() => { resetForm(); setShowModal(false); }}>
                <Ionicons name="close" size={24} color={Colors.white} />
              </Pressable>
            </View>

            <FlatList
              data={[1]}
              renderItem={() => (
                <View style={styles.modalBody}>
                  <Pressable onPress={pickImage} style={styles.imagePickerBtn}>
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={styles.pickedImage} contentFit="cover" />
                    ) : (
                      <View style={styles.imagePickerPlaceholder}>
                        <Ionicons name="camera-outline" size={36} color={Colors.textMuted} />
                        <Text style={styles.imagePickerText}>Add Photo</Text>
                      </View>
                    )}
                  </Pressable>

                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Name</Text>
                    <TextInput
                      style={styles.textInput}
                      value={name}
                      onChangeText={setName}
                      placeholder="e.g., Black Silk Blouse"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Category</Text>
                    <View style={styles.chipRow}>
                      {CATEGORIES.map((c) => (
                        <Pressable
                          key={c}
                          onPress={() => { setCategory(c); Haptics.selectionAsync(); }}
                          style={[styles.chip, category === c && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Color</Text>
                    <View style={styles.chipRow}>
                      {COLORS_LIST.map((c) => (
                        <Pressable
                          key={c}
                          onPress={() => { setColor(c); Haptics.selectionAsync(); }}
                          style={[styles.chip, color === c && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, color === c && styles.chipTextActive]}>{c}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Description (optional)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Material, brand, or any details..."
                      placeholderTextColor={Colors.textMuted}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.85 }, saving && { opacity: 0.6 }]}
                  >
                    {saving ? (
                      <ActivityIndicator color={Colors.black} />
                    ) : (
                      <Text style={styles.saveButtonText}>Add to Wardrobe</Text>
                    )}
                  </Pressable>
                </View>
              )}
              keyExtractor={() => "form"}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 16,
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
  addButton: {
    backgroundColor: Colors.accent,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: { paddingHorizontal: 14, paddingTop: 8 },
  row: { gap: 10, paddingHorizontal: 6 },
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
  clothingCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  clothingImage: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: Colors.surfaceLight,
  },
  clothingImagePlaceholder: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: Colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
  },
  clothingInfo: { padding: 10, gap: 2 },
  clothingName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.white,
  },
  clothingMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
  },
  deleteBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
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
  modalBody: { paddingHorizontal: 20, gap: 20, paddingBottom: 20 },
  imagePickerBtn: { borderRadius: 16, overflow: "hidden" },
  imagePickerPlaceholder: {
    width: "100%",
    height: 180,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  imagePickerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textMuted,
  },
  pickedImage: { width: "100%", height: 200, borderRadius: 16 },
  inputWrapper: { gap: 8 },
  inputLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  textInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.white,
  },
  textArea: { height: 80, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  chipTextActive: { color: Colors.black },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  saveButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.black,
  },
});
