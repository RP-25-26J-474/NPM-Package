// src/AdaptiveText.tsx
import React from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

export type TextVariant = "h1" | "h2" | "h3" | "body" | "caption";

export interface AdaptiveTextProps extends AdaptiveComponentProps {
  variant?: TextVariant;
  as?: string; // DO NOT use JSX.IntrinsicElements
}

export function AdaptiveText(props: AdaptiveTextProps) {
  const { tokens } = useAdaptive();
  const { colors, typography } = tokens;

  // Extract props manually — no rest/spread
  const variant: TextVariant =
    props.variant === undefined ? "body" : props.variant;

  const asTag =
    props.as !== undefined
      ? props.as
      : variant === "h1"
      ? "h1"
      : variant === "h2"
      ? "h2"
      : variant === "h3"
      ? "h3"
      : variant === "caption"
      ? "span"
      : "p";

  const classNameProp = props.className === undefined ? "" : props.className;
  const styleProp = props.style;
  const children = props.children;

  // Determine the font size from tokens
  const fontSize =
    variant === "h1"
      ? typography.h1
      : variant === "h2"
      ? typography.h2
      : variant === "h3"
      ? typography.h3
      : variant === "caption"
      ? typography.caption
      : typography.body;

  const textStyle: React.CSSProperties = {
    fontSize,
    lineHeight: typography.lineHeight,
    color: colors.text,
    margin: 0,
  };

  // Merge styleProp manually (no spread)
  if (styleProp) {
    const styleKeys = Object.keys(styleProp) as Array<keyof typeof styleProp>;
    for (let i = 0; i < styleKeys.length; i++) {
      const key = styleKeys[i];
      const value = styleProp[key];
      if (value !== undefined) {
        (textStyle as any)[key] = value;
      }
    }
  }

  // Build props to pass to element (no rest/spread)
  const elementProps: any = {
    style: textStyle,
    className: "adaptive-text " + classNameProp,
  };

  // Pass other explicit props manually if needed
  if ((props as any).id !== undefined) elementProps.id = (props as any).id;
  if ((props as any).title !== undefined)
    elementProps.title = (props as any).title;
  if ((props as any)["aria-label"] !== undefined)
    elementProps["aria-label"] = (props as any)["aria-label"];

  // Use createElement to avoid JSX intrinsic issues
  return React.createElement(asTag, elementProps, children);
}
