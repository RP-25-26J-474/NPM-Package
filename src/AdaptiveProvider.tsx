// src/AdaptiveProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";

import { predictFallbackTokens } from "./fallback-ml/predict";
import { readFallbackCache, writeFallbackCache } from "./fallback-ml/cache";
import { buildFallbackProfileFromPredictions } from "./utils";

import type {
  AdaptiveContextValue,
  AdaptiveProviderProps,
  AdaptiveFeedbackPayload,
  AuraProfileV2,
  AuraTokens,
  AuraSource,
  AuraMlEnvelopeV2,
} from "./types";

import { deriveTokensFromProfile, mockFetchAuraEnvelope, DEFAULT_GUEST_PROFILE } from "./utils";
import { AdaptiveRevert } from './components/AdaptiveRevert';
import { BehaviorTracker, BehaviorTrackerConfig } from "./BehaviorTracker";
import { useTrialManager } from "./hooks/useTrialManager";
import { DirectionalFeedbackPrompt } from "./components/DirectionalFeedbackPrompt";
import { AdaptiveTempUserPrompt } from "./components/AdaptiveTempUserPrompt";
import { AdaptiveFeedback } from './components/AdaptiveFeedback';
import { useSettingsSync } from "./hooks/useSettingsSync";
import { MLFeedbackPrompt } from "./components/MLFeedbackPrompt";
import { ComponentFeedbackModal, type ComponentFeedbackType } from "./components/ComponentFeedbackModal";

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

// ----------------------------
// Extension bridge (page <-> content script via window.postMessage)
// ----------------------------
type AuraExtensionBridge = {
  isInstalled: () => Promise<boolean>;
  getUserId: () => Promise<string>;
  getMlEnvelope: (userId: string) => Promise<AuraMlEnvelopeV2>;
};

function createRealExtensionBridge(timeoutMs: number): AuraExtensionBridge {
  function request<T>(requestType: string, responseType: string): Promise<T> {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("No window"));
        return;
      }

      const requestId = "aura_" + Math.random().toString(36).slice(2);

      const timer = window.setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("Extension response timeout"));
      }, timeoutMs);

      function onMessage(ev: MessageEvent) {
        const d = ev && ev.data ? ev.data : null;
        if (!d || d.__aura !== true) return;
        if (d.requestId !== requestId) return;
        if (d.type !== responseType) return;

        window.clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(d.payload as T);
      }

      window.addEventListener("message", onMessage);
      window.postMessage({ __aura: true, type: requestType, requestId }, "*");
    });
  }

  return {
    isInstalled: async () => {
      try {
        await request("AURA_EXT_PING", "AURA_EXT_PONG");
        return true;
      } catch {
        return false;
      }
    },

    getUserId: async () => {
      const payload = await request<{ userId: string }>(
        "AURA_EXT_GET_USER_ID",
        "AURA_EXT_USER_ID"
      );
      return payload && payload.userId ? String(payload.userId) : "guest";
    },

    getMlEnvelope: async (_userId: string) => {
      // extension returns the full envelope directly
      const payload = await request<AuraMlEnvelopeV2>(
        "AURA_EXT_GET_ML_PROFILE",
        "AURA_EXT_ML_PROFILE"
      );
      return payload;
    },
  };
}

