import type { Equipment, LpTolerance, VisualReward } from "@/lib/catalogTypes";

export const EQUIPMENT: { value: Equipment; label: string }[] = [
  { value: "naked-eye", label: "Naked eye" },
  { value: "binoculars", label: "Binoculars" },
  { value: "small-telescope", label: "Small scope" },
  { value: "medium-telescope", label: "Medium scope" },
  { value: "large-telescope", label: "Large scope" },
];

export const LP: { value: LpTolerance; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export const REWARD: { value: VisualReward; label: string }[] = [
  { value: "high", label: "High" },
  { value: "moderate", label: "Moderate" },
  { value: "low", label: "Low" },
];

export interface CatalogFilterState {
  equipment: Set<Equipment>;
  lp: Set<LpTolerance>;
  reward: Set<VisualReward>;
}

