import { describe, expect, it } from "vitest";
import { parseObservationLists, readObservationState, OBSERVATION_LISTS_KEY } from "./observationLists";

describe("parseObservationLists", () => {
  it("parses AstroHopper-style named groups and notes", () => {
    expect(parseObservationLists("Clusters: M3 M13 M92\nGalaxies: M31 (Andromeda), M51, NGC 224")).toEqual([
      {
        name: "Clusters", selectedIndex: 0,
        targets: ["M3", "M13", "M92"].map((name) => ({ name, note: "", done: false })),
      },
      {
        name: "Galaxies", selectedIndex: 0,
        targets: [
          { name: "M31", note: "Andromeda", done: false },
          { name: "M51", note: "", done: false },
          { name: "NGC 224", note: "", done: false },
        ],
      },
    ]);
  });

  it("supports one object per line, multiword names, comments and CRLF", () => {
    expect(parseObservationLists("# Tonight\r\n- Andromeda Galaxy\r\nM 42\r\nAlbireo # double star")).toEqual([
      {
        name: "Observing list", selectedIndex: 0,
        targets: ["Andromeda Galaxy", "M 42", "Albireo"]
          .map((name) => ({ name, note: "", done: false })),
      },
    ]);
  });

  it("ignores empty groups and blank input", () => {
    expect(parseObservationLists("Empty:\nGalaxies: M31\n# comment")).toHaveLength(1);
    expect(parseObservationLists("\n # comment\n")).toEqual([]);
  });
});

describe("readObservationState", () => {
  it("ignores malformed saved data", () => {
    localStorage.setItem(OBSERVATION_LISTS_KEY, '{bad json');
    expect(readObservationState()).toEqual({ lists: [], activeListIndex: 0 });
    localStorage.setItem(OBSERVATION_LISTS_KEY, JSON.stringify({ lists: [{ name: "Bad", targets: [], selectedIndex: 0 }], activeListIndex: 0 }));
    expect(readObservationState()).toEqual({ lists: [], activeListIndex: 0 });
    localStorage.removeItem(OBSERVATION_LISTS_KEY);
  });
});
