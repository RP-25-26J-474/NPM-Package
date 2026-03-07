// src/components/AdaptiveNavbar.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";
import { AdaptiveButton } from "./AdaptiveButton";
import { AdaptiveText } from "./AdaptiveText";

type AnyStyle = Record<string, any>;

export interface AdaptiveNavbarProps extends AdaptiveComponentProps {
  /**
   * Basic variant only for now.
   * Structure: Brand | Nav items | Spacer | Actions
   */
  variant?: "basic";

  /**
   * Sticky navbar at top.
   */
  sticky?: boolean;

  /**
   * show a bottom border (useful for high contrast).
   */
  bordered?: boolean;

  /**
   *  override simplification (if true, keep full nav even if ML simplifies).
   */
  detailed?: boolean;

  /**
   * Viewport width (px) threshold for compact navbar mode.
   * In compact mode, nav gets safer overflow/wrap behavior for small screens.
   */
  collapseAt?: number;

  /**
   * Compact nav behavior:
   * - "scroll": single row with horizontal scroll (default, safest for many items)
   * - "wrap": multi-row wrapped nav
   */
  compactNavMode?: "scroll" | "wrap";
}

type NavbarCtx = {
  tokens: any;
  simplify: boolean;
  heightPx: number;
  compact: boolean;
  compactNavMode: "scroll" | "wrap";
  openComponentFeedback?: any;
  behaviorTracker?: any;
};

const NavbarContext = createContext<NavbarCtx | null>(null);

function mergeStyle(target: AnyStyle, incoming: any) {
  if (!incoming) return;
  const keys = Object.keys(incoming);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = incoming[k];
    if (v !== undefined) target[k] = v;
  }
}

function useNavbarCtx(): NavbarCtx {
  const ctx = useContext(NavbarContext);
  if (!ctx) throw new Error("AdaptiveNavbar.* must be used inside <AdaptiveNavbar>");
  return ctx;
}

function getViewportWidth(): number {
  if (typeof window === "undefined") return 1024;
  return window.innerWidth;
}

/* ===================== Root ===================== */

