// src/components/AdaptiveAlert.tsx
import React, { useEffect, useState } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

type AnyStyle = Record<string, any>;

export type AdaptiveAlertVariant = "info" | "success" | "warning" | "error";
export type AdaptiveAlertEmphasis = "auto" | "icon" | "text" | "balanced";

export interface AdaptiveAlertProps extends AdaptiveComponentProps {
  variant?: AdaptiveAlertVariant;
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  showIcon?: boolean;
  emphasis?: AdaptiveAlertEmphasis;

  /** Optional: enables a strong semi-transparent standard background color (useful for low-literacy users) */
  filled?: boolean;

  textSize?: string;
  durationMs?: number;
  extendDurationForVisual?: boolean;
  onDismiss?: () => void;

  role?: "status" | "alert";
  ariaLabel?: string;

  iconClassName?: string;
  iconStyle?: React.CSSProperties;
  textClassName?: string;
  textStyle?: React.CSSProperties;
  titleClassName?: string;
  titleStyle?: React.CSSProperties;
  messageClassName?: string;
  messageStyle?: React.CSSProperties;
}

function mergeStyle(target: AnyStyle, incoming: any) {
  if (!incoming) return;
  const keys = Object.keys(incoming);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = incoming[k];
    if (v !== undefined) target[k] = v;
  }
}

function defaultIcon(variant: AdaptiveAlertVariant) {
  if (variant === "success") {
    return React.createElement(
      "svg",
      {
        viewBox: "0 0 20 20",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        width: 16,
        height: 16,
        "aria-hidden": "true",
      } as any,
      React.createElement("path", { d: "M5 10l3 3 7-7" } as any)
    );
  }

  if (variant === "warning") {
    return React.createElement(
      "svg",
      {
        viewBox: "0 0 20 20",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        width: 16,
        height: 16,
        "aria-hidden": "true",
      } as any,
      React.createElement("path", { d: "M10 3l7 14H3l7-14z" } as any),
      React.createElement("path", { d: "M10 8v3" } as any),
      React.createElement("path", { d: "M10 14h.01" } as any)
    );
  }

  if (variant === "error") {
    return React.createElement(
      "svg",
      {
        viewBox: "0 0 20 20",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        width: 16,
        height: 16,
        "aria-hidden": "true",
      } as any,
      React.createElement("path", { d: "M6 6l8 8" } as any),
      React.createElement("path", { d: "M14 6l-8 8" } as any)
    );
  }

  return React.createElement(
    "svg",
    {
      viewBox: "0 0 20 20",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      width: 16,
      height: 16,
      "aria-hidden": "true",
    } as any,
    React.createElement("circle", { cx: 10, cy: 10, r: 7 } as any),
    React.createElement("path", { d: "M10 7h.01" } as any),
    React.createElement("path", { d: "M10 10v4" } as any)
  );
}

function variantLabel(variant: AdaptiveAlertVariant): string {
  if (variant === "success") return "Success";
  if (variant === "warning") return "Warning";
  if (variant === "error") return "Error";
  return "Info";
}

