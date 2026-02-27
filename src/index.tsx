// src/index.tsx
export { AdaptiveProvider, useAdaptive } from "./AdaptiveProvider";
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

export type {
  AuraProfile,
  AuraMlResponse,
  AuraTokens,
  AdaptiveContextValue,
  AdaptiveFeedbackType,
  AdaptiveFeedbackPayload,
} from "./types";
