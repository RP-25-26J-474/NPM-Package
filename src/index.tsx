// src/index.tsx
export { AdaptiveProvider, useAdaptive } from "./AdaptiveProvider";
export {
  DEFAULT_AURA_API_ENDPOINT,
  DEFAULT_AURA_RL_ENDPOINT,
  resolveAuraApiEndpoint,
  resolveAuraRlEndpoint,
} from "./endpoints";
export {
  applyAdaptiveCssVariables,
  createAdaptiveCssVariables,
} from "./adaptiveCssVariables";
export { predictFallbackTokens } from "./fallback-ml/predict";
export { AdaptiveButton } from "./components/AdaptiveButton";
export { AdaptiveText } from "./components/AdaptiveText";
export { AdaptiveTable } from "./components/AdaptiveTable";
export { AdaptiveCard } from "./components/AdaptiveCard";
export { AdaptiveNavbar } from "./components/AdaptiveNavbar";
export { AdaptiveGrid } from "./components/AdaptiveGrid";
export { AdaptiveInput } from "./components/AdaptiveInput";
export { AdaptiveSelect } from "./components/AdaptiveSelect";
export { AdaptiveTextarea } from "./components/AdaptiveTextarea";
export { AdaptiveMenu } from "./components/AdaptiveMenu";
export { AdaptiveDropdown } from "./components/AdaptiveDropdown";
export { AdaptiveList } from "./components/AdaptiveList";
export { AdaptivePagination } from "./components/AdaptivePagination";
export { AdaptiveAlert } from "./components/AdaptiveAlert";
export { AdaptiveTooltip } from "./components/AdaptiveTooltip";
export { AdaptiveDrawer } from "./components/AdaptiveDrawer";
export { AdaptiveCheckbox } from "./components/AdaptiveCheckbox";
export { AdaptiveSwitch } from "./components/AdaptiveSwitch";
export { AdaptiveDialog } from "./components/AdaptiveDialog";
export { AdaptiveProfileInspector } from "./components/AdaptiveProfileInspector";

export { BehaviorTracker } from "./BehaviorTracker";
export { useRealtimeUIUpdates } from "./hooks/useRealtimeUIUpdates";
export { useSettingsSync } from "./hooks/useSettingsSync";
export { useUserSettingsStore } from "./hooks/useUserSettingsStore";
export { useTrialManager } from "./hooks/useTrialManager";
export { AdaptiveChangeConfirmation } from "./components/AdaptiveChangeConfirmation";
export { AdaptiveDifficultyDetector } from "./components/AdaptiveDifficultyDetector";
export { AdaptiveFeedback } from "./components/AdaptiveFeedback";
export { AdaptiveFeedbackPrompt } from "./components/AdaptiveFeedbackPrompt";
export { AdaptiveRevert } from "./components/AdaptiveRevert";
export { AdaptiveTempUserPrompt } from "./components/AdaptiveTempUserPrompt";
export { ComponentFeedbackModal } from "./components/ComponentFeedbackModal";
export { DirectionalFeedbackPrompt } from "./components/DirectionalFeedbackPrompt";
export { MLFeedbackPrompt } from "./components/MLFeedbackPrompt";
export type {
  AuraProfileV2,
  AuraMlEnvelopeV2,
  AuraTokens,
  AuraCssVariables,
  AuraCssVariableName,
  AdaptiveContextValue,
  AuraInspectorSnapshot,
  AuraInspectorRuntimeState,
  AuraInspectorExtensionState,
} from "./types";
