/** Space kept clear when fitting the map to a resort. Desktop detail lives in the left dock, so the right side stays a gutter. */
export function mapFitPadding(options: {
  narrow: boolean;
  sheet: string | null;
  height: number;
}): { paddingTopLeft: [number, number]; paddingBottomRight: [number, number] } {
  const bottom =
    !options.narrow || !options.sheet
      ? 28
      : options.sheet === "peek"
        ? 212
        : options.sheet === "full"
          ? Math.max(80, options.height - 96)
          : Math.round(options.height * 0.5);
  const left = options.narrow ? 28 : 420;
  return { paddingTopLeft: [left, 72], paddingBottomRight: [28, bottom] };
}
