// src/components/AdaptivePagination.tsx
import React from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

type AnyStyle = Record<string, any>;

export interface AdaptivePaginationProps extends AdaptiveComponentProps {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;

  showPageNumbers?: boolean;
  showArrows?: boolean;
  showPrevNextText?: boolean;
  prevText?: string;
  nextText?: string;
  maxVisiblePages?: number;

  buttonSize?: number;
  gap?: number;
  disabled?: boolean;
  fullWidth?: boolean;

  ariaLabel?: string;

  getPageHref?: (page: number) => string | undefined;
  getPrevHref?: () => string | undefined;
  getNextHref?: () => string | undefined;

  buttonClassName?: string;
  buttonStyle?: React.CSSProperties;
  currentClassName?: string;
  currentStyle?: React.CSSProperties;
  linkClassName?: string;
  linkStyle?: React.CSSProperties;
  textClassName?: string;
  textStyle?: React.CSSProperties;
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

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function getVisiblePages(
  current: number,
  total: number,
  maxVisible?: number
): number[] {
  if (!maxVisible || maxVisible >= total) {
    const all: number[] = [];
    for (let i = 1; i <= total; i++) all.push(i);
    return all;
  }

  const safeMax = Math.max(3, maxVisible);
  const half = Math.floor(safeMax / 2);
  let start = current - half;
  let end = start + safeMax - 1;

  if (start < 1) {
    start = 1;
    end = safeMax;
  }

  if (end > total) {
    end = total;
    start = Math.max(1, end - safeMax + 1);
  }

  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
}

export function AdaptivePagination(props: AdaptivePaginationProps) {
  const { tokens } = useAdaptive();
  const { colors, typography, spacing, controls, flags } = tokens;

  const totalPages = Math.max(1, props.totalPages);
  const currentPage = clamp(props.currentPage, 1, totalPages);
  const prevPage = currentPage - 1;
  const nextPage = currentPage + 1;

  const motorFriendly = controls.minTargetSize >= 28;
  const lowLiteracy = flags.tooltipAssist || flags.layoutSimplification;

  const showPageNumbers =
    props.showPageNumbers === undefined ? true : props.showPageNumbers;

  const showArrows = props.showArrows === undefined ? true : props.showArrows;

  const showPrevNextText =
    props.showPrevNextText === undefined ? !lowLiteracy : props.showPrevNextText;

  const prevText = props.prevText === undefined ? "Previous" : props.prevText;
  const nextText = props.nextText === undefined ? "Next" : props.nextText;

  const pages = getVisiblePages(currentPage, totalPages, props.maxVisiblePages);

  const disabled = props.disabled === true;

  const fullWidth = props.fullWidth === true;

  const baseSize = Math.max(
    controls.minTargetSize,
    Math.round(typography.basePx * 2.1),
    spacing.padY * 2 + typography.basePx
  );

  const buttonSize = props.buttonSize || baseSize;

  const gap = props.gap === undefined ? Math.max(8, spacing.gapX) : props.gap;

  const wrapperStyle: AnyStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: gap.toString() + "px",
    width: fullWidth ? "100%" : "auto",
    flexWrap: "wrap",
  };

  mergeStyle(wrapperStyle, props.style);

  const wrapperClassName = "adaptive-pagination " + (props.className || "");

