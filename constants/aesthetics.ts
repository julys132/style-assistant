export type AestheticOption = {
  id: string;
  label: string;
  hint: string;
};

export const AESTHETIC_OPTIONS: AestheticOption[] = [
  { id: "old_money", label: "Old Money", hint: "Tailored, refined" },
  { id: "minimal", label: "Minimal", hint: "Clean, neutral" },
  { id: "clean_girl", label: "Clean Girl", hint: "Soft, polished" },
  { id: "classic", label: "Classic", hint: "Timeless, balanced" },
  { id: "feminine", label: "Feminine", hint: "Soft, pretty" },
  { id: "streetwear", label: "Streetwear", hint: "Bold, relaxed" },
  { id: "edgy", label: "Edgy", hint: "Sharp, contrast" },
  { id: "boho", label: "Boho", hint: "Flowy, relaxed" },
  { id: "sporty", label: "Sporty", hint: "Easy, active" },
  { id: "soft_glam", label: "Soft Glam", hint: "Chic, elevated" },
  { id: "other", label: "Other", hint: "Custom style" },
];
