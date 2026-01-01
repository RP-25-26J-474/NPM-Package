// src/components/AdaptiveCard.tsx
import React, { createContext, useContext } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

type AnyStyle = Record<string, any>;
export type AdaptiveCardVariant = "content" | "media" | "action" | "data";
export type MediaPlacement = "top" | "left" | "right" | "hidden";

export interface AdaptiveCardRootProps extends AdaptiveComponentProps {
  variant?: AdaptiveCardVariant;
  align?: "left" | "center";
  showDivider?: boolean;
  detailed?: boolean; // overrides layout simplification
  mediaPlacement?: MediaPlacement; // used by Media when variant=media
}

type CardCtx = {
  variant: AdaptiveCardVariant;
  align: "left" | "center";
  showDivider: boolean;
  simplify: boolean;
  mediaPlacement: MediaPlacement;
  tokens: any;
};

const CardContext = createContext<CardCtx | null>(null);

function mergeStyle(target: AnyStyle, incoming: any) {
  if (!incoming) return;
  const keys = Object.keys(incoming);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = incoming[k];
    if (v !== undefined) target[k] = v;
  }
}

function useCardCtx(): CardCtx {
  const ctx = useContext(CardContext);
  if (!ctx) throw new Error("AdaptiveCard.* must be used inside <AdaptiveCard>");
  return ctx;
}

/* ---------------- Root ---------------- */

function AdaptiveCardRoot(props: AdaptiveCardRootProps) {
  const { tokens } = useAdaptive();
  const { colors, spacing, flags } = tokens;

  const variant: AdaptiveCardVariant = props.variant === undefined ? "content" : props.variant;
  const align = props.align === undefined ? "left" : props.align;
  const showDivider = props.showDivider === undefined ? true : props.showDivider;

  // If ML says simplify layout, apply it unless developer forces detailed mode
  const simplify = flags.layoutSimplification === true && props.detailed !== true;

  const mediaPlacement: MediaPlacement =
    props.mediaPlacement === undefined ? "top" : props.mediaPlacement;

  const pad = spacing.base;
  const padY = Math.max(10, Math.round(pad * 1.6));
  const padX = Math.max(12, Math.round(pad * 1.8));

  const wrapperStyle: AnyStyle = {
    border: "1px solid " + colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    color: colors.text,
    padding: padY.toString() + "px " + padX.toString() + "px",
    width: "100%",
    boxSizing: "border-box",
    textAlign: align === "center" ? "center" : "left",
  };

  // optional shadow (avoid for high contrast)
  if (!flags.highContrast) wrapperStyle.boxShadow = "0 6px 18px rgba(0,0,0,0.12)";

  mergeStyle(wrapperStyle, props.style);

  const ctx: CardCtx = {
    variant,
    align,
    showDivider,
    simplify,
    mediaPlacement,
    tokens,
  };

  const classNameProp = props.className === undefined ? "" : props.className;

  return React.createElement(
    CardContext.Provider,
    { value: ctx },
    React.createElement(
      "div",
      {
        style: wrapperStyle,
        className: "adaptive-card adaptive-card--" + variant + " " + classNameProp,
      } as any,
      (props as any).children
    )
  );
}

/* ---------------- Subcomponents ---------------- */

function AdaptiveCardBody(props: AdaptiveComponentProps) {
  const { tokens } = useCardCtx();
  const { spacing } = tokens;

  const style: AnyStyle = {
    display: "flex",
    flexDirection: "column",
    gap: Math.max(8, spacing.base).toString() + "px",
  };
  mergeStyle(style, (props as any).style);

  const classNameProp = props.className === undefined ? "" : props.className;

  return React.createElement(
    "div",
    { style: style, className: "adaptive-card__body " + classNameProp } as any,
    (props as any).children
  );
}

function AdaptiveCardTitle(props: AdaptiveComponentProps) {
  const ctx = useCardCtx();
  const { tokens } = ctx;
  const { typography, colors } = tokens;

  const style: AnyStyle = {
    margin: 0,
    fontSize: typography.h3,
    lineHeight: typography.lineHeight,
    fontWeight: 800,
    color: colors.text,
  };
  mergeStyle(style, (props as any).style);

  return React.createElement(
    "h3",
    { style: style, className: "adaptive-card__title " + (props.className || "") } as any,
    (props as any).children
  );
}

