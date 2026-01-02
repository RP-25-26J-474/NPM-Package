// src/components/AdaptiveCard.tsx
import React, { createContext, useContext } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

type AnyStyle = Record<string, any>;

export type AdaptiveCardVariant = "content" | "media" | "action" | "data";
export type MediaPlacement = "top" | "left" | "right" | "hidden";

export interface AdaptiveCardProps extends AdaptiveComponentProps {
  variant?: AdaptiveCardVariant;
  align?: "left" | "center";
  showDivider?: boolean;

  /**
   * If true, card will NOT auto-simplify even when ML says layout_simplification=true.
   * Useful for critical information blocks.
   */
  detailed?: boolean;

  /**
   * Default media placement for AdaptiveCard.Media when placement prop not provided.
   * Used mainly in media cards.
   */
  mediaPlacement?: MediaPlacement;
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

/* ===================== Root ===================== */

function AdaptiveCardRoot(props: AdaptiveCardProps) {
  const { tokens } = useAdaptive();
  const { colors, spacing, flags } = tokens;

  const variant: AdaptiveCardVariant =
    props.variant === undefined ? "content" : props.variant;

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

  // Optional shadow (avoid for high contrast)
  if (!flags.highContrast) {
    wrapperStyle.boxShadow = "0 6px 18px rgba(0,0,0,0.12)";
  }

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

/* ===================== Body ===================== */

function AdaptiveCardBody(props: AdaptiveComponentProps) {
  const ctx = useCardCtx();
  const { tokens } = ctx;
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

/* ===================== Actions ===================== */

function AdaptiveCardActions(
  props: AdaptiveComponentProps & {
    layout?: "auto" | "horizontal" | "vertical";
    maxVisible?: number;
    showDivider?: boolean; // optional local divider
  }
) {
  const ctx = useCardCtx();
  const { tokens, align, simplify, showDivider } = ctx;
  const { spacing, controls, colors } = tokens;

  const layoutProp = (props as any).layout;
  const maxVisible = (props as any).maxVisible;
  const showDividerLocal =
    (props as any).showDivider === undefined ? false : (props as any).showDivider;

  const layout =
    layoutProp === undefined || layoutProp === "auto"
      ? controls.minTargetSize >= 28
        ? "vertical"
        : "horizontal"
      : layoutProp;

  // Simplification: reduce visible actions
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

  const dividerStyle: AnyStyle = {
    height: "1px",
    backgroundColor: colors.border,
    width: "100%",
    marginTop: Math.max(10, spacing.base).toString() + "px",
    marginBottom: Math.max(10, spacing.base).toString() + "px",
  };

  return React.createElement(
    "div",
    { className: "adaptive-card__actions " + (props.className || "") } as any,
    showDividerLocal || showDivider ? React.createElement("div", { style: dividerStyle }) : null,
    React.createElement("div", { style: style }, shown)
  );
}

/* ===================== Media ===================== */

function AdaptiveCardMedia(
  props: AdaptiveComponentProps & {
    src?: string;
    alt?: string;
    placement?: MediaPlacement;
    shape?: "square" | "rounded";
    keepInSimplify?: boolean; 
  }
) {
  const ctx = useCardCtx();
  const { tokens, simplify, mediaPlacement } = ctx;
  const { colors, controls, spacing } = tokens;

  const src = (props as any).src;
  if (!src) return null;

  //  keep media visible if developer says it's required
  const keepInSimplify = (props as any).keepInSimplify === true;
  if (simplify && !keepInSimplify) return null;

  const placement = (props as any).placement || mediaPlacement;
  if (placement === "hidden") return null;

  const shape = (props as any).shape || "rounded";

  const imgH = Math.max(560, controls.minTargetSize * 3);
  const imgStyle: AnyStyle = {
    width: placement === "top" ? "100%" : Math.max(90, controls.minTargetSize * 6),
    height: imgH,
    objectFit: "cover",
    borderRadius: shape === "rounded" ? 14 : 0,
    border: "1px solid " + colors.border,
    display: "block",
  };

  mergeStyle(imgStyle, (props as any).style);

  if (placement === "top") {
    return React.createElement(
      "div",
      { style: { marginBottom: Math.max(12, spacing.base * 2) } } as any,
      React.createElement("img", {
        src: src,
        alt: (props as any).alt || "",
        style: imgStyle,
      } as any)
    );
  }

  // left/right: used inside SideLayout
  return React.createElement("img", {
    src: src,
    alt: (props as any).alt || "",
    style: imgStyle,
  } as any);
}

/* ===================== Side Layout ===================== */

function AdaptiveCardSideLayout(
  props: AdaptiveComponentProps & { placement?: "left" | "right" }
) {
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

/** Tiny helper if dev wants a divider in the card body that adapts. */
function AdaptiveCardDivider(props: AdaptiveComponentProps) {
  const ctx = useCardCtx();
  const { tokens } = ctx;
  const { colors, spacing } = tokens;

  const style: AnyStyle = {
    height: "1px",
    width: "100%",
    backgroundColor: colors.border,
    marginTop: Math.max(10, spacing.base).toString() + "px",
    marginBottom: Math.max(10, spacing.base).toString() + "px",
  };

  mergeStyle(style, (props as any).style);

  return React.createElement("div", { style: style } as any);
}

/* ===================== Export compound API ===================== */

export const AdaptiveCard: any = AdaptiveCardRoot;
AdaptiveCard.Body = AdaptiveCardBody;
AdaptiveCard.Actions = AdaptiveCardActions;
AdaptiveCard.Media = AdaptiveCardMedia;
AdaptiveCard.SideLayout = AdaptiveCardSideLayout;
AdaptiveCard.Divider = AdaptiveCardDivider;
