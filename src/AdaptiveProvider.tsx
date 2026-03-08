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
import { loadAdaptiveProfileFromExtension } from "./extensionBridge";

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
    try {
      setLoading(true);
      setError(undefined);
      setIsExtensionLoggedIn(undefined);

      const result = await loadAdaptiveProfileFromExtension(initialUserId);
      setIsExtensionInstalled(result.installed);
      setIsExtensionLoggedIn(result.loggedIn);

      if (!result.installed || !result.loggedIn || !result.envelope) {
        await loadFallback(setUserId, setSource, setProfile, setTokens);
        return;
      }

      applyEnvelope(
        result.envelope,
        (v) => setUserId(v),
        setSource,
        setProfile,
        setTokens
      );
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
      if (
        d.type !== "AURA_USER_UPDATE" &&
        d.type !== "AURA_EXT_PROFILE_CHANGED"
      ) {
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
