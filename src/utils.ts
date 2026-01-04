// src/utils.ts
import type {
  AuraMlResponse,
  AuraProfile,
  AuraTokens,
  AuraFontSize,
  AuraElementSpacing,
  AuraThemeMode,
} from "./types";

// -----------------------------------------
// Mock ML backend JSON (ONLY for simulation)
// -----------------------------------------
// Later: you will remove these and get ML json from the extension.

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

// Admin / power user (example: darker, high contrast, simplified)
export const USER_PROFILE_MOCK_U001: AuraMlResponse = {
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

// Normal user (smaller, compact)
export const USER_PROFILE_MOCK_U002: AuraMlResponse = {
  user_id: "u_002",
  session_id: "s_00034",
  metadata: {
    origin: "user",
    created_at: "2025-10-07T09:15:00Z",
    confidence_overall: 0.9,
  },
  profile: {
    font_size: "small",
    line_height: 1.3,
    contrast_mode: "normal",
    primary_color: "#b91c1c",
    secondary_color: "#f97316",
    accent_color: "#22c55e",
    theme: "light",
    reduced_motion: false,
    element_spacing: "compact",
    target_size: 20,
    tooltip_assist: false,
    layout_simplification: false,
  },
  node_outputs: {},
};

// Low vision user (bigger text, higher line height, high contrast)
export const USER_PROFILE_MOCK_U003: AuraMlResponse = {
  user_id: "u_003",
  session_id: "s_00056",
  metadata: {
    origin: "user",
    created_at: "2025-10-10T10:10:00Z",
    confidence_overall: 0.88,
  },
  profile: {
    font_size: "x-large",
    line_height: 1.8,
    contrast_mode: "high",
    primary_color: "#0ea5e9",
    secondary_color: "#38bdf8",
    accent_color: "#f59e0b",
    theme: "light",
    reduced_motion: true,
    element_spacing: "wide",
    target_size: 30,
    tooltip_assist: true,
    layout_simplification: false, // don’t hide content; just improve readability
  },
  node_outputs: {},
};

// Motor support user (bigger targets, more spacing, reduced motion)
export const USER_PROFILE_MOCK_U004: AuraMlResponse = {
  user_id: "u_004",
  session_id: "s_00078",
  metadata: {
    origin: "user",
    created_at: "2025-10-11T08:30:00Z",
    confidence_overall: 0.86,
  },
  profile: {
    font_size: "large",
    line_height: 1.5,
    contrast_mode: "normal",
    primary_color: "#7c3aed",
    secondary_color: "#c4b5fd",
    accent_color: "#22c55e",
    theme: "dark",
    reduced_motion: true,
    element_spacing: "wide",
    target_size: 34,
    tooltip_assist: true,
    layout_simplification: true,
  },
  node_outputs: {},
};

// Low computer literacy user (clearer UI: larger spacing, tooltips, simplified layout)
export const USER_PROFILE_MOCK_U005: AuraMlResponse = {
  user_id: "u_005",
  session_id: "s_00091",
  metadata: {
    origin: "user",
    created_at: "2025-10-12T07:20:00Z",
    confidence_overall: 0.84,
  },
  profile: {
    font_size: "large",
    line_height: 1.7,
    contrast_mode: "normal",
    primary_color: "#16a34a",
    secondary_color: "#86efac",
    accent_color: "#f97316",
    theme: "light",
    reduced_motion: true,
    element_spacing: "wide",
    target_size: 32,
    tooltip_assist: true,
    layout_simplification: true,
  },
  node_outputs: {},
};

// -----------------------------------------
// Profile -> Tokens mapping
// -----------------------------------------

const FONT_SIZE_MAP: Record<AuraFontSize, string> = {
  small: "14px",
  medium: "16px",
  large: "18px",
  "x-large": "20px",
};

const SPACING_MAP: Record<AuraElementSpacing, number> = {
  compact: 4,
  normal: 8,
  wide: 12,
};

const getBaseBackgroundAndText = (
  theme: AuraThemeMode,
  highContrast: boolean
): { background: string; surface: string; text: string } => {
  if (theme === "dark") {
    return {
      background: "#000000",
      surface: highContrast ? "#111111" : "#181818",
      text: "#FFFFFF",
    };
  }

  return {
    background: "#FFFFFF",
    surface: highContrast ? "#F5F5F5" : "#FAFAFA",
    text: "#111111",
  };
};

export const deriveTokensFromProfile = (profile: AuraProfile): AuraTokens => {
  const baseFontSize = FONT_SIZE_MAP[profile.font_size];
  const baseSpacing = SPACING_MAP[profile.element_spacing];
  const highContrast = profile.contrast_mode === "high";

  const { background, surface, text } = getBaseBackgroundAndText(
    profile.theme,
    highContrast
  );

  const minTargetSize = profile.target_size;

  const colors = {
    background,
    surface,
    text,
    primary: profile.primary_color,
    secondary: profile.secondary_color,
    accent: profile.accent_color,
    border: highContrast ? "#FFFFFF" : "#C4C4C4",
    onPrimary: highContrast ? "#000000" : "#FFFFFF",
  };

  const typography = {
    baseSize: baseFontSize,
    lineHeight: profile.line_height,
    h1: "calc(" + baseFontSize + " + 12px)",
    h2: "calc(" + baseFontSize + " + 8px)",
    h3: "calc(" + baseFontSize + " + 4px)",
    body: baseFontSize,
    caption: "12px",
  };

  const spacing = {
    base: baseSpacing,
    gap: baseSpacing * 2,
    pagePadding: baseSpacing * 3,
  };

  const controls = {
    minTargetSize,
  };

  const flags = {
    highContrast,
    reducedMotion: profile.reduced_motion,
    tooltipAssist: profile.tooltip_assist,
    layoutSimplification: profile.layout_simplification,
    theme: profile.theme,
  };

  return {
    colors,
    typography,
    spacing,
    controls,
    flags,
  };
};

// -----------------------------------------
// Mock "backend" call (ONLY for simulation)
// -----------------------------------------

export const mockFetchAuraProfile = async (
  userId: string
): Promise<AuraMlResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 250));

  if (userId === "u_001") return USER_PROFILE_MOCK_U001;
  if (userId === "u_002") return USER_PROFILE_MOCK_U002;
  if (userId === "u_003") return USER_PROFILE_MOCK_U003;
  if (userId === "u_004") return USER_PROFILE_MOCK_U004;
  if (userId === "u_005") return USER_PROFILE_MOCK_U005;

  return CATEGORY_PROFILE_MOCK;
};
