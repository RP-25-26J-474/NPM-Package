// src/AdaptiveProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

import { predictFallbackTokens } from "./fallback-ml/predict";
import { readFallbackCache, writeFallbackCache } from "./fallback-ml/cache";
import { buildFallbackProfileFromPredictions } from "./utils";

import type {
  AdaptiveContextValue,
  AdaptiveProviderProps,
  AuraProfileV2,
  AuraTokens,
  AuraSource,
  AuraMlEnvelopeV2,
} from "./types";

import { deriveTokensFromProfile, mockFetchAuraEnvelope, DEFAULT_GUEST_PROFILE } from "./utils";

const initialProfile: AuraProfileV2 = DEFAULT_GUEST_PROFILE;
const initialTokens: AuraTokens = deriveTokensFromProfile(initialProfile);

const AdaptiveContext = createContext<AdaptiveContextValue | null>(null);

type AnyStyle = Record<string, any>;
type AnyRecord = Record<string, unknown>;

const DEFAULT_EXTENSION_PROMPT_MESSAGE =
  "Install the AURA extension for a more personalized UI adaptation experience.";
const DEFAULT_EXTENSION_PROMPT_CTA = "Get AURA Extension";
const DEFAULT_EXTENSION_PROMPT_DISMISS_LABEL = "Not now";
const DEFAULT_EXTENSION_PROMPT_STORAGE_KEY = "__aura_ext_prompt_seen_v1";

function mergeStyle(target: AnyStyle, incoming: any) {
  if (!incoming) return;
  const keys = Object.keys(incoming);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = incoming[k];
    if (v !== undefined) target[k] = v;
  }
}

function isLoggedInUserId(userId: string | undefined | null): boolean {
  if (!userId) return false;
  const normalized = String(userId).trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized !== "guest" &&
    normalized !== "anonymous" &&
    normalized !== "anon" &&
    normalized !== "unknown"
  );
}

// ----------------------------
// Extension bridge (page <-> content script via window.postMessage)
// ----------------------------
type AuraExtensionBridge = {
  getStatus: () => Promise<AuraExtensionStatus>;
  getFinalProfile: () => Promise<AuraExtensionFinalProfileResponse>;
};

type AuraExtensionStatus = {
  extensionPresent?: boolean;
  loggedIn?: boolean;
  token?: string | null;
  user?: {
    email?: string | null;
    name?: string | null;
  } | null;
  error?: string;
};

type AuraExtensionFinalProfileResponse = {
  profile?: unknown;
  available?: boolean;
  sourceType?: string | null;
  error?: string;
};

function isRecord(value: unknown): value is AnyRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeSpacingValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === "compact") return 6;
  if (value === "wide") return 16;
  if (value === "comfortable") return 12;
  return undefined;
}

function normalizeProfileShape(input: unknown): AuraProfileV2 | null {
  if (!isRecord(input)) return null;

  const legacySpacing = normalizeSpacingValue(input.element_spacing);
  const legacyPadding = normalizeSpacingValue(input.element_padding);

  return {
    ...DEFAULT_GUEST_PROFILE,
    font_size: toFiniteNumber(input.font_size, DEFAULT_GUEST_PROFILE.font_size),
    line_height: toFiniteNumber(
      input.line_height,
      DEFAULT_GUEST_PROFILE.line_height
    ),
    contrast_mode:
      input.contrast_mode === "high" ? "high" : DEFAULT_GUEST_PROFILE.contrast_mode,
    primary_color:
      typeof input.primary_color === "string"
        ? input.primary_color
        : DEFAULT_GUEST_PROFILE.primary_color,
    primary_color_content:
      typeof input.primary_color_content === "string"
        ? input.primary_color_content
        : DEFAULT_GUEST_PROFILE.primary_color_content,
    secondary_color:
      typeof input.secondary_color === "string"
        ? input.secondary_color
        : DEFAULT_GUEST_PROFILE.secondary_color,
    secondary_color_content:
      typeof input.secondary_color_content === "string"
        ? input.secondary_color_content
        : DEFAULT_GUEST_PROFILE.secondary_color_content,
    accent_color:
      typeof input.accent_color === "string"
        ? input.accent_color
        : DEFAULT_GUEST_PROFILE.accent_color,
    accent_color_content:
      typeof input.accent_color_content === "string"
        ? input.accent_color_content
        : DEFAULT_GUEST_PROFILE.accent_color_content,
    theme: input.theme === "dark" ? "dark" : DEFAULT_GUEST_PROFILE.theme,
    element_spacing_x: toFiniteNumber(
      input.element_spacing_x,
      legacySpacing ?? DEFAULT_GUEST_PROFILE.element_spacing_x
    ),
    element_spacing_y: toFiniteNumber(
      input.element_spacing_y,
      legacySpacing ?? DEFAULT_GUEST_PROFILE.element_spacing_y
    ),
    element_padding_x: toFiniteNumber(
      input.element_padding_x,
      legacyPadding ?? DEFAULT_GUEST_PROFILE.element_padding_x
    ),
    element_padding_y: toFiniteNumber(
      input.element_padding_y,
      legacyPadding ?? DEFAULT_GUEST_PROFILE.element_padding_y
    ),
    reduced_motion:
      typeof input.reduced_motion === "boolean"
        ? input.reduced_motion
        : DEFAULT_GUEST_PROFILE.reduced_motion,
    target_size: toFiniteNumber(
      input.target_size,
      DEFAULT_GUEST_PROFILE.target_size
    ),
    tooltip_assist:
      typeof input.tooltip_assist === "boolean"
        ? input.tooltip_assist
        : DEFAULT_GUEST_PROFILE.tooltip_assist,
    layout_simplification:
      typeof input.layout_simplification === "boolean"
        ? input.layout_simplification
        : DEFAULT_GUEST_PROFILE.layout_simplification,
  };
}

