import { Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { AESTHETIC_OPTIONS } from "@/constants/aesthetics";

type Props = {
  selectedAesthetic: string;
  aestheticOther: string;
  onChangeAesthetic: (value: string) => void;
  onChangeAestheticOther: (value: string) => void;
};

export function AestheticSelector({
  selectedAesthetic,
  aestheticOther,
  onChangeAesthetic,
  onChangeAestheticOther,
}: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isMedium = width >= 620;
  const cardWidth = isWide ? "31.8%" : isMedium ? "48.5%" : "100%";

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Aesthetic</Text>
      <Text style={styles.subtitle}>Pick the overall style direction for the outfit.</Text>

      <View style={styles.grid}>
        {AESTHETIC_OPTIONS.map((item) => {
          const active = selectedAesthetic === item.id;

          return (
            <Pressable
              key={item.id}
              onPress={() => onChangeAesthetic(item.id)}
              style={[styles.card, { width: cardWidth }, active && styles.cardActive]}
            >
              <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>{item.label}</Text>
              <Text numberOfLines={1} style={[styles.cardHint, active && styles.cardHintActive]}>
                {item.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedAesthetic === "other" && (
        <View style={styles.otherWrap}>
          <Text style={styles.otherLabel}>Describe your aesthetic</Text>
          <TextInput
            value={aestheticOther}
            onChangeText={onChangeAestheticOther}
            placeholder="e.g. quiet luxury, romantic minimal, modern Parisian"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
            multiline={Platform.OS !== "web"}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  title: {
    color: "#F7F1E8",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  subtitle: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 12.5,
    lineHeight: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    minHeight: 68,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#111216",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    gap: 4,
  },
  cardActive: {
    backgroundColor: "rgba(190,149,92,0.12)",
    borderColor: "#C5A06A",
  },
  cardTitle: {
    color: "#F3EEE7",
    fontSize: 13.5,
    fontWeight: "700",
  },
  cardTitleActive: {
    color: "#F7E3C7",
  },
  cardHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11.5,
    fontWeight: "500",
  },
  cardHintActive: {
    color: "rgba(247,227,199,0.78)",
  },
  otherWrap: {
    marginTop: 2,
    gap: 8,
  },
  otherLabel: {
    color: "#F3EEE7",
    fontSize: 12.5,
    fontWeight: "600",
  },
  input: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#101116",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    color: "#F8F4EE",
    fontSize: 13,
  },
});
