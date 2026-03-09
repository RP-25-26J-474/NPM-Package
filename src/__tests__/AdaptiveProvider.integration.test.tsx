import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";

jest.mock("../BehaviorTracker", () => ({
  BehaviorTracker: jest.fn().mockImplementation(() => ({
    updateUserId: jest.fn(),
    destroy: jest.fn(),
    trackInteraction: jest.fn(),
  })),
}));

jest.mock("../hooks/useTrialManager", () => ({
  useTrialManager: jest.fn(() => ({
    activeTrial: null,
    showPrompt: false,
    trialSettings: null,
    handleFeedback: jest.fn(),
  })),
}));

jest.mock("../hooks/useSettingsSync", () => ({
  useSettingsSync: jest.fn(),
}));

jest.mock("../hooks/useUserSettingsStore", () => ({
  useUserSettingsStore: jest.fn(() => ({
    settings: null,
    source: null,
    updateSettings: jest.fn(),
    triggerEodSync: jest.fn(),
    isLoaded: true,
  })),
}));

jest.mock("../components/AdaptiveFeedback", () => ({
  AdaptiveFeedback: () => null,
}));

jest.mock("../components/AdaptiveTempUserPrompt", () => ({
  AdaptiveTempUserPrompt: () => null,
}));

jest.mock("../components/MLFeedbackPrompt", () => ({
  MLFeedbackPrompt: () => null,
}));

jest.mock("../components/ComponentFeedbackModal", () => ({
  ComponentFeedbackModal: () => null,
}));

jest.mock("../extensionBridge", () => ({
  loadAdaptiveProfileFromExtension: jest.fn(),
  saveAdaptiveProfileToExtension: jest.fn(),
}));

jest.mock("../fallback-ml/predict", () => ({
  predictFallbackTokens: jest.fn(),
}));

jest.mock("../fallback-ml/cache", () => ({
  readFallbackCache: jest.fn(),
  writeFallbackCache: jest.fn(),
}));

import { AdaptiveProvider } from "../AdaptiveProvider";
import { AdaptiveButton } from "../components/AdaptiveButton";
import { AdaptiveInput } from "../components/AdaptiveInput";
import { AdaptiveText } from "../components/AdaptiveText";
import { loadAdaptiveProfileFromExtension } from "../extensionBridge";
import { predictFallbackTokens } from "../fallback-ml/predict";
import { readFallbackCache, writeFallbackCache } from "../fallback-ml/cache";

import {
  AdaptiveStateProbe,
  ALT_TEST_ENVELOPE,
  TEST_ENVELOPE,
} from "./testUtils";

const mockedLoadAdaptiveProfileFromExtension =
  loadAdaptiveProfileFromExtension as jest.MockedFunction<
    typeof loadAdaptiveProfileFromExtension
  >;
const mockedPredictFallbackTokens =
  predictFallbackTokens as jest.MockedFunction<typeof predictFallbackTokens>;
const mockedReadFallbackCache =
  readFallbackCache as jest.MockedFunction<typeof readFallbackCache>;
const mockedWriteFallbackCache =
  writeFallbackCache as jest.MockedFunction<typeof writeFallbackCache>;

function TestSurface() {
  return (
    <>
      <AdaptiveStateProbe />
      <AdaptiveButton>Pay now</AdaptiveButton>
      <AdaptiveInput label="Email address" />
      <AdaptiveText>Fallback text</AdaptiveText>
    </>
  );
}

describe("AdaptiveProvider integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("loads the extension ML profile and applies it to adaptive components", async () => {
    mockedLoadAdaptiveProfileFromExtension.mockResolvedValue({
      installed: true,
      loggedIn: true,
      envelope: TEST_ENVELOPE,
      extensionUserId: "ext-user-1",
    });

    render(
      <AdaptiveProvider userId="host-user">
        <TestSurface />
      </AdaptiveProvider>
    );

    const button = await screen.findByRole("button", { name: "Pay now" });
    const input = await screen.findByPlaceholderText("Email address");
    const state = await screen.findByTestId("adaptive-state");

    expect(button).toHaveStyle({
      minHeight: "52px",
      fontSize: "20px",
      backgroundColor: "#113355",
    });
    expect(input).toHaveStyle({
      minHeight: "52px",
      fontSize: "20px",
      borderColor: "#ffffff",
    });

    expect(JSON.parse(state.textContent || "{}")).toMatchObject({
      userId: "ext-user-1",
      source: "user",
      loading: false,
      isExtensionInstalled: true,
      isExtensionLoggedIn: true,
      profile: {
        font_size: 20,
        target_size: 52,
        layout_simplification: true,
      },
    });
  });

  it("reloads from the extension when the extension broadcasts a profile change", async () => {
    mockedLoadAdaptiveProfileFromExtension
      .mockResolvedValueOnce({
        installed: true,
        loggedIn: true,
        envelope: TEST_ENVELOPE,
        extensionUserId: "ext-user-1",
      })
      .mockResolvedValueOnce({
        installed: true,
        loggedIn: true,
        envelope: ALT_TEST_ENVELOPE,
        extensionUserId: "ext-user-1",
      });

    render(
      <AdaptiveProvider userId="host-user">
        <AdaptiveButton>Pay now</AdaptiveButton>
      </AdaptiveProvider>
    );

    const button = await screen.findByRole("button", { name: "Pay now" });
    expect(button).toHaveStyle({ minHeight: "52px", fontSize: "20px" });

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            source: "aura-extension",
            type: "AURA_EXT_PROFILE_CHANGED",
          },
          source: window,
        })
      );
    });

    await waitFor(() => {
      expect(button).toHaveStyle({ minHeight: "44px", fontSize: "16px" });
    });
  });

  it("shows the extension installation prompt and falls back to the local FNN profile when the extension is missing", async () => {
    mockedLoadAdaptiveProfileFromExtension.mockResolvedValue({
      installed: false,
      loggedIn: false,
      envelope: null,
      extensionUserId: null,
    });
    mockedReadFallbackCache.mockReturnValue(null);
    mockedPredictFallbackTokens.mockReturnValue({
      font_size: 18.2,
      line_height: 1.52,
      target_size: 33.7,
    });

    render(
      <AdaptiveProvider
        userId="guest"
        showExtensionPrompt={true}
        extensionPromptCtaHref="https://example.com/extension"
      >
        <TestSurface />
      </AdaptiveProvider>
    );

    const promptText = await screen.findByText(
      /Install the AURA extension for a more personalized UI adaptation experience/i
    );
    const cta = screen.getByRole("link", { name: "Get AURA Extension" });
    const fallbackText = screen.getByText("Fallback text");
    const state = screen.getByTestId("adaptive-state");

    expect(promptText).toBeInTheDocument();
    expect(cta).toHaveAttribute("href", "https://example.com/extension");
    expect(mockedWriteFallbackCache).toHaveBeenCalledWith({
      font_size: 18.2,
      line_height: 1.52,
      target_size: 33.7,
    });
    expect(fallbackText).toHaveStyle({
      fontSize: "18.2px",
      lineHeight: 1.52,
    });
    expect(JSON.parse(state.textContent || "{}")).toMatchObject({
      source: "fallback",
      isExtensionInstalled: false,
      isExtensionLoggedIn: false,
      profile: {
        font_size: 18.2,
        line_height: 1.52,
        target_size: 33.7,
      },
    });
  });
});
