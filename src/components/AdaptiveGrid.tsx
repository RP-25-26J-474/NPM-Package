// src/components/AdaptiveGrid.tsx
import React, { useEffect, useState } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

type AnyStyle = Record<string, any>;

export interface AdaptiveGridProps extends AdaptiveComponentProps {
  /**
   * Base number of columns (desktop-like intent).
   * ML and viewport will adapt this automatically.
   */
  columns?: number;
  minColumns?: number;
  maxColumns?: number;

  /**
   * Minimum column width in px (for auto-fit behavior).
   * Helps responsive + accessibility layouts.
   */
  minColumnWidth?: number;
  maxColumnWidth?: number;

  /**
   * If true, column count adapts to viewport width.
   */
  autoFit?: boolean;

  /**
   * Collapse to a single column below this viewport width (px).
   */
  collapseBelow?: number;

  /**
   * Enable adaptive inner padding using page spacing tokens.
   */
  withContainerPadding?: boolean;

  /**
   * Compact spacing.
   */
  dense?: boolean;

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

function safeNumber(v: any, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampInt(n: number, min: number, max: number): number {
  const fixed = Math.round(n);
  if (fixed < min) return min;
  if (fixed > max) return max;
  return fixed;
}

function getViewportWidth(): number {
  if (typeof window === "undefined") return 1280;
  return window.innerWidth;
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
  const { colors, typography, spacing, flags, controls } = tokens;
  const [viewportWidth, setViewportWidth] = useState<number>(getViewportWidth);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setViewportWidth(getViewportWidth());
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const maxColumnsProp =
    props.maxColumns === undefined ? props.columns === undefined ? 3 : props.columns : props.maxColumns;
  const maxColumns = clampInt(Math.max(1, maxColumnsProp), 1, 12);
  const minColumnsProp = props.minColumns === undefined ? 1 : props.minColumns;
  const minColumns = clampInt(Math.max(1, minColumnsProp), 1, maxColumns);

  const baseMinColumnWidth = props.minColumnWidth === undefined ? 220 : props.minColumnWidth;
  const maxColumnWidth =
    props.maxColumnWidth === undefined
      ? undefined
      : Math.max(baseMinColumnWidth, props.maxColumnWidth);
  const autoFit = props.autoFit === undefined ? true : props.autoFit;
  const withContainerPadding = props.withContainerPadding === true;
  const dense = props.dense === true;

  // ML-driven simplification
  const simplify = flags.layoutSimplification === true && props.detailed !== true;

  const bodyPx = Math.max(12, safeNumber(typography.basePx, 16));
  const lineHeight = Math.max(1, safeNumber(typography.lineHeight, 1.4));

  // Token-driven track width so content stays readable and touch-friendly.
  const readableTrackWidth = Math.round(bodyPx * 14 + spacing.padX * 2);
  const targetTrackWidth = Math.round(
    Math.max(controls.minTargetSize * (flags.tooltipAssist ? 6.4 : 5.2), spacing.padX * 4 + controls.minTargetSize)
  );

  let effectiveMinTrack = Math.max(baseMinColumnWidth, readableTrackWidth, targetTrackWidth);

  if (simplify) {
    effectiveMinTrack = Math.round(effectiveMinTrack * 1.15);
  }
  if (flags.highContrast) {
    effectiveMinTrack = Math.round(effectiveMinTrack * 1.06);
  }

  if (maxColumnWidth !== undefined && maxColumnWidth > 0) {
    effectiveMinTrack = Math.min(effectiveMinTrack, maxColumnWidth);
  }

  // Gap + padding adapt from spacing tokens and accessibility flags.
  const gapScale = dense ? 0.8 : simplify ? 1.05 : 1;
  const gapX = Math.max(8, Math.round(safeNumber(spacing.gapX, 10) * gapScale));
  const gapY = Math.max(8, Math.round(safeNumber(spacing.gapY, 10) * gapScale));

  const padX = withContainerPadding
    ? Math.max(0, Math.round(safeNumber(spacing.pagePaddingX, 0)))
    : 0;
  const padY = withContainerPadding
    ? Math.max(0, Math.round(safeNumber(spacing.pagePaddingY, 0)))
    : 0;

  // Responsive column count from available width + min track width.
  const availableWidth = Math.max(220, viewportWidth - padX * 2);
  const estimatedColumnsByWidth = Math.max(
    1,
    Math.floor((availableWidth + gapX) / Math.max(1, effectiveMinTrack + gapX))
  );

  let effectiveMaxColumns = maxColumns;
  if (simplify) {
    effectiveMaxColumns = Math.min(effectiveMaxColumns, 2);
  }
  if (controls.minTargetSize >= 28) {
    effectiveMaxColumns = Math.min(effectiveMaxColumns, 2);
  }
  if (controls.minTargetSize >= 36) {
    effectiveMaxColumns = 1;
  }

  const collapseThreshold =
    props.collapseBelow === undefined
      ? Math.max(420, effectiveMinTrack + gapX * 2 + padX * 2)
      : props.collapseBelow;

  let effectiveColumns = autoFit
    ? clampInt(estimatedColumnsByWidth, Math.min(minColumns, effectiveMaxColumns), effectiveMaxColumns)
    : effectiveMaxColumns;

  if (viewportWidth <= collapseThreshold) {
    effectiveColumns = 1;
  }

  const adaptiveBackground =
    flags.theme === "dark" ? colors.surface : colors.background;

  const style: AnyStyle = {
    display: "grid",
    columnGap: gapX.toString() + "px",
    rowGap: gapY.toString() + "px",
    gridTemplateColumns: `repeat(${effectiveColumns}, minmax(min(100%, ${effectiveMinTrack}px), 1fr))`,
    alignItems: props.alignItems || "stretch",
    justifyItems: props.justifyItems || "stretch",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    color: colors.text,
    backgroundColor:
      withContainerPadding || flags.highContrast ? adaptiveBackground : undefined,
    fontSize: typography.body,
    lineHeight,
    padding:
      withContainerPadding && (padX > 0 || padY > 0)
        ? padY.toString() + "px " + padX.toString() + "px"
        : undefined,
    border: flags.highContrast ? "1px solid " + colors.border : undefined,
    borderRadius: flags.highContrast ? 10 : undefined,
    transition: flags.reducedMotion ? "none" : "grid-template-columns 0.2s ease, gap 0.2s ease",
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
