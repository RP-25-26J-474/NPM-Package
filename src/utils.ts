// src/utils.ts
import type {
  AuraMlResponse,
  AuraProfile,
  AuraTokens,
  AuraFontSize,
  AuraElementSpacing,
  AuraThemeMode,
} from "./types";

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
    primary_color: "#2E4669",
    secondary_color: "#4D5A69",
    accent_color: "#A7B7C9",
    theme: "dark",
    reduced_motion: true,
    element_spacing: "wide",
    target_size: 28,
    tooltip_assist: true,
    layout_simplification: true,
  },
  node_outputs: {
    font_size: {
      confidence: 0.86,
      explanations: ["zoom_count +2.8σ", "scroll_rate low"],
      proposed: "x-large",
      final: "x-large",
    },
    target_size: {
      confidence: 0.78,
      explanations: ["target_miss_rate high", "pointer_jitter high"],
      proposed: 30,
      final: 28,
    },
  },
};

// u_002 (compact + light)
export const USER_PROFILE_MOCK_2: AuraMlResponse = {
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
    primary_color: "#4D371E",
    secondary_color: "#826146",
    accent_color: "#291000",
    theme: "light",
    reduced_motion: false,
    element_spacing: "compact",
    target_size: 20,
    tooltip_assist: false,
    layout_simplification: false,
  },
  node_outputs: {},
};

// u_003 (low vision: large typography + wide spacing, NOT simplified)
export const USER_PROFILE_MOCK_3: AuraMlResponse = {
  user_id: "u_003",
  session_id: "s_00045",
  metadata: {
    origin: "user",
    created_at: "2025-10-08T10:05:00Z",
    confidence_overall: 0.86,
  },
  profile: {
    font_size: "x-large",
    line_height: 1.7,
    contrast_mode: "high",
    primary_color: "#502959",
    secondary_color: "#83698A",
    accent_color: "#B08C07",
    theme: "light",
    reduced_motion: true,
    element_spacing: "wide",
    target_size: 28,
    tooltip_assist: true,
    layout_simplification: false,
  },
  node_outputs: {},
};

// u_004 (motor support: large targets + wide spacing + simplified)
export const USER_PROFILE_MOCK_4: AuraMlResponse = {
  user_id: "u_004",
  session_id: "s_00062",
  metadata: {
    origin: "user",
    created_at: "2025-10-09T08:40:00Z",
    confidence_overall: 0.88,
  },
  profile: {
    font_size: "large",
    line_height: 1.6,
    contrast_mode: "normal",
    primary_color: "#459EA3",
    secondary_color: "#89ABAB",
    accent_color: "#B8BFBF",
    theme: "dark",
    reduced_motion: true,
    element_spacing: "wide",
    target_size: 36, // big click targets
    tooltip_assist: true,
    layout_simplification: true,
  },
  node_outputs: {},
};

//u_005 (guest shopper)
export const USER_PROFILE_MOCK_5: AuraMlResponse = {
  user_id: "u_005",
  session_id: "s_00074",
  metadata: {
    origin: "user",
    created_at: "2025-10-09T16:20:00Z",
    confidence_overall: 0.76,
  },
  profile: {
    font_size: "medium",
    line_height: 1.5,
    contrast_mode: "normal",
    primary_color: "#154215",
    secondary_color: "#558055",
    accent_color: "#A30525",
    theme: "light",
    reduced_motion: false,
    element_spacing: "normal",
    target_size: 24,
    tooltip_assist: false,
    layout_simplification: false,
  },
  node_outputs: {},
};

//u_006 (low computer literacy user)
export const USER_PROFILE_MOCK_6: AuraMlResponse = {
  user_id: "u_006",
  session_id: "s_00080",
  metadata: {
    origin: "user",
    created_at: "2025-10-10T07:55:00Z",
    confidence_overall: 0.84,
  },
  profile: {
    font_size: "large",
    line_height: 1.7,
    contrast_mode: "high",
    primary_color: "#2563eb",
    secondary_color: "#93c5fd",
    accent_color: "#f97316",
    theme: "light",
    reduced_motion: true,
    element_spacing: "wide",
    target_size: 34,
    tooltip_assist: true,
    layout_simplification: true,
  },
  node_outputs: {},
};


// -------------------------
// Profile - Tokens mapping
// -------------------------

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
    onPrimary: "#FFFFFF",
    primaryContent: "#FFFFFF",
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

  return { colors, typography, spacing, controls, flags };
};

// -------------------------
// Mock users fetch function
// -------------------------
export const mockFetchAuraProfile = async (
  userId: string
): Promise<AuraMlResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 200));

  if (userId === "u_001") return USER_PROFILE_MOCK;
  if (userId === "u_002") return USER_PROFILE_MOCK_2;
  if (userId === "u_003") return USER_PROFILE_MOCK_3;
  if (userId === "u_004") return USER_PROFILE_MOCK_4;
  if (userId === "u_005") return USER_PROFILE_MOCK_5;
  if (userId === "u_006") return USER_PROFILE_MOCK_6;

  // default
  return CATEGORY_PROFILE_MOCK;
};
