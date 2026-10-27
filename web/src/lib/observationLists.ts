import ngcData from "@/data/openngc.json";
import starData from "@/data/hyg-bright.json";
import { normaliseQuery } from "./advancedSearch";
import type { NgcEntry, StarEntry } from "./catalogTypes";

export interface ObservationTarget {
  name: string;
  note: string;
  done: boolean;
}

export interface ObservationList {
  name: string;
  targets: ObservationTarget[];
  selectedIndex: number;
}

export interface ObservationState {
  lists: ObservationList[];
  activeListIndex: number;
}

export const OBSERVATION_LISTS_KEY = "pushnav.catalog.observation-lists";

const DESIGNATION = /((?:NGC|IC|HIP|HD|HR|M)\s*\d+[A-Za-z]?)(?:\s*\(([^)]*)\))?/gi;
const DESIGNATION_SEQUENCE = /^(?:(?:NGC|IC|HIP|HD|HR|M)\s*\d+[A-Za-z]?(?:\s*\([^)]*\))?\s*)+$/i;

function parseTargets(line: string): ObservationTarget[] {
  return line.split(/[,;]/).flatMap((part) => {
    const text = part.trim();
    if (!text) return [];
    if (DESIGNATION_SEQUENCE.test(text)) {
      return [...text.matchAll(DESIGNATION)].map((match) => ({
        name: match[1].trim(), note: (match[2] ?? "").trim(), done: false,
      }));
    }
    const noted = text.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    return [{
      name: (noted?.[1] ?? text).replace(/^"|"$/g, "").trim(),
      note: (noted?.[2] ?? "").trim(), done: false,
    }];
  }).filter((target) => target.name.length > 0);
}

export function parseObservationLists(text: string): ObservationList[] {
  const lists: ObservationList[] = [];
  let current: ObservationList | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0].trim().replace(/^[-*]\s+/, "");
    if (!line) continue;
    const header = line.match(/^([^:,()]+?):\s*(.*)$/);
    if (header) {
      current = { name: header[1].trim(), targets: [], selectedIndex: 0 };
      lists.push(current);
    }
    const targets = parseTargets(header ? header[2] : line);
    if (targets.length === 0) continue;
    if (!current) {
      current = { name: "Observing list", targets: [], selectedIndex: 0 };
      lists.push(current);
    }
    current.targets.push(...targets);
  }
  return lists.filter((list) => list.targets.length > 0);
}

function isObservationList(value: unknown): value is ObservationList {
  if (!value || typeof value !== "object") return false;
  if (!("name" in value) || typeof value.name !== "string"
      || !("targets" in value) || !Array.isArray(value.targets)
      || !("selectedIndex" in value) || typeof value.selectedIndex !== "number") return false;
  return value.targets.length > 0 && value.targets.length <= 200
    && Number.isInteger(value.selectedIndex)
    && value.selectedIndex >= 0 && value.selectedIndex < value.targets.length
    && value.targets.every((target: unknown) =>
      target !== null && typeof target === "object"
      && "name" in target && typeof target.name === "string"
      && "note" in target && typeof target.note === "string"
      && "done" in target && typeof target.done === "boolean");
}

export function readObservationState(): ObservationState {
  const empty: ObservationState = { lists: [], activeListIndex: 0 };
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(OBSERVATION_LISTS_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object" || !("lists" in parsed)
        || !Array.isArray(parsed.lists)) return empty;
    const lists = parsed.lists.slice(0, 30).filter(isObservationList);
    const index = "activeListIndex" in parsed ? parsed.activeListIndex : 0;
    return {
      lists,
      activeListIndex: typeof index === "number" && Number.isInteger(index)
        && index >= 0 && index < lists.length ? index : 0,
    };
  } catch {
    return empty;
  }
}

type CatalogEntry = NgcEntry | StarEntry;
const ngcEntries: CatalogEntry[] = (ngcData as Omit<NgcEntry, "source">[])
  .map((entry) => ({ ...entry, source: "ngc" as const }));
const starEntries: CatalogEntry[] = (starData as Omit<StarEntry, "source">[])
  .map((entry) => ({ ...entry, source: "star" as const }));
const byName = new Map<string, CatalogEntry | null>();
for (const entry of [...ngcEntries, ...starEntries]) {
  for (const label of [entry.id, ...entry.aliases]) {
    const key = normaliseQuery(label);
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, entry);
    else if (byName.get(key) !== entry) byName.set(key, null);
  }
}

export function resolveObservationTarget(name: string): CatalogEntry | null {
  return byName.get(normaliseQuery(name)) ?? null;
}
