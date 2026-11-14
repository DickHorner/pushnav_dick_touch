import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { advancedSearch } from "@/lib/advancedSearch";
import type {
  AdvancedEntry, NgcEntry, StarEntry,
} from "@/lib/catalogTypes";
import ngcData from "@/data/openngc.json";
import starData from "@/data/hyg-bright.json";
import { GERMAN_NGC_ALIASES } from "@/lib/germanCatalogAliases";
import { SearchInput } from "./SearchInput";
import { ResultsList } from "./ResultsList";
import { ManualEntry } from "./ManualEntry";

const ngcList: NgcEntry[] = (ngcData as Omit<NgcEntry, "source">[])
  .map((e) => ({ ...e, aliases: [...e.aliases, ...(GERMAN_NGC_ALIASES[e.id] ?? [])], source: "ngc" as const }));
const starList: StarEntry[] = (starData as Omit<StarEntry, "source">[])
  .map((e) => ({ ...e, source: "star" as const }));
const allEntries: (NgcEntry | StarEntry)[] = [...ngcList, ...starList];

// Persist the search query so it survives Navigation ↔ What-to-see flips
// (which unmount this component) and full reloads. The selection is
// persisted in WhatToSee via pushnav.catalog.advanced.selected; together
// the two cover everything the user sees in this tab.
const QUERY_KEY = "pushnav.catalog.advanced.query";

interface Props {
  selected: AdvancedEntry | null;
  onSelect: (entry: AdvancedEntry | null) => void;
}

export function AdvancedTab({ selected, onSelect }: Props) {
  const [query, setQueryRaw] = useState<string>(
    () => localStorage.getItem(QUERY_KEY) ?? "",
  );
  // Seed `debounced` with the same persisted value so results render
  // immediately on mount — otherwise the first paint shows the
  // empty-state hint even when the user had previously typed a query.
  const [debounced, setDebounced] = useState<string>(
    () => localStorage.getItem(QUERY_KEY) ?? "",
  );
  const setQuery = (v: string) => {
    setQueryRaw(v);
    if (v === "") localStorage.removeItem(QUERY_KEY);
    else localStorage.setItem(QUERY_KEY, v);
  };
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 100);
    return () => clearTimeout(id);
  }, [query]);

  const results = useMemo(
    () => advancedSearch(debounced, allEntries) as (NgcEntry | StarEntry)[],
    [debounced],
  );

  const selectedId =
    selected && (selected.source === "ngc" || selected.source === "star")
      ? selected.id
      : null;

  function onPick(id: string, source: "ngc" | "star") {
    const found = allEntries.find((e) => e.source === source && e.id === id);
    onSelect(found ?? null);
  }

  return (
    <Card className="lg:col-span-2 flex flex-col gap-2 px-3 py-3 min-h-0 max-h-[70vh] lg:max-h-none">
      <SearchInput value={query} onChange={setQuery} />
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-1">
          Manual RA/Dec entry
        </summary>
        <div className="mt-2">
          <ManualEntry
            current={selected && selected.source === "manual" ? selected : null}
            onSubmit={(m) => onSelect(m)}
            onClear={() => {
              if (selected && selected.source === "manual") onSelect(null);
            }}
          />
        </div>
      </details>
      <div className="border-t border-border/60 -mx-3" />
      <div className="flex-1 min-h-0 overflow-y-auto pushnav-scrollbar -mx-3 px-3">
        {debounced.trim() === "" ? (
          <div className="text-sm text-muted-foreground p-2">
            Type to search ~{ngcList.length + starList.length} objects.
          </div>
        ) : (
          <ResultsList entries={results} selectedId={selectedId} onSelect={onPick} />
        )}
      </div>
      <div className="text-[10px] text-muted-foreground mt-1 px-1 leading-tight">
        Star data:{" "}
        <a href="https://www.astronexus.com/hyg" target="_blank"
           rel="noopener noreferrer" className="underline">HYG database</a>.
        Deep-sky data:{" "}
        <a href="https://github.com/mattiaverga/OpenNGC" target="_blank"
           rel="noopener noreferrer" className="underline">OpenNGC</a>. CC-BY-SA.
      </div>
    </Card>
  );
}
