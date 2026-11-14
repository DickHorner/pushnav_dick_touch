import { describe, expect, it } from "vitest";
import type { BafkObject } from "./bafk";
import { buildCatalogIndex, resolveCatalogTarget, searchCatalog } from "./unifiedCatalog";
import { SOLAR_BODIES } from "./solarSystem";

const bafk: BafkObject = {
  id: "p004-00", name: "M 31", constellation: "And",
  ra_deg: 10.684, dec_deg: 41.269, aperture: "FG",
  filter: "--", type: "Gx", page: 4,
  description: "Die große Andromedagalaxie ist deutlich sichtbar.",
  images: ["p004-00.jpg"],
};

describe("one shared sky search", () => {
  const index = buildCatalogIndex([bafk], SOLAR_BODIES);

  it("finds every planet in German, with Saturn before the Saturn Nebula", () => {
    for (const name of ["Merkur", "Venus", "Erde", "Mars", "Jupiter",
                        "Saturn", "Uranus", "Neptun", "Mond"]) {
      const match = searchCatalog(name, index)[0];
      expect(match.target.kind).toBe("solar");
      expect(match.title).toBe(name);
    }
    expect(searchCatalog("Saturn", index)[0].key).toBe("solar:saturn");
    expect(searchCatalog("Neptune", index)[0].key).toBe("solar:neptune");
  });

  it("finds common German names across source catalogs", () => {
    expect(searchCatalog("Siebengestirn", index)[0].title).toMatch(/Pleiades|Plejaden/i);
    expect(searchCatalog("Orionnebel", index).length).toBeGreaterThan(0);
    expect(searchCatalog("Wega", index)[0].source).toBe("HYG");
    expect(searchCatalog("Polarstern", index)[0].source).toBe("HYG");
    expect(searchCatalog("Kugelsternhaufen", index).length).toBeGreaterThan(0);
  });

  it("matches atlas descriptions and prefers a single source for M31", () => {
    const match = searchCatalog("Andromedagalaxie", index)[0];
    expect(match.target.kind).toBe("bafk");
    expect(searchCatalog("M 31", index).filter((r) =>
      r.key === "bafk:p004-00" || r.key === "ngc:NGC 224" ||
      r.source === "Empfehlung" && r.title === "Andromeda Galaxy",
    )).toHaveLength(1);
  });

  it("resolves observing lists against the same catalog including planets", () => {
    expect(resolveCatalogTarget("saturn", index)?.kind).toBe("solar");
    expect(resolveCatalogTarget("M31", index)?.kind).toBe("bafk");
    expect(resolveCatalogTarget("Unbekanntes Ziel", index)).toBeNull();
  });
});
