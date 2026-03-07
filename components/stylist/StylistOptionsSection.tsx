import type { Dispatch, ReactNode, SetStateAction } from "react";
import { View, Text, Pressable, TextInput, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { ColorPaletteSelector } from "@/components/ColorPaletteSelector";
import { AestheticSelector } from "@/components/AestheticSelector";
import {
  ColorStructure,
  PALETTE_OPTIONS,
} from "@/constants/colorPalettes";

type OutputMode = "text" | "image";
type ImageInputMode = "single_item" | "multi_item";
type OptionalImageInputMode = ImageInputMode | null;
type StyleGender = "female" | "male" | "non_binary" | "";

type GenderOption = {
  label: string;
  value: "female" | "male" | "non_binary";
};

type StylistOptionsSectionProps = {
  styles: Record<string, any>;
  screenWidth: number;
  outputMode: OutputMode;
  setOutputMode: Dispatch<SetStateAction<OutputMode>>;
  styleCosts: Record<OutputMode, number>;
  imageInputMode: OptionalImageInputMode;
  showPhotoSetupOption: boolean;
  updateImageInputMode: (nextMode: ImageInputMode) => void;
  maxPhotosByMode: Record<ImageInputMode, number>;
  eventDetails: string;
  setEventDetails: Dispatch<SetStateAction<string>>;
  requiredPiecesText: string;
  setRequiredPiecesText: Dispatch<SetStateAction<string>>;
  occasion: string;
  setOccasion: Dispatch<SetStateAction<string>>;
  occasionOther: string;
  setOccasionOther: Dispatch<SetStateAction<string>>;
  season: string;
  setSeason: Dispatch<SetStateAction<string>>;
  seasonOther: string;
  setSeasonOther: Dispatch<SetStateAction<string>>;
  aesthetic: string;
  setAesthetic: Dispatch<SetStateAction<string>>;
  aestheticOther: string;
  setAestheticOther: Dispatch<SetStateAction<string>>;
  colorStructure: ColorStructure;
  setColorStructure: Dispatch<SetStateAction<ColorStructure>>;
  selectedPaletteId: string | null;
  setSelectedPaletteId: Dispatch<SetStateAction<string | null>>;
  styleGender: StyleGender;
  selectStyleGender: (nextGender: StyleGender) => void;
  showStartCreating: boolean;
  setShowStartCreating: Dispatch<SetStateAction<boolean>>;
  showLookPlan: boolean;
  setShowLookPlan: Dispatch<SetStateAction<boolean>>;
  showPhotoMode: boolean;
  setShowPhotoMode: Dispatch<SetStateAction<boolean>>;
  showLookDetails: boolean;
  setShowLookDetails: Dispatch<SetStateAction<boolean>>;
  showOccasion: boolean;
  setShowOccasion: Dispatch<SetStateAction<boolean>>;
  showPreferences: boolean;
  setShowPreferences: Dispatch<SetStateAction<boolean>>;
  showSeason: boolean;
  setShowSeason: Dispatch<SetStateAction<boolean>>;
  showAesthetic: boolean;
  setShowAesthetic: Dispatch<SetStateAction<boolean>>;
  showPalette: boolean;
  setShowPalette: Dispatch<SetStateAction<boolean>>;
  lookOutputLabel: string;
  imageModeLabel: string;
  lookDetailsLabel: string;
  resolvedOccasionLabel: string;
  stylePreferencesLabel: string;
  setActionHint: Dispatch<SetStateAction<string>>;
  occasionOptions: readonly string[];
  seasonOptions: readonly string[];
  genderOptions: readonly GenderOption[];
};

function CollapsibleSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
  styles,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  styles: Record<string, any>;
}) {
  return (
    <View style={styles.dropdownCard}>
      <Pressable onPress={onToggle} style={styles.dropdownHeader}>
        <View style={styles.dropdownHeaderTextWrap}>
          <Text style={styles.dropdownTitle}>{title}</Text>
          {subtitle ? <Text style={styles.dropdownSubtitle}>{subtitle}</Text> : null}
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={Colors.textSecondary} />
      </Pressable>
      {open && <View style={styles.dropdownContent}>{children}</View>}
    </View>
  );
}

