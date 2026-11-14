import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { fetchBafk, uploadBafk, type BafkObject } from "@/lib/bafk";
import { fetchSolarBodies, SOLAR_BODIES, type SolarBody } from "@/lib/solarSystem";
import {
  buildCatalogIndex, buildCatalogResolver, recommendations, searchCatalog,
  type CatalogTarget, type SearchItem,
} from "@/lib/unifiedCatalog";
import type { AdvancedEntry } from "@/lib/catalogTypes";
import {
  OBSERVATION_LISTS_KEY, readObservationState, type ObservationState,
} from "@/lib/observationLists";
import type { EnginePayload } from "@/lib/types";
import { CatalogDetail } from "./CatalogDetail";
import { LocationPanel } from "./LocationPanel";
import { UnifiedSearchTab } from "./UnifiedSearchTab";
import { ObservationListsTab } from "./ObservationListsTab";

const SELECTED_KEY = "pushnav.catalog.selected";
const QUERY_KEY = "pushnav.catalog.query";
const MATCH_KEY = "pushnav.catalog.search.selected";
const SUBTAB_KEY = "pushnav.catalog.subtab";

interface Props {
  state: EnginePayload;
  onSwitchToNavigation: () => void;
}

export function WhatToSee({ state, onSwitchToNavigation }: Props) {
  const [tab, setTab] = useState<"search" | "lists">(
    () => localStorage.getItem(SUBTAB_KEY) === "lists" ? "lists" : "search",
  );
  const [query, setQueryRaw] = useState(() =>
    localStorage.getItem(QUERY_KEY)
    ?? localStorage.getItem("pushnav.catalog.advanced.query") ?? "",
  );
  function setQuery(value: string) {
    setQueryRaw(value);
    if (value) localStorage.setItem(QUERY_KEY, value);
    else localStorage.removeItem(QUERY_KEY);
  }
  function setSubtab(next: "search" | "lists") {
    setTab(next);
    localStorage.setItem(SUBTAB_KEY, next);
  }

  const [selectedKey, setSelectedKey] = useState<string | null>(
    () => localStorage.getItem(MATCH_KEY),
  );
  function selectResult(item: SearchItem) {
    setSelectedKey(item.key);
    localStorage.setItem(MATCH_KEY, item.key);
    setManual(null);
  }

  const [selectedId, setSelectedIdState] = useState<string | null>(() => {
    const id = localStorage.getItem(SELECTED_KEY);
    return recommendations.some((obj) => obj.id === id) ? id : null;
  });
  function setSelectedId(id: string | null) {
    setSelectedIdState(id);
    if (id === null) localStorage.removeItem(SELECTED_KEY);
    else localStorage.setItem(SELECTED_KEY, id);
    setManual(null);
  }

  const [manual, setManual] = useState<AdvancedEntry | null>(null);
  const [tickNow, setTickNow] = useState(() => Date.now());
  const [appliedOffsetMin, setAppliedOffsetMin] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTickNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const evalAt = useMemo(
    () => new Date(tickNow + appliedOffsetMin * 60_000),
    [tickNow, appliedOffsetMin],
  );

  const latitude = state.location?.latitude ?? null;
  const longitude = state.location?.longitude ?? null;
  const location = useMemo(
    () => latitude !== null && longitude !== null ? { latitude, longitude } : null,
    [latitude, longitude],
  );

  const [bafkObjects, setBafkObjects] = useState<BafkObject[]>([]);
  const [bafkError, setBafkError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    fetchBafk().then((entries) => {
      if (mounted) { setBafkObjects(entries); setBafkError(null); }
    }).catch((error: unknown) => {
      if (mounted) setBafkError(error instanceof Error ? error.message : "BAfK nicht verfügbar");
    });
    return () => { mounted = false; };
  }, []);
  async function importBafk(file: File) {
    await uploadBafk(file);
    const entries = await fetchBafk();
    setBafkObjects(entries);
    setBafkError(null);
  }

  const [solarBodies, setSolarBodies] = useState<SolarBody[]>(SOLAR_BODIES);
  const [solarError, setSolarError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    fetchSolarBodies(evalAt).then((entries) => {
      if (mounted) { setSolarBodies(entries); setSolarError(null); }
    }).catch((error: unknown) => {
      if (mounted) setSolarError(error instanceof Error
        ? error.message : "Ephemeriden nicht verfügbar");
    });
    return () => { mounted = false; };
  }, [evalAt, location]);

  const index = useMemo(() =>
    buildCatalogIndex(bafkObjects, SOLAR_BODIES), [bafkObjects],
  );
  const results = useMemo(() => searchCatalog(query, index), [query, index]);
  const resolveTarget = useMemo(() => buildCatalogResolver(index), [index]);
  const isKnownTarget = (name: string) => resolveTarget(name) !== null;

  const [observation, setObservation] = useState(readObservationState);
  function saveObservation(next: ObservationState): boolean {
    try {
      localStorage.setItem(OBSERVATION_LISTS_KEY, JSON.stringify(next));
      setObservation(next);
      return true;
    } catch { return false; }
  }
  const activeList = observation.lists[observation.activeListIndex] ?? null;
  const activeTarget = activeList?.targets[activeList.selectedIndex] ?? null;
  const observedSelection = activeTarget ? resolveTarget(activeTarget.name) : null;
  const recommendation = recommendations.find((obj) => obj.id === selectedId) ?? null;
  const resultSelection = results.find((item) => item.key === selectedKey)?.target ?? null;

  function currentSolarTarget(target: CatalogTarget | null): CatalogTarget | null {
    if (target?.kind !== "solar") return target;
    const object = solarBodies.find((body) => body.id === target.object.id) ?? target.object;
    return { kind: "solar", object };
  }
  const detail: CatalogTarget | null = tab === "lists"
    ? currentSolarTarget(observedSelection)
    : manual?.source === "manual"
      ? { kind: "advanced", entry: manual }
      : query.trim()
        ? currentSolarTarget(resultSelection)
        : recommendation ? { kind: "buddy", object: recommendation } : null;

  return (
    <div className="flex flex-col gap-2 lg:h-full lg:min-h-0">
      <div className="flex gap-1 self-start rounded-lg bg-muted/40 p-1">
        <button type="button" onClick={() => setSubtab("search")}
          className={"px-3 py-1 rounded-md text-xs " +
            (tab === "search" ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground")}>
          Suche
        </button>
        <button type="button" onClick={() => setSubtab("lists")}
          className={"px-3 py-1 rounded-md text-xs " +
            (tab === "lists" ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground")}>
          Beobachtungslisten
        </button>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 lg:grid-rows-1 gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
        {tab === "search" ? (
          <UnifiedSearchTab
            query={query} onQueryChange={setQuery}
            results={results} selectedKey={selectedKey} onSelect={selectResult}
            recommendations={recommendations}
            selectedRecommendationId={selectedId} onRecommendationSelect={setSelectedId}
            location={location} evalAt={evalAt}
            appliedOffsetMin={appliedOffsetMin} setAppliedOffsetMin={setAppliedOffsetMin}
            bafkObjects={bafkObjects} onBafkImport={importBafk} bafkError={bafkError}
            solarError={solarError} manual={manual} onManualSelect={setManual}
          />
        ) : (
          <ObservationListsTab value={observation} onChange={saveObservation}
            resolveTarget={isKnownTarget} />
        )}

        <Card className="lg:col-span-1 lg:min-h-0 lg:overflow-y-auto pushnav-scrollbar flex flex-col gap-3 px-4 py-3 text-sm">
          <LocationPanel state={state} />
          <div className="border-t border-border/60 -mx-4" />
          {tab === "lists" && activeTarget && !observedSelection ? (
            <div className="text-sm text-destructive">
              {activeTarget.name} wurde nicht eindeutig im Katalog gefunden.
            </div>
          ) : (
            <CatalogDetail input={detail} location={location} evalAt={evalAt}
              onTargetSet={onSwitchToNavigation} />
          )}
        </Card>
      </div>
    </div>
  );
}
