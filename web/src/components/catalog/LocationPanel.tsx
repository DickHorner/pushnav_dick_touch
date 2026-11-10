import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { EnginePayload } from "@/lib/types";

interface Props {
  state: EnginePayload;
}

export function LocationPanel({ state }: Props) {
  const activeLat = state.location?.latitude ?? null;
  const activeLon = state.location?.longitude ?? null;
  const source = state.location?.source ?? null;
  const activeLatStr = activeLat !== null ? activeLat.toFixed(2) : "";
  const activeLonStr = activeLon !== null ? activeLon.toFixed(2) : "";

  const [draft, setDraft] = useState<{ lat: string; lon: string; baseLat: string; baseLon: string }>({
    lat: activeLatStr, lon: activeLonStr, baseLat: activeLatStr, baseLon: activeLonStr,
  });
  const current = draft.baseLat === activeLatStr && draft.baseLon === activeLonStr;
  const latInput = current ? draft.lat : activeLatStr;
  const lonInput = current ? draft.lon : activeLonStr;
  const setLatInput = (lat: string) => setDraft({ lat, lon: lonInput, baseLat: activeLatStr, baseLon: activeLonStr });
  const setLonInput = (lon: string) => setDraft({ lat: latInput, lon, baseLat: activeLatStr, baseLon: activeLonStr });

  const lat = parseFloat(latInput);
  const lon = parseFloat(lonInput);
  const valid =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180;
  const dirty = latInput !== activeLatStr || lonInput !== activeLonStr;
  const hasManual = source === "manual";

  const save = async () => {
    if (!valid) return;
    await api.setSettings({ location: { latitude: lat, longitude: lon } });
  };

  const clear = async () => {
    setLatInput("");
    setLonInput("");
    await api.setSettings({ location: null });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-primary">Location</Label>
        <span className="text-xs text-muted-foreground font-mono">
          {state.location?.source ?? "—"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          step="0.0001"
          placeholder="Lat"
          value={latInput}
          onChange={(e) => setLatInput(e.target.value)}
          className="h-7 text-xs text-right"
        />
        <Input
          type="number"
          step="0.0001"
          placeholder="Lon"
          value={lonInput}
          onChange={(e) => setLonInput(e.target.value)}
          className="h-7 text-xs text-right"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={save}
          disabled={!dirty || !valid}
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={clear}
          disabled={!hasManual}
        >
          Clear
        </Button>
      </div>
      <div className="text-xs text-muted-foreground leading-snug space-y-0.5">
        <div>Latitude: + = North, − = South</div>
        <div>Longitude: + = East, − = West</div>
        <div className="pt-1">
          e.g. New York <span className="font-mono">40.71, −74.01</span> ·
          Sydney <span className="font-mono">−33.87, 151.21</span>
        </div>
      </div>
    </div>
  );
}
