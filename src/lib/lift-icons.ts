/**
 * Lift pictograms, drawn the way piste maps and valley-station signs show them: a cabin, a chair or
 * a drag hanger under the cable. The same path data draws the map signs (rasterised for the map
 * library), the moving cars, and the legends in the app.
 */

export type LiftKind = "cable_car" | "gondola" | "mixed" | "chair" | "drag" | "platter" | "rope_tow" | "carpet" | "other";

/** Legend order: big aerial lifts first, then surface lifts. */
export const LIFT_KINDS: readonly LiftKind[] = ["cable_car", "gondola", "mixed", "chair", "drag", "platter", "rope_tow", "carpet", "other"];

/** OSM aerialway values in the data. Zip lines and untyped lifts are "other". */
const KIND_OF_AERIALWAY: Record<string, LiftKind> = {
  cable_car: "cable_car",
  gondola: "gondola",
  mixed_lift: "mixed",
  chair_lift: "chair",
  "t-bar": "drag",
  "j-bar": "drag",
  drag_lift: "drag",
  platter: "platter",
  rope_tow: "rope_tow",
  magic_carpet: "carpet",
};

export function liftKind(aerialway: string | null | undefined): LiftKind {
  return (aerialway && KIND_OF_AERIALWAY[aerialway]) || "other";
}

/** The same choice as a style expression, for layers that read the aerialway property. */
export function liftKindExpression(): unknown[] {
  return ["match", ["coalesce", ["get", "aerialway"], ""], ...Object.entries(KIND_OF_AERIALWAY).flat(), "other"];
}

export const LIFT_KIND_LABEL = {
  cable_car: "liftCableCar",
  gondola: "liftGondola",
  mixed: "liftMixed",
  chair: "liftChair",
  drag: "liftDrag",
  platter: "liftPlatter",
  rope_tow: "liftRopeTow",
  carpet: "liftCarpet",
  other: "liftOther",
} as const satisfies Record<LiftKind, string>;

/** A glyph part. Knockouts are cut back to the background, like a cabin window. */
export interface GlyphShape {
  d: string;
  mode: "stroke" | "fill" | "knockout";
  width?: number;
}

