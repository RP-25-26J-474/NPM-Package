// src/components/AdaptiveList.tsx
import React, { createContext, useContext } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

type AnyStyle = Record<string, any>;

type ListCtx = {
  tokens: any;
  dense: boolean;
};

const ListContext = createContext<ListCtx | null>(null);

function mergeStyle(target: AnyStyle, incoming: any) {
  if (!incoming) return;
  const keys = Object.keys(incoming);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = incoming[k];
    if (v !== undefined) target[k] = v;
  }
}

function useListCtx(): ListCtx {
  const ctx = useContext(ListContext);
  if (!ctx) throw new Error("AdaptiveList.* must be used inside <AdaptiveList>");
  return ctx;
}

function safeNum(v: any, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/* ---------------- Root ---------------- */

export interface AdaptiveListProps extends AdaptiveComponentProps {
  /** Compact rows (developer override). If omitted, derives from ML spacing. */
  dense?: boolean;

  /** Optional aria-label */
  ariaLabel?: string;
}

function AdaptiveListRoot(props: AdaptiveListProps) {
  const { tokens } = useAdaptive();
  const { colors, flags, spacing, typography } = tokens;

  const gapX = safeNum(spacing?.gapX, 10);
  const gapY = safeNum(spacing?.gapY, 10);
  const padX = safeNum(spacing?.padX, 14);
  const padY = safeNum(spacing?.padY, 12);

  const dense =
    props.dense === undefined
      ? gapY <= 6 || gapX <= 6
      : props.dense === true;

  const wrapperStyle: AnyStyle = {
    width: "100%",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    color: colors.text,
    padding: padY.toString() + "px " + padX.toString() + "px",
    boxSizing: "border-box",
    fontSize: typography.body,
    lineHeight: typography.lineHeight,
  };

  if (!flags.highContrast) {
    wrapperStyle.boxShadow = "0 8px 22px rgba(0,0,0,0.10)";
  }

  mergeStyle(wrapperStyle, props.style);

  const ulStyle: AnyStyle = {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: Math.max(8, dense ? gapY : Math.round(gapY * 1.4)).toString() + "px",
  };

  const ctx: ListCtx = { tokens, dense };

  return React.createElement(
    ListContext.Provider,
    { value: ctx },
    React.createElement(
      "ul",
      {
        style: ulStyle,
        className: "adaptive-list " + (props.className || ""),
        "aria-label": props.ariaLabel || "Adaptive list",
        role: "list",
      } as any,
      (props as any).children
    )
  );
}

/* ---------------- Header (like DaisyUI first li) ---------------- */

export interface AdaptiveListHeaderProps extends AdaptiveComponentProps {}

function AdaptiveListHeader(props: AdaptiveListHeaderProps) {
  const { tokens } = useListCtx();
  const { typography, colors } = tokens;

  const style: AnyStyle = {
    padding: "0 2px",
    fontSize: typography.caption,
    lineHeight: typography.lineHeight,
    opacity: 0.7,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: colors.text,
    marginBottom: 2,
  };

  mergeStyle(style, props.style);

  return React.createElement(
    "li",
    { style: style, className: "adaptive-list__header " + (props.className || "") } as any,
    (props as any).children
  );
}

/* ---------------- Row ---------------- */

export interface AdaptiveListRowProps extends AdaptiveComponentProps {
  onClick?: () => void;
  disabled?: boolean;
}

function AdaptiveListRow(props: AdaptiveListRowProps) {
  const { tokens, dense } = useListCtx();
  const { colors, controls, flags, spacing } = tokens;

  const gapX = safeNum(spacing?.gapX, 10);
  const gapY = safeNum(spacing?.gapY, 10);

  const rowPadY = dense ? Math.max(8, gapY) : Math.max(10, Math.round(gapY * 1.4));
  const rowPadX = dense ? Math.max(10, gapX) : Math.max(12, Math.round(gapX * 1.6));

  const disabled = props.disabled === true;

  const style: AnyStyle = {
    display: "flex",
    alignItems: "center",
    columnGap: Math.max(10, Math.round(gapX * 1.2)).toString() + "px",
    padding: rowPadY.toString() + "px " + rowPadX.toString() + "px",
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.border,
    backgroundColor: colors.background,
    minHeight: Math.max(controls.minTargetSize, 44),
    boxSizing: "border-box",
    cursor: disabled ? "not-allowed" : props.onClick ? "pointer" : "default",
    opacity: disabled ? 0.6 : 1,
    transition: flags.reducedMotion ? "none" : "background-color 0.12s ease, transform 0.10s ease",
  };

  const onMouseEnter = flags.reducedMotion
    ? undefined
    : function (e: any) {
        if (disabled) return;
        try {
          e.currentTarget.style.backgroundColor = colors.surface;
        } catch {}
      };

  const onMouseLeave = flags.reducedMotion
    ? undefined
    : function (e: any) {
        if (disabled) return;
        try {
          e.currentTarget.style.backgroundColor = colors.background;
        } catch {}
      };

  mergeStyle(style, props.style);

  return React.createElement(
    "li",
    {
      style: style,
      className: "adaptive-list__row " + (props.className || ""),
      onClick: disabled ? undefined : props.onClick,
      onMouseEnter,
      onMouseLeave,
      role: "listitem",
    } as any,
    (props as any).children
  );
}

/* ---------------- Avatar ---------------- */

export interface AdaptiveListAvatarProps extends AdaptiveComponentProps {
  src?: string;
  alt?: string;
  size?: number; // px
  shape?: "rounded" | "circle" | "square";
}

function AdaptiveListAvatar(props: AdaptiveListAvatarProps) {
  const { tokens } = useListCtx();
  const { colors, controls } = tokens;

  const size =
    props.size !== undefined
      ? props.size
      : Math.max(40, controls.minTargetSize);

  const shape = props.shape || "rounded";

  const style: AnyStyle = {
    width: size,
    height: size,
    borderRadius: shape === "circle" ? 9999 : shape === "square" ? 6 : 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.border,
    overflow: "hidden",
    flex: "0 0 auto",
    display: "grid",
    placeItems: "center",
    backgroundColor: colors.surface,
  };

  mergeStyle(style, props.style);

  if (props.src) {
    const imgStyle: AnyStyle = {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
    };

    return React.createElement(
      "div",
      { style: style, className: "adaptive-list__avatar " + (props.className || "") } as any,
      React.createElement("img", { src: props.src, alt: props.alt || "", style: imgStyle } as any)
    );
  }

  return React.createElement(
    "div",
    { style: style, className: "adaptive-list__avatar " + (props.className || "") } as any,
    (props as any).children
  );
}

/* ---------------- Content ---------------- */

export interface AdaptiveListContentProps extends AdaptiveComponentProps {}

function AdaptiveListContent(props: AdaptiveListContentProps) {
  const { tokens } = useListCtx();
  const { typography } = tokens;

  const style: AnyStyle = {
    flex: "1 1 auto",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    lineHeight: typography.lineHeight,
  };

  mergeStyle(style, props.style);

  return React.createElement(
    "div",
    { style: style, className: "adaptive-list__content " + (props.className || "") } as any,
    (props as any).children
  );
}

export interface AdaptiveListTitleProps extends AdaptiveComponentProps {}

function AdaptiveListTitle(props: AdaptiveListTitleProps) {
  const { tokens } = useListCtx();
  const { typography, colors } = tokens;

  const style: AnyStyle = {
    fontSize: typography.body,
    lineHeight: typography.lineHeight,
    fontWeight: 700,
    color: colors.text,
    margin: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  mergeStyle(style, props.style);

  return React.createElement(
    "div",
    { style: style, className: "adaptive-list__title " + (props.className || "") } as any,
    (props as any).children
  );
}

export interface AdaptiveListSubtitleProps extends AdaptiveComponentProps {}

function AdaptiveListSubtitle(props: AdaptiveListSubtitleProps) {
  const { tokens } = useListCtx();
  const { typography, colors, flags } = tokens;

  const style: AnyStyle = {
    fontSize: typography.caption,
    lineHeight: typography.lineHeight,
    fontWeight: 600,
    opacity: flags.highContrast ? 1 : 0.65,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    margin: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    color: colors.text,
  };

  mergeStyle(style, props.style);

  return React.createElement(
    "div",
    { style: style, className: "adaptive-list__subtitle " + (props.className || "") } as any,
    (props as any).children
  );
}

/* ---------------- Actions (right side) ---------------- */

export interface AdaptiveListActionsProps extends AdaptiveComponentProps {}

function AdaptiveListActions(props: AdaptiveListActionsProps) {
  const { tokens } = useListCtx();
  const { spacing } = tokens;

  const gapX = safeNum(spacing?.gapX, 10);

  const style: AnyStyle = {
    display: "flex",
    gap: Math.max(8, Math.round(gapX * 1.1)).toString() + "px",
    alignItems: "center",
    flex: "0 0 auto",
  };

  mergeStyle(style, props.style);

  return React.createElement(
    "div",
    { style: style, className: "adaptive-list__actions " + (props.className || "") } as any,
    (props as any).children
  );
}

/* ---------------- Export compound API ---------------- */

export const AdaptiveList: any = AdaptiveListRoot;
AdaptiveList.Header = AdaptiveListHeader;
AdaptiveList.Row = AdaptiveListRow;
AdaptiveList.Avatar = AdaptiveListAvatar;
AdaptiveList.Content = AdaptiveListContent;
AdaptiveList.Title = AdaptiveListTitle;
AdaptiveList.Subtitle = AdaptiveListSubtitle;
AdaptiveList.Actions = AdaptiveListActions;
