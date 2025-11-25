// src/utils.ts
import type {
  AuraMlResponse,
  AuraProfile,
  AuraTokens,
  AuraFontSize,
  AuraElementSpacing,
  AuraThemeMode,
} from "./types";

// ---- Hardcoded ML backend JSON (category-wise & user-wise) ----

export const CATEGORY_PROFILE_MOCK: AuraMlResponse = {
  user_id: "u_001",
  session_id: "s_00001",
  metadata: {
    origin: "category",
    created_at: "2025-10-06T11:00:00Z",
    confidence_overall: 0.65,
  },
  profile: {
    font_size: "large",
    line_height: 1.5,
    contrast_mode: "high",
    primary_color: "#1a73e8",
    secondary_color: "#1a73e8",
    accent_color: "#e37400",
    theme: "light",
    reduced_motion: true,
    element_spacing: "normal",
    target_size: 24,
    tooltip_assist: false,
    layout_simplification: false,
  },
  node_outputs: {},
};

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
    primary_color: "#1a73e8",
    secondary_color: "#1a73e8",
    accent_color: "#e37400",
    theme: "dark",
    reduced_motion: true,
    element_spacing: "wide",
    target_size: 28,
    tooltip_assist: true,
    layout_simplification: false,
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

// ---- Profile -> Tokens mapping ----

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

  // light theme
  return {
    background: "#FFFFFF",
    surface: highContrast ? "#F5F5F5" : "#FAFAFA",
    text: "#111111",
  };
};

/**
 * Convert an AuraProfile from the ML backend into a set of design tokens
 * that UI components can consume.
 */
export const deriveTokensFromProfile = (profile: AuraProfile): AuraTokens => {
  const baseFontSize = FONT_SIZE_MAP[profile.font_size];
  const baseSpacing = SPACING_MAP[profile.element_spacing];
  const highContrast = profile.contrast_mode === "high";

  const { background, surface, text } = getBaseBackgroundAndText(
    profile.theme,
    highContrast
  );

  const minTargetSize = profile.target_size; // px

  const colors = {
    background,
    surface,
    text,
    primary: profile.primary_color,
    secondary: profile.secondary_color,
    accent: profile.accent_color,
    border: highContrast ? "#FFFFFF" : "#C4C4C4",
    onPrimary: "#FFFFFF",
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

// ---- Mock "backend" call ----

/**
 * Simulate fetching personalization for a user.
 *
 * In a real system, this would:
 *  - Look up user-wise personalization first.
 *  - If not available, fall back to category-wise personalization.
 *  - Be called once on the first page load of the day.
 *
 * For now, it is hardcoded to:
 *  - Return USER_PROFILE_MOCK for "u_001"
 *  - Return CATEGORY_PROFILE_MOCK for any other user id.
 */
export const mockFetchAuraProfile = async (
  userId: string
): Promise<AuraMlResponse> => {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 400));

  if (userId === "u_001") {
    return USER_PROFILE_MOCK;
  }

  return CATEGORY_PROFILE_MOCK;
};
