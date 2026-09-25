export interface Point {
  lat: number;
  lon: number;
}

export interface Cluster<T> {
  lat: number;
  lon: number;
  items: T[];
}

export function project(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const scale = 256 * 2 ** zoom;
  const x = ((lon + 180) / 360) * scale;
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

export function clusterPoints<T extends Point>(
  items: T[],
  zoom: number,
  options?: { cellPx?: number; unclusterZoom?: number },
): Cluster<T>[] {
  const cell = options?.cellPx ?? 56;
  const unclusterZoom = options?.unclusterZoom ?? 11;
  if (zoom >= unclusterZoom) {
    return items.map((item) => ({ lat: item.lat, lon: item.lon, items: [item] }));
  }
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const { x, y } = project(item.lat, item.lon, zoom);
    const key = `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }
  return [...buckets.values()].map((group) => ({
    lat: group.reduce((sum, item) => sum + item.lat, 0) / group.length,
    lon: group.reduce((sum, item) => sum + item.lon, 0) / group.length,
    items: group,
  }));
}
