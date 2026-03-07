export type ColorStructure =
  | "any"
  | "monochrome"
  | "2_colors"
  | "3_colors"
  | "4_colors_max";

export type PaletteOption = {
  id: string;
  label: string;
  structure: Exclude<ColorStructure, "any">;
  swatches: string[];
};

export const COLOR_STRUCTURES: { id: ColorStructure; label: string }[] = [
  { id: "any", label: "Any" },
  { id: "monochrome", label: "Monochrome" },
  { id: "2_colors", label: "2 colors" },
  { id: "3_colors", label: "3 colors" },
  { id: "4_colors_max", label: "4 max" },
];

export const PALETTE_OPTIONS: PaletteOption[] = [
  {
    id: "mono_black",
    label: "Mono black",
    structure: "monochrome",
    swatches: ["#111111", "#2B2B2B", "#555555"],
  },
  {
    id: "mono_beige",
    label: "Mono beige",
    structure: "monochrome",
    swatches: ["#F3E8D7", "#D8C0A5", "#B6916F"],
  },
  {
    id: "mono_brown",
    label: "Mono brown",
    structure: "monochrome",
    swatches: ["#C9A27E", "#8B5E3C", "#4E3426"],
  },
  {
    id: "black_white",
    label: "Black + white",
    structure: "2_colors",
    swatches: ["#111111", "#F5F5F2"],
  },
  {
    id: "beige_cream",
    label: "Beige + cream",
    structure: "2_colors",
    swatches: ["#D9BE9C", "#F5ECDD"],
  },
  {
    id: "brown_black",
    label: "Brown + black",
    structure: "2_colors",
    swatches: ["#7B523A", "#111111"],
  },
  {
    id: "blue_white",
    label: "Blue + white",
    structure: "2_colors",
    swatches: ["#4E6FAE", "#F7F7F4"],
  },
  {
    id: "pink_cream",
    label: "Pink + cream",
    structure: "2_colors",
    swatches: ["#E8B7C8", "#F6EBDD"],
  },
  {
    id: "olive_beige",
    label: "Olive + beige",
    structure: "2_colors",
    swatches: ["#7B8461", "#D7C2A3"],
  },
  {
    id: "navy_white_beige",
    label: "Navy + white + beige",
    structure: "3_colors",
    swatches: ["#243A69", "#F7F7F2", "#D8C0A5"],
  },
  {
    id: "black_grey_white",
    label: "Black + grey + white",
    structure: "3_colors",
    swatches: ["#111111", "#8B8B8B", "#F3F3F0"],
  },
  {
    id: "brown_cream_black",
    label: "Brown + cream + black",
    structure: "3_colors",
    swatches: ["#8A5A3C", "#F4E9DA", "#151515"],
  },
  {
    id: "soft_pastels",
    label: "Soft pastels",
    structure: "4_colors_max",
    swatches: ["#E9C6D3", "#F4E4C8", "#D7E5D4", "#D9DFF1"],
  },
  {
    id: "earth_mix",
    label: "Earth mix",
    structure: "4_colors_max",
    swatches: ["#6E4C3A", "#A67C52", "#D8C0A5", "#6C7258"],
  },
];
