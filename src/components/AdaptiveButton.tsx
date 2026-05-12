// src/components/AdaptiveButton.tsx
import React, {
  useState,
  type MouseEvent,
  type FocusEvent,
  type ButtonHTMLAttributes,
} from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

export type ButtonVariant = "primary" | "secondary" | "accent" | "ghost";

export interface AdaptiveButtonProps
  extends AdaptiveComponentProps,
    ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;

  /** Atomic: icon (svg/node) */
  icon?: React.ReactNode;

  /** Icon placement */
  iconPosition?: "left" | "right";

  /**
   * Icon-only mode (developer can request).
   * Accessibility: MUST provide aria-label when iconOnly=true.
   */
  iconOnly?: boolean;

  /**
   * Low literacy rule: show icon + text by default.
   * Developer can force hiding/showing text.
   */
  showText?: boolean;

  /** Adaptable: gap between icon and text */
  iconGapPx?: number;

  /** Adaptable: override text size (px or css string like "14px") */
  textSize?: string;

  /** Adaptable: override padding/hit-area without changing your existing defaults too much */
  minHitAreaPx?: number; // ensures >= 44
  paddingX?: number;
  paddingY?: number;

  /** Adaptable: stronger focus outline */
  focusRingPx?: number;

  /** Helps avoid ambiguous icon-only buttons: optional visible text label */
  textLabel?: string; // if children is not provided, this can be used as text
}

