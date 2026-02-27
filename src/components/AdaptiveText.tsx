// src/components/AdaptiveText.tsx
import React from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

export type TextVariant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "lead"
  | "body"
  | "caption"
  | "overline"
  | "code";

export type TextAlign = "left" | "center" | "right" | "justify";
export type TextWeight = "normal" | "medium" | "semibold" | "bold";

export interface AdaptiveTextProps extends AdaptiveComponentProps {
  variant?: TextVariant;
  as?: string; // avoid JSX.IntrinsicElements typing issues

  align?: TextAlign;
  weight?: TextWeight;

  muted?: boolean;
  underline?: boolean;
  strike?: boolean;

  truncate?: boolean; // single-line ellipsis
  maxLines?: number;  // multi-line clamp (best-effort)
}

type AnyStyle = Record<string, any>;

function weightToNumber(w: TextWeight): number {
  if (w === "bold") return 700;
  if (w === "semibold") return 600;
  if (w === "medium") return 500;
  return 400;
}

function pickTag(variant: TextVariant, as?: string): string {
  if (as) return as;

  if (variant === "display" || variant === "h1") return "h1";
  if (variant === "h2") return "h2";
  if (variant === "h3") return "h3";
  if (variant === "h4") return "h4";
  if (variant === "h5") return "h5";
  if (variant === "h6") return "h6";
  if (variant === "caption" || variant === "overline") return "span";
  if (variant === "code") return "code";
  return "p";
}

export function AdaptiveText(props: AdaptiveTextProps) {
  const { tokens } = useAdaptive();
  const { colors, typography, flags, spacing } = tokens;

  const variant: TextVariant =
    props.variant === undefined ? "body" : props.variant;

  const align: TextAlign = props.align === undefined ? "left" : props.align;

  const weight: TextWeight =
    props.weight === undefined
      ? variant === "display" || variant === "h1" || variant === "h2"
        ? "bold"
        : variant === "h3" || variant === "h4"
        ? "semibold"
        : "normal"
      : props.weight;

  const muted = props.muted === true;
  const underline = props.underline === true;
  const strike = props.strike === true;
  const truncate = props.truncate === true;
  const maxLines = props.maxLines;

  const classNameProp = props.className === undefined ? "" : props.className;
  const styleProp = props.style as any;
  const children = (props as any).children;

  const asTag = pickTag(variant, props.as);

  const base = typography.baseSize; // e.g. "16px"
  const size =
    variant === "display"
      ? "calc(" + base + " + 18px)"
      : variant === "h1"
      ? typography.h1
      : variant === "h2"
      ? typography.h2
      : variant === "h3"
      ? typography.h3
      : variant === "h4"
      ? "calc(" + base + " + 2px)"
      : variant === "h5"
      ? base
      : variant === "h6"
      ? "calc(" + base + " - 1px)"
      : variant === "lead"
      ? "calc(" + base + " + 2px)"
      : variant === "caption"
      ? typography.caption
      : variant === "overline"
      ? "calc(" + typography.caption + " - 1px)"
      : variant === "code"
      ? "calc(" + base + " - 1px)"
      : typography.body;

  const baseTextColor = colors.text;
  const secondaryTextColor = flags.highContrast
    ? colors.text
    : colors.secondary
    ? colors.secondary
    : colors.text;

  const textColor = muted ? secondaryTextColor : baseTextColor;

  const textStyle: AnyStyle = {
    fontSize: size,
    lineHeight: typography.lineHeight,
    color: textColor,
    margin: 0,
    textAlign: align,
    fontWeight: weightToNumber(weight),
  };

  // Variant tweaks
  if (variant === "overline") {
    textStyle.letterSpacing = "0.08em";
    textStyle.textTransform = "uppercase";
  }

  if (variant === "code") {
    textStyle.fontFamily =
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    textStyle.backgroundColor = colors.surface;
    const py = Math.max(2, Math.round(spacing.padY * 0.5));
    const px = Math.max(4, Math.round(spacing.padX * 0.75));
    textStyle.padding = py.toString() + "px " + px.toString() + "px";
    textStyle.borderRadius = 6;
  }

  // Decorations
  if (underline && strike) textStyle.textDecoration = "underline line-through";
  else if (underline) textStyle.textDecoration = "underline";
  else if (strike) textStyle.textDecoration = "line-through";

  // Truncation / clamping
  if (truncate) {
    textStyle.whiteSpace = "nowrap";
    textStyle.overflow = "hidden";
    textStyle.textOverflow = "ellipsis";
  } else if (typeof maxLines === "number" && maxLines > 0) {
    textStyle.display = "-webkit-box";
    textStyle.WebkitBoxOrient = "vertical";
    textStyle.WebkitLineClamp = maxLines;
    textStyle.overflow = "hidden";
  }

  // Merge incoming style manually (no spread)
  if (styleProp) {
    const styleKeys = Object.keys(styleProp);
    for (let i = 0; i < styleKeys.length; i++) {
      const key = styleKeys[i];
      const value = styleProp[key];
      if (value !== undefined) {
        textStyle[key] = value;
      }
    }
  }

  const elementProps: any = {
    style: textStyle,
    className: "adaptive-text " + classNameProp,
  };

  // Common passthrough attributes (manual)
  if ((props as any).id !== undefined) elementProps.id = (props as any).id;
  if ((props as any).title !== undefined) elementProps.title = (props as any).title;
  if ((props as any)["aria-label"] !== undefined)
    elementProps["aria-label"] = (props as any)["aria-label"];
  if ((props as any).role !== undefined) elementProps.role = (props as any).role;
  
  // NEW: Track clicks on text (e.g. headers)
  const { behaviorTracker, openComponentFeedback } = useAdaptive();
  const idToUse = (props as any).id || (props as any)["data-testid"] || "text-" + Math.random().toString(36).substr(2, 5);
  
  // Intercept click to track it
  const originalOnClick = (props as any).onClick;
  elementProps.onClick = (e: any) => {
      // ALT + Click for Feedback
      if (e.altKey && openComponentFeedback) {
          e.preventDefault();
          e.stopPropagation();
          openComponentFeedback(idToUse, 'text', { 
            variant, 
            text: typeof children === 'string' ? children : 'nested-text',
            computedSize: parseInt(textStyle.fontSize as string) || 16 
          });
          return;
      }

      if (behaviorTracker?.trackInteraction && idToUse) {
          behaviorTracker.trackInteraction(idToUse, 'click', { variant });
      } else if (behaviorTracker?.trackInteraction) {
           // even without ID, we can track generic text interaction
           behaviorTracker.trackInteraction('text-generic', 'click', { 
               variant, 
               preview: typeof children === 'string' ? children.substring(0, 20) : 'content'
            });
      }
      
      if (originalOnClick) originalOnClick(e);
  };

  return React.createElement(asTag, elementProps, children);
}