function normalizeExtensionOrigin(value: unknown): "category" | "user" {
  if (value === "category") return value;
  return "user";
}

function normalizeExtensionEnvelope(
  response: AuraExtensionFinalProfileResponse,
  fallbackUserId?: string
): AuraMlEnvelopeV2 | null {
  const rawProfile = response.profile;
  if (!isRecord(rawProfile)) return null;

  const looksLikeStoredProfile =
    typeof rawProfile.user_id === "string" &&
    isRecord(rawProfile.profile);

  const userId =
    (looksLikeStoredProfile && typeof rawProfile.user_id === "string"
      ? rawProfile.user_id
      : fallbackUserId) ?? "extension-user";

  const metadata: AnyRecord =
    looksLikeStoredProfile && isRecord(rawProfile.metadata)
      ? rawProfile.metadata
      : {};
  const profileChanges: AnyRecord | null =
    looksLikeStoredProfile && isRecord(rawProfile.profile_changes)
      ? rawProfile.profile_changes
      : null;

  const normalizedProfile = normalizeProfileShape(
    looksLikeStoredProfile ? rawProfile.profile : rawProfile
  );

  if (!normalizedProfile) return null;

  return {
    profile: {
      user_id: userId,
      metadata: {
        origin: normalizeExtensionOrigin(metadata.origin),
        created_at:
          typeof metadata.created_at === "string"
            ? metadata.created_at
            : new Date().toISOString(),
        confidence_overall: toFiniteNumber(metadata.confidence_overall, 0.8),
        version: toFiniteNumber(metadata.version, 1),
      },
      profile: normalizedProfile,
    },
    diff:
      profileChanges
        ? {
            changed: Array.isArray(profileChanges.changed)
              ? profileChanges.changed
              : undefined,
            old: profileChanges.old,
            new: profileChanges.new,
          }
        : undefined,
    traces: [],
  };
}

function getExtensionDisplayUserId(
  status: AuraExtensionStatus,
  profileUserId?: string,
  fallbackUserId?: string
): string {
  if (profileUserId && profileUserId.trim()) return profileUserId;
  if (status.user?.email && status.user.email.trim()) return status.user.email;
  if (status.user?.name && status.user.name.trim()) return status.user.name;
  if (fallbackUserId && fallbackUserId.trim()) return fallbackUserId;
  return "extension-user";
}

