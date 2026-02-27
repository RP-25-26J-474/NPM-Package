// src/components/AdaptiveCheckbox.tsx
import React, { useId } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

export interface AdaptiveCheckboxProps extends AdaptiveComponentProps {
  label: string;

  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;

  disabled?: boolean;

  boxSizePx?: number;
  hitAreaPx?: number; // >= 44
  labelFontSizePx?: number;
  labelLineHeight?: number;
  gapPx?: number;
}

export function AdaptiveCheckbox({
  label,
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  boxSizePx,
  hitAreaPx,
  labelFontSizePx,
  labelLineHeight,
  gapPx,
  className,
  style,
}: AdaptiveCheckboxProps) {
  const { tokens } = useAdaptive();
  const { colors, typography, spacing, controls, flags } = tokens;

  const id = useId();

  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(Boolean(defaultChecked));
  const isChecked = isControlled ? Boolean(checked) : internal;

  const HIT = Math.max(hitAreaPx ?? controls.minTargetSize, 44);
  const BOX = Math.max(boxSizePx ?? Math.round(typography.basePx * 1.1), 18);
  const GAP = Math.max(gapPx ?? spacing.gapX, 10);

  const fontPx = Math.max(labelFontSizePx ?? typography.basePx, 12);
  const lh = labelLineHeight ?? typography.lineHeight;

  const borderColor = flags.highContrast ? colors.text : colors.border;
  const fill = isChecked ? colors.primary : colors.background;

  const checkStroke = flags.highContrast ? colors.text : colors.onPrimary;
  const checkStrokeWidth = flags.highContrast ? 3.5 : 3;

  const toggle = () => {
    if (disabled) return;
    const next = !isChecked;
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <div className={className} style={style}>
      <label
        htmlFor={id}
        style={{
          display: "inline-flex",
          alignItems: "center", // ✅ horizontal alignment fixed
          gap: GAP,
          cursor: disabled ? "not-allowed" : "pointer",
          userSelect: "none",
          maxWidth: "100%",
        }}
      >
        {/* Fixed 44×44 hit area, centers checkbox without vertical drift */}
        <span
          style={{
            width: HIT,
            height: HIT,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
          }}
          onClick={(e) => {
            e.preventDefault();
            toggle();
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: BOX,
              height: BOX,
              borderRadius: 6,
              border: `2px solid ${borderColor}`,
              background: fill,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box",
            }}
          >
            {isChecked ? (
              <svg width={BOX - 2} height={BOX - 2} viewBox="0 0 24 24">
                <path
                  d="M20 6L9 17l-5-5"
                  fill="none"
                  stroke={checkStroke}
                  strokeWidth={checkStrokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </span>
        </span>

        {/* Real input (accessible) */}
        <input
          id={id}
          type="checkbox"
          checked={isControlled ? isChecked : undefined}
          defaultChecked={!isControlled ? internal : undefined}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.checked;
            if (!isControlled) setInternal(next);
            onChange?.(next);
          }}
          style={{
            position: "absolute",
            opacity: 0,
            width: 1,
            height: 1,
            pointerEvents: "none",
          }}
        />

        {/* Text scales independently */}
        <span
          style={{
            fontSize: `${fontPx}px`,
            lineHeight: lh,
            fontWeight: 700,
            color: colors.text,
            maxWidth: "100%",
            wordBreak: "break-word",
          }}
        >
          {label}
        </span>
      </label>
    </div>
  );
}
