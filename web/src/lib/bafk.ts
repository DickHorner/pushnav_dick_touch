export interface BafkObject {
  id: string;
  name: string;
  constellation: string;
  ra_deg: number;
  dec_deg: number;
  aperture: string;
  filter: string;
  type: string;
  page: number;
  description: string;
  images: string[];
}

export async function fetchBafk(): Promise<BafkObject[]> {
  const response = await fetch("/api/bafk");
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as BafkObject[];
}

export async function uploadBafk(file: File): Promise<void> {
  const response = await fetch("/api/bafk/import", {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: file,
  });
  if (!response.ok) throw new Error(await response.text());
}

// Search German common names in the atlas prose as well as catalog IDs.
function searchKey(text: string): string {
  return text.toLocaleLowerCase("de")
    .replace(/ä/g, "ae").replace(/ö/g, "oe")
    .replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9α-ω]/g, "");
}

export function searchBafk(objects: BafkObject[], query: string): BafkObject[] {
  const key = searchKey(query);
  if (!key) return [];
  return objects.filter((entry) =>
    searchKey(entry.name).includes(key)
    || searchKey(entry.description).includes(key)
    || searchKey(entry.constellation).includes(key),
  ).slice(0, 200);
}