function applyEnvelope(
  env: AuraMlEnvelopeV2,
  setUserId: (v: string) => void,
  setSource: (v: AuraSource) => void,
  setProfile: (v: AuraProfileV2) => void,
  setTokens: (v: AuraTokens) => void,
  onDiffDetected?: (diff: any) => void
) {
  const inner = env.profile;
  setUserId(inner.user_id);
  setSource(inner.metadata.origin);
  setProfile(inner.profile);
  setTokens(deriveTokensFromProfile(inner.profile));
  
  const diffData = env.profile_changes || env.diff;
  if (onDiffDetected && diffData && diffData.changed && diffData.changed.length > 0) {
      onDiffDetected(diffData);
  }
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
  apiEndpoint,
  enableBehaviorTracking = true,
  debugMode = false,
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
  mode = "standard",
}: AdaptiveProviderProps & { mode?: "standard" | "trial-based" }) {
  const [userId, setUserId] = useState<string | undefined>(initialUserId);
  const [profile, setProfile] = useState<AuraProfileV2 | null>(initialProfile);
  const [tokens, setTokens] = useState<AuraTokens>(initialTokens);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>();
  const [source, setSource] = useState<AuraSource>("category");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
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
  const [behaviorTracker, setBehaviorTracker] = useState<BehaviorTracker | null>(null);

  useEffect(() => {
    if (enableBehaviorTracking) {
      const tracker = new BehaviorTracker({
        apiEndpoint: apiEndpoint || '',
        userId: initialUserId || 'guest',
        uiVariant: 'baseline',
        debugMode: debugMode
      });
      setBehaviorTracker(tracker);

      return () => {
        tracker.destroy();
      };
    }
  }, [enableBehaviorTracking, apiEndpoint, initialUserId, debugMode]);

  const [pendingDiffs, setPendingDiffs] = useState<{key: string; oldVal: any; newVal: any}[]>([]);
  const pendingDiffsRef = useRef(pendingDiffs);
  useEffect(() => { pendingDiffsRef.current = pendingDiffs; }, [pendingDiffs]);

  const [mlChangedSettings, setMlChangedSettings] = useState<{key: string; oldVal: any; newVal: any}[]>([]);
  const [latestSettings, setLatestSettings] = useState<any>(null);
  const [settingsSource, setSettingsSource] = useState<'manual' | 'ml' | 'trial'>('manual');
  const [mlConfidence, setMlConfidence] = useState<number>(0.5);

  const [activeFeedbackComponent, setActiveFeedbackComponent] = useState<{
    id: string;
    type: ComponentFeedbackType;
    props: any;
  } | null>(null);

  // Listen for Anomaly events to trigger ML feedback queue
  useEffect(() => {
     if (typeof window === 'undefined') return;

     const handleAnomaly = (e: any) => {
        setMlChangedSettings(prev => {
            if (prev.length === 0) return prev;
            if (pendingDiffsRef.current.length > 0) return prev; // Already asking
            
            // Move the first item to pendingDiffs
            const [first, ...rest] = prev;
            setPendingDiffs([first]);
            return rest;
        });
     };

     window.addEventListener('aura-anomaly', handleAnomaly);
     return () => window.removeEventListener('aura-anomaly', handleAnomaly);
  }, []);

  const {
    activeTrial,
    showPrompt,
    trialSettings,
    handleFeedback: handleTrialFeedback,
  } = useTrialManager(initialUserId || "guest", apiEndpoint || "", mode);

  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const isSignificantDeviation = useCallback((newSettings: any, baseProfile: AuraProfileV2): boolean => {
    if (!newSettings) return false;
    if (newSettings.theme && newSettings.theme !== baseProfile.theme) return true;
    const currentFontSize = newSettings.fontSize || baseProfile.font_size;
    if (currentFontSize !== baseProfile.font_size) return true;
    const currentContrast = newSettings.contrast || baseProfile.contrast_mode;
    if (currentContrast !== 'normal' && currentContrast !== baseProfile.contrast_mode) return true;
    let newTargetSize = baseProfile.target_size;
    if (newSettings.targetSize) {
        const val = typeof newSettings.targetSize === 'string' ? parseInt(newSettings.targetSize, 10) : newSettings.targetSize;
        if (!isNaN(val)) newTargetSize = val;
    }
    if (Math.abs(newTargetSize - baseProfile.target_size) > 2) return true;
    const currentSpacing = newSettings.spacing || baseProfile.element_spacing_y;
    if (currentSpacing !== baseProfile.element_spacing_y) return true;
    return false;
  }, []);

  const handleSettingsUpdate = useCallback((settings: any, source: string, mlConf?: number) => {
    const currentProfile = profileRef.current;
    
    let primaryChangedKey = 'theme';
    let oldVal: any = currentProfile?.theme;
    
    if (settings.theme && settings.theme !== currentProfile?.theme) {
      primaryChangedKey = 'theme'; oldVal = currentProfile?.theme;
    } else if (settings.fontSize && settings.fontSize !== currentProfile?.font_size) {
      primaryChangedKey = 'fontSize'; oldVal = currentProfile?.font_size;
    } else if (settings.targetSize && settings.targetSize !== currentProfile?.target_size) {
      primaryChangedKey = 'targetSize'; oldVal = currentProfile?.target_size;
    }
    
    let targetSizeValue = currentProfile?.target_size || 44;
    if (settings.targetSize) {
      if (typeof settings.targetSize === 'number') targetSizeValue = settings.targetSize;
      else if (typeof settings.targetSize === 'string') {
        const parsed = parseInt(settings.targetSize, 10);
        targetSizeValue = isNaN(parsed) ? targetSizeValue : parsed;
      }
    }
    
    const updatedProfile: AuraProfileV2 = {
      font_size: settings.fontSize || currentProfile?.font_size || 16,
      line_height: settings.lineHeight || currentProfile?.line_height || 1.5,
      contrast_mode: settings.contrast || currentProfile?.contrast_mode || 'normal',
      primary_color: settings.primaryColor || currentProfile?.primary_color || '#007bff',
      primary_color_content: currentProfile?.primary_color_content || '#ffffff',
      secondary_color: settings.secondaryColor || currentProfile?.secondary_color || '#6c757d',
      secondary_color_content: currentProfile?.secondary_color_content || '#ffffff',
      accent_color: settings.accentColor || currentProfile?.accent_color || '#28a745',
      accent_color_content: currentProfile?.accent_color_content || '#ffffff',
      theme: settings.theme || currentProfile?.theme || 'light',
      reduced_motion: settings.reducedMotion ?? currentProfile?.reduced_motion ?? false,
      element_spacing_x: settings.spacing || currentProfile?.element_spacing_x || 10,
      element_spacing_y: settings.spacing || currentProfile?.element_spacing_y || 10,
      element_padding_x: currentProfile?.element_padding_x || 12,
      element_padding_y: currentProfile?.element_padding_y || 12,
      target_size: targetSizeValue,
      tooltip_assist: settings.tooltipAssist ?? currentProfile?.tooltip_assist ?? false,
      layout_simplification: settings.layoutSimplification ?? currentProfile?.layout_simplification ?? false,
    };

    setProfile(updatedProfile);
    const newTokens = deriveTokensFromProfile(updatedProfile);
    setTokens(newTokens);
    setSource('user');
    
    if (typeof document !== 'undefined') {
        const root = document.documentElement;
        Object.entries(newTokens.colors).forEach(([key, value]) => {
            root.style.setProperty(`--aura-${key}`, value as string);
        });
        root.style.setProperty('--aura-base-size', newTokens.typography.baseSize);
        root.style.setProperty('--aura-line-height', String(newTokens.typography.lineHeight));
        root.style.setProperty('--aura-spacing-base', `${newTokens.spacing.gapY}px`);
        root.style.setProperty('--aura-min-target-size', `${newTokens.controls.minTargetSize}px`);
    }
    
    const isSignificant = isSignificantDeviation(settings, currentProfile || initialProfile);

    setLatestSettings(settings);
    setSettingsSource(source as 'manual' | 'ml' | 'trial');
    setMlConfidence(mlConf || 0.5);
    
    if (source === 'ml' && isSignificant) {
        setMlChangedSettings(prev => [...prev, {
            key: primaryChangedKey,
            oldVal: oldVal,
            newVal: settings[primaryChangedKey] !== undefined ? settings[primaryChangedKey] : targetSizeValue
        }]);
    }
  }, [isSignificantDeviation]);

  // Handle Diff from Extension/Backend Profile Load
  const handleProfileDiff = useCallback((diff: any) => {
      if (!diff || !diff.changed || diff.changed.length === 0) return;
      
      const newDiffItems = diff.changed.map((key: string) => ({
          key,
          oldVal: diff.old ? diff.old[key] : undefined,
          newVal: diff.new ? diff.new[key] : undefined,
      }));
      
      setLatestSettings(diff.new || {});
      setSettingsSource('ml');
      setMlChangedSettings(prev => [...prev, ...newDiffItems]);
  }, []);

  useSettingsSync({
    userId: userId || initialUserId || 'guest',
    apiEndpoint: apiEndpoint || '',
    enabled: !!apiEndpoint && !!userId,
    onSettingsUpdate: handleSettingsUpdate,
    onConnect: () => {},
    onError: () => {},
  });

  const submitFeedback = useCallback(
    async (feedback: AdaptiveFeedbackPayload): Promise<{ success: boolean }> => {
      if (!apiEndpoint || !userId || !sessionId) return { success: false };
      const answer = (feedback.value ?? 0) >= 0.5 ? 'yes' : 'no';
      const response = await fetch(`${apiEndpoint.replace(/\/+$/, "")}/feedback/explicit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, sessionId, answer, comment: feedback.comment }),
      });
      if (!response.ok) return { success: false };
      const result = await response.json();
      return { success: result && result.success === true };
    },
    [apiEndpoint, userId, sessionId]
  );

  const handleSettingsFeedback = useCallback(
    async (sentiment: 'positive' | 'negative' | 'neutral', comment?: string) => {
      // Dequeue the current prompt
      const currentDiff = pendingDiffs[0];
      setPendingDiffs(prev => prev.slice(1));

      if (!apiEndpoint || !userId || !currentDiff) return;

      if (sentiment === 'negative' && currentDiff.oldVal !== undefined) {
         const revertedSettings = { ...latestSettings, [currentDiff.key]: currentDiff.oldVal };
         handleSettingsUpdate(revertedSettings, 'revert');
         try {
            await fetch(`${apiEndpoint}/api/users/${userId}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: { [currentDiff.key]: currentDiff.oldVal }, source: 'user_revert' })
            });
         } catch (e) {}
      }

      if (sentiment === 'positive' && latestSettings) {
          try {
              await fetch(`${apiEndpoint}/api/users/${userId}/settings`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ settings: { [currentDiff.key]: currentDiff.newVal }, source: 'ml_suggestion_accepted' })
             });
          } catch (e) {}
      }
    },
    [apiEndpoint, userId, latestSettings, pendingDiffs, handleSettingsUpdate]
  );

  const openComponentFeedback = useCallback((componentId: string, type: ComponentFeedbackType, currentProps: any) => {
    setActiveFeedbackComponent({ id: componentId, type, props: currentProps });
  }, []);

  const handleComponentFeedbackSubmit = useCallback(async (data: { issue: string; severity: number; comment?: string }) => {
    if (!activeFeedbackComponent || !apiEndpoint || !userId) return;
    try {
      const payload = {
        userId, 
        componentId: activeFeedbackComponent.id, 
        componentType: activeFeedbackComponent.type,
        issue: data.issue, 
        severity: data.severity, 
        comment: data.comment,
        context: { 
          currentProfile: profile, 
          componentProps: activeFeedbackComponent.props, 
          timestamp: new Date().toISOString() 
        }
      };

      const response = await fetch(`${apiEndpoint.replace(/\/+$/, "")}/api/rl-feedback/component-issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success && result.nextSuggestion) {
          const suggestion = result.nextSuggestion;
          handleSettingsUpdate({ [suggestion.parameter]: suggestion.suggestedValue }, 'ml', suggestion.confidence || 0.85);
          
          // Trigger the ML feedback prompt immediately to see if this suggestion actually fixed their complaint!
          setPendingDiffs([{
             key: suggestion.parameter,
             oldVal: suggestion.currentValue,
             newVal: suggestion.suggestedValue
          }]);
      }
      setActiveFeedbackComponent(null);
    } catch (err) {
      console.error("[AdaptiveProvider] Error submitting component feedback:", err);
    }
  }, [activeFeedbackComponent, apiEndpoint, userId, profile]);

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
        applyEnvelope(env, (v) => setUserId(v), setSource, setProfile, setTokens, handleProfileDiff);
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

      const installed = await bridge.isInstalled();
      setIsExtensionInstalled(installed);

      if (!installed) {
        setIsExtensionLoggedIn(false);
        await loadFallback(setUserId, setSource, setProfile, setTokens);
        return;
      }

      const extUserId = await bridge.getUserId();
      const loggedIn = isLoggedInUserId(extUserId);
      setIsExtensionLoggedIn(loggedIn);

      if (!loggedIn) {
        await loadFallback(setUserId, setSource, setProfile, setTokens);
        return;
      }

      const env = await bridge.getMlEnvelope(extUserId);
      applyEnvelope(env, (v) => setUserId(v), setSource, setProfile, setTokens, handleProfileDiff);
    } catch (err) {
      console.error("[AURA] Extension path failed", err);
      setError("Failed to load personalization from extension");
      setIsExtensionLoggedIn(false);
      await loadFallback(setUserId, setSource, setProfile, setTokens);
    } finally {
      setLoading(false);
    }
  }, []);

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
      if (!d || d.__aura !== true) return;
      if (d.type !== "AURA_EXT_PROFILE_CHANGED") return;

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
    sessionId,
    source,
    profile,
    tokens,
    loading,
    error,
    isExtensionInstalled,
    isExtensionLoggedIn,
    apiEndpoint,
    behaviorTracker,
    submitFeedback,
    openComponentFeedback,

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
    React.createElement(React.Fragment, null, 
      extensionPrompt, 
      pendingDiffs.length > 0 ? React.createElement(MLFeedbackPrompt, {
          key: pendingDiffs[0].key, // Forces component to remount so the auto-hide timer resets
          userId: userId || "guest",
          settingKey: pendingDiffs[0].key,
          oldValue: pendingDiffs[0].oldVal,
          newValue: pendingDiffs[0].newVal,
          mlConfidence: mlConfidence,
          source: settingsSource as 'ml' | 'manual' | 'trial',
          apiEndpoint: apiEndpoint || "",
          onFeedback: handleSettingsFeedback
      }) : null,
      activeFeedbackComponent && React.createElement(ComponentFeedbackModal, {
          componentId: activeFeedbackComponent.id,
          componentType: activeFeedbackComponent.type,
          currentProps: activeFeedbackComponent.props,
          onClose: () => setActiveFeedbackComponent(null),
          onSubmit: handleComponentFeedbackSubmit
      }),
      React.createElement(AdaptiveTempUserPrompt, {
          userId: userId || initialUserId || "guest",
          apiEndpoint: apiEndpoint || "",
          tracker: behaviorTracker,
          enabled: enableBehaviorTracking,
      }),
      enableBehaviorTracking && React.createElement(AdaptiveFeedback, null),
      children
    )
  );
}

export function useAdaptive(): AdaptiveContextValue {
  const ctx = useContext(AdaptiveContext);
  if (!ctx) throw new Error("useAdaptive must be used inside <AdaptiveProvider>");
  return ctx;
}
