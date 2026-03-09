import React from "react";
import { render } from "@testing-library/react";

import { AdaptiveProvider, useAdaptive } from "../AdaptiveProvider";
import { deriveTokensFromProfile } from "../utils";

import type { AuraMlEnvelopeV2, AuraProfileV2, AdaptiveContextValue } from "../types";

export const TEST_PROFILE: AuraProfileV2 = {
  font_size: 20,
  line_height: 1.9,
  contrast_mode: "high",
  primary_color: "#113355",
  primary_color_content: "#ffffff",
  secondary_color: "#224466",
  secondary_color_content: "#ffffff",
  accent_color: "#ff6600",
  accent_color_content: "#111111",
  theme: "dark",
  element_spacing_x: 18,
  element_spacing_y: 20,
  element_padding_x: 16,
  element_padding_y: 14,
  reduced_motion: true,
  target_size: 52,
  tooltip_assist: true,
  layout_simplification: true,
};

export const ALT_TEST_PROFILE: AuraProfileV2 = {
  ...TEST_PROFILE,
  font_size: 16,
  line_height: 1.5,
  primary_color: "#0055aa",
  target_size: 44,
  element_spacing_x: 12,
  element_spacing_y: 12,
  element_padding_x: 12,
  element_padding_y: 10,
  tooltip_assist: false,
  layout_simplification: false,
};

export const TEST_ENVELOPE: AuraMlEnvelopeV2 = {
  profile: {
    user_id: "ext-user-1",
    metadata: {
      origin: "user",
      created_at: "2026-03-09T09:00:00.000Z",
      confidence_overall: 0.93,
      version: 4,
    },
    profile: TEST_PROFILE,
  },
  diff: {
    changed: ["font_size", "target_size", "layout_simplification"],
    old: {
      font_size: 16,
      target_size: 44,
      layout_simplification: false,
    },
    new: {
      font_size: 20,
      target_size: 52,
      layout_simplification: true,
    },
  },
  traces: [],
};

export const ALT_TEST_ENVELOPE: AuraMlEnvelopeV2 = {
  profile: {
    user_id: "ext-user-1",
    metadata: {
      origin: "user",
      created_at: "2026-03-09T10:00:00.000Z",
      confidence_overall: 0.88,
      version: 5,
    },
    profile: ALT_TEST_PROFILE,
  },
  diff: {
    changed: ["font_size", "target_size"],
    old: {
      font_size: 20,
      target_size: 52,
    },
    new: {
      font_size: 16,
      target_size: 44,
    },
  },
  traces: [],
};

export const TEST_TOKENS = deriveTokensFromProfile(TEST_PROFILE);

export type MockAdaptiveContext = Pick<
  AdaptiveContextValue,
  | "tokens"
  | "source"
  | "profile"
  | "loading"
  | "reload"
  | "isExtensionInstalled"
  | "isExtensionLoggedIn"
  | "behaviorTracker"
  | "openComponentFeedback"
>;

export const MOCK_ADAPTIVE_CONTEXT: MockAdaptiveContext = {
  tokens: TEST_TOKENS,
  source: "user",
  profile: TEST_PROFILE,
  loading: false,
  reload: async () => {},
  isExtensionInstalled: true,
  isExtensionLoggedIn: true,
  behaviorTracker: { trackInteraction: jest.fn() },
  openComponentFeedback: jest.fn(),
};

export function AdaptiveStateProbe() {
  const ctx = useAdaptive();

  return (
    <output data-testid="adaptive-state">
      {JSON.stringify({
        userId: ctx.userId,
        source: ctx.source,
        loading: ctx.loading,
        isExtensionInstalled: ctx.isExtensionInstalled,
        isExtensionLoggedIn: ctx.isExtensionLoggedIn,
        profile: ctx.profile,
      })}
    </output>
  );
}

export function renderInsideProvider(
  ui: React.ReactElement,
  providerProps?: React.ComponentProps<typeof AdaptiveProvider>
) {
  return render(<AdaptiveProvider {...providerProps}>{ui}</AdaptiveProvider>);
}

export function setWindowSize(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height,
  });
  window.dispatchEvent(new Event("resize"));
}

export function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
}
