import { describe, expect, it } from "vitest";
import { searchBafk, type BafkObject } from "./bafk";

const entries: BafkObject[] = [
  {
    id: "p099-01", name: "M 27", constellation: "Vul",
    ra_deg: 299.9, dec_deg: 22.7, aperture: "FG",
    filter: "O", type: "PN", page: 99,
    description: "Der Hantelnebel ist ein planetarischer Nebel.",
    images: ["p099-00.jpg"],
  },
  {
    id: "p006-00", name: "NGC 7009", constellation: "Aqr",
    ra_deg: 316, dec_deg: -11, aperture: "FG",
    filter: "--", type: "PN", page: 6,
    description: "Der Saturnnebel ist visuell sichtbar.",
    images: [],
  },
];

describe("searchBafk", () => {
  it("finds catalog identifiers with or without spaces", () => {
    expect(searchBafk(entries, "M27")).toEqual([entries[0]]);
    expect(searchBafk(entries, "NGC 7009")).toEqual([entries[1]]);
  });

  it("finds German common names in observing text", () => {
    expect(searchBafk(entries, "Hantelnebel")).toEqual([entries[0]]);
    expect(searchBafk(entries, "Saturnnebel")).toEqual([entries[1]]);
  });

  it("transliterates umlauts and eszett while rejecting blank queries", () => {
    const localized = { ...entries[0], description: "Größerer Nebel" };
    expect(searchBafk([localized], "groesserer")).toEqual([localized]);
    expect(searchBafk(entries, "")).toEqual([]);
  });
});
