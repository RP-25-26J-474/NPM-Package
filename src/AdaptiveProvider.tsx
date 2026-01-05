// src/AdaptiveProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";

import type {
  AdaptiveContextValue,
  AdaptiveProviderProps,
  AdaptiveFeedbackPayload,
  AuraProfile,
  AuraTokens,
  AuraSource,
  AuraMlResponse,
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
import { useSettingsSync } from "./hooks/useSettingsSync";
import { MLFeedbackPrompt } from "./components/MLFeedbackPrompt";
import { ComponentFeedbackModal, type ComponentFeedbackType } from "./components/ComponentFeedbackModal";
// NOTE: AdaptiveSettingsChangePrompt temporarily disabled due to TypeScript build issues
// import { AdaptiveSettingsChangePrompt } from "./components/AdaptiveSettingsChangePrompt";

// --- INITIAL DEFAULT STATES ---
const initialProfile: AuraProfile = CATEGORY_PROFILE_MOCK.profile;
const initialTokens: AuraTokens = deriveTokensFromProfile(initialProfile);

const AdaptiveContext = createContext<AdaptiveContextValue | null>(null);

// ----------------------------
// Future extension bridge (kept for later)
// ----------------------------

type AuraExtensionBridge = {
  isInstalled: () => Promise<boolean>;
  getUserId: () => Promise<string>;
  getMlProfile: (userId: string) => Promise<AuraMlResponse>;
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
        const d = ev && (ev as any).data ? (ev as any).data : null;
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
      return payload?.userId ? String(payload.userId) : "guest";
    },

    getMlProfile: async (_userId: string) => {
      const payload = await request<AuraMlResponse>(
        "AURA_EXT_GET_ML_PROFILE",
        "AURA_EXT_ML_PROFILE"
      );
      return payload;
    },
  };
}

// ----------------------------
// Helper: apply ML json to state
// ----------------------------

function applyMlJson(
  mlJson: AuraMlResponse,
  setUserId: (v: string) => void,
  setSource: (v: AuraSource) => void,
  setProfile: (v: AuraProfile) => void,
  setTokens: (v: AuraTokens) => void
) {
  setUserId(mlJson.user_id);
  setSource(mlJson.metadata.origin);
  setProfile(mlJson.profile);
  setTokens(deriveTokensFromProfile(mlJson.profile));
}

// --- PROVIDER COMPONENT ---

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
  const [profile, setProfile] = useState<AuraProfile | null>(initialProfile);
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

  // prevent double-handling messages
  const lastAppliedSessionRef = useRef<string>("");

  // -------------------------
  // OLD SIMULATION PATH
  // -------------------------
  const loadProfile = useCallback(
    async (uid?: string) => {
      const effectiveUserId = uid ?? initialUserId ?? "guest";

      try {
        setLoading(true);
        setError(undefined);

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
        console.error("[AURA] Failed to load personalization", err);
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

      const installed = await bridge.isInstalled();
      setIsExtensionInstalled(installed);

      if (!installed) {
        // No extension → category guest for now
        await loadProfile("guest");
        return;
      }

      const extUserId = await bridge.getUserId();
      const mlJson = await bridge.getMlProfile(extUserId);

      applyMlJson(mlJson, setUserId as any, setSource, setProfile as any, setTokens);
    } catch (err) {
      console.error("[AURA] Extension path failed, falling back to guest", err);
      setError("Failed to load personalization from extension");
      await loadProfile("guest");
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  // -------------------------
  // ✅ NEW: Live updates listener (push)
  // -------------------------
  useEffect(() => {
    if (simulateExtensionInstalled) return; // in simulation, extension not driving changes

    function onMessage(ev: MessageEvent) {
      const d: any = ev && (ev as any).data ? (ev as any).data : null;
      if (!d || d.__aura !== true) return;

      // Extension broadcasts this when user switches
      if (d.type === "AURA_EXT_PROFILE_CHANGED") {
        const mlJson = d.payload as AuraMlResponse;
        if (!mlJson || !mlJson.profile || !mlJson.metadata) return;

        // avoid applying same update twice
        const sessionKey = String(mlJson.session_id || "");
        if (sessionKey && lastAppliedSessionRef.current === sessionKey) return;
        lastAppliedSessionRef.current = sessionKey;

        applyMlJson(mlJson, setUserId as any, setSource, setProfile as any, setTokens);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [simulateExtensionInstalled]);

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
    // KEEP OLD SIMULATION WORKING
    if (simulateExtensionInstalled) {
      setIsExtensionInstalled(true);
      const mockUserId = initialUserId ?? "u_001";
      loadProfile(mockUserId);
      return;
    }

    // REAL extension mode
    loadFromExtension();
  }, [simulateExtensionInstalled, initialUserId, loadProfile, loadFromExtension]);

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
        await loadProfile(userId);
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
    })
  );
}

// --- HOOK ---
export function useAdaptive(): AdaptiveContextValue {
  const ctx = useContext(AdaptiveContext);
  if (!ctx) {
    throw new Error("useAdaptive must be used inside <AdaptiveProvider>");
  }
  return ctx;
}
