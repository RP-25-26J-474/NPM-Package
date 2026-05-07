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
import { loadAdaptiveProfileFromExtension, saveAdaptiveProfileToExtension } from "./extensionBridge";

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
import { DEFAULT_AURA_API_ENDPOINT, DEFAULT_AURA_RL_ENDPOINT } from "./endpoints";
import { AdaptiveRevert } from './components/AdaptiveRevert';
import { BehaviorTracker, BehaviorTrackerConfig } from "./BehaviorTracker";
import { useTrialManager } from "./hooks/useTrialManager";
import { DirectionalFeedbackPrompt } from "./components/DirectionalFeedbackPrompt";
import { AdaptiveTempUserPrompt } from "./components/AdaptiveTempUserPrompt";
import { AdaptiveFeedback } from './components/AdaptiveFeedback';
import { useSettingsSync } from "./hooks/useSettingsSync";
import { useUserSettingsStore } from "./hooks/useUserSettingsStore";
import { MLFeedbackPrompt } from "./components/MLFeedbackPrompt";
import { ComponentFeedbackModal, type ComponentFeedbackType } from "./components/ComponentFeedbackModal";
import { ExtensionInstallPromptBanner } from "./components/ExtensionInstallPromptBanner";

const initialProfile: AuraProfileV2 = DEFAULT_GUEST_PROFILE;
const initialTokens: AuraTokens = deriveTokensFromProfile(initialProfile);

const AdaptiveContext = createContext<AdaptiveContextValue | null>(null);

const DEFAULT_EXTENSION_PROMPT_MESSAGE =
  "Install the AURA extension for a more personalized UI adaptation experience.";
const DEFAULT_EXTENSION_PROMPT_CTA = "Get AURA Extension";
const DEFAULT_EXTENSION_PROMPT_CTA_HREF =
  "https://chromewebstore.google.com/detail/aura/likelgppeaoiocgebdepjbfmpnfncfan";
const DEFAULT_EXTENSION_PROMPT_DISMISS_LABEL = "Not now";
const DEFAULT_EXTENSION_PROMPT_STORAGE_KEY = "__aura_ext_prompt_seen_v1";

// ── Anomaly ↔ profile-attribute correlation ───────────────────────────────
// Maps each behaviour anomaly type to the profile knobs most likely responsible
// for the user's frustration.  Keys match ProfileKnobs / AuraProfileV2 field names.
const ANOMALY_PROFILE_KEYS: Record<string, string[]> = {
  rage_click:    ['target_size', 'font_size', 'element_padding_x', 'element_padding_y', 'layout_simplification'],
  dead_click:    ['target_size', 'layout_simplification', 'tooltip_assist', 'font_size'],
  scroll_thrash: ['element_spacing_y', 'element_spacing_x', 'layout_simplification', 'line_height'],
};

/**
 * Given a list of pending profile diffs and the anomaly context, returns the
 * index of the diff whose key is most likely related to the behaviour issue.
 * Falls back to index 0 if no specific match is found.
 */
