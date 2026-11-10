import { useEffect, useState } from "react";
import { EQUIPMENT, LP, REWARD } from "./catalogFilterOptions";
import type { CatalogFilterState } from "./catalogFilterOptions";
import type { Equipment, LpTolerance, VisualReward } from "@/lib/catalogTypes";

export function useCatalogFilters(): [
  CatalogFilterState,
  (next: CatalogFilterState) => void,
] {
  const [state, setStateRaw] = useState<CatalogFilterState>(() => {
    const eq = JSON.parse(localStorage.getItem("pushnav.catalog.equipment") || "null");
    const lp = JSON.parse(localStorage.getItem("pushnav.catalog.lp") || "null");
    const rw = JSON.parse(localStorage.getItem("pushnav.catalog.reward") || "null");
    return {
      equipment: new Set(eq ?? EQUIPMENT.map((e) => e.value)) as Set<Equipment>,
      lp: new Set(lp ?? LP.map((l) => l.value)) as Set<LpTolerance>,
      reward: new Set(rw ?? REWARD.map((r) => r.value)) as Set<VisualReward>,
    };
  });
  useEffect(() => {
    localStorage.setItem(
      "pushnav.catalog.equipment",
      JSON.stringify([...state.equipment]),
    );
    localStorage.setItem("pushnav.catalog.lp", JSON.stringify([...state.lp]));
    localStorage.setItem("pushnav.catalog.reward", JSON.stringify([...state.reward]));
  }, [state]);
  return [state, setStateRaw];
}
