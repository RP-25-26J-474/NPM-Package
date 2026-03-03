import type {
  AuraThemeMode,
  AuraProfile,
  AuraProfileV2,
  AuraMlResponse,
  AuraMlEnvelopeV2,
  AuraTokens,
} from "./types";

type PersonalizationSettings = {
  variant?: string;
  fontSize?: string;
  lineHeight?: number | string;
  contrast?: string;
  spacing?: string;
  targetSize?: number | string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  theme?: string;
  reducedMotion?: boolean;
  tooltipAssist?: boolean;
  layoutSimplification?: boolean;
};

type PersonalizationResponse = {
  success: boolean;
  userId?: string;
  sessionId?: string;
  source?: string;
  confidence?: number;
  settings?: PersonalizationSettings;
};

// -------------------------
// Hardcoded ML backend JSON
// -------------------------


export const CATEGORY_PROFILE_MOCK: AuraMlResponse = {
  user_id: "guest",
  session_id: "s_00001",
  metadata: {
    origin: "category",
    created_at: "2025-10-06T11:00:00Z",
    confidence_overall: 0.65,
  },
  profile: {
    font_size: "medium",
    line_height: 1.4,
    contrast_mode: "normal",
    primary_color: "#2563eb",
    secondary_color: "#93c5fd",
    accent_color: "#f97316",
    theme: "light",
    reduced_motion: false,
    element_spacing: "normal",
    target_size: 24,
    tooltip_assist: false,
    layout_simplification: false,
  },
  node_outputs: {},
};

const normalizeEndpoint = (endpoint: string): string => {
  return endpoint.replace(/\/+$/, "");
};

const mapFontSize = (
  fontSize: string | undefined,
  fallback: string | number
): string | number => {
  if (!fontSize) return fallback;
  const parsed = parseInt(fontSize, 10);
  if (Number.isNaN(parsed)) return fallback;
  if (parsed <= 14) return "small";
  if (parsed <= 16) return "medium";
  if (parsed <= 18) return "large";
  return "x-large";
};

const mapSpacing = (
  spacing: string | undefined,
  fallback: string | number
): string | number => {
  if (!spacing) return fallback;
  if (spacing === "compact" || spacing === "normal" || spacing === "wide") {
    return spacing;
  }
  if (spacing.includes("compact")) return "compact";
  if (spacing.includes("wide")) return "wide";
  return fallback;
};

const parseTargetSize = (
  value: number | string | undefined,
  fallback: number
): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
};

const parseLineHeight = (
  value: number | string | undefined,
  fallback: number
): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
};

// u_001 (dark + high contrast + simplified)
export const USER_PROFILE_MOCK: AuraMlResponse = {
  user_id: "u_001",
  session_id: "s_00012",
  metadata: {
    origin: "user",
    created_at: "2025-10-06T11:25:00Z",
    confidence_overall: 0.83,
  },
  profile: {
    font_size: "x-large",
    line_height: 1.6,
    contrast_mode: "high",
    primary_color: "#1a7318",
    secondary_color: "#1a73e8",
    accent_color: "#e37400",
    theme: "dark",
    reduced_motion: true,
    element_spacing: "wide",
    target_size: 28,
    tooltip_assist: true,
    layout_simplification: true,
  },
  node_outputs: {},
};
// -------------------------------
// Minimal MOCK (dev-only fallback)
// -------------------------------
export const DEFAULT_GUEST_PROFILE: AuraProfileV2 = {
  font_size: 10,
  line_height: 1.15,
  contrast_mode: "normal",

  primary_color: "#2563eb",
  primary_color_content: "#ffffff",

  secondary_color: "#0ea5e9",
  secondary_color_content: "#ffffff",

  accent_color: "#f97316",
  accent_color_content: "#111111",

  theme: "light",

  element_spacing_x: 10,
  element_spacing_y: 10,
  element_padding_x: 12,
  element_padding_y: 10,

  reduced_motion: false,
  target_size: 14,
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
  userId: string
): Promise<AuraMlEnvelopeV2> => {
  await new Promise((r) => setTimeout(r, 150));

  if (userId === "u_001") return DEFAULT_GUEST_ENVELOPE;
  
  return DEFAULT_GUEST_ENVELOPE;
};

export const fetchAuraProfile = async (
  apiEndpoint: string,
  userId: string
): Promise<AuraMlResponse> => {
  const baseProfile = CATEGORY_PROFILE_MOCK.profile;
  const url = `${normalizeEndpoint(apiEndpoint)}/personalization?userId=${encodeURIComponent(userId)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Personalization request failed (${response.status})`);
  }

  const data = (await response.json()) as PersonalizationResponse;

  if (!data || !data.success || !data.settings) {
    throw new Error("Invalid personalization response");
  }

  const settings = data.settings;
  const origin =
    data.source === "baseline" || settings.variant === "baseline"
      ? "category"
      : "user";

  const contrastMode =
    settings.contrast === "high"
      ? "high"
      : settings.contrast === "normal"
        ? "normal"
        : baseProfile.contrast_mode;

  const theme =
    settings.theme === "dark" || settings.theme === "light"
      ? settings.theme
      : baseProfile.theme;

  const profile: AuraProfile = {
    font_size: mapFontSize(settings.fontSize, baseProfile.font_size),
    line_height: parseLineHeight(settings.lineHeight, baseProfile.line_height),
    contrast_mode: contrastMode,
    primary_color: settings.primaryColor || baseProfile.primary_color,
    secondary_color: settings.secondaryColor || baseProfile.secondary_color,
    accent_color: settings.accentColor || baseProfile.accent_color,
    theme,
    reduced_motion:
      typeof settings.reducedMotion === "boolean"
        ? settings.reducedMotion
        : baseProfile.reduced_motion,
    element_spacing: mapSpacing(settings.spacing, baseProfile.element_spacing),
    target_size: parseTargetSize(settings.targetSize, baseProfile.target_size),
    tooltip_assist:
      typeof settings.tooltipAssist === "boolean"
        ? settings.tooltipAssist
        : baseProfile.tooltip_assist,
    layout_simplification:
      typeof settings.layoutSimplification === "boolean"
        ? settings.layoutSimplification
        : baseProfile.layout_simplification,
  };

  return {
    user_id: data.userId || userId,
    session_id: data.sessionId || `s_${Date.now()}`,
    metadata: {
      origin,
      created_at: new Date().toISOString(),
      confidence_overall:
        typeof data.confidence === "number" ? data.confidence : 0.7,
    },
    profile,
    node_outputs: {},
  };
};
