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
  AdaptiveFeedbackPayload,
  AuraProfile,
  AuraProfileV2,
  AuraTokens,
  AuraSource,
  AuraMlEnvelopeV2,
} from "./types";

import {
  CATEGORY_PROFILE_MOCK,
  deriveTokensFromProfile,
  fetchAuraProfile,
  mockFetchAuraProfile,
} from "./utils";

import { BehaviorTracker } from "./BehaviorTracker";
import { useTrialManager } from "./hooks/useTrialManager";
import { DirectionalFeedbackPrompt } from "./components/DirectionalFeedbackPrompt";
import { AdaptiveTempUserPrompt } from "./components/AdaptiveTempUserPrompt";
import { useSettingsSync } from "./hooks/useSettingsSync";
import { MLFeedbackPrompt } from "./components/MLFeedbackPrompt";
import { ComponentFeedbackModal, type ComponentFeedbackType } from "./components/ComponentFeedbackModal";
// NOTE: AdaptiveSettingsChangePrompt temporarily disabled due to TypeScript build issues
// import { AdaptiveSettingsChangePrompt } from "./components/AdaptiveSettingsChangePrompt";

// --- INITIAL DEFAULT STATES ---
const initialProfile: AuraProfile = CATEGORY_PROFILE_MOCK.profile;
import { deriveTokensFromProfile, mockFetchAuraEnvelope, DEFAULT_GUEST_PROFILE } from "./utils";