function box(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

function disc(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
}

const stroke = (d: string, width = 1.6): GlyphShape => ({ d, mode: "stroke", width });
const fill = (d: string): GlyphShape => ({ d, mode: "fill" });
const knockout = (d: string): GlyphShape => ({ d, mode: "knockout" });

/** The cable climbs to the right, as lifts climb from the valley station. */
const CABLE = stroke("M2.5 8L21.5 3.5");

/** Sign pictograms on a 24 px grid. */
export const LIFT_GLYPHS: Record<LiftKind, GlyphShape[]> = {
  cable_car: [
    CABLE,
    stroke("M12 5.8V8.5M8 8.5H16"),
    fill(box(4.5, 8.5, 15, 12, 2)),
    knockout(box(6.3, 10.3, 5, 4.4, 0.8)),
    knockout(box(12.7, 10.3, 5, 4.4, 0.8)),
  ],
  gondola: [CABLE, stroke("M12 5.8V9.5"), fill(box(6.5, 9.5, 11, 11, 3.2)), knockout(box(8.3, 11.4, 7.4, 4.2, 1))],
  mixed: [
    CABLE,
    stroke("M7.5 6.9V10"),
    fill(box(3.5, 10, 8, 9, 2.4)),
    knockout(box(4.9, 11.5, 5.2, 3.1, 0.7)),
    stroke("M16.5 4.8V10.2H14.4"),
    fill(box(13.2, 9.6, 2.2, 7.4, 0.9)),
    fill(box(13.2, 15, 7.4, 2.2, 0.9)),
  ],
  chair: [CABLE, stroke("M12 5.8V10H8.2"), fill(box(6.6, 9.4, 2.6, 9.2, 1.1)), fill(box(6.6, 16.2, 10.4, 2.6, 1.1))],
  drag: [CABLE, stroke("M12 5.8V17", 1.7), stroke("M6.8 17.6H17.2", 2.6)],
  platter: [CABLE, stroke("M12 5.8V14.5", 1.7), fill(disc(12, 17.3, 3.3))],
  rope_tow: [stroke("M3 17.5L21 12"), fill(disc(3.6, 17.3, 1.9)), fill(disc(20.4, 12.2, 1.9)), stroke("M9.5 15.5V18.2M14.5 14V16.7", 1.8)],
  carpet: [
    stroke(box(3, 12.5, 18, 6.5, 3.25)),
    fill(disc(6.3, 15.75, 1.3)),
    fill(disc(17.7, 15.75, 1.3)),
    stroke("M7.5 8H16M13.2 5.3L16 8L13.2 10.7", 1.7),
  ],
  other: [CABLE, fill(box(9.8, 4.1, 4.4, 3.4, 1.2)), stroke("M12 7.5V13.5"), stroke("M12 13.5A2.3 2.3 0 1 0 14.3 15.8")],
};

/** What runs along each kind of lift. Cable cars shuttle two cabins; mixed lifts alternate cabins and chairs. */
export type CarKind = "cabin" | "chair" | "tbar" | "platter" | "grip" | "chevron";

export const CAR_KINDS: readonly CarKind[] = ["cabin", "chair", "tbar", "platter", "grip", "chevron"];

/** Moving car glyphs on a 16 px grid, hung from the top centre. */
export const CAR_GLYPHS: Record<CarKind, GlyphShape[]> = {
  cabin: [stroke("M8 0.8V4", 1.4), fill(box(3, 4, 10, 10, 2.8)), knockout(box(4.7, 5.8, 6.6, 3.6, 0.8))],
  chair: [stroke("M8 0.8V5.2H5", 1.4), fill(box(3.8, 4.6, 2.2, 8, 0.9)), fill(box(3.8, 10.6, 8.6, 2.2, 0.9))],
  tbar: [stroke("M8 0.8V10.5", 1.4), stroke("M4 11H12", 2.2)],
  platter: [stroke("M8 0.8V9", 1.4), fill(disc(8, 11.5, 2.6))],
  grip: [fill(disc(8, 8, 2.2))],
  chevron: [stroke("M5.5 4L9.5 8L5.5 12", 2)],
};

export const liftSignImageId = (kind: LiftKind) => `lift-sign-${kind}`;
export const liftCarImageId = (car: CarKind) => `lift-car-${car}`;

export const SIGN_FILL = "#1f2937";
const PIXEL_RATIO = 2;
/** CSS pixels of the sign image: a 24 px badge with room for its white edge and shadow. */
const SIGN_CSS = 30;
/** CSS pixels of a car image: the 16 px glyph with room for its halo. */
const CAR_CSS = 20;

export interface RasterIcon {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function paintGlyph(ctx: CanvasRenderingContext2D, shapes: GlyphShape[], ink: string, cut: string, halo?: { color: string; width: number }): void {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (halo) {
    ctx.strokeStyle = halo.color;
    ctx.fillStyle = halo.color;
    for (const shape of shapes) {
      const path = new Path2D(shape.d);
      ctx.lineWidth = (shape.mode === "stroke" ? (shape.width ?? 1.6) : 0) + halo.width * 2;
      ctx.stroke(path);
      if (shape.mode !== "stroke") ctx.fill(path);
    }
  }
  for (const shape of shapes) {
    const path = new Path2D(shape.d);
    if (shape.mode === "stroke") {
      ctx.strokeStyle = ink;
      ctx.lineWidth = shape.width ?? 1.6;
      ctx.stroke(path);
    } else {
      ctx.fillStyle = shape.mode === "knockout" ? cut : ink;
      ctx.fill(path);
    }
  }
}

function raster(css: number, draw: (ctx: CanvasRenderingContext2D) => void): RasterIcon | null {
  const canvas = document.createElement("canvas");
  canvas.width = css * PIXEL_RATIO;
  canvas.height = css * PIXEL_RATIO;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO);
  draw(ctx);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: image.width, height: image.height, data: image.data };
}

/** The sign: a dark badge with a white edge, so it stands off the lift line it sits on. */
export function drawLiftSign(kind: LiftKind): RasterIcon | null {
  return raster(SIGN_CSS, (ctx) => {
    const badge = new Path2D(box(3, 3, 24, 24, 6.5));
    ctx.save();
    ctx.shadowColor = "rgba(13, 19, 33, 0.35)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = SIGN_FILL;
    ctx.fill(badge);
    ctx.restore();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke(badge);
    ctx.translate(6, 6);
    ctx.scale(0.75, 0.75);
    paintGlyph(ctx, LIFT_GLYPHS[kind], "#ffffff", SIGN_FILL);
  });
}

/** A moving car, with a halo so it reads over rock, forest and snow. */
export function drawLiftCar(car: CarKind, dark: boolean): RasterIcon | null {
  const ink = dark ? "#f3f4f6" : SIGN_FILL;
  const halo = dark ? "#0b1220" : "#ffffff";
  return raster(CAR_CSS, (ctx) => {
    ctx.translate(2, 2);
    paintGlyph(ctx, CAR_GLYPHS[car], ink, halo, { color: halo, width: 1.1 });
  });
}

export const LIFT_ICON_PIXEL_RATIO = PIXEL_RATIO;
