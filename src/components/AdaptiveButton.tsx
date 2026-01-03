// src/AdaptiveButton.tsx
import React, {
  useState,
  type MouseEvent,
  type ButtonHTMLAttributes,
} from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface AdaptiveButtonProps
  extends AdaptiveComponentProps,
    ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function AdaptiveButton(props: AdaptiveButtonProps) {
  const { tokens, behaviorTracker } = useAdaptive();
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
    if (onMouseLeaveProp) {
      onMouseLeaveProp(event);
    }
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
    backgroundColor: disabled ? colors.border : baseBg,
    color: disabled ? colors.background : textColor,
    fontSize: typography.body,
    lineHeight: typography.lineHeight,
    cursor: disabled ? "not-allowed" : "pointer",
    transform:
      !flags.reducedMotion && hovered && !disabled
        ? "scale(1.03)"
        : "scale(1)",
    transition: flags.reducedMotion
      ? "none"
      : "transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease",
    outline: "none",
  };

  // Merge any user-provided inline style manually (no object spread)
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
  if (typeProp !== undefined) buttonProps.type = typeProp;
  if (ariaLabelProp !== undefined) (buttonProps as any)["aria-label"] = ariaLabelProp;
  if (idProp !== undefined) buttonProps.id = idProp;
  if (nameProp !== undefined) buttonProps.name = nameProp;
  if (valueProp !== undefined) buttonProps.value = valueProp;

  // Use createElement instead of JSX to avoid JSX intrinsic element typing issues
  return React.createElement("button", buttonProps, children);
}
