export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function inBounds(point: { lat: number; lon: number }, bounds: MapBounds): boolean {
  return point.lat >= bounds.south && point.lat <= bounds.north && point.lon >= bounds.west && point.lon <= bounds.east;
}

/** True when the map has moved enough that the list should offer "Search this area". */
export function boundsMoved(current: MapBounds, next: MapBounds): boolean {
  const latSpan = Math.max(0.02, Math.abs(current.north - current.south));
  const lonSpan = Math.max(0.02, Math.abs(current.east - current.west));
  return (
    Math.abs(current.south - next.south) > latSpan * 0.12 ||
    Math.abs(current.north - next.north) > latSpan * 0.12 ||
    Math.abs(current.west - next.west) > lonSpan * 0.12 ||
    Math.abs(current.east - next.east) > lonSpan * 0.12
  );
}