function AdaptiveCardText(props: AdaptiveComponentProps & { muted?: boolean; truncate?: boolean; maxLines?: number }) {
  const ctx = useCardCtx();
  const { tokens, simplify } = ctx;
  const { typography, colors, flags } = tokens;

  const muted = (props as any).muted === true;
  const truncate = (props as any).truncate === true;
  const maxLines = (props as any).maxLines;

  const style: AnyStyle = {
    margin: 0,
    fontSize: typography.body,
    lineHeight: typography.lineHeight,
    color: muted && !flags.highContrast ? (colors.secondary || colors.text) : colors.text,
  };

  // simplification: if developer didn't set detailed content, clamp lines
  if (simplify && typeof maxLines !== "number") {
    style.display = "-webkit-box";
    style.WebkitBoxOrient = "vertical";
    style.WebkitLineClamp = 3;
    style.overflow = "hidden";
  }

  if (truncate) {
    style.whiteSpace = "nowrap";
    style.overflow = "hidden";
    style.textOverflow = "ellipsis";
  } else if (typeof maxLines === "number" && maxLines > 0) {
    style.display = "-webkit-box";
    style.WebkitBoxOrient = "vertical";
    style.WebkitLineClamp = maxLines;
    style.overflow = "hidden";
  }

  mergeStyle(style, (props as any).style);

  return React.createElement(
    "p",
    { style: style, className: "adaptive-card__text " + (props.className || "") } as any,
    (props as any).children
  );
}

function AdaptiveCardFooter(props: AdaptiveComponentProps) {
  const ctx = useCardCtx();
  const { tokens, simplify, showDivider } = ctx;
  const { typography, colors, spacing, flags } = tokens;

  // In simplified mode, hide footer by default (developer can bypass by using detailed=true on root)
  if (simplify) return null;

  const dividerStyle: AnyStyle = {
    height: "1px",
    backgroundColor: colors.border,
    width: "100%",
    marginTop: Math.max(10, spacing.base).toString() + "px",
    marginBottom: Math.max(10, spacing.base).toString() + "px",
  };

  const footerStyle: AnyStyle = {
    fontSize: typography.caption,
    lineHeight: typography.lineHeight,
    color: flags.highContrast ? colors.text : (colors.secondary || colors.text),
  };
  mergeStyle(footerStyle, (props as any).style);

  return React.createElement(
    "div",
    { className: "adaptive-card__footer " + (props.className || "") } as any,
    showDivider ? React.createElement("div", { style: dividerStyle }) : null,
    React.createElement("div", { style: footerStyle }, (props as any).children)
  );
}

function AdaptiveCardActions(props: AdaptiveComponentProps & { layout?: "auto" | "horizontal" | "vertical"; maxVisible?: number }) {
  const ctx = useCardCtx();
  const { tokens, align, simplify } = ctx;
  const { spacing, controls } = tokens;

  const layoutProp = (props as any).layout;
  const maxVisible = (props as any).maxVisible;

  const layout =
    layoutProp === undefined || layoutProp === "auto"
      ? controls.minTargetSize >= 28
        ? "vertical"
        : "horizontal"
      : layoutProp;

  // In simplified mode, optionally show fewer children (first N only)
  const children = React.Children.toArray((props as any).children);
  let shown = children;
  if (simplify && typeof maxVisible === "number" && maxVisible > 0) {
    shown = children.slice(0, maxVisible);
  } else if (simplify && maxVisible === undefined) {
    shown = children.slice(0, 1);
  }

  const style: AnyStyle = {
    display: "flex",
    flexDirection: layout === "vertical" ? "column" : "row",
    gap: Math.max(10, spacing.base).toString() + "px",
    marginTop: Math.max(10, spacing.base).toString() + "px",
    alignItems: layout === "vertical" ? "stretch" : "center",
    justifyContent: align === "center" ? "center" : "flex-start",
    flexWrap: layout === "horizontal" ? "wrap" : "nowrap",
  };

  mergeStyle(style, (props as any).style);

  return React.createElement(
    "div",
    { style: style, className: "adaptive-card__actions " + (props.className || "") } as any,
    shown
  );
}

