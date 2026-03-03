// src/fallback-ml/predict.ts
import model from "./model.json";

export type AuraFallbackOutputs = {
  font_size: number;
  line_height: number;
  target_size: number;
};

type OutputClamps = Record<string, [number, number]>;

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

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function relu(x: number) {
  return x > 0 ? x : 0;
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

function dotRow(vec: number[], W: number[][], j: number): number {
  let s = 0;
  for (let i = 0; i < vec.length; i++) s += vec[i] * W[i][j];
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

function detectDeviceFromViewport(vw: number): "mobile" | "tablet" | "desktop" {
  if (vw <= 600) return "mobile";
  if (vw <= 992) return "tablet";
  return "desktop";
}

function detectBrowserFromUA(ua: string): "chrome" | "firefox" | "safari" | "unknown" {
  const s = ua.toLowerCase();
  if (s.includes("firefox")) return "firefox";
  // Safari must exclude Chrome
  if (s.includes("safari") && !s.includes("chrome") && !s.includes("chromium")) return "safari";
  if (s.includes("chrome") || s.includes("chromium") || s.includes("brave") || s.includes("edg")) return "chrome";
  return "unknown";
}

function detectOSFromUA(ua: string): "android" | "ios" | "windows" | "macos" | "unknown" {
  const s = ua.toLowerCase();
  if (s.includes("android")) return "android";
  if (s.includes("iphone") || s.includes("ipad") || s.includes("ipod")) return "ios";
  if (s.includes("windows")) return "windows";
  if (s.includes("mac os x") || s.includes("macintosh")) return "macos";
  return "unknown";
}

function setOneHot(features: Record<string, number>, prefix: string, value: string) {
  // We rely on model.input_features. If the specific key doesn't exist, use *_unknown.
  const key = `${prefix}_${value}`;
  const unk = `${prefix}_unknown`;

  if (key in features) features[key] = 1;
  else if (unk in features) features[unk] = 1;
  // If neither exists, do nothing (keeps bundle resilient)
}

function clampOutputs(
  outputs: Record<string, number>,
  clamps: OutputClamps
): AuraFallbackOutputs {
  const font = clamp(outputs.font_size, clamps.font_size[0], clamps.font_size[1]);
  const line = clamp(outputs.line_height, clamps.line_height[0], clamps.line_height[1]);
  const target = clamp(outputs.target_size, clamps.target_size[0], clamps.target_size[1]);

  return {
    font_size: Math.round(font * 100) / 100,
    line_height: Math.round(line * 100) / 100,
    target_size: Math.round(target * 100) / 100,
  };
}

export function predictFallbackTokens(): AuraFallbackOutputs {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

  // 1) Build features map initialized to 0 using model.input_features
  const features: Record<string, number> = {};
  for (const f of M.input_features) features[f] = 0;

  // 2) Fill numeric inputs (if present)
  if ("viewport_width" in features) features.viewport_width = vw;
  if ("viewport_height" in features) features.viewport_height = vh;
  if ("device_pixel_ratio" in features) features.device_pixel_ratio = dpr;

  // 3) One-hot set (UNKNOWN bucket if unseen)
  const device = detectDeviceFromViewport(vw);
  const browser = detectBrowserFromUA(ua);
  const os = detectOSFromUA(ua);

  setOneHot(features, "device", device);
  setOneHot(features, "browser", browser);
  setOneHot(features, "os", os);

  // 4) Build xRaw in exact training order
  const xRaw = M.input_features.map((k) => features[k] ?? 0);

  // 5) Normalize + forward pass + unnormalize
  const x = normalize(xRaw, M.x_mean, M.x_std);
  const h = dense(x, M.layers[0]);        // relu
  const yScaled = dense(h, M.layers[1]);  // linear
  const y = unnormalize(yScaled, M.y_mean, M.y_std);

  // 6) Map outputs by name and clamp
  const out: Record<string, number> = {};
  for (let i = 0; i < M.output_features.length; i++) {
    out[M.output_features[i]] = y[i];
  }

  return clampOutputs(out, M.output_clamps);
}