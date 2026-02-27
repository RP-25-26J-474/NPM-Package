// src/fallback-ml/predict.ts
// Lightweight, dependency-free inference for the exported sklearn MLP model.
// - Normalizes inputs
// - Dense(ReLU) -> Dense(linear)
// - Unnormalizes outputs
// - Clamps to safe ranges

import model from "./model.json";

/**
 * Expected model.json format:
 * {
 *   input_features: string[],
 *   output_features: string[],
 *   x_mean: number[],
 *   x_std: number[],
 *   y_mean: number[],
 *   y_std: number[],
 *   layers: [
 *     { name: "dense_1", activation: "relu",   W: number[][], b: number[] },
 *     { name: "dense_out", activation: "linear", W: number[][], b: number[] }
 *   ],
 *   output_clamps: { font_size: [min,max], line_height: [min,max], target_size: [min,max] }
 * }
 */

export type AuraFallbackOutputs = {
  font_size: number;
  line_height: number;
  target_size: number;
};

type OutputClamps = Record<string, [number, number]>;

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function relu(x: number) {
  return x > 0 ? x : 0;
}

// --- Encoding (ordinal + unknown -> neutral) ---
export function encodeDevice(device: string): number {
  // mobile=0, tablet=0.5, desktop=1
  const d = device.toLowerCase();
  if (d.includes("mobile") || d.includes("phone")) return 0.0;
  if (d.includes("tablet") || d.includes("ipad")) return 0.5;
  if (d.includes("desktop") || d.includes("windows") || d.includes("mac")) return 1.0;
  return 0.5; // unknown -> neutral
}

export function encodeBrowser(browser: string): number {
  // Chrome=0.0, Firefox=0.5, Safari=1 (unknown -> 0.5)
  const b = browser.toLowerCase();
  if (b.includes("firefox")) return 0.5;
  // Safari should be checked before Chrome because many UAs include "Safari"
  if (b.includes("safari") && !b.includes("chrome") && !b.includes("chromium")) return 1.0;
  if (b.includes("chrome") || b.includes("chromium") || b.includes("brave") || b.includes("edge") || b.includes("edg")) return 0.0;
  return 0.5;
}

export function encodeOS(os: string): number {
  // Android=0, iOS=0.33, Windows=0.66, macOS=1 (unknown -> 0.5)
  const o = os.toLowerCase();
  if (o.includes("android")) return 0.0;
  if (o.includes("ios") || o.includes("iphone") || o.includes("ipad")) return 0.33;
  if (o.includes("windows")) return 0.66;
  if (o.includes("mac") || o.includes("macos") || o.includes("os x")) return 1.0;
  return 0.5;
}

// --- Basic detection (kept simple & safe) ---
function detectDeviceFromViewport(vw: number): string {
  // same logic you used in the generator
  if (vw <= 600) return "mobile";
  if (vw <= 992) return "tablet";
  return "desktop";
}

function detectBrowserFromUA(ua: string): string {
  // Return a name; encodeBrowser handles mapping.
  const s = ua.toLowerCase();
  if (s.includes("firefox")) return "Firefox";
  if (s.includes("edg")) return "Edge";
  // Safari check must exclude Chrome/Chromium
  if (s.includes("safari") && !s.includes("chrome") && !s.includes("chromium")) return "Safari";
  if (s.includes("chrome") || s.includes("chromium")) return "Chrome";
  return "Unknown";
}

function detectOSFromUA(ua: string): string {
  const s = ua.toLowerCase();
  if (s.includes("android")) return "Android";
  if (s.includes("iphone") || s.includes("ipad") || s.includes("ipod")) return "iOS";
  if (s.includes("windows")) return "Windows";
  if (s.includes("mac os x") || s.includes("macintosh")) return "macOS";
  if (s.includes("linux")) return "Linux";
  return "Unknown";
}

// --- Model utilities ---
type Layer = {
  name: string;
  activation: "relu" | "linear";
  W: number[][];
  b: number[];
};

type ExportedModel = {
  input_features: string[];
  output_features: string[];
  x_mean: number[];
  x_std: number[];
  y_mean: number[];
  y_std: number[];
  layers: Layer[];
  output_clamps: OutputClamps;
};

const M = model as unknown as ExportedModel;

