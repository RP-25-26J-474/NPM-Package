// src/AdaptiveProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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

// --- INITIAL DEFAULT STATES ---
const initialProfile: AuraProfile = CATEGORY_PROFILE_MOCK.profile;
const initialTokens: AuraTokens = deriveTokensFromProfile(initialProfile);

// Keep context relaxed to avoid Provider JSX type edge cases
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
        const d = ev && ev.data ? ev.data : null;
        if (!d || d.__aura !== true) return;
        if (d.requestId !== requestId) return;
        if (d.type !== responseType) return;

        window.clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(d.payload as T);
      }

      window.addEventListener("message", onMessage);

      window.postMessage(
        { __aura: true, type: requestType, requestId },
        "*"
      );
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

    // Extension should respond with full AuraMlResponse json
    getMlProfile: async (userId: string) => {
      const payload = await request<AuraMlResponse>(
        "AURA_EXT_GET_ML_PROFILE",
        "AURA_EXT_ML_PROFILE"
      );

      // If extension returns profile for a different userId, prefer extension data.
      return payload;
    },
  };
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

  // NEW: Trial manager for trial-based mode
  const {
    activeTrial,
    showPrompt,
    trialSettings,
    handleFeedback: handleTrialFeedback,
  } = useTrialManager(initialUserId || "guest", apiEndpoint || "", mode);

  //  extension simulation 
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

  // real extension path (inactive for now unless simulateExtensionInstalled=false)
  const loadFromExtension = useCallback(
    async () => {
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

        setUserId(mlJson.user_id);
        setSessionId(mlJson.session_id);
        setSource(mlJson.metadata.origin);
        setProfile(mlJson.profile);
        setTokens(deriveTokensFromProfile(mlJson.profile));
      } catch (err) {
        console.error("[AURA] Extension path failed, falling back to guest", err);
        setError("Failed to load personalization from extension");
        await loadProfile("guest");
      } finally {
        setLoading(false);
      }
    },
    [loadProfile]
  );

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

  // --- Initialization ---
  useEffect(() => {
    // KEEP OLD SIMULATION WORKING EXACTLY
    if (simulateExtensionInstalled) {
      setIsExtensionInstalled(true);
      const mockUserId = initialUserId ?? "u_001";
      loadProfile(mockUserId);
      return;
    }

    //  FUTURE path: real extension
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
    submitFeedback,

    // must return Promise<void> (your types.ts expects Promise)
    reload: async () => {
      if (simulateExtensionInstalled) {
        await loadProfile(userId);
        return;
      }
      await loadFromExtension();
    },
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
