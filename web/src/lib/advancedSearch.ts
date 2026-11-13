import type { AdvancedEntry } from "./catalogTypes";

// Manual entries lack id/aliases/mag and are filtered out by scoreEntry, so
// the search return type narrows to the non-manual variants.
type SearchableEntry = Exclude<AdvancedEntry, { source: "manual" }>;

const RESULT_CAP = 200;

/** Lowercase + strip non-alphanumeric (so "M 31", "m31", "m-31" all collide). */
export function normaliseQuery(s: string): string {
  return s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9α-ω]/gi, "");
}

interface Scored {
  entry: SearchableEntry;
  score: number;
}

/**
 * Match `query` against the id + aliases of each entry, score, sort,
 * and return the top RESULT_CAP results.
 *
 * Scoring (descending):
 *   100  exact id or alias
 *    60  id or alias begins with the query
 *    30  id or alias contains the query
 *     0  no match (excluded)
 *
 * Tiebreaker:  brighter mag first (lower numeric mag), then alphabetical id.
 */
export function advancedSearch(
  query: string, entries: AdvancedEntry[],
): SearchableEntry[] {
  const q = normaliseQuery(query);
  if (!q) return [];
  const scored: Scored[] = [];
  for (const entry of entries) {
    if (entry.source === "manual") continue;
    const score = scoreEntry(q, entry);
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const am = a.entry.mag ?? Infinity;
    const bm = b.entry.mag ?? Infinity;
    if (am !== bm) return am - bm;
    return a.entry.id.localeCompare(b.entry.id);
  });
  return scored.slice(0, RESULT_CAP).map((s) => s.entry);
}

function scoreEntry(q: string, entry: AdvancedEntry): number {
  if (entry.source === "manual") return 0;        // manual entries are never search results
  let best = 0;
  const candidates = [entry.id, ...entry.aliases];
  for (const c of candidates) {
    const n = normaliseQuery(c);
    if (n === q) return 100;                       // can't beat exact match
    if (n.startsWith(q) && best < 60) best = 60;
    else if (n.includes(q) && best < 30) best = 30;
  }
  return best;
}
