import affiliates from "../../config/affiliates.json";

export type AffiliateCategory = "ski_rental" | "lodging" | "gear" | "travel";

export interface AffiliateLink {
  label: string;
  url: string;
  category: AffiliateCategory;
}

export type AffiliatesConfig = Partial<Record<AffiliateCategory, AffiliateLink[]>>;

const raw = affiliates as AffiliatesConfig;

export function getAffiliateLinks(): AffiliateLink[] {
  const out: AffiliateLink[] = [];
  for (const category of Object.keys(raw) as AffiliateCategory[]) {
    const list = raw[category];
    if (!list?.length) continue;
    for (const item of list) {
      if (item?.url && item.label) out.push({ ...item, category });
    }
  }
  return out;
}

export function hasAffiliateLinks(): boolean {
  return getAffiliateLinks().length > 0;
}