// const initialProfile: AuraProfileV2 = DEFAULT_GUEST_PROFILE;
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
  simulateExtensionInstalled = true,
  apiEndpoint,
  enableBehaviorTracking = true,
  mode = "standard", // NEW: "standard" | "trial-based"
  debugMode = false,
}: AdaptiveProviderProps & { mode?: "standard" | "trial-based" }) {
  const [userId, setUserId] = useState<string | undefined>(initialUserId);
  const [profile, setProfile] = useState<AuraProfileV2 | null>(initialProfile);
  const [tokens, setTokens] = useState<AuraTokens>(initialTokens);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>();
  const [source, setSource] = useState<AuraSource>("category");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [isExtensionInstalled, setIsExtensionInstalled] =
    useState<boolean>(false);
  const [behaviorTracker, setBehaviorTracker] = useState<BehaviorTracker | null>(null);

  // NEW: Settings change feedback state
  const [showSettingsPrompt, setShowSettingsPrompt] = useState(false);
  const [latestSettings, setLatestSettings] = useState<any>(null);
  const [settingsSource, setSettingsSource] = useState<'manual' | 'ml' | 'trial'>('manual');
  const [mlConfidence, setMlConfidence] = useState<number>(0.5);
  const [changedSettingKey, setChangedSettingKey] = useState<string>('');
  const [settingOldValue, setSettingOldValue] = useState<any>(null);

  // Active Component Feedback State
  const [activeFeedbackComponent, setActiveFeedbackComponent] = useState<{
    id: string;
    type: ComponentFeedbackType;
    props: any;
  } | null>(null);

  // NEW: Trial manager for trial-based mode
  const {
    activeTrial,
    showPrompt,
    trialSettings,
    handleFeedback: handleTrialFeedback,
  } = useTrialManager(initialUserId || "guest", apiEndpoint || "", mode);

  // NEW: Settings sync for real-time updates from dashboard
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // NEW: Helper to check if settings significantly deviate from default
  const isSignificantDeviation = useCallback((newSettings: any, baseProfile: AuraProfile): boolean => {
    if (!newSettings) return false;

    // Check Theme
    if (newSettings.theme && newSettings.theme !== baseProfile.theme) return true;

    // Check Font Size
    const currentFontSize = newSettings.fontSize || baseProfile.font_size;
    if (currentFontSize !== baseProfile.font_size) return true;

    // Check High Contrast
    const currentContrast = newSettings.contrast || baseProfile.contrast_mode;
    if (currentContrast !== 'normal' && currentContrast !== baseProfile.contrast_mode) return true;

    // Check Target Size (threshold > 4px change)
    let newTargetSize = baseProfile.target_size;
    if (newSettings.targetSize) {
        const val = typeof newSettings.targetSize === 'string' ? parseInt(newSettings.targetSize, 10) : newSettings.targetSize;
        if (!isNaN(val)) newTargetSize = val;
    }
    if (Math.abs(newTargetSize - baseProfile.target_size) > 2) return true;

    // Check Spacing
    const currentSpacing = newSettings.spacing || baseProfile.element_spacing;
    if (currentSpacing !== baseProfile.element_spacing) return true;

    return false;
  }, []);

  const handleSettingsUpdate = useCallback((settings: any, source: string, mlConf?: number) => {
    console.log('[AURA] 📥 Received settings update:', settings, 'source:', source);
    
    const currentProfile = profileRef.current;
    console.log('[AURA] 📋 Current profile:', currentProfile);
    
    // Detect which setting changed the most
    let primaryChangedKey = 'theme';
    let oldVal: any = currentProfile?.theme;
    
    if (settings.theme && settings.theme !== currentProfile?.theme) {
      primaryChangedKey = 'theme';
      oldVal = currentProfile?.theme;
    } else if (settings.fontSize && settings.fontSize !== currentProfile?.font_size) {
      primaryChangedKey = 'fontSize'; // WAS: 'font_size'
      oldVal = currentProfile?.font_size;
    } else if (settings.targetSize && settings.targetSize !== currentProfile?.target_size) {
      primaryChangedKey = 'targetSize'; // WAS: 'target_size'
      oldVal = currentProfile?.target_size;
    }
    
    // Parse targetSize if it's a string (e.g., "28px" -> 28)
    let targetSizeValue = currentProfile?.target_size || 44;
    if (settings.targetSize) {
      if (typeof settings.targetSize === 'number') {
        targetSizeValue = settings.targetSize;
      } else if (typeof settings.targetSize === 'string') {
        const parsed = parseInt(settings.targetSize, 10);
        targetSizeValue = isNaN(parsed) ? targetSizeValue : parsed;
      }
    }
    
    // Map dashboard settings to AuraProfile format
    const updatedProfile: AuraProfile = {
      font_size: settings.fontSize || currentProfile?.font_size || 'medium',
      line_height: settings.lineHeight || currentProfile?.line_height || 1.5,
      contrast_mode: settings.contrast || currentProfile?.contrast_mode || 'normal',
      primary_color: settings.primaryColor || currentProfile?.primary_color || '#007bff',
      secondary_color: settings.secondaryColor || currentProfile?.secondary_color || '#6c757d',
      accent_color: settings.accentColor || currentProfile?.accent_color || '#28a745',
      theme: settings.theme || currentProfile?.theme || 'light',
      reduced_motion: settings.reducedMotion ?? currentProfile?.reduced_motion ?? false,
      element_spacing: settings.spacing || currentProfile?.element_spacing || 'normal',
      target_size: targetSizeValue,
      tooltip_assist: settings.tooltipAssist ?? currentProfile?.tooltip_assist ?? false,
      layout_simplification: settings.layoutSimplification ?? currentProfile?.layout_simplification ?? false,
    };

    console.log('[AURA] 🎨 Applying updated profile:', updatedProfile);
    
    setProfile(updatedProfile);
    const newTokens = deriveTokensFromProfile(updatedProfile);
    setTokens(newTokens);
    setSource('user');
    
    console.log('[AURA] ✅ Tokens updated:', newTokens);
    console.log('[AURA] 🎯 UI should now reflect: theme=%s, fontSize=%s, colors=%s', 
      updatedProfile.theme, updatedProfile.font_size, updatedProfile.primary_color);

    // INJECT CSS VARIABLES FOR REAL-TIME UPDATES
    if (typeof document !== 'undefined') {
        const root = document.documentElement;
        // Colors
        Object.entries(newTokens.colors).forEach(([key, value]) => {
            root.style.setProperty(`--aura-${key}`, value as string);
        });
        // Typography
        root.style.setProperty('--aura-base-size', newTokens.typography.baseSize);
        root.style.setProperty('--aura-line-height', String(newTokens.typography.lineHeight));
        // Spacing
        root.style.setProperty('--aura-spacing-base', `${newTokens.spacing.base}px`);
        // Controls
        root.style.setProperty('--aura-min-target-size', `${newTokens.controls.minTargetSize}px`);
        
        console.log('[AURA] 💉 Injected CSS variables to :root');
    }
    
    // Check for significant deviation
    const isSignificant = isSignificantDeviation(settings, currentProfile || initialProfile);
    console.log(`[AURA] 📏 Significant deviation check: ${isSignificant} (Source: ${source})`);

    // Store for feedback prompt
    setLatestSettings(settings);
    setSettingsSource(source as 'manual' | 'ml' | 'trial');
    setMlConfidence(mlConf || 0.5);
    setChangedSettingKey(primaryChangedKey);
    setSettingOldValue(oldVal);
    
    // Only show prompt if source is ML AND the change is significant
    setShowSettingsPrompt(source === 'ml' && isSignificant);
    
    console.log('[AURA] 💬 Feedback prompt:', (source === 'ml' && isSignificant) ? 'shown' : 'hidden');
  }, [isSignificantDeviation]);

  useSettingsSync({
    userId: userId || initialUserId || 'guest',
    apiEndpoint: apiEndpoint || '',
    enabled: !!apiEndpoint && !!userId,
    onSettingsUpdate: handleSettingsUpdate,
    onConnect: () => {
      console.log('[AURA] 🔌 Connected to settings sync');
      console.log('[AURA] 👤 Monitoring user:', userId || initialUserId || 'guest');
      console.log('[AURA] 🌐 SSE endpoint:', apiEndpoint);
    },
    onError: (error) => console.error('[AURA] ❌ Settings sync error:', error),
  });

  // DEV path: local mocks
  const loadFromMocks = useCallback(
    async (uid?: string) => {
      const effectiveUserId = uid ?? initialUserId ?? "guest";

      try {
        setLoading(true);
        setError(undefined);
        setIsExtensionInstalled(true);

        if (!apiEndpoint) {
          throw new Error("Missing apiEndpoint for personalization request");
        }

        const response = await fetchAuraProfile(apiEndpoint, effectiveUserId);

        setUserId(response.user_id);
        setSessionId(response.session_id);
        setSource(response.metadata.origin);
        setProfile(response.profile);
        setTokens(deriveTokensFromProfile(response.profile));
      } catch (err) {
        console.error("[AURA] Failed to load personalization (mock)", err);
        setError("Failed to load personalization");
        try {
          const fallback = await mockFetchAuraProfile(effectiveUserId);
          setUserId(fallback.user_id);
          setSessionId(fallback.session_id);
          setSource(fallback.metadata.origin);
          setProfile(fallback.profile);
          setTokens(deriveTokensFromProfile(fallback.profile));
        } catch (fallbackError) {
          // Fallback to initial category profile
          setProfile(initialProfile);
          setTokens(initialTokens);
          setSource("fallback");
          setUserId("guest");
        }

      } finally {
        setLoading(false);
      }
    },
    [initialUserId, apiEndpoint]
  );

  // -------------------------
  // REAL EXTENSION PATH (future)
  // -------------------------
  // -------------------------
  // REAL EXTENSION PATH (future)
  // -------------------------
  const loadFromExtension = useCallback(async () => {
    const bridge = createRealExtensionBridge(900);

    try {
      setLoading(true);
      setError(undefined);
      setIsExtensionLoggedIn(undefined);

      const installed = await bridge.isInstalled();
      setIsExtensionInstalled(installed);

      if (!installed) {
        // No extension → category guest for now
        await loadProfile("guest");
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
      applyEnvelope(env, (v) => setUserId(v), setSource, setProfile, setTokens);
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

  const submitFeedback = useCallback(
    async (feedback: AdaptiveFeedbackPayload): Promise<{ success: boolean }> => {
      if (!apiEndpoint) {
        throw new Error("Missing apiEndpoint for feedback");
      }
      if (!userId) {
        throw new Error("Missing userId for feedback");
      }
      if (!sessionId) {
        throw new Error("Missing sessionId for feedback");
      }

      // Map feedback to answer format
      const answer = (feedback.value ?? 0) >= 0.5 ? 'yes' : 'no';

      const response = await fetch(`${apiEndpoint.replace(/\/+$/, "")}/feedback/explicit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          sessionId,
          answer,
          comment: feedback.comment,
        }),
      });

      if (!response.ok) {
        throw new Error(`Feedback request failed (${response.status})`);
      }

      const result = await response.json();
      return { success: result && result.success === true };
    },
    [apiEndpoint, userId, sessionId]
  );

  // NEW: Handle settings change feedback
  const handleSettingsFeedback = useCallback(
    async (sentiment: 'positive' | 'negative' | 'neutral', comment?: string) => {
      // Hide prompt immediately
      setShowSettingsPrompt(false);

      if (!apiEndpoint || !userId) {
        console.warn('[AURA] Cannot submit feedback: missing apiEndpoint or userId');
        return;
      }

      // 1. Handle REVERT if negative
      if (sentiment === 'negative' && changedSettingKey && settingOldValue !== undefined) {
         console.log(`[AURA] 🔙 Reverting ${changedSettingKey} to ${settingOldValue}`);
         
         // A. Local Revert
         const revertedSettings = { ...latestSettings, [changedSettingKey]: settingOldValue };
         
         // Using 'revert' source avoids triggering another prompt
         handleSettingsUpdate(revertedSettings, 'revert');

         // B. Persist Revert to Backend
         try {
            await fetch(`${apiEndpoint}/users/${userId}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settings: { [changedSettingKey]: settingOldValue },
                    source: 'user_revert'
                })
            });
         } catch (e) {
             console.error('[AURA] Failed to save revert:', e);
         }
      }

      // 2. Handle COMMIT if positive (User accepts the change)
      if (sentiment === 'positive' && latestSettings) {
          console.log(`[AURA] 🔒 Committing settings (User liked them)`);
          
          try {
             // We save the ENTIRE latestSettings which is the delta object (e.g. { targetSize: 32 })
             // This avoids key mismatch issues (snake_case vs camelCase)
             const settingsToSave = latestSettings;
 
              // USE MANUAL SETTINGS ENDPOINT TO ENSURE PRECEDENCE
              // This updates both ManualSettings collection and User.currentSettings
              await fetch(`${apiEndpoint}/manual-settings/apply`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     userId,
                     settings: settingsToSave
                 })
             });
            console.log('[AURA] ✅ Settings committed to DB');
          } catch (e) {
             console.error('[AURA] Failed to commit settings:', e);
          }
      }

      try {
        // Convert sentiment to rating
        const ratingMap = { positive: 5, neutral: 3, negative: 1 };
        const rating = ratingMap[sentiment];

        const feedbackPayload = {
          parameter: 'settings_sync',
          currentValue: latestSettings,
          feedback: {
            type: sentiment,
            rating,
            comment: comment || `Settings change ${sentiment}`,
            accepted: sentiment === 'positive',
            responseTime: 0,
            isManualSelection: false,
          },
          context: {
            deviceType: window.innerWidth < 768 ? 'mobile' : 'desktop',
            timeOfDay: new Date().getHours() < 12 ? 'morning' : 'afternoon',
            sessionDuration: 60000,
            interactionCount: 1,
            pageUrl: window.location.href,
            source: 'settings_sync',
          },
          optimization: {
            parameter: 'settings_sync',
            oldValue: 'previous',
            newValue: 'dashboard_update',
            suggestedBy: settingsSource,
          },
        };

        console.log('[AURA] Submitting settings feedback:', feedbackPayload);

        const response = await fetch(`${apiEndpoint}/users/${userId}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feedbackPayload),
        });

        if (response.ok) {
          console.log('[AURA] Settings feedback submitted successfully');
        } else {
          console.error('[AURA] Failed to submit settings feedback:', response.status);
        }
      } catch (error) {
        console.error('[AURA] Error submitting settings feedback:', error);
      }
    },
    [apiEndpoint, userId, latestSettings, settingsSource, changedSettingKey, settingOldValue, handleSettingsUpdate]
  );

  const openComponentFeedback = useCallback((componentId: string, type: ComponentFeedbackType, currentProps: any) => {
    console.log('[AURA] 🟢 Opening feedback for component:', componentId);
    setActiveFeedbackComponent({ id: componentId, type, props: currentProps });
  }, []);

  const handleComponentFeedbackSubmit = useCallback(async (data: { issue: string; severity: number; comment?: string }) => {
    if (!activeFeedbackComponent || !apiEndpoint || !userId) return;

    try {
      console.log('[AURA] 🚀 Submitting component feedback:', data);
      
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

      // Send to backend (using rl-feedback endpoint as generic handler)
      const response = await fetch(`${apiEndpoint}/rl-feedback/component-issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      console.log('[AURA] ✅ Component feedback submitted', result);

      // Check for immediate fix
      if (result.success && result.nextSuggestion) {
          const suggestion = result.nextSuggestion;
          console.log(`[AURA] 🛠️ Applying fix: ${suggestion.parameter} -> ${suggestion.suggestedValue}`);

          // Map RL param to Profile param
           const paramMap: Record<string, string> = {
            'fontSize': 'font_size',
            'targetSize': 'target_size',
            'contrastMode': 'contrast_mode',
            'elementSpacing': 'element_spacing', // Check mapping in utils
            'lineHeight': 'line_height'
          };
          
          const profileKey = paramMap[suggestion.parameter] || suggestion.parameter;

          // Create partial settings object
          // NOTE: We need to use the format expected by `handleSettingsUpdate` (camelCase usually)
          // `handleSettingsUpdate` expects keys like `fontSize`, `targetSize` etc. derived from dashboard.
          // Let's use the raw parameter name if it matches, or map to settings key.
          
          const settingsPayload = {
              [suggestion.parameter]: suggestion.suggestedValue
          };

          // Apply update via our handler
          // PASSING 'ml' AS SOURCE IS CRITICAL TO TRIGGER THE PROMPT
          handleSettingsUpdate(settingsPayload, 'ml', suggestion.confidence);
          
          // Optional: Show a toast? 
          // The MLFeedbackPrompt should appear due to 'ml' source + change detection.
      }

    } catch (err) {
      console.error('[AURA] ❌ Failed to submit component feedback', err);
    }
  }, [activeFeedbackComponent, apiEndpoint, userId, profile]);

  // --- Initialization ---
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

  // --- Initialize Behavior Tracker (Week 1 Implementation) ---
  useEffect(() => {
    if (!enableBehaviorTracking || !apiEndpoint || !userId || loading) {
      return;
    }

    // Initialize tracker
    const tracker = new BehaviorTracker({
      userId,
      uiVariant: source === 'user' ? 'personalized' : 'baseline',
      apiEndpoint,
      personalizationSessionId: sessionId,
      sendInterval: 300000, // 5 minutes
      debugMode,
    });

    setBehaviorTracker(tracker);

    // Store globally for AdaptiveRevert component
    if (typeof window !== 'undefined') {
      (window as any).__behaviorTracker = tracker;
    }

    // Cleanup on unmount
    return () => {
      tracker.destroy();
      if (typeof window !== 'undefined') {
        (window as any).__behaviorTracker = null;
      }
    };
  }, [enableBehaviorTracking, apiEndpoint, userId, sessionId, source, loading, debugMode]);

  const contextValue: AdaptiveContextValue = {
    userId,
    sessionId,
    source,
    profile: profile
      ? {
          ...profile,
          // Merge trial settings if in trial-based mode
          ...(mode === "trial-based" && trialSettings),
        }
      : null,
    tokens,
    loading,
    error,
    isExtensionInstalled,
    behaviorTracker, // Pass the tracker instance
    apiEndpoint,     // Pass the API endpoint
    submitFeedback,

    reload: async () => {
      if (simulateExtensionInstalled) {
        await loadFromMocks(userId);
        return;
      }
      await loadFromExtension();
    },
    openComponentFeedback,
  };

  return React.createElement(
    React.Fragment,
    {},
    React.createElement(
      AdaptiveContext.Provider,
      { value: contextValue },
      children
    ),
    // NEW: Show feedback prompt if needed (trial-based mode)
    mode === "trial-based" &&
      showPrompt &&
      activeTrial &&
      React.createElement(DirectionalFeedbackPrompt, {
        trialId: activeTrial.trialId,
        settingName: activeTrial.settingName,
        oldValue: activeTrial.oldValue,
        newValue: activeTrial.newValue,
        onFeedback: handleTrialFeedback,
        position: "bottom-right",
      }),
    // ML Feedback prompt (when ML engine changes settings)
    showSettingsPrompt &&
      settingsSource === 'ml' &&
      apiEndpoint &&
      React.createElement(MLFeedbackPrompt, {
        userId: userId || 'guest',
        settingKey: changedSettingKey,
        oldValue: settingOldValue,
        newValue: latestSettings?.[changedSettingKey] || latestSettings?.[changedSettingKey.replace('_', '')],
        mlConfidence: mlConfidence,
        source: settingsSource,
        apiEndpoint: apiEndpoint,
        onClose: () => setShowSettingsPrompt(false),
        onFeedback: handleSettingsFeedback,
        position: "bottom-right"
      }),
    
    // Active Component Feedback Modal
    activeFeedbackComponent && React.createElement(ComponentFeedbackModal, {
      componentId: activeFeedbackComponent.id,
      componentType: activeFeedbackComponent.type,
      currentProps: activeFeedbackComponent.props,
      onClose: () => setActiveFeedbackComponent(null),
      onSubmit: handleComponentFeedbackSubmit
    }),

    // Temp User / Bot Protection Prompt
    behaviorTracker && apiEndpoint && userId && React.createElement(AdaptiveTempUserPrompt, {
        userId,
        apiEndpoint,
        tracker: behaviorTracker,
        enabled: true,
        onResetConfirmed: () => {
             console.log('[AURA] 🛡️ Temp user reset confirmed.');
             // Reload or re-fetch profile would happen here
             window.location.reload();
        }
    })
  );
}

export function useAdaptive(): AdaptiveContextValue {
  const ctx = useContext(AdaptiveContext);
  if (!ctx) throw new Error("useAdaptive must be used inside <AdaptiveProvider>");
  return ctx;
}
