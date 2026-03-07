import { useState, useCallback, useEffect } from "react";
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
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import {
  useWardrobe,
  ClothingItem,
  OutfitResult,
  StylingSourceMode,
} from "@/contexts/WardrobeContext";
import { useCredits } from "@/contexts/CreditsContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api-client";
import { router } from "expo-router";
import StylistOptionsSection from "@/components/stylist/StylistOptionsSection";

const OCCASIONS = [
  "Casual Day Out",
  "Business Meeting",
  "Evening Gala",
  "Date Night",
  "Weekend Brunch",
  "Beach Day",
  "Cocktail Party",
  "Travel",
  "Other",
];

const SEASON_OPTIONS = ["Spring", "Summer", "Autumn", "Winter", "Other"];
const AESTHETIC_OPTIONS = [
  "Old Money",
  "Minimalist",
  "Streetwear",
  "Classic",
  "Boho",
  "Sporty",
  "Other",
];
const PALETTE_OPTIONS = [
  "Neutral Tones",
  "Monochrome",
  "Earthy",
  "Pastel",
  "Bold & Vibrant",
  "Black & White",
  "Other",
];
const GENDER_OPTIONS = [
  { label: "Woman", value: "female" },
  { label: "Man", value: "male" },
  { label: "Non-binary", value: "non_binary" },
] as const;

const ORBIT_SLOTS = [
  { top: 28, left: 24, rotate: "-18deg" },
  { top: 8, left: "42%", rotate: "6deg" },
  { top: 34, right: 24, rotate: "14deg" },
  { top: 144, left: 30, rotate: "-10deg" },
  { top: 164, right: 30, rotate: "12deg" },
  { top: 198, left: "43%", rotate: "4deg" },
] as const;

type OutputMode = "text" | "image";
type ImageInputMode = "single_item" | "multi_item";
type StyleGender = "female" | "male" | "non_binary" | "";
type OptionalImageInputMode = ImageInputMode | null;
type UploadedPhoto = {
  uri: string;
  base64: string;
  mimeType?: string;
};

const STYLE_COSTS: Record<OutputMode, number> = {
  text: 2,
  image: 5,
};

const MAX_PHOTOS_BY_MODE: Record<ImageInputMode, number> = {
  single_item: 6,
  multi_item: 2,
};
const MAX_UPLOAD_IMAGE_BASE64_LENGTH = 450_000;
const MAX_SAVED_OUTFIT_IMAGE_BASE64_LENGTH = 350_000;
const MAX_RENDER_RESULT_IMAGE_BASE64_LENGTH = 900_000;
const WEB_IMAGE_MAX_DIMENSION = 1280;
const WEB_IMAGE_MIN_DIMENSION = 512;
const WEB_IMAGE_MAX_ATTEMPTS = 8;

function stripDataUriPrefix(base64OrDataUri: string): string {
  const commaIndex = base64OrDataUri.indexOf(",");
  return commaIndex >= 0 ? base64OrDataUri.slice(commaIndex + 1) : base64OrDataUri;
}

function sanitizeGeneratedImage(
  imageBase64: unknown,
  maxLength: number,
): string | undefined {
  if (typeof imageBase64 !== "string") return undefined;
  const normalized = stripDataUriPrefix(imageBase64.trim());
  if (!normalized || normalized.length > maxLength) return undefined;
  return normalized;
}