function AdaptiveCardMedia(props: AdaptiveComponentProps & { src?: string; alt?: string; placement?: MediaPlacement; shape?: "square" | "rounded" }) {
  const ctx = useCardCtx();
  const { tokens, simplify, mediaPlacement, variant } = ctx;
  const { colors, controls, spacing } = tokens;

  const src = (props as any).src;
  if (!src) return null;

  // In simplified mode, hide media by default for cognitive overload reduction
  if (simplify) return null;

  const placement = (props as any).placement || mediaPlacement;
  if (placement === "hidden") return null;

  const shape = (props as any).shape || "rounded";

  const imgH = Math.max(120, controls.minTargetSize * 3);
  const imgStyle: AnyStyle = {
    width: placement === "top" ? "100%" : Math.max(180, controls.minTargetSize * 6),
    height: imgH,
    objectFit: "cover",
    borderRadius: shape === "rounded" ? 14 : 0,
    border: "1px solid " + colors.border,
    display: "block",
  };

  mergeStyle(imgStyle, (props as any).style);

  // Layout wrappers for left/right media
  if (placement === "top") {
    return React.createElement(
      "div",
      { style: { marginBottom: Math.max(12, spacing.base * 2) } } as any,
      React.createElement("img", { src: src, alt: (props as any).alt || "", style: imgStyle } as any)
    );
  }

  // For left/right, developer usually places Media + Body inside same root; we provide a flex wrapper helper:
  // If they want DaisyUI style `lg:card-side`, they should wrap with AdaptiveCard.SideLayout below.
  return React.createElement("img", { src: src, alt: (props as any).alt || "", style: imgStyle } as any);
}

function AdaptiveCardSideLayout(props: AdaptiveComponentProps & { placement?: "left" | "right" }) {
  const ctx = useCardCtx();
  const { tokens } = ctx;
  const { spacing } = tokens;

  const placement = (props as any).placement || "left";

  const style: AnyStyle = {
    display: "flex",
    flexDirection: placement === "right" ? "row-reverse" : "row",
    gap: Math.max(14, spacing.base * 2).toString() + "px",
    alignItems: "flex-start",
  };
  mergeStyle(style, (props as any).style);

  return React.createElement(
    "div",
    { style: style, className: "adaptive-card__side " + (props.className || "") } as any,
    (props as any).children
  );
}

/* Optional KPI helper for Data Card */
function AdaptiveCardKPI(props: AdaptiveComponentProps & { label?: string; value?: any; statusText?: string; trend?: "up" | "down" | "neutral" }) {
  const ctx = useCardCtx();
  const { tokens, simplify } = ctx;
  const { typography, colors, spacing, flags } = tokens;

  const label = (props as any).label;
  const value = (props as any).value;
  const statusText = (props as any).statusText;
  const trend = (props as any).trend;

  let trendText = "";
  if (trend === "up") trendText = "▲ Up";
  else if (trend === "down") trendText = "▼ Down";
  else if (trend === "neutral") trendText = "● Stable";

  const labelStyle: AnyStyle = {
    fontSize: typography.caption,
    lineHeight: typography.lineHeight,
    color: flags.highContrast ? colors.text : (colors.secondary || colors.text),
    margin: 0,
  };

  const valueStyle: AnyStyle = {
    fontSize: typography.h1,
    lineHeight: typography.lineHeight,
    fontWeight: 900,
    margin: "6px 0 0 0",
    color: colors.text,
  };

  const pillsWrap: AnyStyle = {
    display: "flex",
    gap: Math.max(10, spacing.base).toString() + "px",
    marginTop: Math.max(10, spacing.base).toString() + "px",
    flexWrap: "wrap",
  };

  const pill: AnyStyle = {
    border: "1px solid " + colors.border,
    borderRadius: 9999,
    padding: "4px 10px",
    fontSize: typography.caption,
    lineHeight: typography.lineHeight,
    backgroundColor: colors.background,
    color: colors.text,
  };

  const pills = [];
  if (statusText) pills.push(React.createElement("span", { key: "s", style: pill }, statusText));
  if (trendText && (!simplify || flags.highContrast)) pills.push(React.createElement("span", { key: "t", style: pill }, trendText));

  return React.createElement(
    "div",
    { className: "adaptive-card__kpi " + (props.className || "") } as any,
    label ? React.createElement("p", { style: labelStyle }, label) : null,
    React.createElement("div", { style: valueStyle }, value === undefined || value === null ? "" : String(value)),
    pills.length > 0 ? React.createElement("div", { style: pillsWrap }, pills) : null
  );
}

/* Attach subcomponents (compound API) */
export const AdaptiveCard: any = AdaptiveCardRoot;
AdaptiveCard.Body = AdaptiveCardBody;
AdaptiveCard.Title = AdaptiveCardTitle;
AdaptiveCard.Text = AdaptiveCardText;
AdaptiveCard.Footer = AdaptiveCardFooter;
AdaptiveCard.Actions = AdaptiveCardActions;
AdaptiveCard.Media = AdaptiveCardMedia;
AdaptiveCard.SideLayout = AdaptiveCardSideLayout;
AdaptiveCard.KPI = AdaptiveCardKPI;