export function AdaptiveButton(props: AdaptiveButtonProps) {
  const { tokens, behaviorTracker, openComponentFeedback } = useAdaptive();
  const { colors, spacing, controls, typography, flags } = tokens;

  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const variant: ButtonVariant =
    props.variant === undefined ? "primary" : props.variant;

  const classNameProp = props.className === undefined ? "" : props.className;
  const styleProp = props.style;
  const disabled = props.disabled === true;

  const icon = props.icon;
  const iconPosition = props.iconPosition ?? "left";
  const iconGap = Math.max(props.iconGapPx ?? spacing.gapX, 8);

  const ariaLabelProp = (props as any)["aria-label"];

  // Use children as text if provided, else fallback to textLabel
  const textChild = props.children ?? props.textLabel;

  // Default: if icon exists and text exists => show both.
  // If iconOnly requested => icon only (but we may override in simplified mode).
  const requestedIconOnly = props.iconOnly === true;
  const requestedShowText = props.showText;

  // Low computer literacy rule heuristic: layoutSimplification => prefer text visible
  const preferText = flags.layoutSimplification === true;

  let iconOnly = requestedIconOnly;
  if (preferText && requestedIconOnly) {
    // Avoid icon-only in simplified mode unless developer *explicitly* hides text and provides aria-label
    // We'll keep iconOnly true only if aria-label exists and no text is available.
    if (textChild != null) iconOnly = false;
  }

  const showText =
    requestedShowText !== undefined
      ? requestedShowText
      : // Default: show text if available, especially in simplified mode
        textChild != null;

  const effectiveIconOnly = iconOnly && icon != null && (!showText || textChild == null);

  // ---- Variant colors ----
  let bg = colors.primary;
  let fg = colors.onPrimary;
  let border = colors.border;

  if (variant === "secondary") {
    bg = colors.secondary;
    fg = colors.onSecondary;
  } else if (variant === "accent") {
    bg = colors.accent;
    fg = colors.onAccent;
  } else if (variant === "ghost") {
    bg = "transparent";
    fg = flags.highContrast ? colors.text : colors.primary;
    border = flags.highContrast ? colors.text : colors.primary;
  }

  // Contrast rule: if highContrast, make border/text stronger
  if (flags.highContrast && variant !== "ghost") {
    border = colors.text;
  }

  // ---- Padding / hit area ----
  const minHit = Math.max(props.minHitAreaPx ?? controls.minTargetSize, 44); // ≥44×44

  const basePadY = props.paddingY ?? spacing.padY;
  const basePadX = props.paddingX ?? spacing.padX;

  // Keep your original “comfort padding” logic, but ensure hit-area
  const minPadY = Math.round(minHit * 0.22);
  const minPadX = Math.round(minHit * 0.40);

  const paddingY = Math.max(basePadY, minPadY);
  const paddingX = Math.max(basePadX, minPadX);

  // Text size adaptability
  const fontSize = props.textSize ?? typography.body;

  // Focus outline (strong)
  const focusRing = Math.max(props.focusRingPx ?? 3, 2);
  const focusColor = flags.highContrast ? colors.text : colors.primary;

  const handleMouseEnter = (event: MouseEvent<HTMLButtonElement>) => {
    setHovered(true);
    if (props.onMouseEnter) props.onMouseEnter(event);
  };

  const handleMouseLeave = (event: MouseEvent<HTMLButtonElement>) => {
    setHovered(false);
    if (props.onMouseLeave) props.onMouseLeave(event);
  };

  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    setFocused(true);
    if (props.onFocus) props.onFocus(event);
  };

  const handleBlur = (event: FocusEvent<HTMLButtonElement>) => {
    setFocused(false);
    if (props.onBlur) props.onBlur(event);
  };

  // Motor rule: avoid icon-only by default (we already prefer text in layoutSimplification)
  // Also enforce minimum hit target.
  const buttonStyle: React.CSSProperties = {
    minWidth: minHit,
    minHeight: minHit,
    padding: paddingY.toString() + "px " + paddingX.toString() + "px",

    borderRadius: 9999,

    // Avoid mixing shorthand/non-shorthand
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: border,

    backgroundColor: disabled ? colors.border : bg,
    color: disabled ? colors.background : fg,

    fontSize: fontSize,
    lineHeight: typography.lineHeight,
    fontWeight: 800,

    cursor: disabled ? "not-allowed" : "pointer",
    userSelect: "none",

    // Layout: icon + text (span) inside
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: effectiveIconOnly ? 0 : iconGap,

    transform:
      !flags.reducedMotion && hovered && !disabled ? "scale(1.03)" : "scale(1)",

    transition: flags.reducedMotion
      ? "none"
      : "transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",

    outline: "none",

    // Strong focus outline
    boxShadow:
      focused && !disabled
        ? "0 0 0 " + focusRing + "px " + focusColor
        : "none",
  };

  // Merge user inline style (keep your manual merge pattern)
  if (styleProp) {
    const keys = Object.keys(styleProp) as Array<keyof typeof styleProp>;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = styleProp[key];
      if (value !== undefined) {
        (buttonStyle as any)[key] = value;
      }
    }
  }

  const buttonProps: ButtonHTMLAttributes<HTMLButtonElement> = {};
  buttonProps.disabled = disabled;
  buttonProps.className = "adaptive-button " + classNameProp;
  buttonProps.style = buttonStyle;
  buttonProps.onClick = (event: MouseEvent<HTMLButtonElement>) => {
    const elementId = props.id || "btn-" + Math.random().toString(36).substr(2, 5);
    if (event.altKey && openComponentFeedback) {
      event.preventDefault();
      event.stopPropagation();
      openComponentFeedback(elementId, 'button', { 
          variant, 
          text: typeof textChild === 'string' ? textChild : 'nested-content',
          computedSize: minHit
      });
      return;
    }

    if (behaviorTracker?.trackInteraction) {
      behaviorTracker.trackInteraction(elementId, 'click', { 
        variant, 
        text: typeof textChild === 'string' ? textChild : 'nested-content' 
      });
    }
    if (props.onClick) {
      props.onClick(event);
    }
  };
  buttonProps.onMouseEnter = handleMouseEnter;
  buttonProps.onMouseLeave = handleMouseLeave;
  buttonProps.onFocus = handleFocus;
  buttonProps.onBlur = handleBlur;

  if (props.type !== undefined) buttonProps.type = props.type;
  if (props.id !== undefined) buttonProps.id = props.id;
  if (props.name !== undefined) buttonProps.name = props.name;
  if (props.value !== undefined) buttonProps.value = props.value;

  // Accessibility: if iconOnly, ensure aria-label exists
  if (ariaLabelProp !== undefined) {
    (buttonProps as any)["aria-label"] = ariaLabelProp;
  } else if (effectiveIconOnly) {
    (buttonProps as any)["aria-label"] = "Action";
  }

  // ---- Atomic composition: button > (icon) + span(text) ----
  const iconNode =
    icon != null ? (
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          // prevent svg shrinking weirdness
          flex: "0 0 auto",
        }}
      >
        {icon}
      </span>
    ) : null;

  const textNode =
    !effectiveIconOnly && showText && textChild != null ? (
      <span
        style={{
          display: "inline-block",
          whiteSpace: "normal",
          overflowWrap: "anywhere",
          textAlign: "center",
        }}
      >
        {textChild as any}
      </span>
    ) : null;

  let content: React.ReactNode = null;
  if (iconNode && textNode) {
    content = iconPosition === "right" ? (
      <>
        {textNode}
        {iconNode}
      </>
    ) : (
      <>
        {iconNode}
        {textNode}
      </>
    );
  } else if (iconNode) {
    content = iconNode;
  } else {
    content = textNode;
  }

  return React.createElement("button", buttonProps, content);
}
