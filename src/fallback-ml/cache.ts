// src/fallback-ml/cache.ts
import type { AuraFallbackOutputs } from "./predict";

// bump version to invalidate old cached tokens after model input change
const KEY = "__aura_fallback_tokens_v2";

export function readFallbackCache(): AuraFallbackOutputs | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuraFallbackOutputs;
  } catch {
    return null;
  }
}

export function writeFallbackCache(v: AuraFallbackOutputs) {
  try {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // ignore
  }
}

export function clearFallbackCache() {
  try {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