export function AdaptiveAlert(props: AdaptiveAlertProps) {
  const { tokens } = useAdaptive();
  const { colors, typography, spacing, controls, flags } = tokens;

  const [visible, setVisible] = useState(true);

  const variant: AdaptiveAlertVariant = props.variant || "info";
  const lowLiteracy = flags.tooltipAssist || flags.layoutSimplification;
  const visualAssist = flags.highContrast;

  const emphasis: AdaptiveAlertEmphasis =
    props.emphasis === undefined
      ? visualAssist
        ? "icon"
        : lowLiteracy
        ? "text"
        : "balanced"
      : props.emphasis;

  const showIcon = props.showIcon === undefined ? true : props.showIcon;

  const textSize =
    props.textSize !== undefined
      ? props.textSize
      : lowLiteracy || visualAssist
      ? (typography.basePx + 1).toString() + "px"
      : typography.body;

  const titleText =
    props.title !== undefined ? props.title : variantLabel(variant);

  const children = (props as any).children;
  const message = children !== undefined ? children : props.message;

  const baseAccent =
    variant === "success"
      ? colors.secondary
      : variant === "warning" || variant === "error"
      ? colors.accent
      : colors.primary;

  const baseOnAccent =
    variant === "success"
      ? colors.onSecondary
      : variant === "warning" || variant === "error"
      ? colors.onAccent
      : colors.onPrimary;

  const padY = Math.max(10, spacing.padY);
  const padX = Math.max(12, spacing.padX);

  const iconSize = Math.max(18, Math.round(typography.basePx * 1.1));
  const iconScale = emphasis === "icon" ? 1.2 : 1;
  const iconBoxSize = Math.round(iconSize * iconScale) + 10;

  const containerStyle: AnyStyle = {
    width: "100%",
    display: "flex",
    alignItems: "flex-start",
    columnGap: Math.max(10, Math.round(spacing.gapX * 0.8)),
    padding: padY.toString() + "px " + padX.toString() + "px",
    borderRadius: 16,
    borderWidth: visualAssist ? 2 : 1,
    borderStyle: "solid",
    borderColor: baseAccent,
    backgroundColor: colors.surface,
    color: colors.text,
    boxSizing: "border-box",
  };

  // New feature: optional strong semi-transparent standard background
  if (props.filled === true) {
    const filledBackgrounds: Record<AdaptiveAlertVariant, string> = {
      info: "rgba(59, 130, 246, 0.2)",     // blue-500
      success: "rgba(34, 197, 94, 0.2)",   // green-600
      warning: "rgba(251, 191, 36, 0.2)",  // amber-400
      error: "rgba(239, 68, 68, 0.2)",     // red-500
    };
    containerStyle.backgroundColor = filledBackgrounds[variant];
  }

  if (!flags.highContrast) {
    containerStyle.boxShadow = "0 10px 24px rgba(0,0,0,0.08)";
  }

  mergeStyle(containerStyle, props.style);

  const containerClassName =
    "adaptive-alert flex items-start rounded-2xl border " + (props.className || "");

  const iconWrapStyle: AnyStyle = {
    width: iconBoxSize,
    height: iconBoxSize,
    borderRadius: 9999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    backgroundColor: baseAccent,
    color: baseOnAccent,
    boxSizing: "border-box",
    borderWidth: visualAssist ? 2 : 1,
    borderStyle: "solid",
    borderColor: visualAssist ? baseAccent : "transparent",
    fontSize: Math.max(12, Math.round(typography.basePx * 0.75)),
    fontWeight: 700,
  };

  mergeStyle(iconWrapStyle, props.iconStyle);

  const iconClassName =
    "adaptive-alert__icon flex items-center justify-center " +
    (props.iconClassName || "");

  const textWrapStyle: AnyStyle = {
    display: "flex",
    flexDirection: "column",
    rowGap: Math.max(4, Math.round(spacing.gapY * 0.4)),
    minWidth: 0,
    flex: 1,
  };

  mergeStyle(textWrapStyle, props.textStyle);

  const textClassName =
    "adaptive-alert__text flex flex-col " + (props.textClassName || "");

  const titleStyle: AnyStyle = {
    fontSize: textSize,
    lineHeight: typography.lineHeight,
    fontWeight: emphasis === "text" ? 700 : 600,
    color: colors.text,
  };

  mergeStyle(titleStyle, props.titleStyle);

  const titleClassName =
    "adaptive-alert__title " +
    (emphasis === "text" ? "font-semibold" : "font-medium ") +
    (props.titleClassName || "");

  const messageStyle: AnyStyle = {
    fontSize: textSize,
    lineHeight: typography.lineHeight,
    color: colors.text,
    opacity: 0.9,
  };

  mergeStyle(messageStyle, props.messageStyle);

  const messageClassName =
    "adaptive-alert__message " + (props.messageClassName || "");

  const role =
    props.role !== undefined
      ? props.role
      : variant === "error"
      ? "alert"
      : "status";

  const ariaLabel = props.ariaLabel || titleText;

  const durationMs = props.durationMs;
  const extendDurationForVisual = props.extendDurationForVisual !== false;

  useEffect(() => {
    if (durationMs === undefined || durationMs <= 0) return;
    if (typeof window === "undefined") return;

    const factor = visualAssist && extendDurationForVisual ? 1.5 : 1;
    const effectiveDuration = Math.round(durationMs * factor);

    const timer = window.setTimeout(() => {
      setVisible(false);
      if (props.onDismiss) props.onDismiss();
    }, effectiveDuration);

    return () => window.clearTimeout(timer);
  }, [durationMs, extendDurationForVisual, visualAssist, props.onDismiss]);

  if (!visible) return null;

  const iconNode = props.icon !== undefined ? props.icon : defaultIcon(variant);

  return React.createElement(
    "div",
    {
      role,
      "aria-live": role === "alert" ? "assertive" : "polite",
      "aria-atomic": "true",
      "aria-label": ariaLabel,
      style: containerStyle,
      className: containerClassName,
    } as any,
    showIcon
      ? React.createElement(
          "div",
          { style: iconWrapStyle, className: iconClassName } as any,
          iconNode
        )
      : null,
    React.createElement(
      "div",
      { style: textWrapStyle, className: textClassName } as any,
      titleText
        ? React.createElement(
            "div",
            { style: titleStyle, className: titleClassName } as any,
            titleText
          )
        : null,
      message
        ? React.createElement(
            "div",
            { style: messageStyle, className: messageClassName } as any,
            message
          )
        : null
    )
  );
}