// src/components/AdaptiveNavbar.tsx
import React, { createContext, useContext } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

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
}

type NavbarCtx = {
  tokens: any;
  simplify: boolean;
  heightPx: number;
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

/* ===================== Root ===================== */

function AdaptiveNavbarRoot(props: AdaptiveNavbarProps) {
  const { tokens, openComponentFeedback, behaviorTracker } = useAdaptive();
  const { colors, spacing, typography, controls, flags } = tokens;

  const sticky = props.sticky === true;
  const bordered = props.bordered === undefined ? true : props.bordered;

  const simplify = flags.layoutSimplification === true && props.detailed !== true;

  // Navbar height based on target size + spacing (motor-friendly)
  const heightPx = Math.max(56, controls.minTargetSize + Math.round(spacing.padY * 2));

  const padX = Math.max(12, spacing.padX);
  const padY = Math.max(8, spacing.padY);

  const style: AnyStyle = {
    width: "100%",
    minHeight: heightPx,
    display: "flex",
    alignItems: "center",
    gap: Math.max(10, spacing.gapX).toString() + "px",
    padding: padY.toString() + "px " + padX.toString() + "px",
    boxSizing: "border-box",
    backgroundColor: colors.surface,
    color: colors.text,
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

  const ctx: NavbarCtx = { tokens, simplify, heightPx, openComponentFeedback, behaviorTracker };

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
  const { tokens } = useNavbarCtx();
  const { typography, spacing } = tokens;

  const style: AnyStyle = {
    display: "flex",
    alignItems: "center",
    gap: Math.max(8, spacing.gapX).toString() + "px",
    fontSize: typography.h3,
    fontWeight: 800,
    lineHeight: typography.lineHeight,
    whiteSpace: "nowrap",
  };

  mergeStyle(style, (props as any).style);

  return React.createElement(
    "div",
    { style, className: "adaptive-navbar__brand " + (props.className || "") } as any,
    (props as any).children
  );
}

function AdaptiveNavbarNav(props: AdaptiveComponentProps) {
  const { tokens, simplify } = useNavbarCtx();
  const { spacing, controls } = tokens;

  // Never hide nav. In simplify mode, only adjust spacing/layout.
  const gap = simplify
    ? Math.max(8, Math.round(spacing.gapX * 0.8))
    : Math.max(10, spacing.gapX);

  const style: AnyStyle = {
    display: "flex",
    alignItems: "center",
    columnGap: gap.toString() + "px",
    flexWrap: "wrap",
    // In simplified mode, keep items easier to hit and avoid tight clustering
    rowGap: simplify ? Math.max(8, Math.round(controls.minTargetSize * 0.25)) : undefined,
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
  const { tokens, heightPx, openComponentFeedback, behaviorTracker } = useNavbarCtx();
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
    borderRadius: 9999,
    border: "1px solid " + (active ? colors.border : "transparent"),
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
    commonProps.onClick = disabled ? undefined : clickHandler;
  } else {
    commonProps.type = "button";
    commonProps.disabled = disabled;
    commonProps.onClick = disabled ? undefined : clickHandler;
  }

  return React.createElement(asTag, commonProps as any, (props as any).children);
}

function AdaptiveNavbarActions(props: AdaptiveComponentProps & { maxVisible?: number }) {
  const { tokens, simplify } = useNavbarCtx();
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
    gap: Math.max(10, spacing.gapX).toString() + "px",
  };

  mergeStyle(style, (props as any).style);

  return React.createElement(
    "div",
    { style, className: "adaptive-navbar__actions " + (props.className || "") } as any,
    shown
  );
}

function AdaptiveNavbarSpacer(props: AdaptiveComponentProps) {
  const style: AnyStyle = { flex: 1 };
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
