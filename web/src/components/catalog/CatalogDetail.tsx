import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { altAzFromRaDec, parseDec, parseRA, riseSetTransitUtc } from "@/lib/astronomy";
import { azimuthCompass } from "@/lib/catalogTypes";
import type { BafkObject } from "@/lib/bafk";
import type {
  CatalogObject, AdvancedEntry,
} from "@/lib/catalogTypes";
import { NGC_TYPE_LABELS } from "@/lib/catalogTypes";

type DetailInput =
  | { kind: "buddy";    object: CatalogObject }
  | { kind: "advanced"; entry:  AdvancedEntry }
  | { kind: "bafk"; object: BafkObject };

interface Props {
  input: DetailInput | null;
  location: { latitude: number; longitude: number } | null;
  evalAt: Date;
  onTargetSet?: () => void;
}

function formatTimeLocal(t: Date | null): string {
  if (!t) return "—";
  const hh = t.getHours().toString().padStart(2, "0");
  const mm = t.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function buddyUrl(id: string): string {
  return `https://stargazingbuddy.com/objects/${id}`;
}

export function CatalogDetail({
  input, location, evalAt, onTargetSet,
}: Props) {
  const [setting, setSetting] = useState(false);
  const [setOk, setSetOk] = useState<null | "ok" | "error">(null);

  if (!input) {
    return (
      <div className="text-sm text-muted-foreground">
        Select an object on the left to see details.
      </div>
    );
  }

  // Unified view of whatever was passed in.
  let raDeg: number | null = null;
  let decDeg: number | null = null;
  if (input.kind === "buddy") {
    const rh = parseRA(input.object.rightAscension);
    const dd = parseDec(input.object.declination);
    raDeg = rh !== null ? rh * 15 : null;
    decDeg = dd;
  } else if (input.kind === "bafk") {
    raDeg = input.object.ra_deg;
    decDeg = input.object.dec_deg;
  } else {
    raDeg = input.entry.ra_deg;
    decDeg = input.entry.dec_deg;
  }
  const raHours = raDeg !== null ? raDeg / 15 : null;

  let altDeg: number | null = null;
  let azDeg: number | null = null;
  let rise: Date | null = null;
  let set: Date | null = null;
  let transit: Date | null = null;

  if (raHours !== null && decDeg !== null && location) {
    const aa = altAzFromRaDec({
      raHours, decDeg,
      latDeg: location.latitude, lonDeg: location.longitude,
      date: evalAt,
    });
    altDeg = aa.altDeg;
    azDeg = aa.azDeg;
    const rst = riseSetTransitUtc({
      raHours, decDeg,
      latDeg: location.latitude, lonDeg: location.longitude,
      dateUtc: evalAt,
    });
    rise = rst.rise;
    set = rst.set;
    transit = rst.transit;
  }

  async function handleSetTarget() {
    if (raDeg === null || decDeg === null) return;
    setSetting(true); setSetOk(null);
    try {
      await api.setGoto(raDeg, decDeg);
      setSetOk("ok");
      onTargetSet?.();
    } catch {
      setSetOk("error");
    } finally {
      setSetting(false);
      setTimeout(() => setSetOk(null), 2500);
    }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      {/* Header */}
      {input.kind === "buddy" ? (
        <BuddyHeader object={input.object} />
      ) : input.kind === "bafk" ? (
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="text-base text-foreground">{input.object.name}</div>
            <div className="text-xs text-muted-foreground">
              {input.object.constellation} · BAfK, Seite {input.object.page - 3}
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{input.object.type}</span>
        </div>
      ) : (
        <AdvancedHeader entry={input.entry} />
      )}

      {/* Facts grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {input.kind === "buddy"
          ? <BuddyFacts object={input.object} altDeg={altDeg} azDeg={azDeg}
                        rise={rise} transit={transit} set={set} />
          : input.kind === "bafk"
            ? <>
                <AdvancedFacts entry={{ source: "manual", ra_deg: input.object.ra_deg, dec_deg: input.object.dec_deg }}
                               altDeg={altDeg} azDeg={azDeg} rise={rise} transit={transit} set={set} />
                <Fact label="Öffnung" value={input.object.aperture || "—"} />
                <Fact label="Filter" value={input.object.filter || "—"} />
              </>
            : <AdvancedFacts entry={input.entry} altDeg={altDeg} azDeg={azDeg}
                             rise={rise} transit={transit} set={set} />}
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSetTarget}
                disabled={setting || raDeg === null || decDeg === null
                          || (altDeg !== null && altDeg < 0)}>
          {setting ? "Setting…" : "Set as target"}
        </Button>
        {altDeg !== null && altDeg < 0 && (
          <span className="text-xs text-muted-foreground">Below horizon</span>
        )}
        {input.kind === "bafk" && (
          <a href={"/api/bafk/atlas#page=" + input.object.page} target="_blank"
             rel="noopener noreferrer"
             className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            BAfK-Seite öffnen <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {input.kind === "buddy" && (
          <a href={buddyUrl(input.object.id)} target="_blank"
             rel="noopener noreferrer"
             className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            Full description <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {setOk === "ok"    && <span className="text-xs text-primary     ml-auto">Target set</span>}
        {setOk === "error" && <span className="text-xs text-destructive ml-auto">Failed</span>}
      </div>

      {/* Description (Buddy only) */}
      {input.kind === "buddy" && <BuddyDescription object={input.object} />}
      {input.kind === "bafk" && (
        <div className="flex flex-col gap-2">
          {input.object.images.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                {input.object.images.map((image) => (
                  <a key={image} href={"/api/bafk/images/" + image}
                     target="_blank" rel="noopener noreferrer"
                     title="Abbildung vergrößern">
                    <img src={"/api/bafk/images/" + image} alt={"BAfK-Abbildung zu " + input.object.name}
                         loading="lazy" className="max-h-48 rounded border border-border" />
                  </a>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Abbildung aus dem BAfK. Bildurheber und Bildart bitte im Originalatlas prüfen;
                Astrofotografien entsprechen nicht zwingend dem visuellen Okularanblick.
              </p>
            </>
          )}
          {input.object.description.split("").map((paragraph, index) => (
            <p key={index} className="text-xs text-muted-foreground leading-relaxed">
              {index > 0 && <strong className="text-foreground">Beobachtung: </strong>}
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ----- sub-components -------------------------------------------------------

function BuddyHeader({ object }: { object: CatalogObject }) {
  return (
    <div className="flex items-baseline justify-between gap-2 leading-tight">
      <div className="min-w-0">
        <div className="text-base text-foreground truncate">{object.name}</div>
        <div className="text-xs text-muted-foreground font-mono">{object.designation}</div>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        {object.subtype ?? object.type}
      </span>
    </div>
  );
}

function AdvancedHeader({ entry }: { entry: AdvancedEntry }) {
  if (entry.source === "manual") {
    return <div className="text-base text-foreground">Manual coordinates</div>;
  }
  const typeLabel =
    entry.source === "ngc"
      ? (NGC_TYPE_LABELS[entry.type] ?? entry.type)
      : (entry.spectral ?? "Star");
  return (
    <div className="flex items-baseline justify-between gap-2 leading-tight">
      <div className="min-w-0">
        <div className="text-base text-foreground truncate">{entry.id}</div>
        <div className="text-xs text-muted-foreground font-mono truncate">
          {entry.aliases.slice(0, 4).join(" · ")}
        </div>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{typeLabel}</span>
    </div>
  );
}

function BuddyFacts({
  object, altDeg, azDeg, rise, transit, set,
}: {
  object: CatalogObject; altDeg: number | null; azDeg: number | null;
  rise: Date | null; transit: Date | null; set: Date | null;
}) {
  return (
    <>
      <Fact label="RA" value={object.rightAscension} mono />
      <Fact label="Dec" value={object.declination} mono />
      <Fact label="Mag" value={typeof object.magnitude === "number" ? object.magnitude.toFixed(1) : "—"} />
      <Fact label="Constellation" value={object.constellation} />
      <Fact label="Alt" value={altDeg !== null ? `${Math.round(altDeg)}°` : "—"} />
      <Fact label="Az"  value={azDeg !== null ? azimuthCompass(azDeg) : "—"} />
      <Fact label="Rises"   value={formatTimeLocal(rise)} />
      <Fact label="Transit" value={formatTimeLocal(transit)} />
      <Fact label="Sets"    value={formatTimeLocal(set)} />
      <Fact label="Equipment" value={equipmentLabel(object.minEquipment)} />
      <Fact label="LP" value={object.lpTolerance} />
      <Fact label="Reward" value={object.visualReward} />
    </>
  );
}

function AdvancedFacts({
  entry, altDeg, azDeg, rise, transit, set,
}: {
  entry: AdvancedEntry; altDeg: number | null; azDeg: number | null;
  rise: Date | null; transit: Date | null; set: Date | null;
}) {
  const raStr = formatRaDeg(entry.ra_deg);
  const decStr = formatDecDeg(entry.dec_deg);
  const mag = entry.source === "manual" ? null : entry.mag;
  const con = entry.source === "manual" ? null : entry.constellation;
  return (
    <>
      <Fact label="RA"  value={raStr} mono />
      <Fact label="Dec" value={decStr} mono />
      {mag !== null && <Fact label="Mag" value={mag.toFixed(2)} />}
      {con && <Fact label="Constellation" value={con} />}
      <Fact label="Alt" value={altDeg !== null ? `${Math.round(altDeg)}°` : "—"} />
      <Fact label="Az"  value={azDeg !== null ? azimuthCompass(azDeg) : "—"} />
      <Fact label="Rises"   value={formatTimeLocal(rise)} />
      <Fact label="Transit" value={formatTimeLocal(transit)} />
      <Fact label="Sets"    value={formatTimeLocal(set)} />
    </>
  );
}

function BuddyDescription({ object }: { object: CatalogObject }) {
  const paragraphs = object.description
    ? object.description.split(/\n\n+/).filter((p) => p.trim().length > 0)
    : [];
  if (paragraphs.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {paragraphs.map((para, i) => (
        <p key={i} className="text-xs text-muted-foreground leading-relaxed">{para}</p>
      ))}
    </div>
  );
}

function formatRaDeg(deg: number): string {
  const h = deg / 15;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = ((h - hh - mm / 60) * 3600).toFixed(1);
  return `${hh}h ${mm.toString().padStart(2, "0")}m ${ss}s`;
}

function formatDecDeg(deg: number): string {
  const sign = deg < 0 ? "-" : "+";
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = ((abs - d - m / 60) * 3600).toFixed(0);
  return `${sign}${d}° ${m.toString().padStart(2, "0")}' ${s}"`;
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground self-center">
        {label}
      </span>
      <span className={cn("text-foreground", mono && "font-mono tabular-nums")}>
        {value}
      </span>
    </>
  );
}

function equipmentLabel(eq: string): string {
  return ({
    "naked-eye":         "Naked eye",
    "binoculars":        "Binoculars",
    "small-telescope":   "Small scope",
    "medium-telescope":  "Medium scope",
    "large-telescope":   "Large scope",
  } as Record<string, string>)[eq] ?? eq;
}
