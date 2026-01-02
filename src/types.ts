// src/types.ts
import type { CSSProperties, ReactNode } from "react";
import React from "react";

// ---- ML backend JSON types ----

export type AuraFontSize = "small" | "medium" | "large" | "x-large";
export type AuraElementSpacing = "compact" | "normal" | "wide";
export type AuraContrastMode = "normal" | "high";
export type AuraThemeMode = "light" | "dark";

export interface AuraProfile {
  font_size: AuraFontSize;
  line_height: number;
  contrast_mode: AuraContrastMode;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  theme: AuraThemeMode;
  reduced_motion: boolean;
  element_spacing: AuraElementSpacing;
  target_size: number;
  tooltip_assist: boolean;
  layout_simplification: boolean;
}

export interface AuraMlMetadata {
  origin: "category" | "user";
  created_at: string;
  confidence_overall: number;
}

export interface AuraMlResponse {
  user_id: string;
  session_id: string;
  metadata: AuraMlMetadata;
  profile: AuraProfile;
  node_outputs: Record<string, unknown>;
}

// ---- Derived tokens for UI components ----

export interface AuraColorTokens {
  background: string;
  surface: string;
  text: string;
  primary: string;
  secondary: string;
  accent: string;
  border: string;
  onPrimary: string;
}

export interface AuraTypographyTokens {
  baseSize: string;   // e.g. "16px"
  lineHeight: number; // e.g. 1.6
  h1: string;
  h2: string;
  h3: string;
  body: string;
  caption: string;
}

export interface AuraSpacingTokens {
  base: number;   // base spacing in px
  gap: number;    // standard gap between elements
  pagePadding: number;
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
  profile: AuraProfile | null;
  tokens: AuraTokens;
  loading: boolean;
  error?: string;
  isExtensionInstalled: boolean;
  behaviorTracker?: any; // BehaviorTracker instance
  submitFeedback?: (feedback: AdaptiveFeedbackPayload) => Promise<{ success: boolean }>;
  reload: () => Promise<void>;
}

export interface AdaptiveProviderProps {
  children: ReactNode;
  /**
   * Optional user id. In real integration this would come from
   * the extension or your auth system.
   */
  userId?: string;
  /**
   * For development: pretend the extension is installed and
   * automatically load personalization on mount.
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
}

export interface AdaptiveComponentProps {
  className?: string;
  style?: CSSProperties;
  children?: React.ReactNode;
}
