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
  FeedbackData,
} from "./types";

import {
  CATEGORY_PROFILE_MOCK,
  deriveTokensFromProfile,
  mockFetchAuraProfile,
} from "./utils";

// --- INITIAL DEFAULT STATES ---

const initialProfile: AuraProfile = CATEGORY_PROFILE_MOCK.profile;
const initialTokens: AuraTokens = deriveTokensFromProfile(initialProfile);

// We keep the runtime value strongly typed in the hook,
// but relax the context type itself to avoid Provider JSX type issues
const AdaptiveContext = createContext<AdaptiveContextValue | null>(null);

// --- PROVIDER COMPONENT ---

export function AdaptiveProvider({
  children,
  userId: initialUserId,
  simulateExtensionInstalled = true,
  apiUrl,
}: AdaptiveProviderProps) {
  const [userId, setUserId] = useState<string | undefined>(initialUserId);
  const [profile, setProfile] = useState<AuraProfile | null>(initialProfile);
  const [tokens, setTokens] = useState<AuraTokens>(initialTokens);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>();
  const [source, setSource] = useState<AuraSource>("category");
  const [isExtensionInstalled, setIsExtensionInstalled] =
    useState<boolean>(false);

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
      } finally {
        setLoading(false);
      }
    },
    [initialUserId]
  );

  // Submit feedback to backend
  const submitFeedback = useCallback(
    async (feedbackData: FeedbackData) => {
      if (!apiUrl || !userId) {
        console.warn("[AURA] No API URL or userId provided for feedback submission");
        return;
      }

      try {
        const response = await fetch(`${apiUrl}/users/${userId}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(feedbackData),
        });

        if (!response.ok) {
          throw new Error(`Feedback submission failed: ${response.statusText}`);
        }

        console.log("[AURA] Feedback submitted successfully");
      } catch (err) {
        console.error("[AURA] Failed to submit feedback:", err);
        throw err;
      }
    },
    [apiUrl, userId]
  );

  // Simulated extension initialization
  useEffect(() => {
    if (simulateExtensionInstalled) {
      setIsExtensionInstalled(true);
      const mockUserId = initialUserId ?? "u_001";
      loadProfile(mockUserId);
    } else {
      setIsExtensionInstalled(false);
      setLoading(false);
    }
  }, [simulateExtensionInstalled, initialUserId, loadProfile]);

  const contextValue: AdaptiveContextValue = {
    userId,
    source,
    profile,
    tokens,
    loading,
    error,
    isExtensionInstalled,
    reload: () => loadProfile(userId),
    submitFeedback,
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