function createRealExtensionBridge(timeoutMs: number): AuraExtensionBridge {
  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function waitForBridgeReady(): Promise<void> {
    if (typeof window === "undefined") return;
    if (document.readyState === "complete") {
      await delay(150);
      return;
    }

    await new Promise<void>((resolve) => {
      window.addEventListener("load", () => resolve(), { once: true });
    });
    await delay(150);
  }

  function requestOnce<T>(requestType: string, responseType: string): Promise<T> {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("No window"));
        return;
      }

      const timer = window.setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("Extension response timeout"));
      }, timeoutMs);

      function onMessage(ev: MessageEvent) {
        const d = ev && ev.data ? ev.data : null;
        if (ev.source !== window) return;
        if (!d || d.source !== "aura-extension") return;
        if (d.type !== responseType) return;

        window.clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(d as T);
      }

      window.addEventListener("message", onMessage);
      window.postMessage({ type: requestType, source: "aura-web" }, "*");
    });
  }

  async function request<T>(requestType: string, responseType: string): Promise<T> {
    const maxAttempts = 3;
    let lastError: unknown;

    await waitForBridgeReady();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await requestOnce<T>(requestType, responseType);
      } catch (err) {
        lastError = err;
        const isTimeout =
          err instanceof Error && err.message === "Extension response timeout";

        if (!isTimeout || attempt === maxAttempts - 1) {
          throw err;
        }

        await delay(250);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Extension bridge request failed");
  }

  return {
    getStatus: () => request<AuraExtensionStatus>("AURA_EXT_PING", "AURA_EXT_PONG"),
    getFinalProfile: () =>
      request<AuraExtensionFinalProfileResponse>(
        "AURA_EXT_ML_FINAL_PROFILE_PING",
        "AURA_EXT_ML_FINAL_PROFILE_PONG"
      ),
  };
}

function applyEnvelope(
  env: AuraMlEnvelopeV2,
  setUserId: (v: string) => void,
  setSource: (v: AuraSource) => void,
  setProfile: (v: AuraProfileV2) => void,
  setTokens: (v: AuraTokens) => void
) {
  const inner = env.profile;
  setUserId(inner.user_id);
  setSource(inner.metadata.origin);
  setProfile(inner.profile);
  setTokens(deriveTokensFromProfile(inner.profile));
}

async function loadFallback(
  setUserId: (v: string) => void,
  setSource: (v: AuraSource) => void,
  setProfile: (v: AuraProfileV2) => void,
  setTokens: (v: AuraTokens) => void
) {
  // 1) cache first
  const cached = readFallbackCache();
  const pred = cached ?? predictFallbackTokens();

  if (!cached) writeFallbackCache(pred);

  const fullProfile = buildFallbackProfileFromPredictions(pred);

  setUserId("guest");
  setSource("fallback");
  setProfile(fullProfile);
  setTokens(deriveTokensFromProfile(fullProfile));
}