function OptionCard({
  title,
  value,
  active,
  cardStyle,
  onPress,
  styles,
  children,
}: {
  title: string;
  value: string;
  active: boolean;
  cardStyle?: ViewStyle;
  onPress: () => void;
  styles: Record<string, any>;
  children?: ReactNode;
}) {
  const hasValue = value.trim().length > 0 && value.trim().toLowerCase() !== "optional";
  return (
    <View
      style={[
        styles.preferenceSummaryCard,
        cardStyle,
        active ? styles.preferenceSummaryCardActive : undefined,
        active ? styles.preferenceSummaryCardExpanded : undefined,
      ]}
    >
      <Pressable onPress={onPress} style={({ pressed }) => [pressed ? { opacity: 0.82 } : undefined]}>
        <View style={styles.preferenceSummaryHeaderRow}>
          <Text style={styles.preferenceSummaryTitle}>{title}</Text>
          <Ionicons
            name={active ? "chevron-up" : "chevron-down"}
            size={18}
            color={hasValue || active ? Colors.accent : Colors.textSecondary}
          />
        </View>
        <Text
          numberOfLines={2}
          style={[
            styles.preferenceSummaryValue,
            hasValue || active ? styles.preferenceSummaryValueAccent : styles.preferenceSummaryValueMuted,
          ]}
        >
          {value || "Optional"}
        </Text>
      </Pressable>
      {active ? <View style={styles.dropdownContent}>{children}</View> : null}
    </View>
  );
}

