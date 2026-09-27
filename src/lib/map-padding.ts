/** Space kept clear when fitting the map to a resort. Desktop detail lives in the left dock, so the right side stays a gutter. */
export function mapFitPadding(options: {
  narrow: boolean;
  /** Visible height of the mobile bottom sheet in px. */
  sheetPx: number | null;
  height: number;
}): { paddingTopLeft: [number, number]; paddingBottomRight: [number, number] } {
  const bottom =
    !options.narrow || options.sheetPx == null ? 28 : Math.min(Math.max(80, options.height - 96), options.sheetPx + 16);
  /** The list/resort dock sits outside the map canvas on desktop; only bottom sheet padding applies on mobile. */
  const left = 28;
  return { paddingTopLeft: [left, 72], paddingBottomRight: [28, bottom] };
}
