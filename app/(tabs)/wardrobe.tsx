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
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useWardrobe, ClothingItem } from "@/contexts/WardrobeContext";
import { apiClient } from "@/lib/api-client";

const CATEGORIES = ["Top", "Bottom", "Dress", "Outerwear", "Shoes", "Accessory", "Bag"];
const COLORS_LIST = [
  "Black",
  "White",
  "Navy",
  "Gray",
  "Beige",
  "Brown",
  "Red",
  "Blue",
  "Green",
  "Pink",
  "Gold",
  "Silver",
  "Yellow",
  "Orange",
  "Purple",
  "Multi",
];
const PATTERN_LIST = ["Solid", "Striped", "Floral", "Checked", "Graphic", "Other"];
const SUGGEST_MODELS = [
  { id: "auto", label: "Auto" },
  { id: "uform", label: "Uform" },
  { id: "llava", label: "LLaVA" },
] as const;
type SuggestModel = (typeof SUGGEST_MODELS)[number]["id"];
type WardrobeGridSize = "small" | "medium" | "large";

const DEFAULT_SUGGEST_MODEL: SuggestModel = "uform";
const SHOW_DEVELOPER_MODEL_SWITCH =
  __DEV__ || process.env.EXPO_PUBLIC_SHOW_WARDROBE_MODEL_SWITCH === "true";
const GRID_SIZE_OPTIONS: { id: WardrobeGridSize; label: string }[] = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
];

function stripDataUriPrefix(base64OrDataUri: string): string {
  const commaIndex = base64OrDataUri.indexOf(",");
  return commaIndex >= 0 ? base64OrDataUri.slice(commaIndex + 1) : base64OrDataUri;
}

function resolveRenderableImageUri(imageUri?: string): string | null {
  const normalized = typeof imageUri === "string" ? imageUri.trim() : "";
  if (!normalized) return null;

  if (Platform.OS === "web" && normalized.startsWith("blob:")) {
    // Blob URLs are session-only on web and can break after reload.
    return null;
  }

  if (normalized.startsWith("data:image/")) return normalized;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(normalized)) return normalized;
  if (normalized.startsWith("/")) return normalized;

  return null;
}

async function readWebImageAsBase64(uri: string): Promise<string> {
  if (Platform.OS !== "web") return "";

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("Could not load selected image");
  }
  const blob = await response.blob();

  const dataUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read selected image"));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("Could not read selected image"));
    reader.readAsDataURL(blob);
  });

  return stripDataUriPrefix(dataUri);
}

function normalizeOptionFromList(
  value: unknown,
  options: readonly string[],
  aliases: Record<string, string> = {},
): string {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) return "";

  if (aliases[normalized]) return aliases[normalized];

  const direct = options.find((option) => option.toLowerCase() === normalized);
  if (direct) return direct;

  const compact = normalized.replace(/[_-]+/g, " ");
  if (aliases[compact]) return aliases[compact];

  const partial = options.find((option) => compact.includes(option.toLowerCase()));
  return partial || "";
}

function isGenericSuggestedName(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized === "item" ||
    normalized === "clothing item" ||
    normalized === "fashion item" ||
    normalized === "garment" ||
    normalized === "product"
  );
}

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

