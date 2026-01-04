// src/components/AdaptiveMenu.tsx
import React, { useId } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

type AnyStyle = Record<string, any>;

export type AdaptiveMenuTextVisibility = "full" | "compact";

export interface AdaptiveMenuItem {
  id?: string;
  label: string;
  description?: string;
  example?: string;
  href?: string;
  disabled?: boolean;
  selected?: boolean;
  onSelect?: (item: AdaptiveMenuItem) => void;
}

export interface AdaptiveMenuGroup {
  id?: string;
  title?: string;
  items: AdaptiveMenuItem[];
}

export interface AdaptiveMenuProps extends AdaptiveComponentProps {
  items?: AdaptiveMenuItem[];
  groups?: AdaptiveMenuGroup[];

  ariaLabel?: string;
  textVisibility?: AdaptiveMenuTextVisibility;
  itemHeight?: number;
  itemGap?: number;
  groupGap?: number;
  showDividers?: boolean;
  fullWidth?: boolean;

  onItemSelect?: (item: AdaptiveMenuItem) => void;
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

export function AdaptiveMenu(props: AdaptiveMenuProps) {
  const { tokens } = useAdaptive();
  const { colors, typography, spacing, controls, flags } = tokens;

  const menuId = useId();

  const groups =
    props.groups && props.groups.length > 0
      ? props.groups
      : props.items && props.items.length > 0
      ? [{ id: "default", items: props.items }]
      : [];

  const fullWidth = props.fullWidth === undefined ? true : props.fullWidth;

  const textVisibility: AdaptiveMenuTextVisibility =
    props.textVisibility === undefined
      ? flags.tooltipAssist
        ? "full"
        : flags.layoutSimplification
        ? "compact"
        : "full"
      : props.textVisibility;

  const showDescriptions = textVisibility === "full";

  const itemGap =
    props.itemGap === undefined
      ? Math.max(6, Math.round(spacing.gapY * 0.6))
      : props.itemGap;

  const groupGap =
    props.groupGap === undefined ? Math.max(10, spacing.gapY) : props.groupGap;

  const minHeightBase = Math.max(
    controls.minTargetSize,
    Math.round(typography.basePx * 2.1),
    spacing.padY * 2 + typography.basePx
  );

  const motorFriendly = controls.minTargetSize >= 28;
  const itemHeight =
    props.itemHeight === undefined
      ? motorFriendly
        ? Math.max(minHeightBase, controls.minTargetSize + 12)
        : minHeightBase
      : props.itemHeight;

  const padY = Math.max(6, spacing.padY);
  const padX = Math.max(10, spacing.padX);

  const secondaryTextColor = flags.highContrast
    ? colors.text
    : colors.secondary
    ? colors.secondary
    : colors.text;

  const wrapperStyle: AnyStyle = {
    width: fullWidth ? "100%" : "auto",
    backgroundColor: colors.surface,
    border: "1px solid " + colors.border,
    borderRadius: 14,
    padding: Math.max(8, spacing.padY).toString() + "px " + Math.max(10, spacing.padX).toString() + "px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: groupGap,
  };

  if (!flags.highContrast) {
    wrapperStyle.boxShadow = "0 6px 16px rgba(0,0,0,0.08)";
  }

  mergeStyle(wrapperStyle, props.style);

  const classNameProp = props.className === undefined ? "" : props.className;

  const menuProps: AnyStyle = {
    style: wrapperStyle,
    className: "adaptive-menu " + classNameProp,
  };

  if ((props as any).id !== undefined) menuProps.id = (props as any).id;
  if ((props as any).role !== undefined) menuProps.role = (props as any).role;
  if (props.ariaLabel !== undefined) menuProps["aria-label"] = props.ariaLabel;
  if ((props as any)["aria-label"] !== undefined)
    menuProps["aria-label"] = (props as any)["aria-label"];

  const showDividers =
    props.showDividers === undefined ? groups.length > 1 : props.showDividers;

  const dividerStyle: AnyStyle = {
    height: "1px",
    backgroundColor: colors.border,
    width: "100%",
    marginTop: Math.max(6, Math.round(spacing.gapY * 0.5)),
    marginBottom: Math.max(6, Math.round(spacing.gapY * 0.5)),
  };

  const groupTitleStyle: AnyStyle = {
    fontSize: typography.caption,
    lineHeight: typography.lineHeight,
    color: secondaryTextColor,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  const groupListStyle: AnyStyle = {
    display: "flex",
    flexDirection: "column",
    gap: itemGap,
    listStyleType: "none",
    padding: 0,
    margin: 0,
  };

  const labelStyle: AnyStyle = {
    fontSize: typography.body,
    lineHeight: typography.lineHeight,
    fontWeight: 600,
    color: colors.text,
  };

  const descriptionStyle: AnyStyle = {
    fontSize: typography.caption,
    lineHeight: typography.lineHeight,
    color: secondaryTextColor,
    marginTop: Math.max(2, Math.round(spacing.gapY * 0.25)),
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    overflow: "hidden",
  };

  const exampleStyle: AnyStyle = {
    fontSize: typography.caption,
    lineHeight: typography.lineHeight,
    color: secondaryTextColor,
    marginTop: Math.max(2, Math.round(spacing.gapY * 0.25)),
    fontStyle: "italic",
  };

  const renderItem = (item: AdaptiveMenuItem) => {
    const disabled = item.disabled === true;
    const selected = item.selected === true;
    const isLink = typeof item.href === "string" && item.href.length > 0;

    const itemStyle: AnyStyle = {
      minHeight: itemHeight,
      padding: padY.toString() + "px " + padX.toString() + "px",
      borderRadius: 10,
      border: "1px solid " + (selected ? colors.primary : colors.border),
      backgroundColor: selected ? colors.background : colors.surface,
      color: colors.text,
      textAlign: "left",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      justifyContent: "center",
      textDecoration: "none",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
      boxSizing: "border-box",
      width: "100%",
    };

    const commonProps: AnyStyle = {
      style: itemStyle,
      className: "adaptive-menu__item",
      "aria-current": selected ? "page" : undefined,
    };

    const handleSelect = (event: React.MouseEvent<any>) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      if (item.onSelect) item.onSelect(item);
      if (props.onItemSelect) props.onItemSelect(item);
    };

    const content = [
      React.createElement("div", { style: labelStyle, key: "label" }, item.label),
    ];

    if (showDescriptions && item.description) {
      content.push(
        React.createElement("div", { style: descriptionStyle, key: "desc" }, item.description)
      );
    }

    if (flags.tooltipAssist && item.example) {
      content.push(
        React.createElement(
          "div",
          { style: exampleStyle, key: "example" },
          "Example: " + item.example
        )
      );
    }

    if (isLink) {
      const linkProps: AnyStyle = {};
      linkProps.style = commonProps.style;
      linkProps.className = commonProps.className;
      if (commonProps["aria-current"] !== undefined) {
        linkProps["aria-current"] = commonProps["aria-current"];
      }
      linkProps.href = disabled ? undefined : item.href;
      linkProps.onClick = handleSelect;
      if (disabled) linkProps["aria-disabled"] = true;
      return React.createElement("a", linkProps as any, content);
    }

    const buttonProps: AnyStyle = {};
    buttonProps.style = commonProps.style;
    buttonProps.className = commonProps.className;
    if (commonProps["aria-current"] !== undefined) {
      buttonProps["aria-current"] = commonProps["aria-current"];
    }
    buttonProps.type = "button";
    buttonProps.disabled = disabled;
    buttonProps.onClick = handleSelect;
    return React.createElement("button", buttonProps as any, content);
  };

  return React.createElement(
    "div",
    menuProps as any,
    groups.map((group, groupIndex) => {
      const groupKey = group.id ? group.id : "group-" + groupIndex.toString();
      const groupTitleId = group.title ? menuId + "-" + groupKey + "-title" : undefined;

      const groupProps: AnyStyle = {
        role: "group",
      };
      if (groupTitleId) groupProps["aria-labelledby"] = groupTitleId;

      return React.createElement(
        "div",
        { key: groupKey, role: groupProps.role, "aria-labelledby": groupProps["aria-labelledby"] } as any,
        group.title
          ? React.createElement(
              "div",
              { id: groupTitleId, style: groupTitleStyle, className: "adaptive-menu__group-title" } as any,
              group.title
            )
          : null,
        React.createElement(
          "ul",
          { style: groupListStyle, className: "adaptive-menu__group" } as any,
          group.items.map((item, itemIndex) =>
            React.createElement(
              "li",
              { key: (item.id || item.label) + "-" + itemIndex.toString() } as any,
              renderItem(item)
            )
          )
        ),
        showDividers && groupIndex < groups.length - 1
          ? React.createElement("div", { style: dividerStyle } as any)
          : null
      );
    })
  );
}
