// src/index.tsx
export { AdaptiveProvider, useAdaptive } from "./AdaptiveProvider";
export { AdaptiveButton } from "./components/AdaptiveButton";
export { AdaptiveText } from "./components/AdaptiveText";
export { FeedbackPopup } from "./components/FeedbackPopup";
// later: export other components as you implement them

export type {
  AuraProfile,
  AuraMlResponse,
  AuraTokens,
  AdaptiveContextValue,
  FeedbackType,
  FeedbackData,
} from "./types";
