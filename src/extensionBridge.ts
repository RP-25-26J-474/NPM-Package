import { DEFAULT_GUEST_PROFILE } from "./utils";

import type { AuraMlEnvelopeV2, AuraProfileV2 } from "./types";

type AnyRecord = Record<string, unknown>;

type AuraExtensionBridge = {
  getStatus: () => Promise<AuraExtensionStatus>;
  getFinalProfile: () => Promise<AuraExtensionFinalProfileResponse>;
};

type AuraExtensionStatus = {
  extensionPresent?: boolean;
  loggedIn?: boolean;
  token?: string | null;
  user?: {
    email?: string | null;
    name?: string | null;
  } | null;
  error?: string;
};

type AuraExtensionFinalProfileResponse = {
  profile?: unknown;
  available?: boolean;
  error?: string;
  sourceType?: string | null;
};

export type ExtensionLoadResult = {
  installed: boolean;
  loggedIn: boolean;
  envelope: AuraMlEnvelopeV2 | null;
};

function isRecord(value: unknown): value is AnyRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeSpacingValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === "compact") return 6;
  if (value === "wide") return 16;
  if (value === "comfortable") return 12;
  return undefined;
}

function normalizeProfileShape(input: unknown): AuraProfileV2 | null {
  if (!isRecord(input)) return null;

  const legacySpacing = normalizeSpacingValue(input.element_spacing);
  const legacyPadding = normalizeSpacingValue(input.element_padding);

  return {
    ...DEFAULT_GUEST_PROFILE,
    font_size: toFiniteNumber(input.font_size, DEFAULT_GUEST_PROFILE.font_size),
    line_height: toFiniteNumber(
      input.line_height,
      DEFAULT_GUEST_PROFILE.line_height
    ),
    contrast_mode:
      input.contrast_mode === "high" ? "high" : DEFAULT_GUEST_PROFILE.contrast_mode,
    primary_color:
      typeof input.primary_color === "string"
        ? input.primary_color
        : DEFAULT_GUEST_PROFILE.primary_color,
    primary_color_content:
      typeof input.primary_color_content === "string"
        ? input.primary_color_content
        : DEFAULT_GUEST_PROFILE.primary_color_content,
    secondary_color:
      typeof input.secondary_color === "string"
        ? input.secondary_color
        : DEFAULT_GUEST_PROFILE.secondary_color,
    secondary_color_content:
      typeof input.secondary_color_content === "string"
        ? input.secondary_color_content
        : DEFAULT_GUEST_PROFILE.secondary_color_content,
    accent_color:
      typeof input.accent_color === "string"
        ? input.accent_color
        : DEFAULT_GUEST_PROFILE.accent_color,
    accent_color_content:
      typeof input.accent_color_content === "string"
        ? input.accent_color_content
        : DEFAULT_GUEST_PROFILE.accent_color_content,
    theme: input.theme === "dark" ? "dark" : DEFAULT_GUEST_PROFILE.theme,
    element_spacing_x: toFiniteNumber(
      input.element_spacing_x,
      legacySpacing ?? DEFAULT_GUEST_PROFILE.element_spacing_x
    ),
    element_spacing_y: toFiniteNumber(
      input.element_spacing_y,
      legacySpacing ?? DEFAULT_GUEST_PROFILE.element_spacing_y
    ),
    element_padding_x: toFiniteNumber(
      input.element_padding_x,
      legacyPadding ?? DEFAULT_GUEST_PROFILE.element_padding_x
    ),
    element_padding_y: toFiniteNumber(
      input.element_padding_y,
      legacyPadding ?? DEFAULT_GUEST_PROFILE.element_padding_y
    ),
    reduced_motion:
      typeof input.reduced_motion === "boolean"
        ? input.reduced_motion
        : DEFAULT_GUEST_PROFILE.reduced_motion,
    target_size: toFiniteNumber(
      input.target_size,
      DEFAULT_GUEST_PROFILE.target_size
    ),
    tooltip_assist:
      typeof input.tooltip_assist === "boolean"
        ? input.tooltip_assist
        : DEFAULT_GUEST_PROFILE.tooltip_assist,
    layout_simplification:
      typeof input.layout_simplification === "boolean"
        ? input.layout_simplification
        : DEFAULT_GUEST_PROFILE.layout_simplification,
  };
}

function normalizeExtensionOrigin(value: unknown): "category" | "user" {
  if (value === "category") return value;
  return "user";
}

