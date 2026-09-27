import type { VectorMap } from "./vector-map";

declare global {
  interface Window {
    __skiMapProbe?: VectorMap;
    __skiMapCanvasVariance?: () => number;
  }
}

const SAMPLE_POINTS: Array<[number, number]> = [
  [0.22, 0.28],
  [0.48, 0.34],
  [0.72, 0.26],
  [0.38, 0.52],
  [0.61, 0.58],
  [0.29, 0.72],
];

function colorVariance(samples: number[]): number {
  if (samples.length < 3) return 0;
  const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
  return samples.reduce((sum, v) => sum + (v - mean) ** 2, 0) / samples.length;
}

function uniqueColorsFrom2d(canvas: HTMLCanvasElement): number {
  const w = canvas.width;
  const h = canvas.height;
  if (w < 8 || h < 8) return 0;
  const scratch = document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  const ctx = scratch.getContext("2d");
  if (!ctx) return 0;
  ctx.drawImage(canvas, 0, 0, w, h);
  const step = Math.max(4, Math.floor(Math.min(w, h) / 72));
  const colors = new Set<string>();
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      colors.add(`${d[0]},${d[1]},${d[2]}`);
    }
  }
  return colors.size;
}

function sampleFrom2d(canvas: HTMLCanvasElement): number {
  const unique = uniqueColorsFrom2d(canvas);
  if (unique <= 1) return 0;
  const w = canvas.width;
  const h = canvas.height;
  const scratch = document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  const ctx = scratch.getContext("2d");
  if (!ctx) return unique;
  ctx.drawImage(canvas, 0, 0, w, h);
  const rgba: number[] = [];
  for (const [px, py] of SAMPLE_POINTS) {
    const x = Math.min(w - 1, Math.max(0, Math.floor(w * px)));
    const y = Math.min(h - 1, Math.max(0, Math.floor(h * py)));
    const d = ctx.getImageData(x, y, 1, 1).data;
    rgba.push(d[0], d[1], d[2]);
  }
  const variance = colorVariance(rgba);
  return Math.max(variance, unique);
}

function sampleFromGl(canvas: HTMLCanvasElement): number {
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!gl) return 0;
  const w = canvas.width;
  const h = canvas.height;
  const buf = new Uint8Array(4);
  const rgba: number[] = [];
  for (const [px, py] of SAMPLE_POINTS) {
    const x = Math.min(w - 1, Math.max(0, Math.floor(w * px)));
    const y = Math.min(h - 1, Math.max(0, Math.floor(h * py)));
    gl.readPixels(x, h - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    rgba.push(buf[0], buf[1], buf[2]);
  }
  return colorVariance(rgba);
}

/** Sample canvas variance for e2e (requires preserveDrawingBuffer). */
export function canvasColorVariance(map: VectorMap): number {
  const canvas = map.getCanvas();
  const from2d = sampleFrom2d(canvas);
  if (from2d > 0) return from2d;
  return sampleFromGl(canvas);
}

export function attachMapProbe(map: VectorMap): void {
  if (typeof window === "undefined") return;
  if (process.env.NEXT_PUBLIC_MAP_CANVAS_PROBE !== "1") return;
  window.__skiMapProbe = map;
  window.__skiMapCanvasVariance = () => canvasColorVariance(map);
}