function pickRelevantDiff(
  diffs:       { key: string; oldVal: any; newVal: any }[],
  anomalyType: string,
  tagName:     string,
  componentId: string,
): number {
  if (diffs.length === 0) return 0;

  // Boost specific key priorities based on element type
  const isTextEl =
    ['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label'].includes(tagName) ||
    /text|label|heading/i.test(componentId);
  const isLinkEl = tagName === 'a' || /link/i.test(componentId);

  const priority: string[] = isTextEl
    ? ['font_size', 'line_height', 'contrast_mode', ...(ANOMALY_PROFILE_KEYS[anomalyType] ?? [])]
    : isLinkEl
    ? ['primary_color', 'contrast_mode', 'font_size', ...(ANOMALY_PROFILE_KEYS[anomalyType] ?? [])]
    : (ANOMALY_PROFILE_KEYS[anomalyType] ?? []);

  if (priority.length === 0) return 0;

  // Walk priority list, return first index that matches a pending diff key
  for (const key of priority) {
    const idx = diffs.findIndex(d => d.key === key);
    if (idx >= 0) return idx;
  }
  return 0;
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
  apiEndpoint = DEFAULT_AURA_API_ENDPOINT,
  enableBehaviorTracking = true,
  debugMode = false,
  showExtensionPrompt = true,
  extensionPromptMessage = DEFAULT_EXTENSION_PROMPT_MESSAGE,
  extensionPromptCtaLabel = DEFAULT_EXTENSION_PROMPT_CTA,
  extensionPromptCtaHref = DEFAULT_EXTENSION_PROMPT_CTA_HREF,
  onExtensionPromptCtaClick,
  extensionPromptStyle,
  extensionPromptMessageStyle,
  extensionPromptCtaStyle,
  extensionPromptDismissLabel = DEFAULT_EXTENSION_PROMPT_DISMISS_LABEL,
  extensionPromptDismissStyle,
  extensionPromptStorageKey = DEFAULT_EXTENSION_PROMPT_STORAGE_KEY,
  onExtensionPromptDismiss,
  rlEndpoint = DEFAULT_AURA_RL_ENDPOINT,
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

  // Used to persist settings to localStorage from within handleSettingsUpdate
  // (storeUpdateSettings is set after useUserSettingsStore is called below)
  const storeUpdateRef = useRef<((patch: any, src?: string) => void) | null>(null);

  useEffect(() => {
    if (enableBehaviorTracking) {
      const effectiveUserId = (isLoggedInUserId(userId) ? userId : isLoggedInUserId(initialUserId) ? initialUserId : userId) || 'guest';
      const tracker = new BehaviorTracker({
        apiEndpoint: apiEndpoint || '',
        userId: effectiveUserId,
        uiVariant: 'baseline',
        debugMode: debugMode
      });
      setBehaviorTracker(tracker);

      return () => {
        tracker.destroy();
      };
    }
  }, [enableBehaviorTracking, apiEndpoint, initialUserId, debugMode]);

  // Keep tracker userId in sync when the resolved userId changes (e.g. after extension login)
  useEffect(() => {
    if (behaviorTracker && userId && isLoggedInUserId(userId)) {
      behaviorTracker.updateUserId(userId);
    }
  }, [behaviorTracker, userId]);

  const lastAppliedProfileLogRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading || !profile) return;

    const appliedProfilePayload = {
      userId: userId || "guest",
      source,
      profile,
    };
    const snapshot = JSON.stringify(appliedProfilePayload);

    if (lastAppliedProfileLogRef.current === snapshot) return;
    lastAppliedProfileLogRef.current = snapshot;

    console.info(
      "[AURA] Applied UI profile\n" +
        JSON.stringify(appliedProfilePayload, null, 2)
    );
  }, [loading, profile, source, userId]);

  const [pendingDiffs, setPendingDiffs] = useState<{key: string; oldVal: any; newVal: any; anomalyType?: string; componentId?: string}[]>([]);
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
     // Guest users should not receive anomaly-driven ML suggestions
     if (!(isLoggedInUserId(userId) || isLoggedInUserId(initialUserId))) return;

     const handleAnomaly = (e: any) => {
        // Extract context from the anomaly event fired by BehaviorTracker
        const anomalyType: string = (e as CustomEvent)?.detail?.type ?? '';
        const detail      = (e as CustomEvent)?.detail?.data ?? {};
        const componentId: string = detail.componentId ?? '';
        const tagName:     string = (detail.targetMetadata?.tagName ?? '').toLowerCase();

        setMlChangedSettings(prev => {
            if (prev.length === 0) return prev;           // No queued profile changes → nothing to ask
            if (pendingDiffsRef.current.length > 0) return prev; // Already showing a prompt

            // Pick the diff whose attribute is most relevant to the behaviour issue
            const idx     = pickRelevantDiff(prev, anomalyType, tagName, componentId);
            const selected = prev[idx];
            const rest     = prev.filter((_, i) => i !== idx);

            // Tag the selected diff with anomaly context so the prompt can tailor its message
            setPendingDiffs([{ ...selected, anomalyType: anomalyType || undefined, componentId: componentId || undefined }]);
            return rest;
        });
     };

     window.addEventListener('aura-anomaly', handleAnomaly);
     return () => window.removeEventListener('aura-anomaly', handleAnomaly);
  }, [userId, initialUserId]);

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

  const extensionInstalledRef = useRef(isExtensionInstalled);
  useEffect(() => {
    extensionInstalledRef.current = isExtensionInstalled;
  }, [isExtensionInstalled]);

  const userIdRef = useRef(userId || initialUserId);
  useEffect(() => {
    userIdRef.current = userId || initialUserId;
  }, [userId, initialUserId]);

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
    // Block RL/ML/SSE-driven UI changes for guest users
    const isGuest = !isLoggedInUserId(userIdRef.current);
    if (isGuest && source !== 'user' && source !== 'revert') return;

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
    const rawTargetSize = settings.targetSize ?? settings.target_size;
    if (rawTargetSize !== undefined) {
      if (typeof rawTargetSize === 'number') targetSizeValue = rawTargetSize;
      else if (typeof rawTargetSize === 'string') {
        const parsed = parseInt(rawTargetSize, 10);
        targetSizeValue = isNaN(parsed) ? targetSizeValue : parsed;
      }
    }
    
    // Accept both camelCase (from local feedback) and snake_case (from SSE/server payloads)
    const updatedProfile: AuraProfileV2 = {
      font_size: settings.fontSize || settings.font_size || currentProfile?.font_size || 16,
      line_height: settings.lineHeight || settings.line_height || currentProfile?.line_height || 1.5,
      contrast_mode: settings.contrast || settings.contrast_mode || currentProfile?.contrast_mode || 'normal',
      primary_color: settings.primaryColor || settings.primary_color || currentProfile?.primary_color || '#007bff',
      primary_color_content: settings.primary_color_content || currentProfile?.primary_color_content || '#ffffff',
      secondary_color: settings.secondaryColor || settings.secondary_color || currentProfile?.secondary_color || '#6c757d',
      secondary_color_content: settings.secondary_color_content || currentProfile?.secondary_color_content || '#ffffff',
      accent_color: settings.accentColor || settings.accent_color || currentProfile?.accent_color || '#28a745',
      accent_color_content: settings.accent_color_content || currentProfile?.accent_color_content || '#ffffff',
      theme: settings.theme || currentProfile?.theme || 'light',
      reduced_motion: settings.reducedMotion ?? settings.reduced_motion ?? currentProfile?.reduced_motion ?? false,
      element_spacing_x: settings.spacing || settings.element_spacing_x || settings.element_spacing || currentProfile?.element_spacing_x || 10,
      element_spacing_y: settings.spacing || settings.element_spacing_y || settings.element_spacing || currentProfile?.element_spacing_y || 10,
      element_padding_x: settings.element_padding_x || currentProfile?.element_padding_x || 12,
      element_padding_y: settings.element_padding_y || currentProfile?.element_padding_y || 12,
      target_size: targetSizeValue,
      tooltip_assist: settings.tooltipAssist ?? settings.tooltip_assist ?? currentProfile?.tooltip_assist ?? false,
      layout_simplification: settings.layoutSimplification ?? settings.layout_simplification ?? currentProfile?.layout_simplification ?? false,
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

    const isHydrationSource =
      source === 'extension' ||
      source === 'dashboard' ||
      source === 'localstorage';

    // Persist user/ML updates to localStorage and POST to server.
    // Skip hydration sources; they are reads from existing state and should
    // not create new settings history rows on refresh.
    // Skip when source is 'sse:...' (update arrived from SSE) to prevent echo loop.
    // Skip when source is 'temp_reset' — session-only change, never written to DB.
    if (
      storeUpdateRef.current &&
      !isHydrationSource &&
      source !== 'revert' &&
      source !== 'temp_reset' &&
      !source.startsWith('sse:')
    ) {
      storeUpdateRef.current(updatedProfile, source);
    }

    // Push updated profile back to extension storage so it persists across refresh.
    // Skip for temp_reset — the extension profile should remain unchanged.
    if (extensionInstalledRef.current && isLoggedInUserId(userIdRef.current) && source !== 'temp_reset') {
      saveAdaptiveProfileToExtension(updatedProfile, userIdRef.current!);
    }
  }, [isSignificantDeviation]);

  // Handle Diff from Extension/Backend Profile Load
  const handleProfileDiff = useCallback((diff: any) => {
      if (!diff || !diff.changed || diff.changed.length === 0) return;
      // Guest users should not receive profile diffs from ML
      if (!isLoggedInUserId(userIdRef.current)) return;
      
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
    userId: (isLoggedInUserId(userId) ? userId : initialUserId) || 'guest',
    apiEndpoint: apiEndpoint || '',
    enabled: !!apiEndpoint && (isLoggedInUserId(userId) || isLoggedInUserId(initialUserId)),
    // Prefix source with 'sse:' so handleSettingsUpdate skips the server re-POST
    onSettingsUpdate: (settings, sseSource) => handleSettingsUpdate(settings, `sse:${sseSource || 'unknown'}`),
    onConnect: () => {},
    onError: () => {},
  });

  // ── Settings persistence + EOD ML sync ────────────────────────────────────
  // useUserSettingsStore bridges: extension → localStorage → server → ML engine
  const { updateSettings: storeUpdateSettings, triggerEodSync } = useUserSettingsStore({
    userId: userId || initialUserId || 'guest',
    apiEndpoint: apiEndpoint || '',
    onSettingsLoaded: (profile, src) => {
      // When the store hydrates from extension / cache, apply to UI if we
      // haven't already received a profile from the extension bridge.
      if (src === 'extension' || src === 'dashboard') {
        handleSettingsUpdate(profile, src);
      }
    },
    onSettingsUpdated: (_profile, _src) => {
      // Settings were persisted to localStorage and POSTed to server.
      // The SSE stream will propagate the change to other open tabs.
    },
    onEodSyncComplete: ({ sent }) => {
      console.log(`[AURA EOD] ✅ ${sent} setting change(s) sent to ML engine.`);
    },
  });
  // Keep ref in sync so handleSettingsUpdate can call storeUpdateSettings
  useEffect(() => {
    storeUpdateRef.current = (patch: any, src?: string) => {
      storeUpdateSettings(patch as any, src as any);
    };
  }, [storeUpdateSettings]);
  const submitFeedback = useCallback(
    async (feedback: AdaptiveFeedbackPayload): Promise<{ success: boolean }> => {
      // Guest users cannot submit feedback
      if (!isLoggedInUserId(userId)) return { success: false };
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
            await fetch(`${apiEndpoint}/settings/${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: { [currentDiff.key]: currentDiff.oldVal }, source: 'user_revert' })
            });
         } catch (e) {}
      }

      if (sentiment === 'positive' && latestSettings) {
          try {
              await fetch(`${apiEndpoint}/settings/${userId}`, {
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
    // Guest users cannot submit component feedback
    if (!(isLoggedInUserId(userId) || isLoggedInUserId(initialUserId))) return;
    setActiveFeedbackComponent({ id: componentId, type, props: currentProps });
  }, [userId, initialUserId]);

  const handleComponentFeedbackSubmit = useCallback(async (data: { issue: string; severity: number; comment?: string }) => {
    if (!activeFeedbackComponent) return;
    // Guest users cannot submit component feedback
    if (!(isLoggedInUserId(userId) || isLoggedInUserId(initialUserId))) return;

    // ── Local suggestion map (works 100% offline) ─────────────────────────
    // Keys MUST match what handleSettingsUpdate reads (camelCase)
    const buildLocalComponentSuggestion = (issue: string, compType: ComponentFeedbackType) => {
      const cur = profileRef.current;
      switch (issue) {
        case 'too_small':
          return compType === 'text'
            ? { parameter: 'fontSize',   suggestedValue: Math.min(22, (cur?.font_size ?? 16) + 2),   currentValue: cur?.font_size }
            : { parameter: 'targetSize', suggestedValue: Math.min(56, (cur?.target_size ?? 44) + 8), currentValue: cur?.target_size };
        case 'too_large':
          return compType === 'text'
            ? { parameter: 'fontSize',   suggestedValue: Math.max(12, (cur?.font_size ?? 16) - 2),   currentValue: cur?.font_size }
            : { parameter: 'targetSize', suggestedValue: Math.max(32, (cur?.target_size ?? 44) - 8), currentValue: cur?.target_size };
        case 'hard_to_read':
          return { parameter: 'fontSize',        suggestedValue: Math.min(22, (cur?.font_size ?? 16) + 2), currentValue: cur?.font_size };
        case 'bad_contrast':
          return { parameter: 'contrast',        suggestedValue: 'high',  currentValue: cur?.contrast_mode };
        case 'line_height':
          return { parameter: 'lineHeight',      suggestedValue: Math.min(2.0, (cur?.line_height ?? 1.5) + 0.2), currentValue: cur?.line_height };
        case 'layout':
          return { parameter: 'spacing',         suggestedValue: Math.min(24, (cur?.element_spacing_y ?? 12) + 4), currentValue: cur?.element_spacing_y };
        case 'wrong_color':
          return { parameter: 'contrast',        suggestedValue: 'high',  currentValue: cur?.contrast_mode };
        default:
          return null;
      }
    };

    const applySuggestion = (suggestion: { parameter: string; suggestedValue: any; currentValue?: any } | null) => {
      if (!suggestion) return;
      handleSettingsUpdate({ [suggestion.parameter]: suggestion.suggestedValue }, 'ml', 0.8);
      setPendingDiffs([{ key: suggestion.parameter, oldVal: suggestion.currentValue, newVal: suggestion.suggestedValue }]);
    };

    // ── Try server first; fall back to local suggestion on any error ───────
    if (apiEndpoint && (userId || initialUserId)) {
      try {
        const effectiveId = isLoggedInUserId(userId) ? userId : initialUserId;
        const payload = {
          userId: effectiveId,
          componentId: activeFeedbackComponent.id,
          componentType: activeFeedbackComponent.type,
          issue: data.issue,
          severity: data.severity,
          comment: data.comment,
          context: { currentProfile: profile, componentProps: activeFeedbackComponent.props, timestamp: new Date().toISOString() }
        };

        const response = await fetch(`${apiEndpoint.replace(/\/+$/, "")}/rl-feedback/component-issue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.success && result.nextSuggestion) {
          applySuggestion(result.nextSuggestion);
        } else {
          applySuggestion(buildLocalComponentSuggestion(data.issue, activeFeedbackComponent.type));
        }
      } catch (err) {
        console.warn("[AdaptiveProvider] Component feedback server unreachable – applying local suggestion.");
        applySuggestion(buildLocalComponentSuggestion(data.issue, activeFeedbackComponent.type));
      }
    } else {
      // No server configured – apply locally immediately
      applySuggestion(buildLocalComponentSuggestion(data.issue, activeFeedbackComponent.type));
    }

    setActiveFeedbackComponent(null);
  }, [activeFeedbackComponent, apiEndpoint, userId, profile, handleSettingsUpdate]);

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
    try {
      setLoading(true);
      setError(undefined);
      setIsExtensionLoggedIn(undefined);

      const result = await loadAdaptiveProfileFromExtension(initialUserId);
      setIsExtensionInstalled(result.installed);
      setIsExtensionLoggedIn(result.loggedIn);

      // Use the real userId from the extension PONG when available
      const effectiveUserId = result.extensionUserId || initialUserId || "guest";

      if (!result.installed || !result.loggedIn || !result.envelope) {
        if (result.installed && result.loggedIn) {
          // Extension installed & user logged in but no stored profile yet.
          // Try fetching from the Optimization Engine API as fallback.
          setUserId(effectiveUserId);
          try {
            const env = await mockFetchAuraEnvelope(effectiveUserId, rlEndpoint || undefined);
            applyEnvelope(env, (v) => setUserId(v), setSource, setProfile, setTokens, handleProfileDiff);
            // Save the fetched profile to extension storage for next refresh
            if (env?.profile?.profile) {
              saveAdaptiveProfileToExtension(env.profile.profile, effectiveUserId);
            }
          } catch {
            // API unavailable – use local fallback defaults
            const cached = readFallbackCache();
            const pred = cached ?? predictFallbackTokens();
            if (!cached) writeFallbackCache(pred);
            const fullProfile = buildFallbackProfileFromPredictions(pred);
            setSource("fallback");
            setProfile(fullProfile);
            setTokens(deriveTokensFromProfile(fullProfile));
          }
        } else {
          await loadFallback(setUserId, setSource, setProfile, setTokens);
          // If the host app passed a valid logged-in userId, preserve it so
          // feedback and personalisation features remain unlocked even when
          // the extension is absent or the user isn't logged into it.
          if (isLoggedInUserId(initialUserId)) {
            setUserId(initialUserId!);
          }
        }
        return;
      }

      applyEnvelope(
        result.envelope,
        (v) => setUserId(v),
        setSource,
        setProfile,
        setTokens,
        handleProfileDiff
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
    
      const isExpectedExtensionMiss =
        message === "Extension response timeout" ||
        message === "No window";
    
      // Missing extension 
      if (debugMode) {
        if (isExpectedExtensionMiss) {
          console.info("[AURA] Extension not available. Using fallback profile.");
        } else {
          console.error("[AURA] Unexpected extension bridge failure", err);
        }
      }
      setError(undefined);
      setIsExtensionInstalled(false);
      setIsExtensionLoggedIn(false);
      await loadFallback(setUserId, setSource, setProfile, setTokens);
      // Restore the host app userId so feedback stays unlocked on refresh
      if (isLoggedInUserId(initialUserId)) {
        setUserId(initialUserId!);
      }
    } finally {
      setLoading(false);
    }
  }, [initialUserId, rlEndpoint]);

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

  // Register user with RL service when a real (non-guest) userId is detected
  const rlRegisteredRef = useRef<string | null>(null);
  useEffect(() => {
    const effectiveUserId = isLoggedInUserId(userId) ? userId : initialUserId;
    if (!isLoggedInUserId(effectiveUserId)) return;
    if (!rlEndpoint) return;
    // Only register once per userId
    if (rlRegisteredRef.current === effectiveUserId) return;
    rlRegisteredRef.current = effectiveUserId!;

    const registerUrl = `${rlEndpoint.replace(/\/+$/, "")}/rl/register-user`;
    const currentProfile = profile || initialProfile;

    fetch(registerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: effectiveUserId,
        profile: {
          font_size: currentProfile.font_size,
          line_height: currentProfile.line_height,
          theme: currentProfile.theme,
          contrast_mode: currentProfile.contrast_mode,
          element_spacing_x: currentProfile.element_spacing_x,
          element_spacing_y: currentProfile.element_spacing_y,
          element_padding_x: currentProfile.element_padding_x,
          element_padding_y: currentProfile.element_padding_y,
          target_size: currentProfile.target_size,
          reduced_motion: currentProfile.reduced_motion,
          tooltip_assist: currentProfile.tooltip_assist,
          layout_simplification: currentProfile.layout_simplification,
        },
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          console.log(`[AURA] RL profile registered for ${effectiveUserId}`, data);
        }
      })
      .catch((err) => {
        console.warn("[AURA] Failed to register RL profile:", err);
        // Reset so it retries on next render
        rlRegisteredRef.current = null;
      });
  }, [userId, initialUserId, rlEndpoint, profile]);

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

  const handleExtensionPromptDismiss = useCallback(() => {
    setIsExtensionPromptClosed(true);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(extensionPromptStorageKey, "1");
      } catch {
        // ignore storage errors
      }
    }
    if (onExtensionPromptDismiss) onExtensionPromptDismiss();
  }, [extensionPromptStorageKey, onExtensionPromptDismiss]);

  const extensionPrompt = shouldShowExtensionPrompt
    ? React.createElement(ExtensionInstallPromptBanner, {
        tokens,
        message: extensionPromptMessage,
        ctaLabel: extensionPromptCtaLabel,
        ctaHref: extensionPromptCtaHref,
        onCtaClick: onExtensionPromptCtaClick,
        onDismiss: handleExtensionPromptDismiss,
        dismissLabel: extensionPromptDismissLabel,
        containerStyle: extensionPromptStyle,
        messageStyle: extensionPromptMessageStyle,
        ctaStyle: extensionPromptCtaStyle,
        dismissStyle: extensionPromptDismissStyle,
      })
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
    rlEndpoint,
    behaviorTracker,
    submitFeedback,
    openComponentFeedback,
    applySettings: (settings: Record<string, any>, src = 'user') => handleSettingsUpdate(settings, src),

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
      (isLoggedInUserId(userId) || isLoggedInUserId(initialUserId)) && pendingDiffs.length > 0 ? React.createElement(MLFeedbackPrompt, {
          key: pendingDiffs[0].key, // Forces component to remount so the auto-hide timer resets
          userId: (isLoggedInUserId(userId) ? userId : initialUserId) || "guest",
          settingKey: pendingDiffs[0].key,
          oldValue: pendingDiffs[0].oldVal,
          newValue: pendingDiffs[0].newVal,
          mlConfidence: mlConfidence,
          source: settingsSource as 'ml' | 'manual' | 'trial',
          apiEndpoint: apiEndpoint || "",
          onFeedback: handleSettingsFeedback,
          // Pass the behaviour context so the prompt can show a relevant message
          anomalyContext: pendingDiffs[0].anomalyType
            ? { type: pendingDiffs[0].anomalyType, componentId: pendingDiffs[0].componentId }
            : undefined,
      }) : null,
      (isLoggedInUserId(userId) || isLoggedInUserId(initialUserId)) && activeFeedbackComponent && React.createElement(ComponentFeedbackModal, {
          componentId: activeFeedbackComponent.id,
          componentType: activeFeedbackComponent.type,
          currentProps: activeFeedbackComponent.props,
          onClose: () => setActiveFeedbackComponent(null),
          onSubmit: handleComponentFeedbackSubmit
      }),
      (isLoggedInUserId(userId) || isLoggedInUserId(initialUserId)) && React.createElement(AdaptiveTempUserPrompt, {
          userId: (isLoggedInUserId(userId) ? userId : initialUserId) || "guest",
          apiEndpoint: apiEndpoint || "",
          tracker: behaviorTracker,
          enabled: enableBehaviorTracking,
          onResetConfirmed: () => {
            // Apply the default (guest) profile for this session only.
            // 'temp_reset' source skips localStorage / server / extension persistence.
            handleSettingsUpdate({
              fontSize:    initialProfile.font_size,
              lineHeight:  initialProfile.line_height,
              contrast:    initialProfile.contrast_mode,
              theme:       initialProfile.theme,
              targetSize:  initialProfile.target_size,
              spacing:     initialProfile.element_spacing_y,
              reducedMotion:       initialProfile.reduced_motion,
              tooltipAssist:       initialProfile.tooltip_assist,
              layoutSimplification: initialProfile.layout_simplification,
            }, 'temp_reset');
          },
      }),
      (isLoggedInUserId(userId) || isLoggedInUserId(initialUserId)) && enableBehaviorTracking && React.createElement(AdaptiveFeedback, null),
      children
    )
  );
}

export function useAdaptive(): AdaptiveContextValue {
  const ctx = useContext(AdaptiveContext);
  if (!ctx) throw new Error("useAdaptive must be used inside <AdaptiveProvider>");
  return ctx;
}


