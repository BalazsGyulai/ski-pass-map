/** Where the open language list sits, in viewport pixels. */
export type MenuPlace = {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

type Anchor = { top: number; right: number; bottom: number; width: number };
type Frame = { width: number; height: number; limitBottom: number };

const GAP = 6;
const MARGIN = 8;
const MIN_WIDTH = 176;
const MAX_HEIGHT = 420;
/** Prefer opening downward until the room below gets tight. */
const PREFER_DOWN = 160;

/** Right-align the list to the trigger, and flip it upward when the space below is tight. */
export function placeLanguageMenu(trigger: Anchor, frame: Frame): MenuPlace {
  const width = Math.min(Math.max(MIN_WIDTH, trigger.width), Math.max(0, frame.width - MARGIN * 2));
  const left = Math.max(MARGIN, Math.min(trigger.right - width, frame.width - width - MARGIN));
  const spaceBelow = frame.limitBottom - trigger.bottom - GAP - MARGIN;
  const spaceAbove = trigger.top - GAP - MARGIN;
  const openUp = spaceBelow < PREFER_DOWN && spaceAbove > spaceBelow;
  if (openUp) {
    return {
      left,
      width,
      maxHeight: Math.max(0, Math.min(MAX_HEIGHT, spaceAbove)),
      bottom: frame.height - trigger.top + GAP,
    };
  }
  return {
    left,
    width,
    maxHeight: Math.max(0, Math.min(MAX_HEIGHT, spaceBelow)),
    top: trigger.bottom + GAP,
  };
}
