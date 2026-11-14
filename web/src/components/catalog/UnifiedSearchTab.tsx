import { useState, type ChangeEvent } from "react";
import { Card } from "@/components/ui/card";
import type { BafkObject } from "@/lib/bafk";
import { cn } from "@/lib/utils";
import type { AdvancedEntry, CatalogObject } from "@/lib/catalogTypes";
import type { SearchItem } from "@/lib/unifiedCatalog";
import { BuddyTab } from "./buddy/BuddyTab";
import { ManualEntry } from "./advanced/ManualEntry";
import { SearchInput } from "./advanced/SearchInput";

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  results: SearchItem[];
  selectedKey: string | null;
  onSelect: (item: SearchItem) => void;
  recommendations: CatalogObject[];
  selectedRecommendationId: string | null;
  onRecommendationSelect: (id: string | null) => void;
  location: { latitude: number; longitude: number } | null;
  evalAt: Date;
  appliedOffsetMin: number;
  setAppliedOffsetMin: (value: number) => void;
  bafkObjects: BafkObject[];
  onBafkImport: (file: File) => Promise<void>;
  bafkError: string | null;
  solarError: string | null;
  manual: AdvancedEntry | null;
  onManualSelect: (entry: AdvancedEntry | null) => void;
}

export function UnifiedSearchTab({
  query, onQueryChange, results, selectedKey, onSelect,
  recommendations, selectedRecommendationId, onRecommendationSelect,
  location, evalAt, appliedOffsetMin, setAppliedOffsetMin,
  bafkObjects, onBafkImport, bafkError, solarError, manual, onManualSelect,
}: Props) {
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function importAtlas(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportError(null);
    setImporting(true);
    try {
      await onBafkImport(file);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "BAfK-Import fehlgeschlagen");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="lg:col-span-2 min-h-0 flex flex-col gap-2">
      <Card className="px-3 py-3 gap-2 shrink-0">
        <SearchInput value={query} onChange={onQueryChange}
          placeholder="Alle Himmelsobjekte suchen: Saturn, Plejaden, M31, Ringnebel …" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <details>
            <summary className="cursor-pointer">BAfK-Atlas importieren ({bafkObjects.length} Einträge)</summary>
            <label className="flex items-center gap-2 py-2">
              <span>Lokales BAfK-Paket (.zip)</span>
              <input type="file" accept=".zip,application/zip"
                aria-label="BAfK-Paket importieren" disabled={importing}
                onChange={importAtlas} className="max-w-full text-xs" />
            </label>
            {importing && <span role="status">Atlas wird importiert …</span>}
            {importError && <span role="alert" className="text-destructive">{importError}</span>}
          </details>
          <details>
            <summary className="cursor-pointer">RA/Dec manuell eingeben</summary>
            <ManualEntry
              current={manual?.source === "manual" ? manual : null}
              onSubmit={onManualSelect}
              onClear={() => onManualSelect(null)}
            />
          </details>
        </div>
        {bafkError && <p role="alert" className="text-xs text-destructive">BAfK: {bafkError}</p>}
        {solarError && <p role="alert" className="text-xs text-destructive">
          Planetenpositionen nicht verfügbar: {solarError}
        </p>}
      </Card>

      {query.trim() ? (
        <Card className="flex-1 min-h-0 max-h-[70vh] lg:max-h-none px-3 py-3">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Treffer.</p>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto pushnav-scrollbar">
              <ul className="flex flex-col">
                {results.map((item) => (
                  <li key={item.key}>
                    <button type="button" onClick={() => onSelect(item)}
                      aria-current={item.key === selectedKey ? "true" : undefined}
                      className={cn("w-full text-left px-2 py-2 text-xs hover:bg-muted/50",
                        item.key === selectedKey && "bg-primary/15")}>
                      <span className="mr-2 inline-block text-[10px] uppercase tracking-wide text-muted-foreground">
                        {item.source}
                      </span>{" "}
                      <span className="font-medium">{item.title}</span>
                      {item.subtitle && (
                        <>{" "}<span className="ml-2 text-muted-foreground">{item.subtitle}</span></>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ) : (
        <BuddyTab objects={recommendations}
          location={location} evalAt={evalAt}
          appliedOffsetMin={appliedOffsetMin} setAppliedOffsetMin={setAppliedOffsetMin}
          selectedId={selectedRecommendationId} setSelectedId={onRecommendationSelect} />
      )}
    </div>
  );
}