function ClothingCard({
  item,
  onDelete,
  cardWidth,
}: {
  item: ClothingItem;
  onDelete: (id: string) => void;
  cardWidth: number;
}) {
  const displayImageUri = resolveRenderableImageUri(item.imageUri);

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={[styles.clothingCard, { width: cardWidth }]}>
      {displayImageUri ? (
        <Image source={{ uri: displayImageUri }} style={styles.clothingImage} contentFit="cover" />
      ) : (
        <View style={styles.clothingImagePlaceholder}>
          <MaterialCommunityIcons name="hanger" size={32} color={Colors.textMuted} />
        </View>
      )}
      <View style={styles.clothingInfo}>
        <Text style={styles.clothingName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.clothingMeta}>
          {item.category} / {item.color}{item.shade ? ` (${item.shade})` : ""}{item.pattern ? ` / ${item.pattern}` : ""}
        </Text>
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
  const { width: screenWidth } = useWindowDimensions();
  const { items, addItem, removeItem } = useWardrobe();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("");
  const [shade, setShade] = useState("");
  const [pattern, setPattern] = useState("");
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [imageBase64, setImageBase64] = useState("");
  const [imageMimeType, setImageMimeType] = useState("image/jpeg");
  const [suggestModel, setSuggestModel] = useState<SuggestModel>(DEFAULT_SUGGEST_MODEL);
  const [suggestedShade, setSuggestedShade] = useState("");
  const [modelUsedLabel, setModelUsedLabel] = useState("");
  const [description, setDescription] = useState("");
  const [gridSize, setGridSize] = useState<WardrobeGridSize>("small");
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const listHorizontalPadding = 20;
  const gridGap = 10;
  const gridColumns =
    gridSize === "small"
      ? screenWidth >= 1200
        ? 5
        : screenWidth >= 960
          ? 4
          : screenWidth >= 640
            ? 3
            : 2
      : gridSize === "medium"
        ? screenWidth >= 960
          ? 3
          : 2
        : screenWidth >= 960
          ? 2
          : 1;
  const cardWidth = Math.floor(
    (screenWidth - listHorizontalPadding * 2 - gridGap * (gridColumns - 1)) / gridColumns,
  );

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.45,
      base64: true,
    });
    const selectedAsset = !result.canceled && result.assets[0] ? result.assets[0] : null;
    if (selectedAsset?.uri) {
      let resolvedBase64 = selectedAsset.base64 || "";
      if (!resolvedBase64 && Platform.OS === "web") {
        try {
          resolvedBase64 = await readWebImageAsBase64(selectedAsset.uri);
        } catch (error) {
          console.warn("Failed to read web image as base64:", error);
        }
      }

      setImageUri(selectedAsset.uri);
      setImageBase64(resolvedBase64);
      setImageMimeType(selectedAsset.mimeType || "image/jpeg");
      setSuggestedShade("");
      setModelUsedLabel("");
    } else if (!result.canceled) {
      Alert.alert("Image error", "Could not read the selected image. Please try again.");
    }
  }, []);

  const handleSuggestDetails = useCallback(async () => {
    if (!imageBase64) {
      Alert.alert("Image required", "Please choose a photo first.");
      return;
    }

    setSuggesting(true);
    try {
      const suggestion = await apiClient.suggestWardrobeDetails({
        imageBase64,
        mimeType: imageMimeType,
        model: suggestModel,
      });
      console.log("[wardrobe suggest] raw suggestion:", suggestion);

      const normalizedCategory = normalizeOptionFromList(suggestion.category, CATEGORIES, {
        tee: "Top",
        tshirt: "Top",
        "t-shirt": "Top",
        shirt: "Top",
        blouse: "Top",
        pants: "Bottom",
        trousers: "Bottom",
        jeans: "Bottom",
        jacket: "Outerwear",
        coat: "Outerwear",
        blazer: "Outerwear",
        sneakers: "Shoes",
        sneaker: "Shoes",
        sandals: "Shoes",
        boot: "Shoes",
        purse: "Bag",
        handbag: "Bag",
      });
      const normalizedColor = normalizeOptionFromList(suggestion.color, COLORS_LIST, {
        grey: "Gray",
        gray: "Gray",
        charcoal: "Gray",
        heather: "Gray",
        ivory: "White",
        cream: "White",
        tan: "Beige",
        camel: "Beige",
        burgundy: "Red",
        maroon: "Red",
        olive: "Green",
        multicolor: "Multi",
        multicolour: "Multi",
      });
      const normalizedPattern = normalizeOptionFromList(suggestion.pattern, PATTERN_LIST, {
        stripe: "Striped",
        stripes: "Striped",
        checkered: "Checked",
        plaid: "Checked",
        plain: "Solid",
        print: "Graphic",
      });

      const normalizedName =
        typeof suggestion.name === "string"
          ? suggestion.name.trim().replace(/\s+/g, " ")
          : "";
      if (normalizedName && !isGenericSuggestedName(normalizedName)) {
        setName(normalizedName);
      }
      if (normalizedCategory) {
        setCategory(normalizedCategory);
      }
      if (normalizedColor) {
        setColor(normalizedColor);
      }
      if (normalizedPattern) {
        setPattern(normalizedPattern);
      }

      const normalizedShade =
        typeof suggestion.shade === "string" ? suggestion.shade.trim().replace(/\s+/g, " ") : "";
      if (normalizedShade) {
        setSuggestedShade(normalizedShade);
        setShade(normalizedShade);
      } else {
        setSuggestedShade("");
      }
      if (suggestion.modelUsed) {
        setModelUsedLabel(suggestion.modelUsed.toUpperCase());
      } else {
        setModelUsedLabel("");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not suggest details for this photo.";
      Alert.alert("Suggest failed", message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSuggesting(false);
    }
  }, [imageBase64, imageMimeType, suggestModel]);

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
      let resolvedBase64 = imageBase64;
      if (Platform.OS === "web" && !resolvedBase64 && imageUri) {
        try {
          resolvedBase64 = await readWebImageAsBase64(imageUri);
          setImageBase64(resolvedBase64);
        } catch (error) {
          console.warn("Failed to recover base64 for web wardrobe image:", error);
        }
      }

      const persistedImageUri =
        Platform.OS === "web" && resolvedBase64
          ? `data:${imageMimeType || "image/jpeg"};base64,${resolvedBase64}`
          : imageUri;

      await addItem({
        name: name.trim(),
        category,
        color,
        shade: shade.trim() || undefined,
        pattern,
        imageUri: persistedImageUri,
        description: description.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
      setShowModal(false);
    } catch {
      Alert.alert("Error", "Failed to save item");
    } finally {
      setSaving(false);
    }
  }, [name, category, color, shade, pattern, imageUri, imageBase64, imageMimeType, description, addItem]);

  const resetForm = () => {
    setName("");
    setCategory("");
    setColor("");
    setShade("");
    setPattern("");
    setImageUri(undefined);
    setImageBase64("");
    setImageMimeType("image/jpeg");
    setSuggestedShade("");
    setModelUsedLabel("");
    setSuggestModel(DEFAULT_SUGGEST_MODEL);
    setDescription("");
    setSuggesting(false);
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

      <View style={styles.viewModeContainer}>
        <Text style={styles.viewModeLabel}>View size</Text>
        <View style={styles.viewModeRow}>
          {GRID_SIZE_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => {
                setGridSize(option.id);
                Haptics.selectionAsync();
              }}
              style={[styles.viewModeChip, gridSize === option.id && styles.viewModeChipActive]}
            >
              <Text style={[styles.viewModeChipText, gridSize === option.id && styles.viewModeChipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ClothingCard item={item} onDelete={handleDelete} cardWidth={cardWidth} />}
        numColumns={gridColumns}
        key={`wardrobe-grid-${gridColumns}`}
        columnWrapperStyle={gridColumns > 1 ? styles.row : undefined}
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
                  {imageUri ? (
                    <View style={styles.suggestBlock}>
                      {SHOW_DEVELOPER_MODEL_SWITCH ? (
                        <>
                          <Text style={styles.inputLabel}>AI Model (Developer)</Text>
                          <View style={styles.suggestModelRow}>
                            {SUGGEST_MODELS.map((option) => (
                              <Pressable
                                key={option.id}
                                onPress={() => {
                                  setSuggestModel(option.id);
                                  Haptics.selectionAsync();
                                }}
                                style={[styles.suggestModelChip, suggestModel === option.id && styles.suggestModelChipActive]}
                              >
                                <Text
                                  style={[
                                    styles.suggestModelChipText,
                                    suggestModel === option.id && styles.suggestModelChipTextActive,
                                  ]}
                                >
                                  {option.label}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </>
                      ) : null}
                      <Text style={styles.suggestHintText}>
                        {SHOW_DEVELOPER_MODEL_SWITCH
                          ? suggestModel === "uform"
                            ? "Uform primary, LLaVA backup."
                            : suggestModel === "llava"
                              ? "LLaVA primary, Uform backup."
                              : "Auto: Uform primary, LLaVA backup."
                          : "Using default low-cost AI model."}
                      </Text>

                      <Pressable
                        onPress={handleSuggestDetails}
                        disabled={suggesting}
                        style={({ pressed }) => [
                          styles.suggestButton,
                          pressed && { opacity: 0.85 },
                          suggesting && { opacity: 0.7 },
                        ]}
                      >
                        {suggesting ? (
                          <ActivityIndicator color={Colors.black} />
                        ) : (
                          <Text style={styles.suggestButtonText}>Suggest details</Text>
                        )}
                      </Pressable>

                      {SHOW_DEVELOPER_MODEL_SWITCH && modelUsedLabel ? (
                        <Text style={styles.suggestHintText}>Suggested by: {modelUsedLabel}</Text>
                      ) : null}
                      {suggestedShade ? (
                        <View style={styles.suggestedShadeRow}>
                          <Text style={styles.suggestedShadeText}>Suggested shade: {suggestedShade}</Text>
                          <Pressable
                            onPress={() => {
                              setShade(suggestedShade);
                              Haptics.selectionAsync();
                            }}
                            style={styles.applyShadeButton}
                          >
                            <Text style={styles.applyShadeButtonText}>Use</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

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
                    <Text style={styles.inputLabel}>Shade (optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={shade}
                      onChangeText={setShade}
                      placeholder="e.g., Dark Heather, Charcoal, Oatmeal"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Pattern (optional)</Text>
                    <View style={styles.chipRow}>
                      {PATTERN_LIST.map((p) => (
                        <Pressable
                          key={p}
                          onPress={() => { setPattern(p); Haptics.selectionAsync(); }}
                          style={[styles.chip, pattern === p && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, pattern === p && styles.chipTextActive]}>{p}</Text>
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
  viewModeContainer: {
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  viewModeLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  viewModeRow: {
    flexDirection: "row",
    gap: 8,
  },
  viewModeChip: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewModeChipActive: {
    borderColor: Colors.accent,
    backgroundColor: "rgba(201, 169, 110, 0.16)",
  },
  viewModeChipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  viewModeChipTextActive: {
    color: Colors.accent,
  },
  listContent: { paddingHorizontal: 20, paddingTop: 8 },
  row: { gap: 10, marginBottom: 10 },
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
  pickedImage: { width: "100%", height: 170, borderRadius: 16 },
  suggestBlock: { gap: 8 },
  suggestModelRow: { flexDirection: "row", gap: 8 },
  suggestModelChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.surfaceLight,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  suggestModelChipActive: {
    borderColor: Colors.accent,
    backgroundColor: "rgba(201, 169, 110, 0.16)",
  },
  suggestModelChipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  suggestModelChipTextActive: {
    color: Colors.accent,
  },
  suggestHintText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  suggestButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  suggestButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.black,
  },
  suggestedShadeRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  suggestedShadeText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.white,
  },
  applyShadeButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(201, 169, 110, 0.12)",
  },
  applyShadeButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.accent,
  },
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
