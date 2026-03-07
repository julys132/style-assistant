import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  COLOR_STRUCTURES,
  ColorStructure,
  PALETTE_OPTIONS,
} from "@/constants/colorPalettes";

type Props = {
  selectedStructure: ColorStructure;
  selectedPaletteId: string | null;
  onChangeStructure: (value: ColorStructure) => void;
  onChangePalette: (paletteId: string | null) => void;
};

export function ColorPaletteSelector({
  selectedStructure,
  selectedPaletteId,
  onChangeStructure,
  onChangePalette,
}: Props) {
  const filteredPalettes = useMemo(() => {
    if (selectedStructure === "any") return [];
    return PALETTE_OPTIONS.filter((palette) => palette.structure === selectedStructure);
  }, [selectedStructure]);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Color direction</Text>

      <View style={styles.structureRow}>
        {COLOR_STRUCTURES.map((item) => {
          const active = selectedStructure === item.id;

          return (
            <Pressable
              key={item.id}
              onPress={() => {
                onChangeStructure(item.id);
                if (item.id === "any") onChangePalette(null);
              }}
              style={[styles.structureChip, active && styles.structureChipActive]}
            >
              <Text style={[styles.structureChipText, active && styles.structureChipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedStructure !== "any" && (
        <View style={styles.paletteGrid}>
          {filteredPalettes.map((palette) => {
            const active = selectedPaletteId === palette.id;

            return (
              <Pressable
                key={palette.id}
                onPress={() => onChangePalette(palette.id)}
                style={[styles.paletteCard, active && styles.paletteCardActive]}
              >
                <SwatchStrip swatches={palette.swatches} />
                <Text
                  numberOfLines={1}
                  style={[styles.paletteLabel, active && styles.paletteLabelActive]}
                >
                  {palette.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function SwatchStrip({ swatches }: { swatches: string[] }) {
  return (
    <View style={styles.swatchStrip}>
      {swatches.map((color, index) => (
        <View
          key={`${color}-${index}`}
          style={[
            styles.swatch,
            { backgroundColor: color },
            index === 0 ? styles.firstSwatch : undefined,
            index === swatches.length - 1 ? styles.lastSwatch : undefined,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  title: {
    color: "#F7F1E8",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  structureRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  structureChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#141518",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
  },
  structureChipActive: {
    backgroundColor: "rgba(190, 149, 92, 0.16)",
    borderColor: "#C5A06A",
  },
  structureChipText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "600",
  },
  structureChipTextActive: {
    color: "#F6E3C6",
  },
  paletteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  paletteCard: {
    width: 132,
    minHeight: 78,
    borderRadius: 16,
    padding: 10,
    backgroundColor: "#111216",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 10,
  },
  paletteCardActive: {
    borderColor: "#C5A06A",
    backgroundColor: "rgba(190, 149, 92, 0.12)",
  },
  swatchStrip: {
    height: 24,
    borderRadius: 10,
    overflow: "hidden",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  swatch: {
    flex: 1,
    height: "100%",
  },
  firstSwatch: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  lastSwatch: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  paletteLabel: {
    color: "#F3EEE7",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  paletteLabelActive: {
    color: "#F7E3C7",
  },
});
