import ngcData from "@/data/openngc.json";
import starData from "@/data/hyg-bright.json";
import objectsData from "@/data/objects.json";
import { normaliseQuery } from "./advancedSearch";
import { GERMAN_NGC_ALIASES } from "./germanCatalogAliases";
import { SOLAR_ALIASES, type SolarBody } from "./solarSystem";
import type { BafkObject } from "./bafk";
import type { AdvancedEntry, CatalogObject, NgcEntry, StarEntry } from "./catalogTypes";

export type CatalogTarget =
  | { kind: "advanced"; entry: AdvancedEntry }
  | { kind: "buddy"; object: CatalogObject }
  | { kind: "bafk"; object: BafkObject }
  | { kind: "solar"; object: SolarBody };

export interface SearchItem {
  key: string;
  title: string;
  subtitle: string;
  source: string;
  target: CatalogTarget;
  labels: string[];
  description?: string;
}

interface IndexedItem extends SearchItem {
  terms: string[];
  prose: string;
}

const ngcEntries: NgcEntry[] = (ngcData as Omit<NgcEntry, "source">[]).map(
  (e) => ({
    ...e, aliases: [...e.aliases, ...(GERMAN_NGC_ALIASES[e.id] ?? [])],
    source: "ngc" as const,
  }),
);
const starEntries: StarEntry[] = (starData as Omit<StarEntry, "source">[]).map(
  (e) => ({ ...e, source: "star" as const }),
);
export const recommendations = objectsData as CatalogObject[];

const GERMAN_TYPES: Record<string, string> = {
  G: "Galaxie", GPair: "Galaxienpaar", GTrpl: "Galaxiengruppe",
  GGroup: "Galaxiengruppe", OCl: "Offener Sternhaufen",
  GCl: "Kugelsternhaufen", "Cl+N": "Sternhaufen Nebel",
  PN: "Planetarischer Nebel", HII: "Emissionsnebel",
  EmN: "Emissionsnebel", RfN: "Reflexionsnebel",
  SNR: "Supernovaüberrest", Neb: "Nebel", "*Ass": "Sternassoziation",
};

// German names that are frequently used instead of catalog designations.
const MESSIER_NAMES: Record<string, string[]> = {
  m31: ["Andromedagalaxie", "Andromedanebel"],
  m33: ["Dreiecksgalaxie"],
  m42: ["Orionnebel"],
  m44: ["Krippe", "Bienenstockhaufen", "Praesepe"],
  m45: ["Plejaden", "Siebengestirn"],
  m51: ["Strudelgalaxie", "Whirlpoolgalaxie"],
  m57: ["Ringnebel"],
  m63: ["Sonnenblumengalaxie"],
  m64: ["Schwarzaugengalaxie"],
  m81: ["Bodes Galaxie"],
  m82: ["Zigarrengalaxie"],
  m97: ["Eulennebel"],
  m101: ["Feuerradgalaxie"],
  m104: ["Sombrerogalaxie"],
};

function designationNames(labels: string[]): string[] {
  const names: string[] = [];
  for (const label of labels) {
    names.push(...(MESSIER_NAMES[normaliseQuery(label)] ?? []));
  }
  return names;
}

function preferredName(entry: NgcEntry | StarEntry): string {
  const german = entry.source === "ngc" ? GERMAN_NGC_ALIASES[entry.id]?.[0] : null;
  return german ?? designationNames(entry.aliases)[0] ??
    entry.aliases.find((a) => /[a-z]{4}/i.test(a) && !/^\s*(NGC|IC|HIP|HD|HR|M)\s*\d/i.test(a))
    ?? entry.id;
}

function indexed(item: SearchItem): IndexedItem {
  return {
    ...item,
    terms: item.labels.map(normaliseQuery).filter(Boolean),
    prose: normaliseQuery(item.description ?? ""),
  };
}

