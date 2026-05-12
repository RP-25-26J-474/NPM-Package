import type { AuraCssVariables, AuraTokens } from "./types";

export const AURA_MIN_TEXT_SCALE = 1;
export const AURA_MAX_TEXT_SCALE = 2;

function px(value: number): string {
  return value.toString() + "px";
}

function clampTextScale(scale: number): number {
  if (!Number.isFinite(scale)) return AURA_MIN_TEXT_SCALE;
  return Math.min(AURA_MAX_TEXT_SCALE, Math.max(AURA_MIN_TEXT_SCALE, scale));
}

export function createAdaptiveCssVariables(tokens: AuraTokens): AuraCssVariables {
  const motionDuration = tokens.flags.reducedMotion ? "0ms" : "160ms";
  const focusRingWidth = tokens.flags.highContrast ? "3px" : "2px";
  const focusRingColor = tokens.flags.highContrast
    ? tokens.colors.text
    : tokens.colors.primary;

  return {
    "--aura-color-background": tokens.colors.background,
    "--aura-color-surface": tokens.colors.surface,
    "--aura-color-text": tokens.colors.text,
    "--aura-color-primary": tokens.colors.primary,
    "--aura-color-on-primary": tokens.colors.onPrimary,
    "--aura-color-secondary": tokens.colors.secondary,
    "--aura-color-on-secondary": tokens.colors.onSecondary,
    "--aura-color-accent": tokens.colors.accent,
    "--aura-color-on-accent": tokens.colors.onAccent,
    "--aura-color-border": tokens.colors.border,

    "--aura-font-size-base": tokens.typography.baseSize,
    "--aura-font-size-body": tokens.typography.body,
    "--aura-font-size-heading": tokens.typography.h2,
    "--aura-font-size-subheading": tokens.typography.h3,
    "--aura-font-size-caption": tokens.typography.caption,
    "--aura-line-height": String(tokens.typography.lineHeight),

    "--aura-spacing-gap-x": px(tokens.spacing.gapX),
    "--aura-spacing-gap-y": px(tokens.spacing.gapY),
    "--aura-spacing-pad-x": px(tokens.spacing.padX),
    "--aura-spacing-pad-y": px(tokens.spacing.padY),
    "--aura-page-padding-x": px(tokens.spacing.pagePaddingX),
    "--aura-page-padding-y": px(tokens.spacing.pagePaddingY),

    "--aura-control-min-target-size": px(tokens.controls.minTargetSize),
    "--aura-focus-ring-width": focusRingWidth,
    "--aura-focus-ring-color": focusRingColor,
    "--aura-motion-duration": motionDuration,

    "--aura-radius-surface": tokens.flags.layoutSimplification ? "8px" : "12px",
    "--aura-radius-control": tokens.flags.layoutSimplification ? "6px" : "999px",

    // Backward-compatible aliases used by older package internals/examples.
    "--aura-background": tokens.colors.background,
    "--aura-surface": tokens.colors.surface,
    "--aura-text": tokens.colors.text,
    "--aura-primary": tokens.colors.primary,
    "--aura-onPrimary": tokens.colors.onPrimary,
    "--aura-secondary": tokens.colors.secondary,
    "--aura-onSecondary": tokens.colors.onSecondary,
    "--aura-accent": tokens.colors.accent,
    "--aura-onAccent": tokens.colors.onAccent,
    "--aura-border": tokens.colors.border,
    "--aura-base-size": tokens.typography.baseSize,
    "--aura-font-h1": tokens.typography.h1,
    "--aura-font-h2": tokens.typography.h2,
    "--aura-font-h3": tokens.typography.h3,
    "--aura-font-body": tokens.typography.body,
    "--aura-spacing-base": px(tokens.spacing.gapY),
    "--aura-spacing-gap": px(tokens.spacing.gapX),
    "--aura-spacing-padding": px(tokens.spacing.pagePaddingX),
    "--aura-min-target-size": px(tokens.controls.minTargetSize),
    "--aura-target-size": px(tokens.controls.minTargetSize),
  };
}

export function applyAdaptiveCssVariables(
  tokens: AuraTokens,
  target?: HTMLElement
): void {
  if (typeof document === "undefined") return;

  const root = target ?? document.documentElement;
  const variables = createAdaptiveCssVariables(tokens);

  Object.entries(variables).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });

  root.classList.remove("aura-theme-light", "aura-theme-dark");
  root.classList.add("aura-theme-" + tokens.flags.theme);

  root.classList.toggle("aura-reduced-motion", tokens.flags.reducedMotion);
  root.classList.toggle("aura-high-contrast", tokens.flags.highContrast);
  root.classList.toggle(
    "aura-layout-simplified",
    tokens.flags.layoutSimplification
  );
  root.classList.toggle("aura-tooltip-assist", tokens.flags.tooltipAssist);
}

export function setAuraTextScale(scale: number, target?: HTMLElement): number {
  if (typeof document === "undefined") return clampTextScale(scale);

  const root = target ?? document.documentElement;
  const nextScale = clampTextScale(scale);
  root.style.setProperty("--aura-text-scale", String(nextScale));
  return nextScale;
}

export function increaseAuraTextScale(
  step = 0.1,
  target?: HTMLElement
): number {
  if (typeof document === "undefined") return AURA_MIN_TEXT_SCALE;

  const root = target ?? document.documentElement;
  const current = Number.parseFloat(
    root.style.getPropertyValue("--aura-text-scale") || "1"
  );
  return setAuraTextScale(current + step, root);
}

export function decreaseAuraTextScale(
  step = 0.1,
  target?: HTMLElement
): number {
  if (typeof document === "undefined") return AURA_MIN_TEXT_SCALE;

  const root = target ?? document.documentElement;
  const current = Number.parseFloat(
    root.style.getPropertyValue("--aura-text-scale") || "1"
  );
  return setAuraTextScale(current - step, root);
}
