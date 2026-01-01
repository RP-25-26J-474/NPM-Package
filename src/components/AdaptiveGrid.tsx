// src/components/AdaptiveGrid.tsx
import React from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

type AnyStyle = Record<string, any>;

export interface AdaptiveGridProps extends AdaptiveComponentProps {
  /**
   * Base number of columns (desktop-like intent).
   * ML and viewport will adapt this automatically.
   */
  columns?: number;

  /**
   * Minimum column width in px (for auto-fit behavior).
   * Helps responsive + accessibility layouts.
   */
  minColumnWidth?: number;

  /**
   * Alignment of items inside grid cells.
   */
  alignItems?: "start" | "center" | "end" | "stretch";

  /**
   * Justification of grid content.
   */
  justifyItems?: "start" | "center" | "end" | "stretch";

  /**
   * Override ML simplification (keep dense grid even if ML simplifies).
   */
  detailed?: boolean;
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

export function AdaptiveGrid(props: AdaptiveGridProps) {
  const { tokens } = useAdaptive();
  const { spacing, flags, controls } = tokens;

  const baseColumns = props.columns === undefined ? 3 : props.columns;
  const minColumnWidth = props.minColumnWidth === undefined ? 220 : props.minColumnWidth;

  // ML-driven simplification
  const simplify = flags.layoutSimplification === true && props.detailed !== true;

  /**
   * Column logic:
   * - In simplified mode → fewer columns
   * - For motor impairment → fewer columns (larger targets)
   */
  let effectiveColumns = baseColumns;

  if (simplify) {
    effectiveColumns = Math.min(2, baseColumns);
  }

  if (controls.minTargetSize >= 28) {
    effectiveColumns = Math.min(effectiveColumns, 2);
  }

  if (controls.minTargetSize >= 36) {
    effectiveColumns = 1;
  }

  // Gap adapts with spacing token
  const gapPx = Math.max(10, Math.round(spacing.base * 1.5));

  const style: AnyStyle = {
    display: "grid",
    gap: gapPx + "px",
    gridTemplateColumns: `repeat(${effectiveColumns}, minmax(${minColumnWidth}px, 1fr))`,
    alignItems: props.alignItems || "stretch",
    justifyItems: props.justifyItems || "stretch",
    width: "100%",
  };

  mergeStyle(style, props.style);

  const classNameProp = props.className === undefined ? "" : props.className;

  return React.createElement(
    "div",
    {
      style,
      className: "adaptive-grid " + classNameProp,
    } as any,
    (props as any).children
  );
}