export default function StylistOptionsSection({
  styles,
  screenWidth,
  outputMode,
  setOutputMode,
  styleCosts,
  imageInputMode,
  showPhotoSetupOption,
  updateImageInputMode,
  maxPhotosByMode,
  eventDetails,
  setEventDetails,
  requiredPiecesText,
  setRequiredPiecesText,
  occasion,
  setOccasion,
  occasionOther,
  setOccasionOther,
  season,
  setSeason,
  seasonOther,
  setSeasonOther,
  aesthetic,
  setAesthetic,
  aestheticOther,
  setAestheticOther,
  colorStructure,
  setColorStructure,
  selectedPaletteId,
  setSelectedPaletteId,
  styleGender,
  selectStyleGender,
  showStartCreating,
  setShowStartCreating,
  showLookPlan,
  setShowLookPlan,
  showPhotoMode,
  setShowPhotoMode,
  showLookDetails,
  setShowLookDetails,
  showOccasion,
  setShowOccasion,
  showPreferences,
  setShowPreferences,
  showSeason,
  setShowSeason,
  showAesthetic,
  setShowAesthetic,
  showPalette,
  setShowPalette,
  lookOutputLabel,
  imageModeLabel,
  lookDetailsLabel,
  resolvedOccasionLabel,
  stylePreferencesLabel,
  setActionHint,
  occasionOptions,
  seasonOptions,
  genderOptions,
}: StylistOptionsSectionProps) {
  const summaryCardStyle =
    screenWidth >= 340 ? styles.preferenceSummaryCardHalf : styles.preferenceSummaryCardFull;

  const collapseAllOptionCards = () => {
    setShowLookPlan(false);
    setShowPhotoMode(false);
    setShowLookDetails(false);
    setShowOccasion(false);
    setShowPreferences(false);
    setShowSeason(false);
    setShowAesthetic(false);
    setShowPalette(false);
  };

  const toggleCard = (card: "look_plan" | "photo_mode" | "look_details" | "occasion" | "preferences") => {
    const isActive =
      (card === "look_plan" && showLookPlan) ||
      (card === "photo_mode" && showPhotoMode) ||
      (card === "look_details" && showLookDetails) ||
      (card === "occasion" && showOccasion) ||
      (card === "preferences" && showPreferences);

    collapseAllOptionCards();
    if (isActive) return;

    if (card === "look_plan") setShowLookPlan(true);
    if (card === "photo_mode") setShowPhotoMode(true);
    if (card === "look_details") setShowLookDetails(true);
    if (card === "occasion") setShowOccasion(true);
    if (card === "preferences") setShowPreferences(true);
  };

  return (
    <Animated.View entering={FadeInDown.delay(135).duration(500)} style={styles.section}>
      <CollapsibleSection
        title="Outfit options"
        subtitle="Tap any option below"
        open={showStartCreating}
        onToggle={() => setShowStartCreating((prev) => !prev)}
        styles={styles}
      >
        <Text style={styles.preferencesHint}>All options are shown in two columns. Expand one to edit details.</Text>
        <View style={styles.preferenceSummaryRow}>
          <OptionCard
            title="Style advice"
            value={lookOutputLabel}
            active={showLookPlan}
            cardStyle={summaryCardStyle}
            onPress={() => toggleCard("look_plan")}
            styles={styles}
          >
            <View style={[styles.modeRow, styles.modeRowStacked]}>
              <Pressable
                onPress={() => {
                  setOutputMode("text");
                  setActionHint("");
                }}
                style={[
                  styles.modeChip,
                  styles.modeChipStacked,
                  outputMode === "text" ? styles.modeChipActive : undefined,
                ]}
              >
                <Text style={outputMode === "text" ? styles.modeChipTitleActive : styles.modeChipTitle}>
                  Style Advice
                </Text>
                <Text style={outputMode === "text" ? styles.modeChipSubtitleActive : styles.modeChipSubtitle}>
                  {styleCosts.text} credits
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setOutputMode("image");
                  setActionHint("");
                }}
                style={[
                  styles.modeChip,
                  styles.modeChipStacked,
                  outputMode === "image" ? styles.modeChipActive : undefined,
                ]}
              >
                <Text style={outputMode === "image" ? styles.modeChipTitleActive : styles.modeChipTitle}>
                  Look Preview Image
                </Text>
                <Text style={outputMode === "image" ? styles.modeChipSubtitleActive : styles.modeChipSubtitle}>
                  {styleCosts.image} credits
                </Text>
              </Pressable>
            </View>
          </OptionCard>

          <OptionCard
            title="Photo setup"
            value={showPhotoSetupOption ? imageModeLabel : "Disabled in current source mode"}
            active={showPhotoMode}
            cardStyle={summaryCardStyle}
            onPress={() => toggleCard("photo_mode")}
            styles={styles}
          >
            {showPhotoSetupOption ? (
              <>
                <Text style={styles.inlineHelperText}>Only needed if you upload photos.</Text>
                <View style={[styles.modeRow, styles.modeRowStacked]}>
                  <Pressable
                    onPress={() => updateImageInputMode("single_item")}
                    style={[
                      styles.modeChip,
                      styles.modeChipStacked,
                      imageInputMode === "single_item" ? styles.modeChipActive : undefined,
                    ]}
                  >
                    <Text style={imageInputMode === "single_item" ? styles.modeChipTitleActive : styles.modeChipTitle}>
                      One Item / Photo
                    </Text>
                    <Text style={imageInputMode === "single_item" ? styles.modeChipSubtitleActive : styles.modeChipSubtitle}>
                      Up to {maxPhotosByMode.single_item} photos
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => updateImageInputMode("multi_item")}
                    style={[
                      styles.modeChip,
                      styles.modeChipStacked,
                      imageInputMode === "multi_item" ? styles.modeChipActive : undefined,
                    ]}
                  >
                    <Text style={imageInputMode === "multi_item" ? styles.modeChipTitleActive : styles.modeChipTitle}>
                      Multiple Items / Photo
                    </Text>
                    <Text style={imageInputMode === "multi_item" ? styles.modeChipSubtitleActive : styles.modeChipSubtitle}>
                      Up to {maxPhotosByMode.multi_item} photos
                    </Text>
                  </Pressable>
                </View>
                {!imageInputMode && <Text style={styles.inlineHelperText}>No selection needed for text-only styling.</Text>}
              </>
            ) : (
              <Text style={styles.inlineHelperText}>
                Photo setup is available only when &quot;Style from this photo&quot; is selected.
              </Text>
            )}
          </OptionCard>

          <OptionCard
            title="Describe your look"
            value={lookDetailsLabel}
            active={showLookDetails}
            cardStyle={summaryCardStyle}
            onPress={() => toggleCard("look_details")}
            styles={styles}
          >
            <View style={styles.extraInputs}>
              <TextInput
                style={styles.compactInput}
                value={eventDetails}
                onChangeText={(value) => {
                  setEventDetails(value);
                  setActionHint("");
                }}
                placeholder="Where are you going? (optional)"
                placeholderTextColor={Colors.textMuted}
              />
              <TextInput
                style={styles.compactInput}
                value={requiredPiecesText}
                onChangeText={(value) => {
                  setRequiredPiecesText(value);
                  setActionHint("");
                }}
                placeholder="Must-have pieces (comma separated)"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </OptionCard>

          <OptionCard
            title="Occasion"
            value={resolvedOccasionLabel}
            active={showOccasion}
            cardStyle={summaryCardStyle}
            onPress={() => toggleCard("occasion")}
            styles={styles}
          >
            <View style={styles.occasionGrid}>
              {occasionOptions.map((o: string) => (
                <Pressable
                  key={o}
                  onPress={() => {
                    setOccasion(occasion === o ? "" : o);
                    if (o !== "Other") setOccasionOther("");
                    setActionHint("");
                    Haptics.selectionAsync();
                  }}
                  style={[styles.occasionChip, occasion === o ? styles.occasionChipActive : undefined]}
                >
                  <Text style={occasion === o ? styles.occasionTextActive : styles.occasionText}>{o}</Text>
                </Pressable>
              ))}
            </View>
            {occasion === "Other" && (
              <TextInput
                style={[styles.compactInput, styles.otherInput]}
                value={occasionOther}
                onChangeText={(value) => {
                  setOccasionOther(value);
                  setActionHint("");
                }}
                placeholder="Write your occasion"
                placeholderTextColor={Colors.textMuted}
              />
            )}
          </OptionCard>

          <OptionCard
            title="Style preferences"
            value={stylePreferencesLabel}
            active={showPreferences}
            cardStyle={summaryCardStyle}
            onPress={() => toggleCard("preferences")}
            styles={styles}
          >
            <Text style={styles.preferencesHint}>These choices apply to both text requests and photo requests.</Text>

            <Text style={styles.preferenceLabel}>Who is this look for?</Text>
            <View style={styles.occasionGrid}>
              {genderOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    const nextGender = styleGender === option.value ? "" : option.value;
                    selectStyleGender(nextGender);
                  }}
                  style={[styles.occasionChip, styleGender === option.value ? styles.occasionChipActive : undefined]}
                >
                  <Text style={styleGender === option.value ? styles.occasionTextActive : styles.occasionText}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.inlineHelperText}>Optional. Helps tailor proportions and styling references.</Text>

            <Pressable style={styles.preferenceToggle} onPress={() => setShowSeason((prev) => !prev)}>
              <Text style={styles.preferenceToggleText}>Season</Text>
              <Ionicons name={showSeason ? "chevron-up" : "chevron-down"} size={16} color={Colors.textSecondary} />
            </Pressable>
            {showSeason && (
              <>
                <View style={styles.occasionGrid}>
                  {seasonOptions.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => {
                        setSeason(season === option ? "" : option);
                        if (option !== "Other") setSeasonOther("");
                        setActionHint("");
                        Haptics.selectionAsync();
                      }}
                      style={[styles.occasionChip, season === option ? styles.occasionChipActive : undefined]}
                    >
                      <Text style={season === option ? styles.occasionTextActive : styles.occasionText}>{option}</Text>
                    </Pressable>
                  ))}
                </View>
                {season === "Other" && (
                  <TextInput
                    style={[styles.compactInput, styles.otherInput]}
                    value={seasonOther}
                    onChangeText={(value) => {
                      setSeasonOther(value);
                      setActionHint("");
                    }}
                    placeholder="Write your season preference"
                    placeholderTextColor={Colors.textMuted}
                  />
                )}
              </>
            )}

            <Pressable style={styles.preferenceToggle} onPress={() => setShowAesthetic((prev) => !prev)}>
              <Text style={styles.preferenceToggleText}>Aesthetic</Text>
              <Ionicons name={showAesthetic ? "chevron-up" : "chevron-down"} size={16} color={Colors.textSecondary} />
            </Pressable>
            {showAesthetic && (
              <AestheticSelector
                selectedAesthetic={aesthetic}
                aestheticOther={aestheticOther}
                onChangeAesthetic={(value) => {
                  setAesthetic(value);
                  if (value !== "other") {
                    setAestheticOther("");
                  }
                  setActionHint("");
                  Haptics.selectionAsync();
                }}
                onChangeAestheticOther={(value) => {
                  setAestheticOther(value);
                  setActionHint("");
                }}
              />
            )}

            <Pressable style={styles.preferenceToggle} onPress={() => setShowPalette((prev) => !prev)}>
              <Text style={styles.preferenceToggleText}>Color palette</Text>
              <Ionicons name={showPalette ? "chevron-up" : "chevron-down"} size={16} color={Colors.textSecondary} />
            </Pressable>
            {showPalette && (
              <ColorPaletteSelector
                selectedStructure={colorStructure}
                selectedPaletteId={selectedPaletteId}
                onChangeStructure={(value) => {
                  setColorStructure(value);
                  setActionHint("");
                  if (value === "any") {
                    setSelectedPaletteId(null);
                    return;
                  }
                  if (
                    selectedPaletteId &&
                    !PALETTE_OPTIONS.some(
                      (palette) => palette.id === selectedPaletteId && palette.structure === value,
                    )
                  ) {
                    setSelectedPaletteId(null);
                  }
                  Haptics.selectionAsync();
                }}
                onChangePalette={(paletteId) => {
                  setSelectedPaletteId(paletteId);
                  setActionHint("");
                  Haptics.selectionAsync();
                }}
              />
            )}
          </OptionCard>
        </View>
      </CollapsibleSection>
    </Animated.View>
  );
}
