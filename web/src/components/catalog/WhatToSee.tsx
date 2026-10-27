import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import objectsData from "@/data/objects.json";
import type { AdvancedEntry, CatalogObject } from "@/lib/catalogTypes";
import {
  OBSERVATION_LISTS_KEY, readObservationState, resolveObservationTarget,
  type ObservationState,
} from "@/lib/observationLists";
import type { EnginePayload } from "@/lib/types";
import { CatalogDetail } from "./CatalogDetail";
import { LocationPanel } from "./LocationPanel";
import { BuddyTab } from "./buddy/BuddyTab";
import { AdvancedTab } from "./advanced/AdvancedTab";
import { ObservationListsTab } from "./ObservationListsTab";

const objects = objectsData as CatalogObject[];
const SELECTED_KEY = "pushnav.catalog.selected";
const SUBTAB_KEY = "pushnav.catalog.subtab";
const ADV_KEY = "pushnav.catalog.advanced.selected";

function readAdvancedSelection(): AdvancedEntry | null {
  try {
    const raw = localStorage.getItem(ADV_KEY);
    return raw ? (JSON.parse(raw) as AdvancedEntry) : null;
  } catch {
    return null;
  }
}
function writeAdvancedSelection(e: AdvancedEntry | null) {
  if (e === null) localStorage.removeItem(ADV_KEY);
  else localStorage.setItem(ADV_KEY, JSON.stringify(e));
}

interface Props {
  state: EnginePayload;
  onSwitchToNavigation: () => void;
}

export function WhatToSee({ state, onSwitchToNavigation }: Props) {
  const [appliedOffsetMin, setAppliedOffsetMin] = useState(0);
  const [selectedId, setSelectedIdState] = useState<string | null>(() => {
    const raw = localStorage.getItem(SELECTED_KEY);
    return raw && objects.some((o) => o.id === raw) ? raw : null;
  });
  const setSelectedId = (id: string | null) => {
    setSelectedIdState(id);
    if (id === null) localStorage.removeItem(SELECTED_KEY);
    else localStorage.setItem(SELECTED_KEY, id);
  };

  const [tickNow, setTickNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTickNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const evalAt = useMemo(
    () => new Date(tickNow + appliedOffsetMin * 60_000),
    [tickNow, appliedOffsetMin],
  );

  const location = useMemo(() => {
    const loc = state.location;
    if (!loc || loc.latitude === null || loc.longitude === null) return null;
    return { latitude: loc.latitude, longitude: loc.longitude };
  }, [state.location]);

  const selected = useMemo(
    () => objects.find((o) => o.id === selectedId) ?? null,
    [selectedId],
  );

  const [advancedSelected, setAdvancedSelectedState] =
    useState<AdvancedEntry | null>(() => readAdvancedSelection());
  const setAdvancedSelected = (e: AdvancedEntry | null) => {
    setAdvancedSelectedState(e);
    writeAdvancedSelection(e);
  };

  const [observation, setObservation] = useState(readObservationState);
  const saveObservation = (next: ObservationState): boolean => {
    try {
      localStorage.setItem(OBSERVATION_LISTS_KEY, JSON.stringify(next));
      setObservation(next);
      return true;
    } catch {
      return false;
    }
  };
  const activeList = observation.lists[observation.activeListIndex] ?? null;
  const activeTarget = activeList?.targets[activeList.selectedIndex] ?? null;
  const listEntry = activeTarget ? resolveObservationTarget(activeTarget.name) : null;

  const [subtab, setSubtabState] = useState<"buddy" | "advanced" | "lists">(() => {
    const saved = localStorage.getItem(SUBTAB_KEY);
    return saved === "advanced" || saved === "lists" ? saved : "buddy";
  });
  const setSubtab = (v: "buddy" | "advanced" | "lists") => {
    setSubtabState(v);
    localStorage.setItem(SUBTAB_KEY, v);
  };

  return (
    <div className="flex flex-col gap-2 lg:h-full lg:min-h-0">
      <div className="flex items-center gap-1 self-start rounded-lg bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setSubtab("buddy")}
          className={
            "px-3 py-1 rounded-md text-xs " +
            (subtab === "buddy"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Stargazing Buddy
        </button>
        <button
          type="button"
          onClick={() => setSubtab("advanced")}
          className={
            "px-3 py-1 rounded-md text-xs " +
            (subtab === "advanced"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Advanced
        </button>
        <button
          type="button"
          onClick={() => setSubtab("lists")}
          className={
            "px-3 py-1 rounded-md text-xs " +
            (subtab === "lists"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Observing Lists
        </button>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 lg:grid-rows-1 gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
        {subtab === "buddy" ? (
          <BuddyTab
            objects={objects}
            location={location}
            evalAt={evalAt}
            appliedOffsetMin={appliedOffsetMin}
            setAppliedOffsetMin={setAppliedOffsetMin}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
          />
        ) : subtab === "advanced" ? (
          <AdvancedTab
            selected={advancedSelected}
            onSelect={setAdvancedSelected}
          />
        ) : (
          <ObservationListsTab value={observation} onChange={saveObservation} />
        )}

        <Card className="lg:col-span-1 lg:min-h-0 lg:overflow-y-auto pushnav-scrollbar flex flex-col gap-3 px-4 py-3 text-sm">
          <LocationPanel state={state} />
          <div className="border-t border-border/60 -mx-4" />
          {subtab === "lists" && activeTarget && !listEntry ? (
            <div className="text-sm text-destructive">
              {activeTarget.name} was not found in the catalog.
            </div>
          ) : (
            <CatalogDetail
              input={
                subtab === "buddy"
                  ? (selected ? { kind: "buddy", object: selected } : null)
                  : subtab === "advanced"
                    ? (advancedSelected ? { kind: "advanced", entry: advancedSelected } : null)
                    : (listEntry ? { kind: "advanced", entry: listEntry } : null)
              }
              location={location}
              evalAt={evalAt}
              onTargetSet={onSwitchToNavigation}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
