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
  const idProp = props.id || (props as any)["data-testid"] || "button-" + Math.random().toString(36).substr(2, 5);
  const nameProp = props.name;
  const valueProp = props.value;

  const baseBg =
    variant === "secondary"
      ? colors.secondary
      : variant === "ghost"
      ? "transparent"
      : colors.primary;

  const textColor =
    variant === "ghost" ? colors.primary : colors.onPrimary ?? colors.text;

  const paddingY = Math.max(
    spacing.base,
    Math.round(controls.minTargetSize * 0.25)
  );
  const paddingX = paddingY * 2;

  const handleMouseEnter = (event: MouseEvent<HTMLButtonElement>) => {
    setHovered(true);
    if (behaviorTracker?.trackInteraction) {
        behaviorTracker.trackInteraction(idProp, 'hover', { variant });
    }
    if (onMouseEnterProp) {
      onMouseEnterProp(event);
    }
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      // NEW: Active Feedback Trigger (Alt + Click)
      if (event.altKey && openComponentFeedback) {
        event.preventDefault();
        event.stopPropagation();
        openComponentFeedback(idProp, 'button', { 
            variant, 
            text: typeof children === 'string' ? children : 'nested-content',
            computedSize: controls.minTargetSize
        });
        return;
      }

      if (behaviorTracker?.trackInteraction) {
          behaviorTracker.trackInteraction(idProp, 'click', { 
            variant, 
            text: typeof children === 'string' ? children : 'nested-content' 
          });
      }
      if (onClickProp) {
          onClickProp(event);
      }
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
  buttonProps.onClick = handleClick; // Use the instrumented handler
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
      <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
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