function AdaptiveNavbarRoot(props: AdaptiveNavbarProps) {
  const { tokens, openComponentFeedback, behaviorTracker } = useAdaptive();
  const { colors, spacing, typography, controls, flags } = tokens;
  const [viewportWidth, setViewportWidth] = useState<number>(getViewportWidth);

  const sticky = props.sticky === true;
  const bordered = props.bordered === undefined ? true : props.bordered;
  const compactNavMode = props.compactNavMode === "wrap" ? "wrap" : "scroll";
  const collapseAt =
    props.collapseAt === undefined
      ? Math.max(560, controls.minTargetSize * 18)
      : props.collapseAt;

  const simplify = flags.layoutSimplification === true && props.detailed !== true;
  const compact = viewportWidth <= collapseAt;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onResize = () => {
      setViewportWidth(getViewportWidth());
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Navbar height based on target size + spacing (motor-friendly)
  const heightPx = Math.max(56, controls.minTargetSize + Math.round(spacing.padY * 2));

  const padX = compact
    ? Math.max(10, Math.round(spacing.padX * 0.9))
    : Math.max(12, spacing.padX);
  const padY = Math.max(8, spacing.padY);
  const rootGap = compact
    ? Math.max(8, Math.round(spacing.gapX * 0.8))
    : Math.max(10, spacing.gapX);

  const style: AnyStyle = {
    width: "100%",
    minHeight: heightPx,
    display: "flex",
    alignItems: "center",
    flexWrap: compact ? "wrap" : "nowrap",
    columnGap: rootGap.toString() + "px",
    rowGap: compact ? Math.max(6, spacing.gapY).toString() + "px" : undefined,
    padding: padY.toString() + "px " + padX.toString() + "px",
    boxSizing: "border-box",
    backgroundColor: colors.surface,
    color: colors.text,
    minWidth: 0,
    overflowX: "clip",
    position: sticky ? "sticky" : "relative",
    top: sticky ? 0 : undefined,
    zIndex: sticky ? 50 : undefined,
  };

  if (bordered || flags.highContrast) {
    style.borderBottom = "1px solid " + colors.border;
  }

  // Avoid heavy transitions when reduced motion
  style.transition = flags.reducedMotion ? "none" : "background-color 0.15s ease";

  mergeStyle(style, props.style);

  const classNameProp = props.className === undefined ? "" : props.className;

  const ctx: NavbarCtx = { tokens, simplify, heightPx, compact, compactNavMode, openComponentFeedback, behaviorTracker };

  return React.createElement(
    NavbarContext.Provider,
    { value: ctx },
    React.createElement(
      "header",
      {
        style,
        className: "adaptive-navbar " + classNameProp,
        role: "navigation",
        "aria-label": "Primary navigation",
      } as any,
      (props as any).children
    )
  );
}

/* ===================== Atomic Parts ===================== */

function AdaptiveNavbarBrand(props: AdaptiveComponentProps) {
  const { tokens, compact } = useNavbarCtx();
  const { typography, spacing } = tokens;
  const children = (props as any).children;

  const brandTextStyle: AnyStyle = {
    margin: 0,
    lineHeight: typography.lineHeight,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const style: AnyStyle = {
    display: "flex",
    alignItems: "center",
    gap: Math.max(8, spacing.gapX).toString() + "px",
    minWidth: 0,
    flex: compact ? "1 1 auto" : "0 1 auto",
    maxWidth: compact ? "100%" : undefined,
  };

  mergeStyle(style, (props as any).style);

  const textLikeChild =
    typeof children === "string" || typeof children === "number";

  return React.createElement(
    "div",
    { style, className: "adaptive-navbar__brand " + (props.className || "") } as any,
    textLikeChild
      ? React.createElement(
          AdaptiveText,
          { as: "span", variant: "h3", weight: "bold", style: brandTextStyle } as any,
          children
        )
      : children
  );
}

function AdaptiveNavbarNav(props: AdaptiveComponentProps) {
  const { tokens, simplify, compact, compactNavMode } = useNavbarCtx();
  const { spacing, controls } = tokens;

  // Never hide nav. In simplify mode, only adjust spacing/layout.
  const gap = simplify
    ? Math.max(8, Math.round(spacing.gapX * 0.8))
    : Math.max(10, spacing.gapX);

  const style: AnyStyle = {
    display: "flex",
    alignItems: "center",
    columnGap: gap.toString() + "px",
    rowGap: compact ? Math.max(8, Math.round(spacing.gapY * 0.8)) : undefined,
    flex: compact ? "1 1 100%" : "1 1 auto",
    width: compact ? "100%" : "auto",
    minWidth: 0,
    order: compact ? 3 : 0,
    overflowX: compactNavMode === "scroll" ? "auto" : "visible",
    overflowY: "hidden",
    paddingBottom:
      compact && compactNavMode === "scroll"
        ? Math.max(2, Math.round(spacing.gapY * 0.25))
        : undefined,
    flexWrap:
      compact && compactNavMode === "scroll"
        ? "nowrap"
        : compact
        ? "wrap"
        : "nowrap",
    // In simplified mode, keep items easier to hit and avoid tight clustering
    ...(simplify
      ? { rowGap: Math.max(8, Math.round(controls.minTargetSize * 0.25)) }
      : null),
  };

  mergeStyle(style, (props as any).style);

  return React.createElement(
    "nav",
    { style, className: "adaptive-navbar__nav " + (props.className || "") } as any,
    (props as any).children
  );
}

export interface AdaptiveNavbarItemProps extends AdaptiveComponentProps {
  as?: "a" | "button";
  href?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: any;
}

function AdaptiveNavbarItem(props: AdaptiveNavbarItemProps) {
  const { tokens, heightPx, compact } = useNavbarCtx();
  const { openComponentFeedback, behaviorTracker } = useNavbarCtx();
  const { colors, typography, spacing, controls, flags } = tokens;

  const asTag = props.as === undefined ? "a" : props.as;
  const active = props.active === true;
  const disabled = props.disabled === true;

  const minH = Math.max(controls.minTargetSize, Math.round(heightPx * 0.65));
  const padX = Math.max(10, spacing.padX);

  const style: AnyStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: minH,
    padding: "0 " + padX.toString() + "px",
    flexShrink: 0,
    maxWidth: compact ? "100%" : undefined,
    borderRadius: 9999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: active ? colors.border : "transparent",
    backgroundColor: active ? colors.background : "transparent",
    color: colors.text,
    fontSize: typography.body,
    lineHeight: typography.lineHeight,
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    userSelect: "none",
  };

  // Hover style only if not reduced motion and not disabled
  if (!flags.reducedMotion && !disabled) {
    style.transition = "transform 0.12s ease, background-color 0.12s ease";
  }

  mergeStyle(style, (props as any).style);

  const commonProps: AnyStyle = {
    style,
    className: "adaptive-navbar__item " + (props.className || ""),
    "aria-current": active ? "page" : undefined,
  };

  const clickHandler = (e: any) => {
      const elId = (props as any).id || "nav-item-" + Math.random().toString(36).substr(2, 5);
      if (e.altKey && openComponentFeedback) {
          e.preventDefault();
          e.stopPropagation();
          openComponentFeedback(elId, 'button', { text: (props as any).children });
          return;
      }
      if (behaviorTracker?.trackInteraction) {
          behaviorTracker.trackInteraction(elId, 'click', { type: 'nav-item' });
      }
      if (props.onClick) props.onClick(e);
  };

  if (asTag === "a") {
    commonProps.href = disabled ? undefined : props.href;
    commonProps.onClick = disabled ? undefined : props.onClick;
    const itemChildren = (props as any).children;
    const textLikeChild =
      typeof itemChildren === "string" || typeof itemChildren === "number";
    return React.createElement(
      asTag,
      commonProps as any,
      textLikeChild
        ? React.createElement(
            AdaptiveText,
            {
              as: "span",
              variant: "body",
              style: { margin: 0, color: "inherit", lineHeight: typography.lineHeight },
            } as any,
            itemChildren
          )
        : itemChildren
    );
  }

  const buttonStyle: AnyStyle = {};
  const styleKeys = Object.keys(style);
  for (let i = 0; i < styleKeys.length; i++) {
    const key = styleKeys[i];
    buttonStyle[key] = style[key];
  }

  return React.createElement(
    AdaptiveButton,
    {
      className: "adaptive-navbar__item adaptive-navbar__item--button " + (props.className || ""),
      variant: "ghost",
      disabled,
      onClick: disabled ? undefined : props.onClick,
      minHitAreaPx: minH,
      textSize: typography.body,
      paddingX: padX,
      paddingY: Math.max(6, spacing.padY),
      style: buttonStyle,
      "aria-current": active ? "page" : undefined,
    } as any,
    (props as any).children
  );
  //   commonProps.onClick = disabled ? undefined : clickHandler;
  // } else {
  //   commonProps.type = "button";
  //   commonProps.disabled = disabled;
  //   commonProps.onClick = disabled ? undefined : clickHandler;
  // }

  // return React.createElement(asTag, commonProps as any, (props as any).children);
}

function AdaptiveNavbarActions(props: AdaptiveComponentProps & { maxVisible?: number }) {
  const { tokens, simplify, compact } = useNavbarCtx();
  const { spacing } = tokens;

  const children = React.Children.toArray((props as any).children);

  // Simplification: keep only first action (or maxVisible)
  let shown = children;
  const maxVisible = (props as any).maxVisible;
  if (simplify && typeof maxVisible === "number" && maxVisible > 0) {
    shown = children.slice(0, maxVisible);
  } else if (simplify && maxVisible === undefined) {
    shown = children.slice(0, 1);
  }

  const style: AnyStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: compact ? "flex-end" : "flex-start",
    columnGap: Math.max(10, spacing.gapX).toString() + "px",
    marginLeft: compact ? "auto" : undefined,
    flexWrap: compact ? "wrap" : "nowrap",
    rowGap: compact ? Math.max(6, Math.round(spacing.gapY * 0.8)) : undefined,
    maxWidth: compact ? "100%" : undefined,
    flexShrink: 0,
    order: compact ? 2 : 0,
  };

  mergeStyle(style, (props as any).style);

  return React.createElement(
    "div",
    { style, className: "adaptive-navbar__actions " + (props.className || "") } as any,
    shown
  );
}

function AdaptiveNavbarSpacer(props: AdaptiveComponentProps) {
  const { compact } = useNavbarCtx();
  const style: AnyStyle = compact ? { display: "none" } : { flex: 1 };
  mergeStyle(style, (props as any).style);
  return React.createElement("div", { style } as any);
}

/* ===================== Export compound API ===================== */

export const AdaptiveNavbar: any = AdaptiveNavbarRoot;
AdaptiveNavbar.Brand = AdaptiveNavbarBrand;
AdaptiveNavbar.Nav = AdaptiveNavbarNav;
AdaptiveNavbar.Item = AdaptiveNavbarItem;
AdaptiveNavbar.Actions = AdaptiveNavbarActions;
AdaptiveNavbar.Spacer = AdaptiveNavbarSpacer;

