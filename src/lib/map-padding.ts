/**
 * Space kept clear when fitting the map. On desktop the side panel floats over the map's left edge;
 * the map's own padding holds it (see MapView), and fitBounds fits inside that.
 */
export function mapFitPadding(options: {
  narrow: boolean;
  /** Visible height of the mobile bottom sheet in px. */
  sheetPx: number | null;
  height: number;
}): { paddingTopLeft: [number, number]; paddingBottomRight: [number, number] } {
  const bottom =
    !options.narrow || options.sheetPx == null ? 28 : Math.min(Math.max(80, options.height - 96), options.sheetPx + 16);
  const left = 28;
  return { paddingTopLeft: [left, 72], paddingBottomRight: [28, bottom] };
}