function dotRow(vec: number[], wCol: number[][], j: number): number {
  // Computes sum_i vec[i] * W[i][j]
  // where W is shape (n_in, n_out)
  let s = 0;
  for (let i = 0; i < vec.length; i++) {
    s += vec[i] * wCol[i][j];
  }
  return s;
}

function dense(vec: number[], layer: Layer): number[] {
  const nOut = layer.b.length;
  const out = new Array<number>(nOut);

  for (let j = 0; j < nOut; j++) {
    let v = dotRow(vec, layer.W, j) + layer.b[j];
    out[j] = layer.activation === "relu" ? relu(v) : v;
  }
  return out;
}

function normalize(x: number[], mean: number[], std: number[]): number[] {
  const out = new Array<number>(x.length);
  for (let i = 0; i < x.length; i++) {
    const denom = std[i] === 0 ? 1 : std[i];
    out[i] = (x[i] - mean[i]) / denom;
  }
  return out;
}

function unnormalize(yScaled: number[], mean: number[], std: number[]): number[] {
  const out = new Array<number>(yScaled.length);
  for (let i = 0; i < yScaled.length; i++) {
    out[i] = yScaled[i] * std[i] + mean[i];
  }
  return out;
}

function clampOutputs(
  outputs: Record<string, number>,
  clamps: OutputClamps
): AuraFallbackOutputs {
  const font = clamp(outputs.font_size, clamps.font_size[0], clamps.font_size[1]);
  const line = clamp(outputs.line_height, clamps.line_height[0], clamps.line_height[1]);
  const target = clamp(outputs.target_size, clamps.target_size[0], clamps.target_size[1]);

  // Optional: round nicely for UI stability
  return {
    font_size: Math.round(font * 100) / 100,
    line_height: Math.round(line * 100) / 100,
    target_size: Math.round(target * 100) / 100,
  };
}

/**
 * Main API: predict fallback UI tokens for the current browser context.
 * Uses viewport + DPR + UA detection.
 */
export function predictFallbackTokens(): AuraFallbackOutputs {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

  const deviceStr = detectDeviceFromViewport(vw);
  const browserStr = detectBrowserFromUA(ua);
  const osStr = detectOSFromUA(ua);

  const xRaw: number[] = [
    vw,
    vh,
    dpr,
    encodeDevice(deviceStr),
    encodeBrowser(browserStr),
    encodeOS(osStr),
  ];

  // Normalize inputs
  const x = normalize(xRaw, M.x_mean, M.x_std);

  // Forward pass
  const h = dense(x, M.layers[0]);          // dense_1 relu
  const yScaled = dense(h, M.layers[1]);    // dense_out linear

  // Unnormalize outputs
  const y = unnormalize(yScaled, M.y_mean, M.y_std);

  // Map outputs in the correct order based on model.output_features
  const out: Record<string, number> = {};
  for (let i = 0; i < M.output_features.length; i++) {
    out[M.output_features[i]] = y[i];
  }

  return clampOutputs(out, M.output_clamps);
}

/**
 * Optional: predict from provided values (useful for tests)
 */
export function predictFallbackTokensFromInput(input: {
  viewport_width: number;
  viewport_height: number;
  device_pixel_ratio: number;
  device?: string;
  browser?: string;
  os?: string;
}): AuraFallbackOutputs {
  const vw = input.viewport_width;
  const vh = input.viewport_height;
  const dpr = input.device_pixel_ratio;

  const deviceStr = input.device ?? detectDeviceFromViewport(vw);
  const browserStr = input.browser ?? "Unknown";
  const osStr = input.os ?? "Unknown";

  const xRaw: number[] = [
    vw,
    vh,
    dpr,
    encodeDevice(deviceStr),
    encodeBrowser(browserStr),
    encodeOS(osStr),
  ];

  const x = normalize(xRaw, M.x_mean, M.x_std);
  const h = dense(x, M.layers[0]);
  const yScaled = dense(h, M.layers[1]);
  const y = unnormalize(yScaled, M.y_mean, M.y_std);

  const out: Record<string, number> = {};
  for (let i = 0; i < M.output_features.length; i++) {
    out[M.output_features[i]] = y[i];
  }

  return clampOutputs(out, M.output_clamps);
}
