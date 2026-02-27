// src/components/AdaptiveDropdown.tsx
import React, { useEffect, useId, useRef, useState } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

type AnyStyle = Record<string, any>;

export type AdaptiveDropdownLabelVisibility = "auto" | "visible" | "hidden";
export type AdaptiveDropdownAlign = "left" | "right";

export interface AdaptiveDropdownItem {
  id?: string;
  label: string;
  href?: string;
  disabled?: boolean;
  onSelect?: (item: AdaptiveDropdownItem) => void;
}

export interface AdaptiveDropdownProps extends AdaptiveComponentProps {
  items: AdaptiveDropdownItem[];

  id?: string;
  label?: string;
  icon?: React.ReactNode;
  iconOnly?: boolean;
  labelVisibility?: AdaptiveDropdownLabelVisibility;
  ariaLabel?: string;

  triggerSize?: number;
  menuSpacing?: number;
  align?: AdaptiveDropdownAlign;
  fullWidth?: boolean;
  disabled?: boolean;

  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;

  onItemSelect?: (item: AdaptiveDropdownItem) => void;
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

export function AdaptiveDropdown(props: AdaptiveDropdownProps) {
  const { tokens } = useAdaptive();
  const { colors, typography, spacing, controls, flags } = tokens;

  const autoId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [internalOpen, setInternalOpen] = useState<boolean>(
    props.defaultOpen === true
  );

  const isControlled = props.open !== undefined;
  const isOpen = isControlled ? props.open === true : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    if (props.onOpenChange) props.onOpenChange(next);
  };

  const lowLiteracy = flags.tooltipAssist || flags.layoutSimplification;

  const labelVisibility: AdaptiveDropdownLabelVisibility =
    props.labelVisibility === undefined ? "auto" : props.labelVisibility;

  const hasLabel = typeof props.label === "string" && props.label.length > 0;
  const iconOnly = props.iconOnly === true;

  const showLabel =
    hasLabel &&
    (labelVisibility === "visible" ||
      (labelVisibility === "auto" && (!iconOnly || lowLiteracy)));

  const hideLabel =
    hasLabel &&
    (labelVisibility === "hidden" || (labelVisibility === "auto" && iconOnly && !lowLiteracy));

  const triggerId = props.id === undefined ? "adaptive-dropdown-" + autoId : props.id;
  const menuId = triggerId + "-menu";

  const fullWidth = props.fullWidth === true;
  const align: AdaptiveDropdownAlign = props.align === "right" ? "right" : "left";

  const motorFriendly = controls.minTargetSize >= 28;

  const baseHeight = Math.max(
    controls.minTargetSize,
    Math.round(typography.basePx * 2.1),
    spacing.padY * 2 + typography.basePx
  );

  const triggerSize =
    props.triggerSize === undefined
      ? motorFriendly
        ? Math.max(baseHeight, controls.minTargetSize + 12)
        : baseHeight
      : props.triggerSize;

  const triggerPadX = Math.max(12, spacing.padX);
  const triggerPadY = Math.max(6, spacing.padY);
  const triggerGap = Math.max(8, spacing.gapX);

  const menuSpacing =
    props.menuSpacing === undefined
      ? Math.max(6, Math.round(spacing.gapY * 0.6))
      : props.menuSpacing;

  const menuOffset = Math.max(6, Math.round(spacing.gapY * 0.5));

  const disabled = props.disabled === true;

  useEffect(() => {
    if (!isOpen) return;
    if (typeof document === "undefined") return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !wrapperRef.current) return;
      if (!wrapperRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, setOpen]);

  const wrapperStyle: AnyStyle = {
    width: fullWidth ? "100%" : "auto",
    position: "relative",
    display: "inline-flex",
    flexDirection: "column",
  };

  mergeStyle(wrapperStyle, props.style);

  const wrapperClassName =
    "adaptive-dropdown inline-flex " + (props.className || "");

  const triggerStyle: AnyStyle = {
    minHeight: triggerSize,
    padding: triggerPadY.toString() + "px " + triggerPadX.toString() + "px",
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: 9999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: typography.lineHeight,
    fontSize: typography.body,
    cursor: disabled ? "not-allowed" : "pointer",
    width: fullWidth ? "100%" : "auto",
    boxSizing: "border-box",
    transition: flags.reducedMotion
      ? "none"
      : "box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease",
  };

  const triggerClassName =
    "adaptive-dropdown__trigger rounded-full border " +
    (flags.highContrast ? "" : "shadow-sm ") +
    (disabled
      ? "opacity-60 "
      : "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ") +
    "backdrop-blur-sm";

  triggerStyle["--tw-ring-color"] = colors.primary;
  triggerStyle["--tw-ring-offset-color"] = colors.surface;

  const menuStyle: AnyStyle = {
    position: "absolute",
    top: "calc(100% + " + menuOffset.toString() + "px)",
    minWidth: fullWidth ? "100%" : Math.max(200, controls.minTargetSize * 6),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: 16,
    padding: Math.max(6, spacing.padY).toString() + "px",
    boxSizing: "border-box",
    display: isOpen ? "flex" : "none",
    flexDirection: "column",
    rowGap: menuSpacing,
    zIndex: 50,
  };