export function AdaptiveProvider({
  children,
  userId: initialUserId,
  simulateExtensionInstalled = false,
  showExtensionPrompt = true,
  extensionPromptMessage = DEFAULT_EXTENSION_PROMPT_MESSAGE,
  extensionPromptCtaLabel = DEFAULT_EXTENSION_PROMPT_CTA,
  extensionPromptCtaHref,
  onExtensionPromptCtaClick,
  extensionPromptStyle,
  extensionPromptMessageStyle,
  extensionPromptCtaStyle,
  extensionPromptDismissLabel = DEFAULT_EXTENSION_PROMPT_DISMISS_LABEL,
  extensionPromptDismissStyle,
  extensionPromptStorageKey = DEFAULT_EXTENSION_PROMPT_STORAGE_KEY,
  onExtensionPromptDismiss,
}: AdaptiveProviderProps) {
  const [userId, setUserId] = useState<string | undefined>(initialUserId);
  const [profile, setProfile] = useState<AuraProfileV2 | null>(initialProfile);
  const [tokens, setTokens] = useState<AuraTokens>(initialTokens);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>();
  const [source, setSource] = useState<AuraSource>("category");
  const [isExtensionInstalled, setIsExtensionInstalled] = useState<boolean>(
    simulateExtensionInstalled
  );
  const [isExtensionLoggedIn, setIsExtensionLoggedIn] = useState<
    boolean | undefined
  >(undefined);
  const [isExtensionPromptSuppressed, setIsExtensionPromptSuppressed] =
    useState<boolean>(false);
  const [isExtensionPromptClosed, setIsExtensionPromptClosed] =
    useState<boolean>(false);

  // DEV path: local mocks
  const loadFromMocks = useCallback(
    async (uid?: string) => {
      const effectiveUserId = uid ?? initialUserId ?? "guest";

      try {
        setLoading(true);
        setError(undefined);
        setIsExtensionInstalled(true);

        const env = await mockFetchAuraEnvelope(effectiveUserId);
        setIsExtensionLoggedIn(isLoggedInUserId(effectiveUserId));
        applyEnvelope(env, (v) => setUserId(v), setSource, setProfile, setTokens);
      } catch (err) {
        console.error("[AURA] Failed to load personalization (mock)", err);
        setError("Failed to load personalization");
        setSource("fallback");
        setUserId("guest");
        setIsExtensionLoggedIn(false);
        setProfile(initialProfile);
        setTokens(initialTokens);
      } finally {
        setLoading(false);
      }
    },
    [initialUserId]
  );

  // REAL path: extension
  const loadFromExtension = useCallback(async () => {
    const bridge = createRealExtensionBridge(2200);

    try {
      setLoading(true);
      setError(undefined);
      setIsExtensionLoggedIn(undefined);

      const status = await bridge.getStatus();
      const installed = status.extensionPresent === true;
      setIsExtensionInstalled(installed);

      if (!installed) {
        setIsExtensionLoggedIn(false);
        await loadFallback(setUserId, setSource, setProfile, setTokens);
        return;
      }

      const loggedIn = status.loggedIn === true;
      setIsExtensionLoggedIn(loggedIn);

      if (!loggedIn) {
        await loadFallback(setUserId, setSource, setProfile, setTokens);
        return;
      }

      const finalProfile = await bridge.getFinalProfile();
      const env = normalizeExtensionEnvelope(
        finalProfile,
        getExtensionDisplayUserId(status, undefined, initialUserId)
      );

      if (!finalProfile.available || !env) {
        await loadFallback(setUserId, setSource, setProfile, setTokens);
        return;
      }

      applyEnvelope(env, (v) => setUserId(v), setSource, setProfile, setTokens);
    } catch (err) {
      console.error("[AURA] Extension path failed", err);
      setError("Failed to load personalization from extension");
      setIsExtensionLoggedIn(false);
      await loadFallback(setUserId, setSource, setProfile, setTokens);
    } finally {
      setLoading(false);
    }
  }, [initialUserId]);

  // Initialization
  useEffect(() => {
    if (simulateExtensionInstalled) {
      setIsExtensionInstalled(true);
      const mockUserId = initialUserId ?? "u_001";
      loadFromMocks(mockUserId);
      return;
    }
    loadFromExtension();
  }, [simulateExtensionInstalled, initialUserId, loadFromMocks, loadFromExtension]);

  // Instant update when extension user changes (no refresh)
  useEffect(() => {
    if (simulateExtensionInstalled) return;

    function onMessage(ev: MessageEvent) {
      const d = ev && ev.data ? ev.data : null;
      if (ev.source !== window) return;
      if (!d || d.source !== "aura-extension") return;
      if (d.type !== "AURA_USER_UPDATE" && d.type !== "AURA_EXT_PROFILE_CHANGED") {
        return;
      }

      // When extension says profile changed -> re-fetch
      loadFromExtension();
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [simulateExtensionInstalled, loadFromExtension]);

  useEffect(() => {
    if (simulateExtensionInstalled) return;
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(extensionPromptStorageKey);
      if (stored === "1") setIsExtensionPromptSuppressed(true);
    } catch {
      // ignore storage errors
    }
  }, [simulateExtensionInstalled, extensionPromptStorageKey]);

  const shouldShowExtensionPrompt =
    showExtensionPrompt &&
    !simulateExtensionInstalled &&
    !loading &&
    !isExtensionInstalled &&
    !isExtensionPromptSuppressed &&
    !isExtensionPromptClosed;

  useEffect(() => {
    if (!shouldShowExtensionPrompt) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(extensionPromptStorageKey, "1");
    } catch {
      // ignore storage errors
    }
  }, [shouldShowExtensionPrompt, extensionPromptStorageKey]);

  const extensionPrompt = shouldShowExtensionPrompt
    ? (() => {
        const { colors, typography, spacing, controls, flags } = tokens;

        const containerStyle: AnyStyle = {
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: Math.max(10, spacing.gapX),
          padding:
            Math.max(10, spacing.padY).toString() +
            "px " +
            Math.max(12, spacing.padX).toString() +
            "px",
          borderRadius: 14,
          borderWidth: flags.highContrast ? 2 : 1,
          borderStyle: "solid",
          borderColor: flags.highContrast ? colors.text : colors.primary,
          backgroundColor: flags.highContrast ? colors.background : colors.surface,
          color: colors.text,
          marginBottom: Math.max(12, spacing.gapY),
        };
        mergeStyle(containerStyle, extensionPromptStyle);

        const messageStyle: AnyStyle = {
          fontSize: typography.body,
          lineHeight: typography.lineHeight,
          flex: "1 1 240px",
        };
        mergeStyle(messageStyle, extensionPromptMessageStyle);

        const actionsStyle: AnyStyle = {
          display: "inline-flex",
          alignItems: "center",
          gap: Math.max(8, Math.round(spacing.gapX * 0.8)),
          flex: "0 0 auto",
        };

        const ctaStyle: AnyStyle = {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: Math.max(6, Math.round(spacing.gapX * 0.5)),
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: colors.primary,
          backgroundColor: colors.primary,
          color: colors.onPrimary,
          borderRadius: 999,
          padding:
            Math.max(8, Math.round(spacing.padY * 0.6)).toString() +
            "px " +
            Math.max(12, Math.round(spacing.padX * 0.9)).toString() +
            "px",
          minHeight: Math.max(32, Math.round(controls.minTargetSize * 0.7)),
          textDecoration: "none",
          fontSize: typography.body,
          lineHeight: typography.lineHeight,
          cursor: "pointer",
        };
        mergeStyle(ctaStyle, extensionPromptCtaStyle);

        const dismissStyle: AnyStyle = {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: flags.highContrast ? colors.text : colors.border,
          backgroundColor: "transparent",
          color: colors.text,
          borderRadius: 999,
          padding:
            Math.max(8, Math.round(spacing.padY * 0.6)).toString() +
            "px " +
            Math.max(12, Math.round(spacing.padX * 0.9)).toString() +
            "px",
          minHeight: Math.max(32, Math.round(controls.minTargetSize * 0.7)),
          textDecoration: "none",
          fontSize: typography.body,
          lineHeight: typography.lineHeight,
          cursor: "pointer",
        };
        mergeStyle(dismissStyle, extensionPromptDismissStyle);

        const messageEl = React.createElement(
          "div",
          { style: messageStyle },
          extensionPromptMessage
        );

        const handleDismiss = () => {
          setIsExtensionPromptClosed(true);
          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(extensionPromptStorageKey, "1");
            } catch {
              // ignore storage errors
            }
          }
          if (onExtensionPromptDismiss) onExtensionPromptDismiss();
        };

        let ctaEl: React.ReactNode = null;
        if (extensionPromptCtaHref || onExtensionPromptCtaClick) {
          if (extensionPromptCtaHref) {
            ctaEl = React.createElement(
              "a",
              {
                href: extensionPromptCtaHref,
                style: ctaStyle,
                onClick: onExtensionPromptCtaClick,
              },
              extensionPromptCtaLabel
            );
          } else {
            ctaEl = React.createElement(
              "button",
              {
                type: "button",
                style: ctaStyle,
                onClick: onExtensionPromptCtaClick,
              },
              extensionPromptCtaLabel
            );
          }
        }

        const dismissEl = React.createElement(
          "button",
          {
            type: "button",
            style: dismissStyle,
            onClick: handleDismiss,
            "aria-label": extensionPromptDismissLabel,
          },
          extensionPromptDismissLabel
        );

        const actionsEl = React.createElement(
          "div",
          { style: actionsStyle },
          ctaEl,
          dismissEl
        );

        return React.createElement(
          "div",
          { role: "status", "aria-live": "polite", style: containerStyle },
          messageEl,
          actionsEl
        );
      })()
    : null;

  const contextValue: AdaptiveContextValue = {
    userId,
    source,
    profile,
    tokens,
    loading,
    error,
    isExtensionInstalled,
    isExtensionLoggedIn,

    reload: async () => {
      if (simulateExtensionInstalled) {
        await loadFromMocks(userId);
        return;
      }
      await loadFromExtension();
    },
  };

  return React.createElement(
    AdaptiveContext.Provider,
    { value: contextValue },
    React.createElement(React.Fragment, null, extensionPrompt, children)
  );
}

export function useAdaptive(): AdaptiveContextValue {
  const ctx = useContext(AdaptiveContext);
  if (!ctx) throw new Error("useAdaptive must be used inside <AdaptiveProvider>");
  return ctx;
}
