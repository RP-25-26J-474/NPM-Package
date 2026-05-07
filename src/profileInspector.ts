import type {
  AuraInspectorDiffEntry,
  AuraInspectorExtensionState,
  AuraInspectorRuntimeState,
  AuraInspectorSnapshot,
} from "./types";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function deepDiff(
  extensionValue: unknown,
  appliedValue: unknown,
  path = ""
): AuraInspectorDiffEntry[] {
  if (!isObjectRecord(extensionValue) || !isObjectRecord(appliedValue)) {
    return JSON.stringify(extensionValue) === JSON.stringify(appliedValue)
      ? []
      : [{ path: path || "value", extensionValue, appliedValue }];
  }

  const diffs: AuraInspectorDiffEntry[] = [];
  const keys = new Set([
    ...Object.keys(extensionValue || {}),
    ...Object.keys(appliedValue || {}),
  ]);

  for (const key of keys) {
    const nextPath = path ? `${path}.${key}` : key;
    const left = extensionValue[key];
    const right = appliedValue[key];

    if (isObjectRecord(left) && isObjectRecord(right)) {
      diffs.push(...deepDiff(left, right, nextPath));
      continue;
    }

    if (JSON.stringify(left) !== JSON.stringify(right)) {
      diffs.push({
        path: nextPath,
        extensionValue: left,
        appliedValue: right,
      });
    }
  }

  return diffs;
}

export function buildAuraInspectorSnapshot(
  extension: AuraInspectorExtensionState,
  runtime: AuraInspectorRuntimeState
): AuraInspectorSnapshot {
  const finalProfile = extension.normalizedFinalEnvelope?.profile.profile ?? null;
  const finalVsApplied =
    finalProfile && runtime.appliedProfile
      ? deepDiff(finalProfile, runtime.appliedProfile)
      : [];

  const limitation =
    runtime.source === "fallback"
      ? "Extension storage is unavailable or not selected. This standalone inspector compares the current fallback-applied runtime profile and approximates the fallback-created profile from that live state."
      : extension.normalizedFinalEnvelope
      ? "The comparison uses the extension final profile and the live profile state currently held by AdaptiveProvider."
      : "No final extension profile is available, so only runtime state can be inspected.";

  return {
    user: {
      requestedUserId: runtime.requestedUserId,
      resolvedUserId: runtime.resolvedUserId,
      source: runtime.source,
      loading: runtime.loading,
      error: runtime.error,
    },
    extension,
    runtime,
    comparison: {
      finalVsApplied,
      hasDifference: finalVsApplied.length > 0,
    },
    fallback: {
      active: runtime.source === "fallback" || runtime.isExtensionInstalled === false,
      reason: runtime.fallbackReason,
      createdProfile: runtime.fallbackCreatedProfile,
      appliedProfile:
        runtime.source === "fallback" || runtime.isExtensionInstalled === false
          ? runtime.appliedProfile
          : null,
    },
    notes: {
      limitation,
    },
  };
}