  const baseButtonStyle: AnyStyle = {
    minWidth: buttonSize,
    height: buttonSize,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: Math.max(10, spacing.padX).toString() + "px",
    paddingRight: Math.max(10, spacing.padX).toString() + "px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };

  const currentButtonStyle: AnyStyle = {
    backgroundColor: colors.primary || colors.accent,
    color: colors.onPrimary || colors.text,
    borderColor: colors.primary || colors.accent,
  };

  const baseButtonClass = "adaptive-pagination__button";

  const baseTextStyle: AnyStyle = {
    marginLeft: showArrows && showPrevNextText ? 6 : 0,
    marginRight: showArrows && showPrevNextText ? 6 : 0,
  };

  const baseTextClass = props.textClassName || "";

  const renderControl = (
    label: React.ReactNode,
    page: number,
    type: "prev" | "next" | "page",
    isCurrent: boolean,
    isDisabled: boolean
  ): React.ReactElement => {
    const commonAriaLabel =
      type === "prev" ? prevText :
      type === "next" ? nextText :
      `Page ${page}`;

    const href =
      type === "page" ? props.getPageHref?.(page) :
      type === "prev" ? props.getPrevHref?.() :
      props.getNextHref?.();

    const isLink = !!href;

    const buildButtonStyle = (current: boolean, disabled: boolean) => {
      const style: AnyStyle = { ...baseButtonStyle };
      if (current) mergeStyle(style, currentButtonStyle);
      if (disabled) style.opacity = 0.5;
      mergeStyle(style, props.buttonStyle);
      if (current) mergeStyle(style, props.currentStyle);
      return style;
    };

    if (isLink) {
      const linkProps: any = {
        href: isDisabled ? undefined : href,
        "aria-label": commonAriaLabel,
        "aria-current": isCurrent ? "page" : undefined,
        className:
          baseButtonClass +
          (props.linkClassName ? " " + props.linkClassName : ""),
        style: buildButtonStyle(isCurrent, isDisabled),
        onClick: (e: React.MouseEvent) => {
          if (isDisabled) {
            e.preventDefault();
            return;
          }
          if (props.onPageChange) props.onPageChange(page);
        },
      };
      if (isDisabled) linkProps["aria-disabled"] = true;
      return React.createElement("a", linkProps, label);
    }

    const buttonProps: any = {
      type: "button",
      "aria-label": commonAriaLabel,
      "aria-current": isCurrent ? "page" : undefined,
      disabled: isDisabled,
      className:
        baseButtonClass +
        (props.buttonClassName ? " " + props.buttonClassName : "") +
        (isCurrent && props.currentClassName ? " " + props.currentClassName : ""),
      style: buildButtonStyle(isCurrent, isDisabled),
      onClick: () => {
        if (isDisabled) return;
        if (props.onPageChange) props.onPageChange(page);
      },
    };
    return React.createElement("button", buttonProps, label);
  };

  const arrowStyle: AnyStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 16,
    height: 16,
  };

  const leftArrow = React.createElement(
    "svg",
    {
      viewBox: "0 0 20 20",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      width: 14,
      height: 14,
      "aria-hidden": "true",
    } as any,
    React.createElement("path", { d: "M12 5l-5 5 5 5" } as any)
  );

  const rightArrow = React.createElement(
    "svg",
    {
      viewBox: "0 0 20 20",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      width: 14,
      height: 14,
      "aria-hidden": "true",
    } as any,
    React.createElement("path", { d: "M8 5l5 5-5 5" } as any)
  );

  const prevLabel = React.createElement(
    "span",
    { className: baseTextClass, style: baseTextStyle } as any,
    showArrows ? React.createElement("span", { style: arrowStyle } as any, leftArrow) : null,
    showPrevNextText ? React.createElement("span", null, prevText) : null
  );

  const nextLabel = React.createElement(
    "span",
    { className: baseTextClass, style: baseTextStyle } as any,
    showPrevNextText ? React.createElement("span", null, nextText) : null,
    showArrows ? React.createElement("span", { style: arrowStyle } as any, rightArrow) : null
  );

  // Render page number controls with unique keys
  const numberLabels = pages.map((page) => {
    const label = React.createElement(
      "span",
      { className: baseTextClass, style: baseTextStyle } as any,
      page.toString()
    );
    const control = renderControl(label, page, "page", page === currentPage, disabled);
    return React.cloneElement(control, { key: `page-${page}` });
  });

  // Render prev/next with keys
  let prevControl = renderControl(
    prevLabel,
    prevPage,
    "prev",
    false,
    disabled || currentPage <= 1
  );
  prevControl = React.cloneElement(prevControl, { key: "prev" });

  let nextControl = renderControl(
    nextLabel,
    nextPage,
    "next",
    false,
    disabled || currentPage >= totalPages
  );
  nextControl = React.cloneElement(nextControl, { key: "next" });

  return React.createElement(
    "nav",
    { className: wrapperClassName, style: wrapperStyle, "aria-label": props.ariaLabel || "Pagination" } as any,
    prevControl,
    showPageNumbers ? numberLabels : null,
    nextControl
  );
}