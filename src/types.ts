// src/types.ts
import type { CSSProperties, ReactNode } from "react";

// ---- NEW ML backend JSON types (matches your latest output) ----

export type AuraContrastMode = "normal" | "high";
export type AuraThemeMode = "light" | "dark";

export interface AuraProfileV2 {
  // numeric now
  font_size: number; // px
  line_height: number;

  contrast_mode: AuraContrastMode;

  primary_color: string;
  primary_color_content: string;

  secondary_color: string;
  secondary_color_content: string;

  accent_color: string;
  accent_color_content: string;

  theme: AuraThemeMode;

  // spacing/padding split into x/y numeric
  element_spacing_x: number; // px
  element_spacing_y: number; // px
  element_padding_x: number; // px
  element_padding_y: number; // px

  reduced_motion: boolean;
  target_size: number; // px
  tooltip_assist: boolean;
  layout_simplification: boolean;
}

export interface AuraMlMetadataV2 {
  origin: "category" | "user";
  created_at: string;
  confidence_overall: number;
  version: number;
}

// Inner "profile" object inside the envelope
export interface AuraMlProfileObjectV2 {
  user_id: string;
  metadata: AuraMlMetadataV2;
  profile: AuraProfileV2;
}

// Full response envelope from ML/extension
export interface AuraMlEnvelopeV2 {
  profile: AuraMlProfileObjectV2;

  // keep these loose because they can evolve
  diff?: {
    changed?: string[];
    old?: any;
    new?: any;
  };
  
  profile_changes?: {
    changed?: string[];
    old?: any;
    new?: any;
  };

  traces?: any[];
}

export interface AuraInspectorDiffEntry {
  path: string;
  extensionValue: unknown;
  appliedValue: unknown;
}

export interface AuraExtensionStatusSnapshot {
  extensionPresent?: boolean;
  loggedIn?: boolean;
  userId?: string | null;
  token?: string | null;
  user?: {
    email?: string | null;
    name?: string | null;
  } | null;
  error?: string;
}

export interface AuraExtensionStoredProfileSnapshot {
  profile?: unknown;
  available?: boolean;
  error?: string;
}

export interface AuraExtensionFinalProfileSnapshot
  extends AuraExtensionStoredProfileSnapshot {
  sourceType?: string | null;
}

export interface AuraInspectorExtensionState {
  status: AuraExtensionStatusSnapshot;
  personalized: AuraExtensionStoredProfileSnapshot | null;
  adaptive: AuraExtensionStoredProfileSnapshot | null;
  final: AuraExtensionFinalProfileSnapshot | null;
  normalizedFinalEnvelope: AuraMlEnvelopeV2 | null;
}

export interface AuraInspectorRuntimeState {
  requestedUserId?: string;
  resolvedUserId?: string;
  source: AuraSource;
  loading: boolean;
  error?: string;
  isExtensionInstalled: boolean;
  isExtensionLoggedIn?: boolean;
  simulateExtensionInstalled: boolean;
  appliedProfile: AuraProfileV2 | null;
  appliedAt?: string | null;
  fallbackCreatedProfile: AuraProfileV2 | null;
  fallbackReason?: string | null;
}

export interface AuraInspectorSnapshot {
  user: {
    requestedUserId?: string;
    resolvedUserId?: string;
    source: AuraSource;
    loading: boolean;
    error?: string;
  };
  extension: AuraInspectorExtensionState;
  runtime: AuraInspectorRuntimeState;
  comparison: {
    finalVsApplied: AuraInspectorDiffEntry[];
    hasDifference: boolean;
  };
  fallback: {
    active: boolean;
    reason?: string | null;
    createdProfile: AuraProfileV2 | null;
    appliedProfile: AuraProfileV2 | null;
  };
  notes: {
    limitation: string;
  };
}

// ---- Derived tokens for UI components ----

export interface AuraColorTokens {
  background: string;
  surface: string;
  text: string;

  primary: string;
  onPrimary: string;

  secondary: string;
  onSecondary: string;

  accent: string;
  onAccent: string;

  border: string;
}

export interface AuraTypographyTokens {
  basePx: number; // numeric base size
  baseSize: string; // "16px"
  lineHeight: number;