async function compressImageForWeb(base64: string, mimeType: string): Promise<UploadedPhoto> {
  if (Platform.OS !== "web" || typeof document === "undefined" || typeof window === "undefined") {
    return { uri: "", base64, mimeType };
  }

  const sourceMimeType = mimeType.startsWith("image/") ? mimeType : "image/jpeg";
  const sourceBase64 = stripDataUriPrefix(base64);
  const sourceDataUri = `data:${sourceMimeType};base64,${sourceBase64}`;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new window.Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Failed to load image for compression"));
    element.src = sourceDataUri;
  });

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) {
    return { uri: "", base64: sourceBase64, mimeType: sourceMimeType };
  }

  let bestBase64 = sourceBase64;
  let maxDimension = WEB_IMAGE_MAX_DIMENSION;
  let quality = 0.68;

  for (let attempt = 0; attempt < WEB_IMAGE_MAX_ATTEMPTS; attempt += 1) {
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) break;

    context.drawImage(image, 0, 0, targetWidth, targetHeight);
    const compressedDataUri = canvas.toDataURL("image/jpeg", quality);
    const compressedBase64 = stripDataUriPrefix(compressedDataUri);

    if (compressedBase64.length < bestBase64.length) {
      bestBase64 = compressedBase64;
    }
    if (bestBase64.length <= MAX_UPLOAD_IMAGE_BASE64_LENGTH) {
      return { uri: "", base64: bestBase64, mimeType: "image/jpeg" };
    }

    maxDimension = Math.max(WEB_IMAGE_MIN_DIMENSION, Math.floor(maxDimension * 0.84));
    quality = Math.max(0.3, quality - 0.08);
  }

  return { uri: "", base64: bestBase64, mimeType: "image/jpeg" };
}

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
  const { width: screenWidth } = useWindowDimensions();
  const { items, addOutfit } = useWardrobe();
  const { credits, refreshCredits } = useCredits();
  const { user, updateProfile } = useAuth();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [occasion, setOccasion] = useState("");
  const [occasionOther, setOccasionOther] = useState("");
  const [eventDetails, setEventDetails] = useState("");
  const [season, setSeason] = useState("");
  const [seasonOther, setSeasonOther] = useState("");
  const [aesthetic, setAesthetic] = useState("");
  const [aestheticOther, setAestheticOther] = useState("");
  const [colorPalette, setColorPalette] = useState("");
  const [colorPaletteOther, setColorPaletteOther] = useState("");
  const [styleGender, setStyleGender] = useState<StyleGender>("");
  const [requiredPiecesText, setRequiredPiecesText] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [stylingSourceMode, setStylingSourceMode] = useState<StylingSourceMode>("photo_only");
  const [outputMode, setOutputMode] = useState<OutputMode>("text");
  const [imageInputMode, setImageInputMode] = useState<OptionalImageInputMode>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [pendingOutfitSave, setPendingOutfitSave] = useState<Omit<OutfitResult, "id" | "createdAt"> | null>(null);
  const [isCurrentLookSaved, setIsCurrentLookSaved] = useState(false);
  const [modifyPrompt, setModifyPrompt] = useState("");
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [actionHint, setActionHint] = useState("");
  const [showLookPlan, setShowLookPlan] = useState(false);
  const [showStartCreating, setShowStartCreating] = useState(false);
  const [showPhotoMode, setShowPhotoMode] = useState(false);
  const [showLookDetails, setShowLookDetails] = useState(false);
  const [showOccasion, setShowOccasion] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showSeason, setShowSeason] = useState(false);
  const [showAesthetic, setShowAesthetic] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const photoCardWidth = Math.min(220, Math.max(150, Math.round(screenWidth * 0.46)));
  const photoCardHeight = Math.round(photoCardWidth * 1.3);
  const maxPhotosAllowed = MAX_PHOTOS_BY_MODE[imageInputMode ?? "single_item"];
  const styleCreditsCost = STYLE_COSTS[outputMode];
  const isPhotoOnlyMode = stylingSourceMode === "photo_only";
  const isSavedWardrobeMode = stylingSourceMode === "saved_wardrobe";
  const isSavedWardrobePlusMode = stylingSourceMode === "saved_wardrobe_plus";
  const allowExtraPieces = isSavedWardrobePlusMode;
  const sourceModeDescription =
    stylingSourceMode === "photo_only"
      ? "Uses only clothes visible in uploaded photo(s)."
      : stylingSourceMode === "saved_wardrobe"
        ? "Uses only selected items from your wardrobe."
        : "Starts from your wardrobe and adds only small finishing pieces when needed.";
  const styleButtonLabel =
    stylingSourceMode === "photo_only"
      ? outputMode === "text"
        ? "Style From This Photo"
        : "Show This Photo As A Look"
      : stylingSourceMode === "saved_wardrobe"
        ? outputMode === "text"
          ? "Style From My Wardrobe"
          : "Preview My Wardrobe Look"
        : outputMode === "text"
          ? "Style My Wardrobe + Finish It"
          : "Preview Wardrobe + Added Pieces";
  const selectedClothing = items.filter((item) => selectedItems.includes(item.id));
  const hasLookContext =
    selectedItems.length > 0 ||
    customPrompt.trim().length > 0 ||
    eventDetails.trim().length > 0 ||
    uploadedPhotos.length > 0 ||
    requiredPiecesText.trim().length > 0;
  const imageModeLabel =
    imageInputMode === "single_item"
      ? "One item per photo"
      : imageInputMode === "multi_item"
        ? "Multiple items per photo"
        : "No photo mode selected";
  const styleGenderLabel =
    styleGender === "female"
      ? "Woman"
      : styleGender === "male"
        ? "Man"
        : styleGender === "non_binary"
          ? "Non-binary"
          : "";
  const resolvedOccasionLabel =
    occasion === "Other" ? occasionOther.trim() || "Custom occasion" : occasion || "Optional";
  const resolvedSeasonLabel = season === "Other" ? seasonOther.trim() : season;
  const resolvedAestheticLabel = aesthetic === "Other" ? aestheticOther.trim() : aesthetic;
  const resolvedPaletteLabel = colorPalette === "Other" ? colorPaletteOther.trim() : colorPalette;
  const hasCustomLookDetails = Boolean(
    eventDetails.trim() || requiredPiecesText.trim() || customPrompt.trim(),
  );
  const hasStylePreferences = Boolean(
    styleGenderLabel || resolvedSeasonLabel || resolvedAestheticLabel || resolvedPaletteLabel,
  );
  const lookOutputLabel = outputMode === "image" ? "Styled outfit image" : "Style advice in text";
  const lookDetailsLabel = hasCustomLookDetails ? "Custom details added" : "Optional";
  const stylePreferencesLabel = hasStylePreferences ? "Custom preferences selected" : "Optional";
  const resolvedStyleGender = styleGender || user?.styleGender || "";
  const saveDisabled = !pendingOutfitSave || isCurrentLookSaved;
  const showPhotoSetupOption = isPhotoOnlyMode;

  useEffect(() => {
    if (!user?.styleGender) return;
    setStyleGender((current) => current || user.styleGender || "");
  }, [user?.id, user?.styleGender]);

  useEffect(() => {
    if (isPhotoOnlyMode) return;
    setShowPhotoMode(false);
  }, [isPhotoOnlyMode]);

  const selectStyleGender = useCallback((nextGender: StyleGender) => {
    setStyleGender(nextGender);
    setActionHint("");
    Haptics.selectionAsync();

    if (!user?.id) return;

    void updateProfile({ styleGender: nextGender || null }).catch((error) => {
      console.error("Failed to save style gender:", error);
    });
  }, [user?.id, updateProfile]);

  const toggleItem = useCallback((id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const updateImageInputMode = useCallback((nextMode: ImageInputMode) => {
    if (imageInputMode === nextMode) {
      if (uploadedPhotos.length > 0) {
        Alert.alert("Photo mode still needed", "Remove uploaded photos first if you want to clear photo mode.");
        return;
      }
      setImageInputMode(null);
      setActionHint("");
      return;
    }

    const nextLimit = MAX_PHOTOS_BY_MODE[nextMode];
    setImageInputMode(nextMode);
    setActionHint("");
    setUploadedPhotos((prev) => {
      if (prev.length <= nextLimit) return prev;
      Alert.alert("Photo limit updated", `This mode supports up to ${nextLimit} photos. Extra photos were removed.`);
      return prev.slice(0, nextLimit);
    });
  }, [imageInputMode, uploadedPhotos.length]);

  const ensurePhotoModeBeforePicking = useCallback(async (): Promise<ImageInputMode | null> => {
    if (imageInputMode) return imageInputMode;

    return new Promise((resolve) => {
      let settled = false;
      const complete = (value: ImageInputMode | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      Alert.alert(
        "Choose photo setup",
        "Select how your reference photos are organized.",
        [
          {
            text: "One item / photo",
            onPress: () => {
              setImageInputMode("single_item");
              setActionHint("");
              complete("single_item");
            },
          },
          {
            text: "Multiple items / photo",
            onPress: () => {
              setImageInputMode("multi_item");
              setActionHint("");
              complete("multi_item");
            },
          },
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              setActionHint("Photo setup is required before uploading reference images.");
              complete(null);
            },
          },
        ],
        {
          cancelable: true,
          onDismiss: () => complete(null),
        },
      );
    });
  }, [imageInputMode]);

  const appendPhoto = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      if (uploadedPhotos.length >= maxPhotosAllowed) {
        Alert.alert("Limit reached", `You can upload up to ${maxPhotosAllowed} photo(s) in this mode.`);
        return;
      }

      let base64 = typeof asset.base64 === "string" ? asset.base64 : "";
      if (!base64 && asset.uri?.startsWith("file://")) {
        try {
          base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch {
          base64 = "";
        }
      }

      if (!base64) {
        Alert.alert("Image error", "Could not read this image. Please try a different one.");
        return;
      }

      let normalizedMimeType =
        typeof asset.mimeType === "string" && asset.mimeType.startsWith("image/")
          ? asset.mimeType
          : "image/jpeg";

      if (base64.length > MAX_UPLOAD_IMAGE_BASE64_LENGTH && Platform.OS === "web") {
        try {
          const compressed = await compressImageForWeb(base64, normalizedMimeType);
          base64 = compressed.base64;
          normalizedMimeType = compressed.mimeType || "image/jpeg";
        } catch {
          // Keep original payload if compression fails.
        }
      }

      if (base64.length > MAX_UPLOAD_IMAGE_BASE64_LENGTH) {
        Alert.alert(
          "Image too large",
          "This photo is still too large even after optimization. Please crop it or choose a smaller one.",
        );
        return;
      }

      setUploadedPhotos((prev) => [
        ...prev,
        {
          uri: asset.uri,
          base64,
          mimeType: normalizedMimeType,
        },
      ]);
      Haptics.selectionAsync();
    },
    [maxPhotosAllowed, uploadedPhotos.length],
  );

  const pickPhoto = useCallback(async () => {
    const selectedMode = await ensurePhotoModeBeforePicking();
    if (!selectedMode) {
      return;
    }

    const allowedPhotos = MAX_PHOTOS_BY_MODE[selectedMode];
    if (uploadedPhotos.length >= allowedPhotos) {
      Alert.alert("Limit reached", `You can upload up to ${allowedPhotos} photo(s) in this mode.`);
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.35,
      base64: true,
    });

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      await appendPhoto(pickerResult.assets[0]);
    }
  }, [appendPhoto, ensurePhotoModeBeforePicking, uploadedPhotos.length]);

  const takePhoto = useCallback(async () => {
    const selectedMode = await ensurePhotoModeBeforePicking();
    if (!selectedMode) {
      return;
    }

    const allowedPhotos = MAX_PHOTOS_BY_MODE[selectedMode];
    if (uploadedPhotos.length >= allowedPhotos) {
      Alert.alert("Limit reached", `You can upload up to ${allowedPhotos} photo(s) in this mode.`);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to take photos.");
      return;
    }

    const cameraResult = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.35,
      base64: true,
    });

    if (!cameraResult.canceled && cameraResult.assets[0]) {
      await appendPhoto(cameraResult.assets[0]);
    }
  }, [appendPhoto, ensurePhotoModeBeforePicking, uploadedPhotos.length]);

  const removePhoto = useCallback((index: number) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStyle = useCallback(async () => {
    const resolvedOccasion =
      occasion === "Other" ? (occasionOther.trim() || "Any occasion") : (occasion || "Any occasion");
    const resolvedSeason = season === "Other" ? seasonOther.trim() : season;
    const resolvedAesthetic = aesthetic === "Other" ? aestheticOther.trim() : aesthetic;
    const resolvedColorPalette =
      colorPalette === "Other" ? colorPaletteOther.trim() : colorPalette;
    const resolvedImageInputMode: ImageInputMode = imageInputMode ?? "single_item";

    const requiredPieces = requiredPiecesText
      .split(/[,;\n]/)
      .map((value: string) => value.trim())
      .filter(Boolean);

    if (isPhotoOnlyMode && uploadedPhotos.length === 0) {
      const message = "Upload at least one photo in \"Style from this photo\" mode.";
      setActionHint(message);
      Alert.alert("Photo needed", message);
      return;
    }

    if (!isPhotoOnlyMode && selectedClothing.length === 0) {
      const message = "Select at least one saved wardrobe item in wardrobe mode.";
      setActionHint(message);
      Alert.alert("Wardrobe item needed", message);
      return;
    }

    if (!hasLookContext) {
      const message = "Add at least one detail: clothing text, photo, wardrobe item, event, or required piece.";
      setActionHint(message);
      Alert.alert(
        "Need a bit more detail",
        message,
      );
      return;
    }

    if (credits < styleCreditsCost) {
      setActionHint(`You need ${styleCreditsCost} credits, but you currently have ${credits}.`);
      Alert.alert(
        "No Credits",
        `You have ${credits} credits. This request costs ${styleCreditsCost} credits. Would you like to get more credits?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Get Credits", onPress: () => router.push("/(tabs)/credits" as any) },
        ]
      );
      return;
    }

    setActionHint("");
    setLoading(true);
    setResult(null);
    setPendingOutfitSave(null);
    setIsCurrentLookSaved(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const data = await apiClient.generateStyle({
        items: isPhotoOnlyMode
          ? []
          : selectedClothing.map((i) => ({
              name: i.name,
              category: i.category,
              color: i.color,
              description: i.description,
            })),
        occasion: resolvedOccasion,
        gender: resolvedStyleGender || undefined,
        event: eventDetails.trim(),
        season: resolvedSeason,
        aesthetic: resolvedAesthetic,
        colorPalette: resolvedColorPalette,
        requiredPieces,
        customPrompt: customPrompt.trim(),
        outputMode,
        imageInputMode: resolvedImageInputMode,
        photos: isPhotoOnlyMode
          ? uploadedPhotos.map((photo) => ({
              base64: photo.base64,
              mimeType: photo.mimeType,
            }))
          : [],
        sourceMode: stylingSourceMode,
        allowExtraPieces,
      });
      const renderImageBase64 = sanitizeGeneratedImage(
        data.imageBase64,
        MAX_RENDER_RESULT_IMAGE_BASE64_LENGTH,
      );
      const savedImageBase64 = sanitizeGeneratedImage(
        data.imageBase64,
        MAX_SAVED_OUTFIT_IMAGE_BASE64_LENGTH,
      );
      setResult({
        ...data,
        imageBase64: renderImageBase64,
      });
      setPendingOutfitSave({
        items: selectedClothing,
        occasion: resolvedOccasion,
        description: data.description,
        stylingTips: data.tips || [],
        imageBase64: savedImageBase64,
        sourceMode: stylingSourceMode,
        referencePhotoCount: isPhotoOnlyMode ? uploadedPhotos.length : 0,
        wardrobeItemCount: selectedClothing.length,
        allowExtraPieces,
      });
      setIsCurrentLookSaved(false);
      if (data.imageBase64 && !renderImageBase64) {
        setActionHint(
          "Generated image is too large for this device. Text result is kept to avoid memory crashes.",
        );
      } else if (renderImageBase64 && !savedImageBase64) {
        setActionHint(
          "Image is shown now, but it will not be stored locally to keep memory usage low.",
        );
      } else {
        setActionHint("");
      }
      await refreshCredits();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.error("Style error:", e);
      if (e?.status === 402) {
        setActionHint(`You need ${styleCreditsCost} credits, but you currently have ${credits}.`);
        Alert.alert(
          "No Credits",
          `You have ${credits} credits. This request costs ${styleCreditsCost} credits. Would you like to get more credits?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Get Credits", onPress: () => router.push("/(tabs)/credits" as any) },
          ],
        );
      } else {
        const message = typeof e?.message === "string" ? e.message : "Failed to generate styling. Please try again.";
        setActionHint(message);
        Alert.alert("Error", message);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [
    hasLookContext,
    occasion,
    occasionOther,
    season,
    seasonOther,
    aesthetic,
    aestheticOther,
    colorPalette,
    colorPaletteOther,
    imageInputMode,
    isPhotoOnlyMode,
    allowExtraPieces,
    stylingSourceMode,
    requiredPiecesText,
    credits,
    styleCreditsCost,
    selectedClothing,
    eventDetails,
    resolvedStyleGender,
    customPrompt,
    outputMode,
    uploadedPhotos,
    refreshCredits,
  ]);

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
    } catch {
      Alert.alert("Error", "Failed to download image.");
    }
  }, [result]);

  const handleModify = useCallback(async () => {
    const resolvedOccasion =
      occasion === "Other" ? (occasionOther.trim() || "Any occasion") : (occasion || "Any occasion");
    const resolvedSeason = season === "Other" ? seasonOther.trim() : season;
    const resolvedAesthetic = aesthetic === "Other" ? aestheticOther.trim() : aesthetic;
    const resolvedColorPalette =
      colorPalette === "Other" ? colorPaletteOther.trim() : colorPalette;
    const resolvedImageInputMode: ImageInputMode = imageInputMode ?? "single_item";

    if (isPhotoOnlyMode && uploadedPhotos.length === 0) {
      const message = "Upload at least one photo in \"Style from this photo\" mode.";
      setActionHint(message);
      Alert.alert("Photo needed", message);
      return;
    }

    if (!isPhotoOnlyMode && selectedClothing.length === 0) {
      const message = "Select at least one saved wardrobe item in wardrobe mode.";
      setActionHint(message);
      Alert.alert("Wardrobe item needed", message);
      return;
    }

    if (!modifyPrompt.trim()) {
      setActionHint("Write what you want changed before applying edits.");
      Alert.alert("Error", "Please describe the changes you'd like");
      return;
    }

    if (credits < styleCreditsCost) {
      setActionHint(`You need ${styleCreditsCost} credits, but you currently have ${credits}.`);
      Alert.alert(
        "No Credits",
        `This request costs ${styleCreditsCost} credits.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Get Credits", onPress: () => router.push("/(tabs)/credits" as any) },
        ]
      );
      return;
    }

    setActionHint("");
    setModifying(true);
    setShowModifyModal(false);

    try {
      const requiredPieces = requiredPiecesText
        .split(/[,;\n]/)
        .map((value: string) => value.trim())
        .filter(Boolean);
      const data = await apiClient.modifyStyle({
        originalDescription: result?.description || "",
        originalTips: result?.tips || [],
        modifyRequest: modifyPrompt.trim(),
        items: isPhotoOnlyMode
          ? []
          : selectedClothing.map((i) => ({
              name: i.name,
              category: i.category,
              color: i.color,
              description: i.description,
            })),
        occasion: resolvedOccasion,
        gender: resolvedStyleGender || undefined,
        event: eventDetails.trim(),
        season: resolvedSeason,
        aesthetic: resolvedAesthetic,
        colorPalette: resolvedColorPalette,
        customPrompt: customPrompt.trim(),
        requiredPieces,
        outputMode,
        imageInputMode: resolvedImageInputMode,
        photos: isPhotoOnlyMode
          ? uploadedPhotos.map((photo) => ({
              base64: photo.base64,
              mimeType: photo.mimeType,
            }))
          : [],
        sourceMode: stylingSourceMode,
        allowExtraPieces,
      });
      const renderImageBase64 = sanitizeGeneratedImage(
        data.imageBase64,
        MAX_RENDER_RESULT_IMAGE_BASE64_LENGTH,
      );
      const savedImageBase64 = sanitizeGeneratedImage(
        data.imageBase64,
        MAX_SAVED_OUTFIT_IMAGE_BASE64_LENGTH,
      );
      setResult({
        ...data,
        imageBase64: renderImageBase64,
      });
      setPendingOutfitSave({
        items: selectedClothing,
        occasion: resolvedOccasion,
        description: data.description,
        stylingTips: data.tips || [],
        imageBase64: savedImageBase64,
        sourceMode: stylingSourceMode,
        referencePhotoCount: isPhotoOnlyMode ? uploadedPhotos.length : 0,
        wardrobeItemCount: selectedClothing.length,
        allowExtraPieces,
      });
      setIsCurrentLookSaved(false);
      if (data.imageBase64 && !renderImageBase64) {
        setActionHint(
          "Generated image is too large for this device. Text result is kept to avoid memory crashes.",
        );
      } else if (renderImageBase64 && !savedImageBase64) {
        setActionHint(
          "Image is shown now, but it will not be stored locally to keep memory usage low.",
        );
      } else {
        setActionHint("");
      }
      await refreshCredits();

      setModifyPrompt("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      if (e?.status === 402) {
        setActionHint(`You need ${styleCreditsCost} credits, but you currently have ${credits}.`);
        Alert.alert(
          "No Credits",
          `You have ${credits} credits. This request costs ${styleCreditsCost} credits.`,
          [{ text: "OK" }],
        );
      } else {
        const message = typeof e?.message === "string" ? e.message : "Failed to modify outfit. Please try again.";
        setActionHint(message);
        Alert.alert("Error", message);
      }
    } finally {
      setModifying(false);
    }
  }, [
    modifyPrompt,
    result,
    occasion,
    resolvedStyleGender,
    eventDetails,
    season,
    seasonOther,
    aesthetic,
    aestheticOther,
    colorPalette,
    colorPaletteOther,
    customPrompt,
    requiredPiecesText,
    occasionOther,
    outputMode,
    imageInputMode,
    isPhotoOnlyMode,
    allowExtraPieces,
    stylingSourceMode,
    uploadedPhotos,
    styleCreditsCost,
    credits,
    refreshCredits,
    selectedClothing,
  ]);

  const handleSaveOutfit = useCallback(async () => {
    if (!result || !pendingOutfitSave) return;
    if (isCurrentLookSaved) {
      Alert.alert("Already saved", "This outfit is already in your collection.");
      return;
    }

    try {
      await addOutfit(pendingOutfitSave);
      setIsCurrentLookSaved(true);
      Alert.alert("Saved", "This outfit has been saved to your collection.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not save this outfit. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [result, pendingOutfitSave, isCurrentLookSaved, addOutfit]);

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

        <Animated.View entering={FadeInDown.delay(70).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Choose styling mode</Text>
          <View style={styles.sourceModeSegmentWrap}>
            <View style={styles.sourceModeSegmentRow}>
              <Pressable
                onPress={() => {
                  setStylingSourceMode("photo_only");
                  setActionHint("");
                }}
                style={[
                  styles.sourceModeSegmentButton,
                  stylingSourceMode === "photo_only" ? styles.sourceModeSegmentButtonActive : undefined,
                ]}
              >
                <Text
                  style={[
                    styles.sourceModeSegmentLabel,
                    stylingSourceMode === "photo_only" ? styles.sourceModeSegmentLabelActive : undefined,
                  ]}
                >
                  Photo
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setStylingSourceMode("saved_wardrobe");
                  setActionHint("");
                }}
                style={[
                  styles.sourceModeSegmentButton,
                  stylingSourceMode === "saved_wardrobe" ? styles.sourceModeSegmentButtonActive : undefined,
                ]}
              >
                <Text
                  style={[
                    styles.sourceModeSegmentLabel,
                    stylingSourceMode === "saved_wardrobe" ? styles.sourceModeSegmentLabelActive : undefined,
                  ]}
                >
                  Wardrobe
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setStylingSourceMode("saved_wardrobe_plus");
                  setActionHint("");
                }}
                style={[
                  styles.sourceModeSegmentButton,
                  stylingSourceMode === "saved_wardrobe_plus" ? styles.sourceModeSegmentButtonActive : undefined,
                ]}
              >
                <Text
                  style={[
                    styles.sourceModeSegmentLabel,
                    stylingSourceMode === "saved_wardrobe_plus" ? styles.sourceModeSegmentLabelActive : undefined,
                  ]}
                >
                  + Extras
                </Text>
              </Pressable>
            </View>
            <Text style={styles.sourceModeSegmentHint}>{sourceModeDescription}</Text>
          </View>
        </Animated.View>

        {isPhotoOnlyMode ? (
          <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.section}>
            <Text style={styles.uploadSectionTitle}>Reference Photos</Text>
            <View style={styles.uploadShowcase}>
              <LinearGradient
                colors={["rgba(255,255,255,0.06)", "rgba(255,255,255,0.01)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              <Pressable onPress={pickPhoto} style={styles.uploadStage}>
                <View style={styles.uploadGlow}>
                  <View style={styles.uploadPlayButton}>
                    <Ionicons name="add" size={28} color={Colors.white} />
                  </View>
                </View>

                {ORBIT_SLOTS.map((slot, index) => {
                  const uri = uploadedPhotos[index]?.uri;
                  const positionStyle = {
                    top: slot.top,
                    transform: [{ rotate: slot.rotate }],
                    ...("left" in slot ? { left: slot.left } : { right: slot.right }),
                  } satisfies ViewStyle;
                  return (
                    <View
                      key={index}
                      style={[styles.uploadOrbitCard, positionStyle]}
                    >
                      {uri ? (
                        <Image source={{ uri }} style={styles.uploadOrbitImage} contentFit="cover" />
                      ) : (
                        <View style={styles.uploadOrbitPlaceholder}>
                          <MaterialCommunityIcons name="hanger" size={18} color={Colors.textMuted} />
                        </View>
                      )}
                    </View>
                  );
                })}
              </Pressable>

              <View style={styles.uploadMeta}>
                <Text style={styles.uploadMetaTitle}>
                  {uploadedPhotos.length > 0
                    ? `${uploadedPhotos.length}/${maxPhotosAllowed} reference photos`
                    : imageInputMode
                      ? `Add up to ${maxPhotosAllowed} reference photos`
                      : "Want to upload photos? Tap Gallery or Camera to choose setup"}
                </Text>
                <Text style={styles.uploadMetaSubtitle}>
                  Photos are optional. You can skip photo setup and type your request below.
                </Text>
              </View>

              <View style={styles.uploadActions}>
                <Pressable onPress={pickPhoto} style={styles.uploadActionButton}>
                  <Ionicons name="image-outline" size={18} color={Colors.white} />
                  <Text style={styles.uploadActionText}>Gallery</Text>
                </Pressable>
                <Pressable onPress={takePhoto} style={styles.uploadActionButton}>
                  <Ionicons name="camera-outline" size={18} color={Colors.white} />
                  <Text style={styles.uploadActionText}>Camera</Text>
                </Pressable>
              </View>

              <View style={styles.orTypeCallout}>
                <Text style={styles.orTypeCalloutLabel}>NO PHOTOS? TYPE HERE</Text>
                <Text style={styles.orTypeCalloutText}>
                  Add one or more pieces (example: &quot;military green satin long skirt, white shirt&quot;). You can be short.
                </Text>
                <TextInput
                  style={styles.orTypeInput}
                  value={customPrompt}
                  onChangeText={(value) => {
                    setCustomPrompt(value);
                    setActionHint("");
                  }}
                  placeholder="Type your outfit idea here..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {uploadedPhotos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosScroll}>
                {uploadedPhotos.map((photo, index) => (
                  <View key={index} style={[styles.photoThumb, { width: photoCardWidth, height: photoCardHeight }]}>
                    <Image source={{ uri: photo.uri }} style={styles.photoThumbImage} contentFit="cover" />
                    <Pressable onPress={() => removePhoto(index)} style={styles.removePhotoBtn}>
                      <Ionicons name="close" size={14} color={Colors.white} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.section}>
            <View style={styles.dropdownCard}>
              <View style={styles.dropdownContent}>
                <Text style={styles.dropdownTitle}>Photo upload is off in this mode</Text>
                <Text style={styles.dropdownSubtitle}>
                  {isSavedWardrobeMode
                    ? "This mode styles only from your saved wardrobe and does not add extra pieces."
                    : "This mode starts from your saved wardrobe and may add a couple of finishing pieces if needed."}
                </Text>
                <TextInput
                  style={styles.promptInput}
                  value={customPrompt}
                  onChangeText={(value) => {
                    setCustomPrompt(value);
                    setActionHint("");
                  }}
                  placeholder="Optional: add extra instructions for the look"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </Animated.View>
        )}

        <StylistOptionsSection
          styles={styles}
          screenWidth={screenWidth}
          outputMode={outputMode}
          setOutputMode={setOutputMode}
          styleCosts={STYLE_COSTS}
          imageInputMode={imageInputMode}
          showPhotoSetupOption={showPhotoSetupOption}
          updateImageInputMode={updateImageInputMode}
          maxPhotosByMode={MAX_PHOTOS_BY_MODE}
          eventDetails={eventDetails}
          setEventDetails={setEventDetails}
          requiredPiecesText={requiredPiecesText}
          setRequiredPiecesText={setRequiredPiecesText}
          occasion={occasion}
          setOccasion={setOccasion}
          occasionOther={occasionOther}
          setOccasionOther={setOccasionOther}
          season={season}
          setSeason={setSeason}
          seasonOther={seasonOther}
          setSeasonOther={setSeasonOther}
          aesthetic={aesthetic}
          setAesthetic={setAesthetic}
          aestheticOther={aestheticOther}
          setAestheticOther={setAestheticOther}
          colorPalette={colorPalette}
          setColorPalette={setColorPalette}
          colorPaletteOther={colorPaletteOther}
          setColorPaletteOther={setColorPaletteOther}
          styleGender={styleGender}
          selectStyleGender={selectStyleGender}
          showStartCreating={showStartCreating}
          setShowStartCreating={setShowStartCreating}
          showLookPlan={showLookPlan}
          setShowLookPlan={setShowLookPlan}
          showPhotoMode={showPhotoMode}
          setShowPhotoMode={setShowPhotoMode}
          showLookDetails={showLookDetails}
          setShowLookDetails={setShowLookDetails}
          showOccasion={showOccasion}
          setShowOccasion={setShowOccasion}
          showPreferences={showPreferences}
          setShowPreferences={setShowPreferences}
          showSeason={showSeason}
          setShowSeason={setShowSeason}
          showAesthetic={showAesthetic}
          setShowAesthetic={setShowAesthetic}
          showPalette={showPalette}
          setShowPalette={setShowPalette}
          lookOutputLabel={lookOutputLabel}
          imageModeLabel={imageModeLabel}
          lookDetailsLabel={lookDetailsLabel}
          resolvedOccasionLabel={resolvedOccasionLabel}
          stylePreferencesLabel={stylePreferencesLabel}
          setActionHint={setActionHint}
          occasionOptions={OCCASIONS}
          seasonOptions={SEASON_OPTIONS}
          aestheticOptions={AESTHETIC_OPTIONS}
          paletteOptions={PALETTE_OPTIONS}
          genderOptions={GENDER_OPTIONS}
        />

        {!isPhotoOnlyMode && items.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.section}>
            <Text style={styles.sectionTitle}>
              Select From Wardrobe ({selectedItems.length} selected)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemsScroll}>
              {items.map((item: ClothingItem) => (
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

        {!isPhotoOnlyMode && items.length === 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.section}>
            <View style={styles.dropdownCard}>
              <View style={styles.dropdownContent}>
                <Text style={styles.dropdownTitle}>Your wardrobe is empty</Text>
                <Text style={styles.dropdownSubtitle}>
                  Add items in the Wardrobe tab first, then come back to style from your saved closet.
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

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
                <Text style={styles.styleButtonText}>
                  {isPhotoOnlyMode
                    ? outputMode === "text"
                      ? "Styling from your photo..."
                      : "Rendering your photo-based look..."
                    : outputMode === "text"
                      ? "Styling from your saved wardrobe..."
                      : "Rendering your wardrobe look..."}
                </Text>
              </View>
            ) : (
              <View style={styles.loadingRow}>
                <Ionicons name="sparkles" size={20} color={Colors.black} />
                <Text style={styles.styleButtonText}>{styleButtonLabel}</Text>
                <View style={styles.creditCostBadge}>
                  <Text style={styles.creditCostText}>{styleCreditsCost} credits</Text>
                </View>
              </View>
            )}
          </Pressable>
          {actionHint ? <Text style={styles.actionHintText}>{actionHint}</Text> : null}
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
                  <Text style={styles.resultTitle}>
                    {result?.outputMode === "text" ? "Your Look Plan" : "Your Look Preview"}
                  </Text>
                  <View style={styles.resultBadge}>
                    <Ionicons name="sparkles" size={14} color={Colors.accent} />
                    <Text style={styles.resultBadgeText}>Styled for you</Text>
                  </View>
                </View>

                {result?.lookName ? <Text style={styles.lookName}>{result.lookName}</Text> : null}

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
                    disabled={saveDisabled}
                    onPress={() => {
                      void handleSaveOutfit();
                    }}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      saveDisabled && styles.actionBtnDisabled,
                      pressed && !saveDisabled && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons name={isCurrentLookSaved ? "bookmark" : "bookmark-outline"} size={20} color={Colors.accent} />
                    <Text style={styles.actionBtnText}>{isCurrentLookSaved ? "Saved" : "Save"}</Text>
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
              <Text style={styles.modalTitle}>Adjust This Look</Text>
              <Pressable onPress={() => setShowModifyModal(false)}>
                <Ionicons name="close" size={24} color={Colors.white} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>Tell me what to tweak</Text>
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
                <Text style={styles.modifyButtonText}>Apply My Changes</Text>
                <View style={styles.creditCostBadge}>
                  <Text style={styles.creditCostText}>{styleCreditsCost} credits</Text>
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
  section: { paddingHorizontal: 20, marginTop: 16 },
  preferenceSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  preferenceSummaryCard: {
    minHeight: 112,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: "#101010",
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "space-between",
    gap: 8,
  },
  preferenceSummaryCardHalf: {
    width: "48.5%",
  },
  preferenceSummaryCardFull: {
    width: "100%",
  },
  preferenceSummaryCardExpanded: {
    width: "100%",
  },
  preferenceSummaryCardActive: {
    borderColor: Colors.accent,
    backgroundColor: "rgba(201, 169, 110, 0.1)",
  },
  preferenceSummaryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  preferenceSummaryTitle: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: Colors.white,
    lineHeight: 21,
  },
  preferenceSummaryValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    lineHeight: 21,
  },
  preferenceSummaryValueAccent: {
    color: Colors.accent,
  },
  preferenceSummaryValueMuted: {
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  dropdownCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: "#101010",
    overflow: "hidden",
  },
  dropdownHeader: {
    paddingHorizontal: 15,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  dropdownHeaderTextWrap: { flex: 1, gap: 2 },
  dropdownTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.white,
  },
  dropdownSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  dropdownContent: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    padding: 12,
    gap: 10,
  },
  sourceModeSegmentWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: "#101010",
    padding: 8,
    gap: 8,
  },
  sourceModeSegmentRow: {
    flexDirection: "row",
    gap: 8,
  },
  sourceModeSegmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  sourceModeSegmentButtonActive: {
    borderColor: Colors.accent,
    backgroundColor: "rgba(201, 169, 110, 0.18)",
  },
  sourceModeSegmentLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  sourceModeSegmentLabelActive: {
    color: Colors.accent,
  },
  sourceModeSegmentHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
    paddingHorizontal: 2,
  },
  modeRow: { flexDirection: "row", gap: 10 },
  modeRowStacked: { flexDirection: "column", gap: 8 },
  modeChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
    minHeight: 64,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  modeChipStacked: {
    flex: 0,
    width: "100%",
  },
  modeChipActive: {
    backgroundColor: "rgba(201, 169, 110, 0.18)",
    borderColor: Colors.accent,
  },
  modeChipTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    lineHeight: 18,
    color: Colors.white,
  },
  modeChipTitleActive: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    lineHeight: 18,
    color: Colors.accent,
  },
  modeChipSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    color: Colors.textSecondary,
  },
  modeChipSubtitleActive: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    color: Colors.accent,
  },
  uploadSectionTitle: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 34,
    color: Colors.white,
    marginBottom: 14,
  },
  uploadShowcase: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: "#090909",
    padding: 16,
    overflow: "hidden",
  },
  uploadStage: {
    height: 320,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.03)",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadGlow: {
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: "#91FFF0",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#7FFFF2",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 14,
  },
  uploadPlayButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#040404",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadOrbitCard: {
    position: "absolute",
    width: 74,
    height: 94,
    padding: 6,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  uploadOrbitImage: {
    width: "100%",
    height: "100%",
    borderRadius: 2,
  },
  uploadOrbitPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  uploadMeta: {
    marginTop: 14,
    gap: 5,
  },
  uploadMetaTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 21,
    color: Colors.white,
  },
  uploadMetaSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  orTypeCallout: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  orTypeCalloutLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.accent,
    letterSpacing: 1,
  },
  orTypeCalloutText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  orTypeInput: {
    marginTop: 8,
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 82,
    color: Colors.white,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  uploadActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  uploadActionButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  uploadActionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.white,
  },
  photosScroll: { gap: 14, paddingRight: 20, paddingTop: 14 },
  photoThumb: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.surfaceLight,
  },
  photoThumbImage: { width: "100%", height: "100%" },
  removePhotoBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
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
  extraInputs: { marginTop: 12, gap: 10 },
  compactInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.white,
  },
  otherInput: {
    marginTop: 10,
  },
  preferenceLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.white,
    marginTop: 14,
    marginBottom: 10,
  },
  preferencesHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  inlineHelperText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  preferenceToggle: {
    marginTop: 8,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  preferenceToggleText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.white,
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
  occasionTextActive: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.black,
  },
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
  actionHintText: {
    marginTop: 8,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
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
  lookName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.accent,
    marginBottom: 8,
  },
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
  actionBtnDisabled: {
    opacity: 0.45,
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

