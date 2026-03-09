import {
  loadAdaptiveProfileFromExtension,
  saveAdaptiveProfileToExtension,
} from "../extensionBridge";

import { TEST_PROFILE } from "./testUtils";

describe("extensionBridge", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("requests extension status and the final ML profile, then normalizes the envelope", async () => {
    const requestTypes: string[] = [];

    window.addEventListener("message", (event: MessageEvent) => {
      const data = event.data;
      if (data?.source !== "aura-web") return;

      requestTypes.push(data.type);

      if (data.type === "AURA_EXT_PING") {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              type: "AURA_EXT_PONG",
              source: "aura-extension",
              extensionPresent: true,
              loggedIn: true,
              userId: "ext-user-1",
              user: { email: "ext-user@example.com", name: "Ext User" },
            },
            source: window,
          })
        );
      }

      if (data.type === "AURA_EXT_ML_FINAL_PROFILE_PING") {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              type: "AURA_EXT_ML_FINAL_PROFILE_PONG",
              source: "aura-extension",
              available: true,
              sourceType: "adaptive",
              profile: {
                user_id: "ext-user-1",
                metadata: {
                  origin: "user",
                  created_at: "2026-03-09T09:00:00.000Z",
                  confidence_overall: 0.97,
                  version: 3,
                },
                profile: {
                  ...TEST_PROFILE,
                  element_spacing: "wide",
                  element_padding: "comfortable",
                },
                profile_changes: {
                  changed: ["font_size", "target_size"],
                  old: { font_size: 16, target_size: 44 },
                  new: { font_size: 20, target_size: 52 },
                },
              },
            },
            source: window,
          })
        );
      }
    });

    const result = await loadAdaptiveProfileFromExtension("fallback-user", 200);

    expect(requestTypes).toEqual(["AURA_EXT_PING", "AURA_EXT_ML_FINAL_PROFILE_PING"]);
    expect(result.installed).toBe(true);
    expect(result.loggedIn).toBe(true);
    expect(result.extensionUserId).toBe("ext-user-1");
    expect(result.envelope?.profile.user_id).toBe("ext-user-1");
    expect(result.envelope?.profile.metadata.origin).toBe("user");
    expect(result.envelope?.profile.profile.font_size).toBe(20);
    expect(result.envelope?.profile.profile.element_spacing_x).toBe(18);
    expect(result.envelope?.profile.profile.element_spacing_y).toBe(20);
    expect(result.envelope?.profile.profile.element_padding_x).toBe(16);
    expect(result.envelope?.profile.profile.element_padding_y).toBe(14);
    expect(result.envelope?.diff?.changed).toEqual(["font_size", "target_size"]);
  });

  it("posts adaptive profile updates back to the extension bridge", () => {
    const postMessageSpy = jest.spyOn(window, "postMessage");

    saveAdaptiveProfileToExtension(TEST_PROFILE, "persisted-user");

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "AURA_EXT_SET_ADAPTIVE_PROFILE",
        source: "aura-web",
        profile: expect.objectContaining({
          user_id: "persisted-user",
          profile: TEST_PROFILE,
        }),
      }),
      "*"
    );
  });
});