function getExtensionDisplayUserId(
  status: AuraExtensionStatus,
  fallbackUserId?: string
): string {
  if (status.user?.email && status.user.email.trim()) return status.user.email;
  if (status.user?.name && status.user.name.trim()) return status.user.name;
  if (fallbackUserId && fallbackUserId.trim()) return fallbackUserId;
  return "extension-user";
}

function normalizeExtensionEnvelope(
  response: AuraExtensionFinalProfileResponse,
  fallbackUserId?: string
): AuraMlEnvelopeV2 | null {
  const rawProfile = response.profile;
  if (!isRecord(rawProfile)) return null;

  const looksLikeStoredProfile =
    typeof rawProfile.user_id === "string" && isRecord(rawProfile.profile);

  const userId =
    (looksLikeStoredProfile && typeof rawProfile.user_id === "string"
      ? rawProfile.user_id
      : fallbackUserId) ?? "extension-user";

  const metadata: AnyRecord =
    looksLikeStoredProfile && isRecord(rawProfile.metadata)
      ? rawProfile.metadata
      : {};
  const profileChanges: AnyRecord | null =
    looksLikeStoredProfile && isRecord(rawProfile.profile_changes)
      ? rawProfile.profile_changes
      : null;

  const normalizedProfile = normalizeProfileShape(
    looksLikeStoredProfile ? rawProfile.profile : rawProfile
  );

  if (!normalizedProfile) return null;

  return {
    profile: {
      user_id: userId,
      metadata: {
        origin: normalizeExtensionOrigin(metadata.origin),
        created_at:
          typeof metadata.created_at === "string"
            ? metadata.created_at
            : new Date().toISOString(),
        confidence_overall: toFiniteNumber(metadata.confidence_overall, 0.8),
        version: toFiniteNumber(metadata.version, 1),
      },
      profile: normalizedProfile,
    },
    diff: profileChanges
      ? {
          changed: Array.isArray(profileChanges.changed)
            ? profileChanges.changed
            : undefined,
          old: profileChanges.old,
          new: profileChanges.new,
        }
      : undefined,
    traces: [],
  };
}

function createRealExtensionBridge(timeoutMs: number): AuraExtensionBridge {
  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function waitForBridgeReady(): Promise<void> {
    if (typeof window === "undefined") return;
    if (document.readyState === "complete") {
      await delay(150);
      return;
    }

    await new Promise<void>((resolve) => {
      window.addEventListener("load", () => resolve(), { once: true });
    });
    await delay(150);
  }

  function requestOnce<T>(requestType: string, responseType: string): Promise<T> {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("No window"));
        return;
      }

      const timer = window.setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("Extension response timeout"));
      }, timeoutMs);

      function onMessage(ev: MessageEvent) {
        const data = ev && ev.data ? ev.data : null;
        if (ev.source !== window) return;
        if (!data || data.source !== "aura-extension") return;
        if (data.type !== responseType) return;

        window.clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(data as T);
      }

      window.addEventListener("message", onMessage);
      window.postMessage({ type: requestType, source: "aura-web" }, "*");
    });
  }

  async function request<T>(requestType: string, responseType: string): Promise<T> {
    const maxAttempts = 3;
    let lastError: unknown;

    await waitForBridgeReady();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await requestOnce<T>(requestType, responseType);
      } catch (err) {
        lastError = err;
        const isTimeout =
          err instanceof Error && err.message === "Extension response timeout";

        if (!isTimeout || attempt === maxAttempts - 1) {
          throw err;
        }

        await delay(250);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Extension bridge request failed");
  }

  return {
    getStatus: () => request<AuraExtensionStatus>("AURA_EXT_PING", "AURA_EXT_PONG"),
    getFinalProfile: () =>
      request<AuraExtensionFinalProfileResponse>(
        "AURA_EXT_ML_FINAL_PROFILE_PING",
        "AURA_EXT_ML_FINAL_PROFILE_PONG"
      ),
  };
}

export async function loadAdaptiveProfileFromExtension(
  fallbackUserId?: string,
  timeoutMs = 2200
): Promise<ExtensionLoadResult> {
  const bridge = createRealExtensionBridge(timeoutMs);
  const status = await bridge.getStatus();
  const installed = status.extensionPresent === true;

  if (!installed) {
    return { installed: false, loggedIn: false, envelope: null };
  }

  const loggedIn = status.loggedIn === true;
  if (!loggedIn) {
    return { installed: true, loggedIn: false, envelope: null };
  }

  const finalProfile = await bridge.getFinalProfile();
  const envelope = finalProfile.available
    ? normalizeExtensionEnvelope(
        finalProfile,
        getExtensionDisplayUserId(status, fallbackUserId)
      )
    : null;

  return {
    installed: true,
    loggedIn: true,
    envelope,
  };
}
