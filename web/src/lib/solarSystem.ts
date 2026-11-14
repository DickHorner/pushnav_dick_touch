export interface SolarBody {
  id: string;
  name: string;
  ra_deg: number | null;
  dec_deg: number | null;
  topocentric: boolean;
}

// Names remain searchable even if the local ephemeris endpoint is temporarily unavailable.
export const SOLAR_BODIES: SolarBody[] = [
  { id: "mercury", name: "Merkur", ra_deg: null, dec_deg: null, topocentric: false },
  { id: "venus", name: "Venus", ra_deg: null, dec_deg: null, topocentric: false },
  { id: "earth", name: "Erde", ra_deg: null, dec_deg: null, topocentric: false },
  { id: "mars", name: "Mars", ra_deg: null, dec_deg: null, topocentric: false },
  { id: "jupiter", name: "Jupiter", ra_deg: null, dec_deg: null, topocentric: false },
  { id: "saturn", name: "Saturn", ra_deg: null, dec_deg: null, topocentric: false },
  { id: "uranus", name: "Uranus", ra_deg: null, dec_deg: null, topocentric: false },
  { id: "neptune", name: "Neptun", ra_deg: null, dec_deg: null, topocentric: false },
  { id: "moon", name: "Mond", ra_deg: null, dec_deg: null, topocentric: false },
];

export const SOLAR_ALIASES: Record<string, string[]> = {
  mercury: ["Mercury"],
  venus: [],
  earth: ["Earth"],
  mars: [],
  jupiter: [],
  saturn: [],
  uranus: [],
  neptune: ["Neptune"],
  moon: ["Moon", "Luna", "Erdmond"],
};

export async function fetchSolarBodies(at: Date): Promise<SolarBody[]> {
  const response = await fetch("/api/solar-system?at=" + encodeURIComponent(at.toISOString()));
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as SolarBody[];
}
