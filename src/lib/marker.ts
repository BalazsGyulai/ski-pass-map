import { escapeHtml } from "./html";

function cssColor(value: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : "#8b938e";
}

export interface PillOptions {
  /** Short pass name, or a dash when the resort has no pass. Full names stay in the marker title. */
  label: string;
  /** Resort, official pass names, and day-ticket price for the marker title and aria-label. */
  accessibleName?: string;
  colors: string[];
  selected: boolean;
  name: string;
  plannedDays: number;
  closed: boolean;
  noPass: boolean;
}

/** Leaflet HTML for a price pill. Text is escaped. Colour is paired with the price and the marker title. */
export function pricePillHtml(options: PillOptions): string {
  const colors = options.colors.slice(0, 3).map(cssColor);
  const extra = options.colors.length - colors.length;
  const dots = colors
    .map((color, index) => `<span class="pill-dot" style="background:${color};z-index:${3 - index}"></span>`)
    .join("");
  const more = extra > 0 ? `<span class="pill-more">+${extra}</span>` : "";
  const hollow = options.noPass ? `<span class="pill-dot is-hollow"></span>` : "";
  const days = options.plannedDays > 0 ? `<span class="pill-days">${options.plannedDays}</span>` : "";
  const name = options.selected ? `<span class="pill-name">${escapeHtml(options.name)}</span>` : "";
  const visible = options.selected ? "" : `<span class="pill-price">${escapeHtml(options.label)}</span>`;
  const classes = [
    "price-pill",
    options.selected ? "is-selected" : "",
    options.closed ? "is-closed" : "",
    options.noPass ? "is-empty" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const accessible = escapeHtml(options.accessibleName ?? (options.selected ? options.name : options.label));
  return `<span class="${classes}" aria-label="${accessible}">${hollow}${dots}${more}${visible}${name}${days}${options.selected ? `<span class="pill-tail"></span>` : ""}</span>`;
}

export interface SharePart {
  color: string;
  weight: number;
}

/** White count disc with a 3px ring split by pass share. Grey stands for resorts with no pass. */
export function clusterRingHtml(count: number, parts: SharePart[]): string {
  const radius = 16.5;
  const circumference = 2 * Math.PI * radius;
  const total = parts.reduce((sum, part) => sum + part.weight, 0) || 1;
  let offset = 0;
  const arcs = parts
    .filter((part) => part.weight > 0)
    .map((part) => {
      const length = (part.weight / total) * circumference;
      const dash = `${length.toFixed(2)} ${(circumference - length).toFixed(2)}`;
      const arc = `<circle cx="20" cy="20" r="${radius}" fill="none" stroke="${cssColor(part.color)}" stroke-width="3" stroke-dasharray="${dash}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 20 20)" />`;
      offset += length;
      return arc;
    })
    .join("");
  const label = Number.isFinite(count) ? String(Math.round(count)) : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">${arcs}<circle cx="20" cy="20" r="13.5" fill="#ffffff"/><text x="20" y="21" text-anchor="middle" dominant-baseline="middle" fill="#0F1B2D" font-size="13" font-weight="700" font-family="Inter, system-ui, sans-serif">${escapeHtml(label)}</text></svg>`;
}

/** Each resort weighs 1. Multi-pass resorts split that weight across their passes. */
export function passShares(items: { passes: string[] }[], colorOf: (id: string) => string): SharePart[] {
  const weights = new Map<string, number>();
  let empty = 0;
  for (const item of items) {
    if (item.passes.length === 0) {
      empty += 1;
      continue;
    }
    const share = 1 / item.passes.length;
    for (const id of item.passes) weights.set(id, (weights.get(id) ?? 0) + share);
  }
  const parts = [...weights.entries()].map(([id, weight]) => ({ color: colorOf(id), weight }));
  if (empty > 0) parts.push({ color: "#94A3B8", weight: empty });
  return parts;
}

export function pieSvg(colors: string[], options: { selected: boolean; closed: boolean }): string {
  const cx = 14;
  const cy = 14;
  const radius = 10;
  const ring = options.selected ? "#ffbf47" : "#14211c";
  const ringWidth = options.selected ? 2.5 : 1.25;
  const dash = options.closed ? ` stroke-dasharray="3 2"` : "";
  let body = "";
  if (colors.length === 0) {
    body = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="#8b938e" />`;
  } else if (colors.length === 1) {
    body = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${cssColor(colors[0])}" />`;
  } else {
    body = colors
      .map((color, index) => {
        const start = (index / colors.length) * Math.PI * 2 - Math.PI / 2;
        const end = ((index + 1) / colors.length) * Math.PI * 2 - Math.PI / 2;
        const x0 = cx + radius * Math.cos(start);
        const y0 = cy + radius * Math.sin(start);
        const x1 = cx + radius * Math.cos(end);
        const y1 = cy + radius * Math.sin(end);
        const large = end - start > Math.PI ? 1 : 0;
        return `<path d="M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="${cssColor(color)}" />`;
      })
      .join("");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="32" viewBox="0 0 28 32" aria-hidden="true">${body}<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${ring}" stroke-width="${ringWidth}"${dash} /></svg>`;
}
