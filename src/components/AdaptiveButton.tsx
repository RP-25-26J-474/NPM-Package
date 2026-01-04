// src/components/AdaptiveButton.tsx
import React, {
  useState,
  type MouseEvent,
  type ButtonHTMLAttributes,
} from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

export type ButtonVariant = "primary" | "secondary" | "accent" | "ghost";

export interface AdaptiveButtonProps
  extends AdaptiveComponentProps,
    ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function AdaptiveButton(props: AdaptiveButtonProps) {
  const { tokens } = useAdaptive();
  const { colors, spacing, controls, typography, flags } = tokens;

  const [hovered, setHovered] = useState(false);

  const variant: ButtonVariant =
    props.variant === undefined ? "primary" : props.variant;

  const classNameProp = props.className === undefined ? "" : props.className;
  const styleProp = props.style;
  const children = props.children;
  const disabled = props.disabled === true;

  const onClickProp = props.onClick;
  const onMouseEnterProp = props.onMouseEnter;
  const onMouseLeaveProp = props.onMouseLeave;
  const typeProp = props.type;
  const ariaLabelProp = (props as any)["aria-label"];
  const idProp = props.id;
  const nameProp = props.name;
  const valueProp = props.value;

  // ---- Variant colors (new schema has explicit content colors) ----
  let bg = colors.primary;
  let fg = colors.onPrimary;

  if (variant === "secondary") {
    bg = colors.secondary;
    fg = colors.onSecondary;
  } else if (variant === "accent") {
    bg = colors.accent;
    fg = colors.onAccent;
  } else if (variant === "ghost") {
    bg = "transparent";
    fg = colors.primary;
  }

  // ---- New spacing tokens ----
  // Use ML padding as the base. Ensure the control is still finger-friendly.
  const basePadY = spacing.padY;
  const basePadX = spacing.padX;

  // Guarantee minimum comfort padding relative to target size
  const minPadY = Math.round(controls.minTargetSize * 0.22);
  const minPadX = Math.round(controls.minTargetSize * 0.40);

  const paddingY = Math.max(basePadY, minPadY);
  const paddingX = Math.max(basePadX, minPadX);

  const handleMouseEnter = (event: MouseEvent<HTMLButtonElement>) => {
    setHovered(true);
    if (onMouseEnterProp) onMouseEnterProp(event);
  };

  const handleMouseLeave = (event: MouseEvent<HTMLButtonElement>) => {
    setHovered(false);
    if (onMouseLeaveProp) onMouseLeaveProp(event);
  };

  const buttonStyle: React.CSSProperties = {
    minWidth: controls.minTargetSize,
    minHeight: controls.minTargetSize,
    padding: paddingY.toString() + "px " + paddingX.toString() + "px",

    borderRadius: 9999,
    border:
      variant === "ghost"
        ? "1px solid " + colors.primary
        : "1px solid " + colors.border,

    backgroundColor: disabled ? colors.border : bg,
    color: disabled ? colors.background : fg,

    fontSize: typography.body,
    lineHeight: typography.lineHeight,

    cursor: disabled ? "not-allowed" : "pointer",

    transform:
      !flags.reducedMotion && hovered && !disabled ? "scale(1.03)" : "scale(1)",

    transition: flags.reducedMotion
      ? "none"
      : "transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease",

    outline: "none",
  };

  // Merge user-provided inline style manually (no object spread)
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
  buttonProps.onClick = onClickProp;
  buttonProps.onMouseEnter = handleMouseEnter;
  buttonProps.onMouseLeave = handleMouseLeave;

  if (typeProp !== undefined) buttonProps.type = typeProp;
  if (ariaLabelProp !== undefined) (buttonProps as any)["aria-label"] = ariaLabelProp;
  if (idProp !== undefined) buttonProps.id = idProp;
  if (nameProp !== undefined) buttonProps.name = nameProp;
  if (valueProp !== undefined) buttonProps.value = valueProp;

  return React.createElement("button", buttonProps, children);
}
