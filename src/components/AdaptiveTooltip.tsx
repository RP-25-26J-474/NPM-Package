// src/components/AdaptiveTooltip.tsx
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

export type TooltipTriggerType = "auto" | "hover" | "click";

// allow any react element, but make props accessible (not unknown)
type AnyElement = React.ReactElement<any>;

export interface AdaptiveTooltipProps extends AdaptiveComponentProps {
  text: string;
  children: AnyElement;

  trigger?: TooltipTriggerType;
  textSizePx?: number;
  triggerAriaLabel?: string;
  enterDelayMs?: number;
  placement?: "top" | "bottom";
}

const srOnly: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function AdaptiveTooltip({
  text,
  children,
  trigger = "auto",
  textSizePx,
  triggerAriaLabel,
  enterDelayMs,
  placement = "top",
  className,
  style,
}: AdaptiveTooltipProps) {
  const { tokens } = useAdaptive();
  const { colors, typography, spacing, flags } = tokens;

  const [open, setOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const delayTimer = useRef<number | null>(null);

  const reactId = useId();
  const tooltipId = `aura-tooltip-${reactId}`;

  const resolvedTrigger: Exclude<TooltipTriggerType, "auto"> = useMemo(() => {
    if (trigger !== "auto") return trigger;
    if (flags.tooltipAssist || flags.layoutSimplification) return "click";
    return "hover";
  }, [trigger, flags.tooltipAssist, flags.layoutSimplification]);

  const computedTextPx = useMemo(() => {
    if (typeof textSizePx === "number") return Math.max(11, textSizePx);
    const base = typography.basePx;
    const scale = flags.tooltipAssist || flags.layoutSimplification ? 1.0 : 0.9;
    return Math.max(11, Math.round(base * scale));
  }, [textSizePx, typography.basePx, flags.tooltipAssist, flags.layoutSimplification]);

  const effectiveEnterDelay = useMemo(() => {
    if (typeof enterDelayMs === "number") return enterDelayMs;
    return flags.reducedMotion ? 0 : 300;
  }, [enterDelayMs, flags.reducedMotion]);

  function clearDelay() {
    if (delayTimer.current != null) {
      window.clearTimeout(delayTimer.current);
      delayTimer.current = null;
    }
  }

  function openWithDelay() {
    clearDelay();
    delayTimer.current = window.setTimeout(() => setOpen(true), effectiveEnterDelay);
  }

  function closeNow() {
    clearDelay();
    setOpen(false);
  }

  // Click trigger: close on outside click + Escape
  useEffect(() => {
    if (resolvedTrigger !== "click") return;
    if (!open) return;

    function onDocMouseDown(e: MouseEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(e.target as Node)) return;
      setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, resolvedTrigger]);

  // Hover trigger: open/close with delay
  useEffect(() => {
    if (resolvedTrigger !== "hover") return;
    if (hovering) openWithDelay();
    else closeNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovering, resolvedTrigger]);

  const tooltipStyle: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    transform:
      placement === "top"
        ? "translate(-50%, -8px)"
        : "translate(-50%, 8px)",
    bottom: placement === "top" ? "100%" : undefined,
    top: placement === "bottom" ? "100%" : undefined,
    zIndex: 9999,
    maxWidth: "min(360px, 90vw)",
    minWidth: "min(140px, max-content)",        
    width: "max-content",
    padding: `${Math.max(6, spacing.padY)}px ${Math.max(10, spacing.padX)}px`,
    borderRadius: 10,
    background: colors.text,
    color: colors.background,
    fontSize: `${computedTextPx}px`,
    lineHeight: typography.lineHeight,
    fontWeight: 600,
    boxShadow: flags.highContrast ? "none" : "0 12px 40px rgba(0,0,0,0.28)",
    opacity: open ? 1 : 0,
    pointerEvents: "none",
    transition: flags.reducedMotion ? "none" : "opacity 120ms ease",
    whiteSpace: "normal",
    wordBreak: "break-word"
  };

  const arrowStyle: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    width: 10,
    height: 10,
    background: colors.text,
    transform:
      placement === "top"
        ? "translate(-50%, -50%) rotate(45deg)"
        : "translate(-50%, 50%) rotate(45deg)",
    bottom: placement === "top" ? 0 : undefined,
    top: placement === "bottom" ? 0 : undefined,
  };

  const childProps: any = {
    "aria-describedby": open ? tooltipId : undefined,
  };

  if (triggerAriaLabel) childProps["aria-label"] = triggerAriaLabel;

  if (resolvedTrigger === "hover") {
    childProps.onMouseEnter = (e: React.MouseEvent) => {
      setHovering(true);
      children.props.onMouseEnter?.(e);
    };
    childProps.onMouseLeave = (e: React.MouseEvent) => {
      setHovering(false);
      children.props.onMouseLeave?.(e);
    };
    childProps.onFocus = (e: React.FocusEvent) => {
      setOpen(true);
      children.props.onFocus?.(e);
    };
    childProps.onBlur = (e: React.FocusEvent) => {
      setOpen(false);
      children.props.onBlur?.(e);
    };
  } else {
    childProps.onClick = (e: React.MouseEvent) => {
      setOpen((v) => !v);
      children.props.onClick?.(e);
    };
    childProps.onKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
      children.props.onKeyDown?.(e);
    };
  }

  return (
    <span
      ref={rootRef}
      className={className}
      style={{ position: "relative", display: "inline-flex", ...style }}
    >
      {React.cloneElement(children, childProps)}

      <span style={srOnly} aria-live="polite">
        {open ? text : ""}
      </span>

      {open ? (
        <div id={tooltipId} role="tooltip" style={tooltipStyle}>
          {text}
          <div aria-hidden="true" style={arrowStyle} />
        </div>
      ) : null}
    </span>
  );
}