/** One searchable index for imported BAfK, curated targets, OpenNGC, HYG and planets. */
export function buildCatalogIndex(
  bafk: BafkObject[], solar: SolarBody[],
): IndexedItem[] {
  const fixed = [...ngcEntries, ...starEntries];
  const byAlias = new Map<string, NgcEntry | StarEntry | null>();
  for (const entry of fixed) {
    for (const name of [entry.id, ...entry.aliases]) {
      const key = normaliseQuery(name);
      if (!key) continue;
      if (!byAlias.has(key)) byAlias.set(key, entry);
      else if (byAlias.get(key) !== entry) byAlias.set(key, null);
    }
  }

  const covered = new Set<string>();
  const results: IndexedItem[] = [];

  for (const object of bafk) {
    const matched = byAlias.get(normaliseQuery(object.name));
    const aliases = matched
      ? [matched.id, ...matched.aliases, ...designationNames(matched.aliases)]
      : [];
    if (matched) covered.add(matched.source + ":" + matched.id);
    results.push(indexed({
      key: "bafk:" + object.id, source: "BAfK", title: object.name,
      subtitle: object.constellation + " · " + object.type,
      labels: [object.name, ...aliases],
      description: object.description,
      target: { kind: "bafk", object },
    }));
  }

  for (const object of recommendations) {
    const labels = [object.name, object.designation];
    const matched = byAlias.get(normaliseQuery(object.designation));
    if (matched && covered.has(matched.source + ":" + matched.id)) continue;
    if (matched) covered.add(matched.source + ":" + matched.id);
    results.push(indexed({
      key: "buddy:" + object.id, source: "Empfehlung",
      title: object.name, subtitle: object.designation,
      labels: [
        ...labels, ...designationNames(labels),
        ...(matched ? [matched.id, ...matched.aliases] : []),
      ],
      description: object.description,
      target: { kind: "buddy", object },
    }));
  }

  for (const entry of fixed) {
    if (covered.has(entry.source + ":" + entry.id)) continue;
    const types = entry.source === "ngc"
      ? [GERMAN_TYPES[entry.type] ?? "", entry.type]
      : ["Stern", "Star"];
    results.push(indexed({
      key: entry.source + ":" + entry.id,
      source: entry.source === "ngc" ? "OpenNGC" : "HYG",
      title: preferredName(entry), subtitle: entry.id,
      labels: [entry.id, ...entry.aliases, ...designationNames(entry.aliases), ...types],
      target: { kind: "advanced", entry },
    }));
  }

  for (const body of solar) {
    results.push(indexed({
      key: "solar:" + body.id, source: "Sonnensystem",
      title: body.name,
      subtitle: body.id === "earth" ? "Standort, kein Himmelsziel"
        : body.id === "moon" ? "Mond" : "Planet",
      labels: [body.name, ...SOLAR_ALIASES[body.id], body.id,
        body.id === "moon" ? "Erdmond" : "Planet"],
      target: { kind: "solar", object: body },
    }));
  }
  return results;
}

function matchScore(query: string, item: IndexedItem): number {
  let score = 0;
  for (const term of item.terms) {
    if (term === query) return 100;
    if (term.startsWith(query)) score = Math.max(score, 60);
    else if (term.includes(query)) score = Math.max(score, 30);
  }
  return item.prose.includes(query) ? Math.max(score, 10) : score;
}

export function searchCatalog(query: string, entries: IndexedItem[]): SearchItem[] {
  const term = normaliseQuery(query);
  if (!term) return [];
  const scores = entries.map((item) => ({ item, score: matchScore(term, item) }))
    .filter(({ score }) => score > 0);
  const priority: Record<string, number> = {
    Sonnensystem: 4, BAfK: 3, Empfehlung: 2, OpenNGC: 1, HYG: 0,
  };
  scores.sort((a, b) =>
    b.score - a.score
    || priority[b.item.source] - priority[a.item.source]
    || a.item.title.localeCompare(b.item.title, "de")
  );
  return scores.slice(0, 200).map(({ item }) => item);
}
