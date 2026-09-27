export type ListingMode = "full" | "link_only" | "unlisted";

export const LISTING_MODES: ListingMode[] = ["full", "link_only", "unlisted"];

export function normalizeListingMode(value: unknown): ListingMode {
  if (value === "link_only" || value === "unlisted") return value;
  return "full";
}

export function applyListingToMapVisibility(
  resortId: string,
  mode: ListingMode,
  listingOverrides: ReadonlyMap<string, ListingMode>,
): boolean {
  const effective = listingOverrides.get(resortId) ?? mode;
  return effective !== "unlisted";
}

export function isLinkOnlyListing(mode: ListingMode): boolean {
  return mode === "link_only";
}
