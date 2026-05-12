const AURA_UTILITY_STYLE_ID = "aura-utility-styles";

const AURA_UTILITY_CSS = `
.a-page,
.a-section,
.a-surface,
.a-panel,
.a-card,
.a-readable,
.a-heading,
.a-subheading,
.a-caption,
.a-muted,
.a-emphasis,
.a-action-primary,
.a-action-secondary,
.a-action-quiet,
.a-control,
.a-input,
.a-alert,
.a-assistive {
  box-sizing: border-box;
}

.a-page {
  min-height: 100vh;
  background: var(--aura-color-background, #ffffff);
  color: var(--aura-color-text, #111111);
  padding: var(--aura-page-padding-y, 20px) var(--aura-page-padding-x, 24px);
  font-size: var(--aura-font-size-body, 16px);
  line-height: var(--aura-line-height, 1.5);
  overflow-wrap: anywhere;
}

.a-section {
  margin-block: var(--aura-spacing-gap-y, 12px);
}

.a-stack {
  display: flex;
  flex-direction: column;
  gap: var(--aura-spacing-gap-y, 12px);
}

.a-cluster {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--aura-spacing-gap-y, 12px) var(--aura-spacing-gap-x, 12px);
}

.a-flow > * + * {
  margin-top: var(--aura-spacing-gap-y, 12px);
}

.a-grid-adaptive {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: var(--aura-spacing-gap-y, 12px) var(--aura-spacing-gap-x, 12px);
}

.a-readable {
  color: var(--aura-color-text, #111111);
  font-size: var(--aura-font-size-body, 16px);
  line-height: var(--aura-line-height, 1.5);
  max-width: 100%;
  overflow-wrap: anywhere;
}

.a-heading {
  color: var(--aura-color-text, #111111);
  font-size: var(--aura-font-size-heading, 24px);
  line-height: var(--aura-line-height, 1.5);
  font-weight: 700;
  margin: 0;
}

.a-subheading {
  color: var(--aura-color-text, #111111);
  font-size: var(--aura-font-size-subheading, 20px);
  line-height: var(--aura-line-height, 1.5);
  font-weight: 650;
  margin: 0;
}

.a-caption {
  color: var(--aura-color-text, #111111);
  font-size: var(--aura-font-size-caption, 12px);
  line-height: var(--aura-line-height, 1.5);
}

.a-muted {
  color: var(--aura-color-secondary, #6c757d);
}

.aura-high-contrast .a-muted {
  color: var(--aura-color-text, #111111);
}

.a-emphasis {
  color: var(--aura-color-text, #111111);
  font-weight: 700;
}

.a-surface,
.a-panel,
.a-card {
  background: var(--aura-color-surface, #fafafa);
  color: var(--aura-color-text, #111111);
  border: 1px solid var(--aura-color-border, #d4d4d4);
  border-radius: var(--aura-radius-surface, 12px);
}

.a-surface {
  padding: var(--aura-spacing-pad-y, 10px) var(--aura-spacing-pad-x, 12px);
}

.a-panel,
.a-card {
  padding: var(--aura-page-padding-y, 20px) var(--aura-page-padding-x, 24px);
}

.a-card {
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.12);
}

.aura-high-contrast .a-card,
.aura-high-contrast .a-panel,
.aura-high-contrast .a-surface {
  box-shadow: none;
  border-width: 2px;
}

.a-divider {
  border: 0;
  border-top: 1px solid var(--aura-color-border, #d4d4d4);
  margin: var(--aura-spacing-gap-y, 12px) 0;
}

.a-border-adaptive {
  border: 1px solid var(--aura-color-border, #d4d4d4);
}

.a-control,
.a-action-primary,
.a-action-secondary,
.a-action-quiet,
.a-input {
  min-width: var(--aura-control-min-target-size, 44px);
  min-height: var(--aura-control-min-target-size, 44px);
  font: inherit;
  font-size: var(--aura-font-size-body, 16px);
  line-height: var(--aura-line-height, 1.5);
}

.a-action-primary,
.a-action-secondary,
.a-action-quiet {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--aura-spacing-gap-x, 12px);
  padding: var(--aura-spacing-pad-y, 10px) var(--aura-spacing-pad-x, 12px);
  border-radius: var(--aura-radius-control, 999px);
  border: 1px solid transparent;
  cursor: pointer;
  text-decoration: none;
  user-select: none;
  white-space: normal;
  overflow-wrap: anywhere;
  transition:
    background-color var(--aura-motion-duration, 160ms) ease,
    border-color var(--aura-motion-duration, 160ms) ease,
    color var(--aura-motion-duration, 160ms) ease,
    transform var(--aura-motion-duration, 160ms) ease;
}

.a-action-primary {
  background: var(--aura-color-primary, #2563eb);
  color: var(--aura-color-on-primary, #ffffff);
  border-color: var(--aura-color-primary, #2563eb);
}

.a-action-secondary {
  background: var(--aura-color-secondary, #0ea5e9);
  color: var(--aura-color-on-secondary, #ffffff);
  border-color: var(--aura-color-secondary, #0ea5e9);
}

.a-action-quiet {
  background: transparent;
  color: var(--aura-color-primary, #2563eb);
  border-color: var(--aura-color-border, #d4d4d4);
}

.a-action-primary:hover,
.a-action-secondary:hover,
.a-action-quiet:hover,
.a-interactive:hover {
  transform: translateY(-1px);
}

.aura-reduced-motion .a-action-primary,
.aura-reduced-motion .a-action-secondary,
.aura-reduced-motion .a-action-quiet,
.aura-reduced-motion .a-interactive {
  transition: none;
}

.aura-reduced-motion .a-action-primary:hover,
.aura-reduced-motion .a-action-secondary:hover,
.aura-reduced-motion .a-action-quiet:hover,
.aura-reduced-motion .a-interactive:hover {
  transform: none;
}

.a-input {
  width: 100%;
  color: var(--aura-color-text, #111111);
  background: var(--aura-color-background, #ffffff);
  border: 1px solid var(--aura-color-border, #d4d4d4);
  border-radius: var(--aura-radius-surface, 12px);
  padding: var(--aura-spacing-pad-y, 10px) var(--aura-spacing-pad-x, 12px);
}

.a-touch-target {
  min-width: var(--aura-control-min-target-size, 44px);
  min-height: var(--aura-control-min-target-size, 44px);
}

.a-focus-ring:focus,
.a-focus-ring:focus-visible,
.a-action-primary:focus-visible,
.a-action-secondary:focus-visible,
.a-action-quiet:focus-visible,
.a-input:focus-visible {
  outline: var(--aura-focus-ring-width, 2px) solid var(--aura-focus-ring-color, #2563eb);
  outline-offset: 2px;
}

.a-alert,
.a-alert-success,
.a-alert-warning,
.a-alert-danger {
  color: var(--aura-color-text, #111111);
  background: var(--aura-color-surface, #fafafa);
  border: 1px solid var(--aura-color-border, #d4d4d4);
  border-left-width: max(4px, var(--aura-focus-ring-width, 2px));
  border-radius: var(--aura-radius-surface, 12px);
  padding: var(--aura-spacing-pad-y, 10px) var(--aura-spacing-pad-x, 12px);
  font-size: var(--aura-font-size-body, 16px);
  line-height: var(--aura-line-height, 1.5);
}

.a-alert-success {
  border-left-color: var(--aura-color-accent, #28a745);
}

.a-alert-warning {
  border-left-color: var(--aura-color-secondary, #0ea5e9);
}

.a-alert-danger {
  border-left-color: var(--aura-color-primary, #2563eb);
}

.a-assistive {
  color: var(--aura-color-text, #111111);
  background: var(--aura-color-surface, #fafafa);
  border: 1px dashed var(--aura-color-border, #d4d4d4);
  border-radius: var(--aura-radius-surface, 12px);
  padding: var(--aura-spacing-pad-y, 10px) var(--aura-spacing-pad-x, 12px);
}

.a-tooltip-target {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 0.2em;
}

.aura-tooltip-assist .a-tooltip-target {
  text-decoration-thickness: 2px;
}

.aura-layout-simplified .a-grid-adaptive {
  grid-template-columns: 1fr;
}

.aura-layout-simplified .a-cluster {
  align-items: stretch;
  flex-direction: column;
}

.aura-layout-simplified .a-card,
.aura-layout-simplified .a-panel {
  box-shadow: none;
}
`;

export function ensureAuraUtilityStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(AURA_UTILITY_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = AURA_UTILITY_STYLE_ID;
  style.textContent = AURA_UTILITY_CSS;
  document.head.appendChild(style);
}