  if (align === "right") {
    menuStyle.right = 0;
  } else {
    menuStyle.left = 0;
  }

  if (!flags.highContrast) {
    menuStyle.boxShadow = "0 12px 30px rgba(0,0,0,0.12)";
  }

  const menuClassName =
    "adaptive-dropdown__menu rounded-2xl border " +
    (flags.highContrast ? "" : "shadow-lg ") +
    "backdrop-blur-sm";

  const itemStyleBase: AnyStyle = {
    minHeight: Math.max(controls.minTargetSize, Math.round(triggerSize * 0.7)),
    padding: Math.max(6, spacing.padY).toString() + "px " + Math.max(12, spacing.padX).toString() + "px",
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "transparent",
    backgroundColor: "transparent",
    color: colors.text,
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    fontSize: typography.body,
    lineHeight: typography.lineHeight,
    cursor: "pointer",
  };

  const hoverClass = flags.theme === "dark" ? "hover:bg-white/10 " : "hover:bg-black/5 ";

  const itemClassName =
    "adaptive-dropdown__item w-full rounded-xl text-left " +
    (flags.reducedMotion ? "" : "transition-colors duration-150 ") +
    (disabled ? "cursor-not-allowed " : hoverClass + "focus-visible:outline-none");

  const iconSize = Math.max(16, Math.round(typography.basePx * 1.1));
  const iconWrapStyle: AnyStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: iconSize,
    height: iconSize,
  };

  const labelWrapStyle: AnyStyle = {
    display: "inline-flex",
    alignItems: "center",
    columnGap: Math.max(6, spacing.gapX * 0.6),
  };

  const handleTriggerClick = () => {
    if (disabled) return;
    setOpen(!isOpen);
  };

  const triggerAriaLabel =
    props.ariaLabel !== undefined
      ? props.ariaLabel
      : !showLabel
      ? props.label || "Menu"
      : undefined;

  const triggerProps: AnyStyle = {
    id: triggerId,
    type: "button",
    style: triggerStyle,
    className: triggerClassName,
    onClick: handleTriggerClick,
    "aria-haspopup": "menu",
    "aria-expanded": isOpen,
    "aria-controls": menuId,
    disabled: disabled,
  };

  if (triggerAriaLabel) triggerProps["aria-label"] = triggerAriaLabel;

  const menuProps: AnyStyle = {
    id: menuId,
    role: "menu",
    "aria-labelledby": triggerId,
    style: menuStyle,
    className: menuClassName,
  };

  const renderItem = (item: AdaptiveDropdownItem, index: number) => {
    const itemDisabled = disabled || item.disabled === true;
    const itemStyle: AnyStyle = {};
    const keys = Object.keys(itemStyleBase);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      itemStyle[k] = itemStyleBase[k];
    }

    if (itemDisabled) {
      itemStyle.opacity = 0.55;
      itemStyle.cursor = "not-allowed";
    }

    const handleItemSelect = (event: React.MouseEvent<any>) => {
      if (itemDisabled) {
        event.preventDefault();
        return;
      }
      if (item.onSelect) item.onSelect(item);
      if (props.onItemSelect) props.onItemSelect(item);
      setOpen(false);
    };

    const content = React.createElement("span", { style: labelWrapStyle }, item.label);

    if (item.href) {
      const linkProps: AnyStyle = {};
      linkProps.key = item.id || item.label || index;
      linkProps.role = "menuitem";
      linkProps.href = itemDisabled ? undefined : item.href;
      linkProps.onClick = handleItemSelect;
      linkProps.className = itemClassName;
      linkProps.style = itemStyle;
      if (itemDisabled) linkProps["aria-disabled"] = true;
      return React.createElement("a", linkProps as any, content);
    }

    const buttonProps: AnyStyle = {};
    buttonProps.key = item.id || item.label || index;
    buttonProps.type = "button";
    buttonProps.role = "menuitem";
    buttonProps.onClick = handleItemSelect;
    buttonProps.className = itemClassName;
    buttonProps.style = itemStyle;
    buttonProps.disabled = itemDisabled;
    return React.createElement("button", buttonProps as any, content);
  };

  const chevronStyle: AnyStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 16,
    height: 16,
    color: colors.text,
    opacity: disabled ? 0.6 : 0.8,
  };

  const chevron = React.createElement(
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
    React.createElement("path", { d: "M6 8l4 4 4-4" } as any)
  );

  const triggerContent = React.createElement(
    "span",
    {
      className: "flex w-full items-center justify-between",
    } as any,
    React.createElement(
      "span",
      { style: labelWrapStyle, className: "flex items-center" } as any,
      props.icon ? React.createElement("span", { style: iconWrapStyle }, props.icon) : null,
      showLabel ? React.createElement("span", null, props.label) : null
    ),
    React.createElement("span", { style: chevronStyle }, chevron)
  );

  return React.createElement(
    "div",
    { ref: wrapperRef, className: wrapperClassName, style: wrapperStyle } as any,
    React.createElement("button", triggerProps as any, triggerContent),
    React.createElement(
      "div",
      menuProps as any,
      props.items.map((item, index) => renderItem(item, index))
    )
  );
}
