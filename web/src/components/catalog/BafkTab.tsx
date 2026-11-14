import { useMemo, useState, type ChangeEvent } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { searchBafk, type BafkObject } from "@/lib/bafk";

interface Props {
  objects: BafkObject[];
  loading: boolean;
  loadError: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onImport: (file: File) => Promise<void>;
}

export function BafkTab({
  objects, loading, loadError, selectedId, onSelect, onImport,
}: Props) {
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const results = useMemo(() => searchBafk(objects, query), [objects, query]);

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      await onImport(file);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "BAfK import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card className="lg:col-span-2 flex flex-col gap-3 px-3 py-3 min-h-0 max-h-[70vh] lg:max-h-none">
      <div className="flex flex-col gap-1 text-xs">
        <span className="font-medium">Beobachter-Atlas für Kurzentschlossene · Juli 2020</span>
        <span className="text-muted-foreground">
          Private lokale Kopie mit Abbildungen und Beobachtungshinweisen.
          Der Import erfolgt am Laptop, die Daten sind anschließend im lokalen Netzwerk verfügbar.
        </span>
        <label className="flex flex-wrap items-center gap-2 py-1">
          <span>BAfK-Paket importieren (.zip)</span>
          <input
            type="file"
            accept=".zip,application/zip"
            aria-label="BAfK-Paket importieren"
            onChange={handleImport}
            disabled={importing}
            className="max-w-full text-xs"
          />
        </label>
        {importing && <span role="status">Atlas wird importiert…</span>}
        {importError && <span role="alert" className="text-destructive">{importError}</span>}
        {loadError && <span role="alert" className="text-destructive">{loadError}</span>}
        {loading && <span role="status">Katalog wird geladen…</span>}
        {!loading && !loadError && (
          <span className="text-muted-foreground">
            {objects.length === 0 ? "Noch kein BAfK-Paket importiert." : objects.length + " Ziele lokal verfügbar."}
          </span>
        )}
      </div>
      <div className="border-t border-border/60 -mx-3" />
      <input
        type="search"
        aria-label="BAfK durchsuchen"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Objektkennung oder deutscher Name, z. B. Hantelnebel…"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <div className="flex-1 min-h-0 overflow-y-auto pushnav-scrollbar">
        {!query.trim() ? (
          <p className="text-sm text-muted-foreground p-2">
            Suche nach Katalogbezeichnung, Sternbild oder Begriff aus den Beobachtungstexten.
          </p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground p-2">Keine Treffer im BAfK.</p>
        ) : (
          <ul className="flex flex-col">
            {results.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  aria-current={selectedId === entry.id ? "true" : undefined}
                  onClick={() => onSelect(entry.id)}
                  className={cn(
                    "w-full text-left px-2 py-2 text-xs hover:bg-muted/50",
                    selectedId === entry.id && "bg-muted",
                  )}
                >
                  <span className="font-medium">{entry.name}</span>
                  <span className="ml-2 text-muted-foreground">
                    {entry.constellation} · {entry.type} · {entry.aperture}
                    {entry.images.length > 0 ? " · Bild" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
