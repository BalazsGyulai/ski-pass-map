import resortsFile from "../../../data/resorts.json";

export function officialWebsiteForResort(resortId: string): string | null {
  const row = resortsFile.resorts.find((r) => r.id === resortId);
  const url = row?.website?.value;
  return typeof url === "string" ? url : null;
}

export function resortNameForId(resortId: string): string {
  const row = resortsFile.resorts.find((r) => r.id === resortId);
  return row?.name ?? resortId;
}
