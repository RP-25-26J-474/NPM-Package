// src/utils.ts
import type {
  AuraMlEnvelopeV2,
  AuraProfileV2,
  AuraTokens,
  AuraThemeMode,
} from "./types";

// -------------------------------
// Minimal MOCK (dev-only fallback)
// -------------------------------
export const DEFAULT_GUEST_PROFILE: AuraProfileV2 = {
  font_size: 16,
  line_height: 1.5,
  contrast_mode: "normal",

  primary_color: "#2563eb",
  primary_color_content: "#ffffff",

  secondary_color: "#0ea5e9",
  secondary_color_content: "#ffffff",

  accent_color: "#f97316",
  accent_color_content: "#111111",

  theme: "light",

  element_spacing_x: 12,
  element_spacing_y: 12,
  element_padding_x: 12,
  element_padding_y: 10,

  reduced_motion: false,
  target_size: 44,
  tooltip_assist: false,
  layout_simplification: false,
};

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function buildFallbackProfileFromPredictions(pred: {
  font_size: number;
  line_height: number;
  target_size: number;
}): AuraProfileV2 {
  // Start from safe defaults
  const base = DEFAULT_GUEST_PROFILE;

  const font_size = clamp(pred.font_size, 14, 22);
  const line_height = clamp(pred.line_height, 1.4, 1.6);
  const target_size = clamp(pred.target_size, 24, 56);

  // OPTIONAL but recommended:
  // derive spacing/padding from predicted size so UI feels consistent
  const element_spacing_x = clamp(Math.round(font_size * 0.6), 6, 18);
  const element_spacing_y = clamp(Math.round(font_size * 0.5), 4, 16);

  const element_padding_x = clamp(Math.round(target_size * 0.25), 8, 18);
  const element_padding_y = clamp(Math.round(target_size * 0.22), 8, 18);

  return {
    ...base,
    font_size,
    line_height,
    target_size,
    element_spacing_x,
    element_spacing_y,
    element_padding_x,
    element_padding_y,
  };
}

export const DEFAULT_GUEST_ENVELOPE: AuraMlEnvelopeV2 = {
  profile: {
    user_id: "guest",
    metadata: {
      origin: "category",
      created_at: "2025-01-01T00:00:00Z",
      confidence_overall: 0.5,
      version: 1,
    },
    profile: DEFAULT_GUEST_PROFILE,
  },
  diff: { changed: [], old: null, new: DEFAULT_GUEST_PROFILE as any },
  traces: [],
};

// -------------------------------
// Profile -> Tokens mapping (V2)
// -------------------------------

const getBaseBackgroundAndText = (
  theme: AuraThemeMode,
  highContrast: boolean
): { background: string; surface: string; text: string; border: string } => {
  if (theme === "dark") {
    return {
      background: "#0b0b0b",
      surface: highContrast ? "#111111" : "#141414",
      text: "#ffffff",
      border: highContrast ? "#ffffff" : "#2a2a2a",
    };
  }

  return {
    background: "#ffffff",
    surface: highContrast ? "#f3f4f6" : "#fafafa",
    text: "#111111",
    border: highContrast ? "#111111" : "#d4d4d4",
  };
};

export const deriveTokensFromProfile = (profile: AuraProfileV2): AuraTokens => {
  const basePx = clamp(profile.font_size, 10, 28);
  const baseSize = basePx.toString() + "px";

  const highContrast = profile.contrast_mode === "high";

  const base = getBaseBackgroundAndText(profile.theme, highContrast);

  const colors = {
    background: base.background,
    surface: base.surface,
    text: base.text,

    primary: profile.primary_color,
    onPrimary: profile.primary_color_content,

    secondary: profile.secondary_color,
    onSecondary: profile.secondary_color_content,

    accent: profile.accent_color,
    onAccent: profile.accent_color_content,

    border: base.border,
  };

  const typography = {
    basePx,
    baseSize,
    lineHeight: profile.line_height,

    h1: "calc(" + baseSize + " + 12px)",
    h2: "calc(" + baseSize + " + 8px)",
    h3: "calc(" + baseSize + " + 4px)",
    body: baseSize,
    caption: "12px",
  };

  const gapX = clamp(profile.element_spacing_x, 0, 40);
  const gapY = clamp(profile.element_spacing_y, 0, 40);

  const padX = clamp(profile.element_padding_x, 0, 64);
  const padY = clamp(profile.element_padding_y, 0, 64);

  const spacing = {
    gapX,
    gapY,
    padX,
    padY,
    pagePaddingX: clamp(padX * 2, 0, 120),
    pagePaddingY: clamp(padY * 2, 0, 120),
  };

  const controls = {
    minTargetSize: clamp(profile.target_size, 16, 64),
  };

  const flags = {
    highContrast,
    reducedMotion: profile.reduced_motion,
    tooltipAssist: profile.tooltip_assist,
    layoutSimplification: profile.layout_simplification,
    theme: profile.theme,
  };

  return { colors, typography, spacing, controls, flags };
};

// -------------------------------
// Mock "backend" call (dev-only)
// -------------------------------

export const mockFetchAuraEnvelope = async (
  userId: string,
  rlEndpointOverride?: string
): Promise<AuraMlEnvelopeV2> => {
  // ── Demo profile: offline-first, no backend needed ──────────────────────
  if (userId === "u_001") {
    return {
      profile: {
        user_id: "u_001",
        metadata: {
          origin: "user",
          created_at: "2026-03-01T09:20:54.996765+00:00",
          confidence_overall: 0.7631,
          version: 6
        },
        profile: {
          font_size: 17,
          line_height: 1.695901820011972,
          contrast_mode: "normal",
          primary_color: "#1a73e8",
          primary_color_content: "#ffffff",
          secondary_color: "#1a73e8",
          secondary_color_content: "#ffffff",
          accent_color: "#e37400",
          accent_color_content: "#ffffff",
          theme: "light",
          element_spacing_x: 7,
          element_spacing_y: 4,
          element_padding_x: 8,
          element_padding_y: 8,
          reduced_motion: true,
          target_size: 32,
          tooltip_assist: true,
          layout_simplification: true
        }
      },
      diff: {
        changed: [
          "font_size",
          "line_height",
          "target_size"
        ],
        new: {
          font_size: 17,
          line_height: 1.695901820011972,
          target_size: 32
        },
        old: {
          font_size: 11,
          line_height: 1.6,
          target_size: 28
        }
      },
      traces: []
    };
  }

  // For non-demo users, try the live backend first
  try {
    const backendUrl = rlEndpointOverride || process.env.AURA_RL_URL || "https://rl-service.fly.dev";
    const response = await fetch(`${backendUrl}/users/${userId}/profile`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.profile) {
        return {
          profile: data.profile,
          diff: data.diff || { changed: [], old: null, new: data.profile.profile },
          traces: []
        };
      }
    }
  } catch (err) {
    //console.warn("[AURA] Could not fetch live profile from backend, falling back to local defaults.", err);
  }

  return DEFAULT_GUEST_ENVELOPE;
};
