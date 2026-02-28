// src/index.tsx
export { AdaptiveProvider, useAdaptive } from "./AdaptiveProvider";
export { predictFallbackTokens } from "./fallback-ml/predict";
export { AdaptiveButton } from "./components/AdaptiveButton";
export { AdaptiveText } from "./components/AdaptiveText";
export { AdaptiveTable } from "./components/AdaptiveTable";
export { AdaptiveCard } from "./components/AdaptiveCard";
export { AdaptiveNavbar } from "./components/AdaptiveNavbar";
export { AdaptiveGrid } from "./components/AdaptiveGrid";
export { AdaptiveFeedback } from "./components/AdaptiveFeedback";
export { AdaptiveRevert } from "./components/AdaptiveRevert";
export { AdaptiveFeedbackPrompt } from "./components/AdaptiveFeedbackPrompt";
export { AdaptiveChangeConfirmation } from "./components/AdaptiveChangeConfirmation";
export { DirectionalFeedbackPrompt } from "./components/DirectionalFeedbackPrompt";
export { AdaptiveDifficultyDetector } from "./components/AdaptiveDifficultyDetector";
export { AdaptiveTempUserPrompt } from "./components/AdaptiveTempUserPrompt";
// NOTE: AdaptiveSettingsChangePrompt temporarily disabled due to TypeScript build issues
// export { AdaptiveSettingsChangePrompt } from "./components/AdaptiveSettingsChangePrompt";
export { BehaviorTracker } from "./BehaviorTracker";
export { useRealtimeUIUpdates } from "./hooks/useRealtimeUIUpdates";
export { useTrialManager } from "./hooks/useTrialManager"; // NEW
export { useSettingsSync } from "./hooks/useSettingsSync"; // NEW
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

export type {
  AuraProfileV2,
  AuraMlEnvelopeV2,
  AuraTokens,
  AdaptiveContextValue,
  AdaptiveFeedbackType,
  AdaptiveFeedbackPayload,
} from "./types";