  h1: string;
  h2: string;
  h3: string;
  body: string;
  caption: string;
}

export interface AuraSpacingTokens {
  gapX: number;
  gapY: number;

  padX: number;
  padY: number;

  pagePaddingX: number;
  pagePaddingY: number;
}

export interface AuraControlTokens {
  minTargetSize: number; // px
}

export interface AuraFlagTokens {
  highContrast: boolean;
  reducedMotion: boolean;
  tooltipAssist: boolean;
  layoutSimplification: boolean;
  theme: AuraThemeMode;
}

export interface AuraTokens {
  colors: AuraColorTokens;
  typography: AuraTypographyTokens;
  spacing: AuraSpacingTokens;
  controls: AuraControlTokens;
  flags: AuraFlagTokens;
}

export type AuraCssVariableName = `--aura-${string}`;
export type AuraCssVariables = Record<AuraCssVariableName, string>;

// ---- Context & component props ----

export type AuraSource = "category" | "user" | "fallback";

export type AdaptiveFeedbackType = "positive" | "neutral" | "negative";

export interface AdaptiveFeedbackPayload {
  type: AdaptiveFeedbackType | 'explicit';
  value?: number;  // For explicit feedback: 1.0 (yes) or 0.0 (no)
  rating?: number;
  comment?: string;
  responseTime?: number;
}

export interface AdaptiveContextValue {
  userId?: string;
  sessionId?: string;
  source: AuraSource;
  profile: AuraProfileV2 | null;
  tokens: AuraTokens;
  loading: boolean;
  error?: string;
  isExtensionInstalled: boolean;
  behaviorTracker?: any; // BehaviorTracker instance
  apiEndpoint?: string; // Add this
  rlEndpoint?: string;
  submitFeedback?: (feedback: AdaptiveFeedbackPayload) => Promise<{ success: boolean }>;
  isExtensionLoggedIn?: boolean;

  /** Re-fetch from extension (or mocks in dev) */
  reload: () => Promise<void>;
  openComponentFeedback?: (componentId: string, type: 'button' | 'text' | 'container' | 'input', currentProps: any) => void;
  /** Apply a settings patch immediately to the UI (works offline, no backend required) */
  applySettings?: (settings: Record<string, any>, source?: string) => void;
}

export interface AdaptiveProviderProps {
  children: ReactNode;

  /**
   * OPTIONAL only for local dev (if you still want mock fetch path).
   * In real integration this comes from the extension.
   */
  userId?: string;

  /**
   * For development only:
   * - true  => use local mock fetch (no extension required)
   * - false => use real extension bridge
   */
  simulateExtensionInstalled?: boolean;
  /**
   * API endpoint for behavior tracking and personalization.
   * Example: 'https://your-backend.com/api'
   */
  apiEndpoint?: string;
  /**
   * Enable implicit behavior tracking (Week 1 implementation).
   * Tracks user behavior silently without prompts.
   */
  enableBehaviorTracking?: boolean;
  /**
   * Enable debug logging for behavior tracker.
   */
  debugMode?: boolean;
  /**
   * Inject AURA's token-driven a-* utility classes.
   * Enabled by default so apps can use className="a-card a-readable" after
   * wrapping with AdaptiveProvider.
   */
  enableUtilityClasses?: boolean;
  /**
   * RL service endpoint for reinforcement learning feedback.
   * Example: 'http://localhost:8000'
   */
  rlEndpoint?: string;

  /** Optional: show a CTA prompt when the extension is missing. */
  showExtensionPrompt?: boolean;
  extensionPromptMessage?: string;
  extensionPromptCtaLabel?: string;
  extensionPromptCtaHref?: string;
  onExtensionPromptCtaClick?: () => void;
  extensionPromptStyle?: CSSProperties;
  extensionPromptMessageStyle?: CSSProperties;
  extensionPromptCtaStyle?: CSSProperties;
  extensionPromptDismissLabel?: string;
  extensionPromptDismissStyle?: CSSProperties;
  extensionPromptStorageKey?: string;
  onExtensionPromptDismiss?: () => void;
}

export interface AdaptiveComponentProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}
