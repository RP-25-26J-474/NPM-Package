// src/components/AdaptiveFeedback.tsx
import React, { useEffect, useRef, useState, type CSSProperties } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps, AdaptiveFeedbackType } from "../types";

export interface AdaptiveFeedbackProps extends AdaptiveComponentProps {
  prompt?: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  showAfterMs?: number;
  autoReload?: boolean;
  oncePerSession?: boolean;
}

export function AdaptiveFeedback(props: AdaptiveFeedbackProps) {
  const {
    prompt = "How is this UI change?",
    position = "bottom-left",
    showAfterMs = 0,
    autoReload = true,
    oncePerSession = true,
    style,
    className,
  } = props;

  const { tokens, submitFeedback, reload, sessionId, loading } = useAdaptive();
  const { colors, spacing, typography, flags } = tokens;
  const [visible, setVisible] = useState(showAfterMs === 0);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (showAfterMs <= 0) {
      shownAtRef.current = Date.now();
      return;
    }
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      setVisible(true);
      shownAtRef.current = Date.now();
    }, showAfterMs);
    return () => window.clearTimeout(timer);
  }, [showAfterMs]);

  if (!visible || loading || !submitFeedback || !sessionId) {
    return null;
  }

  if (oncePerSession && submitted) {
    return null;
  }

  const handleFeedback = async (type: AdaptiveFeedbackType) => {
    if (sending) return;
    setSending(true);
    const responseTime = shownAtRef.current
      ? Date.now() - shownAtRef.current
      : undefined;

    try {
      await submitFeedback({
        type,
        responseTime,
      });
      setSubmitted(true);
      if (autoReload) {
        await reload();
      }
    } catch (error) {
      console.error("[AURA] Failed to submit feedback", error);
    } finally {
      setSending(false);
    }
  };

  const spacingLg = `${spacing.base * 2}px`;
  const spacingSm = `${spacing.base * 0.5}px`;
  const spacingMd = `${spacing.base}px`;

  const positionStyles: Record<string, CSSProperties> = {
    "bottom-right": { bottom: spacingLg, right: spacingLg },
    "bottom-left": { bottom: spacingLg, left: spacingLg },
    "top-right": { top: spacingLg, right: spacingLg },
    "top-left": { top: spacingLg, left: spacingLg },
  };

  const baseStyle: CSSProperties = {
    position: "fixed",
    ...positionStyles[position],
    padding: spacingMd,
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: "10px",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.12)",
    fontFamily: "system-ui, sans-serif",
    color: colors.text,
    zIndex: 9999,
    minWidth: "220px",
    transition: flags.reducedMotion ? "none" : "opacity 0.2s ease",
    ...style,
  };

  const promptStyle: CSSProperties = {
    marginBottom: spacingSm,
    fontSize: typography.body,
    fontWeight: 600,
  };

  const buttonRowStyle: CSSProperties = {
    display: "flex",
    gap: spacingSm,
  };

  const buttonBase: CSSProperties = {
    flex: 1,
    padding: `${spacingSm} ${spacingMd}`,
    borderRadius: "6px",
    border: `1px solid ${colors.border}`,
    cursor: sending ? "not-allowed" : "pointer",
    fontSize: typography.body,
    lineHeight: typography.lineHeight,
  };

  const positiveStyle: CSSProperties = {
    ...buttonBase,
    background: colors.primary,
    color: colors.onPrimary || colors.text,
  };

  const neutralStyle: CSSProperties = {
    ...buttonBase,
    background: colors.secondary,
    color: colors.onPrimary || colors.text,
  };

  const negativeStyle: CSSProperties = {
    ...buttonBase,
    background: colors.accent,
    color: colors.onPrimary || colors.text,
  };

  return React.createElement(
    "div",
    { style: baseStyle, className },
    React.createElement("div", { style: promptStyle }, prompt),
    React.createElement(
      "div",
      { style: buttonRowStyle },
      React.createElement(
        "button",
        { style: positiveStyle, onClick: () => handleFeedback("positive"), disabled: sending },
        "Good"
      ),
      React.createElement(
        "button",
        { style: neutralStyle, onClick: () => handleFeedback("neutral"), disabled: sending },
        "Ok"
      ),
      React.createElement(
        "button",
        { style: negativeStyle, onClick: () => handleFeedback("negative"), disabled: sending },
        "Bad"
      )
    )
  );
}
