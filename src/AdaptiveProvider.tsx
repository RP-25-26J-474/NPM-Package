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
  AuraProfile,
  AuraTokens,
  AuraSource,
  AuraMlResponse, 
} from "./types";

import {
  CATEGORY_PROFILE_MOCK,
  deriveTokensFromProfile,
  mockFetchAuraProfile,
} from "./utils";

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
}: AdaptiveProviderProps) {
  const [userId, setUserId] = useState<string | undefined>(initialUserId);
  const [profile, setProfile] = useState<AuraProfile | null>(initialProfile);
  const [tokens, setTokens] = useState<AuraTokens>(initialTokens);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>();
  const [source, setSource] = useState<AuraSource>("category");
  const [isExtensionInstalled, setIsExtensionInstalled] =
    useState<boolean>(false);

  //  extension simulation 
  const loadProfile = useCallback(
    async (uid?: string) => {
      const effectiveUserId = uid ?? initialUserId ?? "guest";

      try {
        setLoading(true);
        setError(undefined);

        const response = await mockFetchAuraProfile(effectiveUserId);

        setUserId(response.user_id);
        setSource(response.metadata.origin);
        setProfile(response.profile);
        setTokens(deriveTokensFromProfile(response.profile));
      } catch (err) {
        console.error("[AURA] Failed to load personalization", err);
        setError("Failed to load personalization");

        // Fallback to initial category profile
        setProfile(initialProfile);
        setTokens(initialTokens);
        setSource("fallback");
        setUserId("guest");
      } finally {
        setLoading(false);
      }
    },
    [initialUserId]
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

  const contextValue: AdaptiveContextValue = {
    userId,
    source,
    profile,
    tokens,
    loading,
    error,
    isExtensionInstalled,

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
    AdaptiveContext.Provider,
    { value: contextValue },
    children
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
