// src/components/AdaptiveSwitch.tsx
import React, { useId, useState } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

type AnyStyle = Record<string, any>;

export interface AdaptiveSwitchProps extends AdaptiveComponentProps {
  /** Main label (visible) */
  label: string;

  /** Optional help text under the label */
  description?: string;

  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;

  disabled?: boolean;

  /** Adaptable overrides */
  switchHeightPx?: number;       // track height
  hitAreaPx?: number;            // >= 44 recommended
  gapPx?: number;                // spacing between text and switch
  labelFontSizePx?: number;      // label size
  showStateText?: boolean;       // ON/OFF redundancy (default true)
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

export function AdaptiveSwitch({
  label,
  description,
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  switchHeightPx,
  hitAreaPx,
  gapPx,
  labelFontSizePx,
  showStateText = true,
  className,
  style,
}: AdaptiveSwitchProps) {
  const { tokens } = useAdaptive();
  const { colors, typography, spacing, controls, flags } = tokens;

  const id = useId();
  const labelId = id + "-label";
  const descId = description ? id + "-desc" : undefined;

  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState(Boolean(defaultChecked));
  const isOn = isControlled ? Boolean(checked) : internal;
  const [focused, setFocused] = useState(false);

  const HIT = Math.max(hitAreaPx ?? controls.minTargetSize, 44);

  const trackHeight = Math.max(
    switchHeightPx ?? Math.round(typography.basePx * 1.1),
    22
  );

  const trackWidth = Math.max(Math.round(trackHeight * 2), trackHeight + 26);
  const thumbSize = Math.max(16, trackHeight - 2);

  const GAP = Math.max(gapPx ?? spacing.gapX * 1.2, 12);
  const labelPx = Math.max(labelFontSizePx ?? typography.basePx, 12);
  const descPx = Math.max(12, Math.round(typography.basePx * 0.88));

  const borderColor = flags.highContrast ? colors.text : colors.border;

  const trackOn = colors.primary;
  const trackOff = colors.surface;
  const thumbBg = colors.background;

  const transition = flags.reducedMotion ? "none" : "all 140ms ease";

  const toggle = () => {
    if (disabled) return;
    const next = !isOn;
    if (!isControlled) setInternal(next);
    if (onChange) onChange(next);
  };

  const wrapperStyle: AnyStyle = {
    maxWidth: "100%",
  };

  mergeStyle(wrapperStyle, style);

  const rowStyle: AnyStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: GAP,
    width: "100%",
  };

  const textWrapStyle: AnyStyle = {
    display: "flex",
    flexDirection: "column",
    rowGap: Math.max(4, Math.round(spacing.gapY * 0.6)),
    flex: "1 1 auto",
    minWidth: 0,
    cursor: disabled ? "not-allowed" : "pointer",
  };

  const labelStyle: AnyStyle = {
    fontSize: labelPx.toString() + "px",
    lineHeight: typography.lineHeight,
    fontWeight: 600,
    color: colors.text,
    wordBreak: "break-word",
  };

  const descStyle: AnyStyle = {
    fontSize: descPx.toString() + "px",
    lineHeight: typography.lineHeight,
    color: flags.highContrast ? colors.text : "#6b7280",
    wordBreak: "break-word",
  };

  const switchButtonStyle: AnyStyle = {
    minHeight: HIT,
    minWidth: trackWidth,
    padding: 0,
    borderWidth: 0,
    borderStyle: "solid",
    borderColor: "transparent",
    backgroundColor: "transparent",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
  };

  const switchWrapStyle: AnyStyle = {
    display: "inline-flex",
    alignItems: "center",
    columnGap: Math.max(8, Math.round(spacing.gapX * 0.8)),
  };

  const trackStyle: AnyStyle = {
    width: trackWidth,
    height: trackHeight,
    borderRadius: trackHeight / 2,
    borderWidth: flags.highContrast ? 2 : 1,
    borderStyle: "solid",
    borderColor: isOn ? trackOn : borderColor,
    backgroundColor: isOn ? trackOn : trackOff,
    position: "relative",
    boxSizing: "border-box",
    transition,
    opacity: disabled ? 0.6 : 1,
    boxShadow:
      focused && !disabled ? "0 0 0 3px " + colors.primary : "none",
  };

  const thumbLeft = isOn ? trackWidth - thumbSize - 3 : 3;

  const thumbStyle: AnyStyle = {
    position: "absolute",
    top: "50%",
    left: thumbLeft,
    transform: "translateY(-50%)",
    width: thumbSize,
    height: thumbSize,
    borderRadius: 9999,
    backgroundColor: thumbBg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: borderColor,
    boxShadow: flags.highContrast ? "none" : "0 6px 16px rgba(0,0,0,0.18)",
    transition,
  };

  const stateTextStyle: AnyStyle = {
    fontSize: Math.max(12, Math.round(typography.basePx * 0.8)).toString() + "px",
    lineHeight: typography.lineHeight,
    fontWeight: 700,
    color: colors.text,
    textTransform: "uppercase",
    opacity: disabled ? 0.6 : 0.85,
  };

  return (
    <div className={className} style={wrapperStyle}>
      <div style={rowStyle}>
        <div style={textWrapStyle} onClick={toggle}>
          <span id={labelId} style={labelStyle}>
            {label}
          </span>
          {description ? (
            <span id={descId} style={descStyle}>
              {description}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-labelledby={labelId}
          aria-describedby={descId}
          disabled={disabled}
          onClick={toggle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle();
            }
          }}
          style={switchButtonStyle}
        >
          <span style={switchWrapStyle}>
            <span aria-hidden="true" style={trackStyle}>
              <span style={thumbStyle} />
            </span>
            {showStateText ? (
              <span style={stateTextStyle}>{isOn ? "On" : "Off"}</span>
            ) : null}
          </span>
        </button>
      </div>
    </div>
  );
}
