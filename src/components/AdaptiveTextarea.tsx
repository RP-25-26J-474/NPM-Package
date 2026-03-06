// src/components/AdaptiveTextarea.tsx
import React, { useId, useState, type TextareaHTMLAttributes } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

type AnyStyle = Record<string, any>;

export type AdaptiveTextareaLabelMode = "visible" | "hidden";

export interface AdaptiveTextareaProps
  extends AdaptiveComponentProps,
    TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  labelMode?: AdaptiveTextareaLabelMode;
  labelFontSize?: string;
  labelGap?: number;

  helperText?: string;
  example?: string;

  height?: number;
  fontSize?: string;
  lineHeight?: number;
  resize?: "none" | "vertical" | "horizontal" | "both";

  fullWidth?: boolean;
  textareaClassName?: string;
  textareaStyle?: React.CSSProperties;
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

function applySrOnlyStyle(target: AnyStyle) {
  target.position = "absolute";
  target.width = "1px";
  target.height = "1px";
  target.padding = 0;
  target.margin = "-1px";
  target.overflow = "hidden";
  target.clip = "rect(0, 0, 0, 0)";
  target.whiteSpace = "nowrap";
  target.border = 0;
}

function toPxNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function AdaptiveTextarea(props: AdaptiveTextareaProps) {
  const { tokens } = useAdaptive();
  const { colors, typography, spacing, controls, flags } = tokens;

  const autoId = useId();
  const [focused, setFocused] = useState(false);

  const label = props.label;
  const labelMode: AdaptiveTextareaLabelMode =
    props.labelMode === undefined ? "visible" : props.labelMode;

  const helperText = props.helperText;
  const example = props.example;

  const fullWidth = props.fullWidth === undefined ? true : props.fullWidth;

  const labelGap =
    props.labelGap === undefined
      ? Math.max(6, Math.round(spacing.gapY * 0.6))
      : props.labelGap;

  const labelFontSize =
    props.labelFontSize === undefined ? typography.body : props.labelFontSize;

  const fontSize = props.fontSize === undefined ? typography.body : props.fontSize;
  const fontPx = toPxNumber(fontSize, typography.basePx);

  const defaultLineHeight =
    flags.highContrast ? Math.max(typography.lineHeight, 1.6) : typography.lineHeight;
  const lineHeight = props.lineHeight === undefined ? defaultLineHeight : props.lineHeight;

  const motorFriendly = controls.minTargetSize >= 28;
  const resizeMode =
    props.resize === undefined ? (motorFriendly ? "both" : "vertical") : props.resize;

  const basePaddingY = Math.max(8, spacing.padY);
  const basePaddingX = Math.max(10, spacing.padX);
  const handlePadding =
    motorFriendly && resizeMode !== "none"
      ? Math.max(6, Math.round(controls.minTargetSize * 0.2))
      : 0;

  const height = props.height;

  const defaultRows = flags.layoutSimplification ? 3 : 5;
  const rows =
    props.rows !== undefined ? props.rows : height === undefined ? defaultRows : undefined;

  const hasLabel = typeof label === "string" && label.length > 0;
  const showLabel = hasLabel && labelMode === "visible";
  const showHiddenLabel = hasLabel && labelMode !== "visible";

  const showExampleInline =
    typeof example === "string" &&
    example.length > 0 &&
    (flags.layoutSimplification || flags.tooltipAssist);

  const placeholderValue =
    props.placeholder === undefined && showExampleInline ? example : props.placeholder;

  const lineHeightPx = Math.max(1, Math.round(fontPx * lineHeight));
  const minHeightFromRows =
    rows === undefined
      ? 0
      : lineHeightPx * rows + (basePaddingY + handlePadding) * 2;

  const minHeightBase = Math.max(
    motorFriendly ? controls.minTargetSize * 3 : controls.minTargetSize * 2,
    minHeightFromRows
  );

  const disabled = props.disabled === true;
  const readOnly = props.readOnly === true;
  const secondaryTextColor =
    flags.highContrast ? colors.text : colors.secondary ? colors.secondary : colors.text;

  const classNameProp = props.className === undefined ? "" : props.className;
  const textareaClassNameProp =
    props.textareaClassName === undefined ? "" : props.textareaClassName;

  const textareaId = props.id === undefined ? "adaptive-textarea-" + autoId : props.id;
  const labelId = label ? textareaId + "-label" : undefined;
  const helperId = helperText ? textareaId + "-help" : undefined;

  const ariaLabelProp = (props as any)["aria-label"];
  const ariaDescribedByProp = (props as any)["aria-describedby"];

  const describedByParts = [];
  if (ariaDescribedByProp) describedByParts.push(ariaDescribedByProp);
  if (helperId) describedByParts.push(helperId);

  const describedBy =
    describedByParts.length > 0 ? describedByParts.join(" ") : undefined;

  const borderColor = colors.border;
  const focusColor = colors.primary;

  const textareaStyle: AnyStyle = {
    width: fullWidth ? "100%" : undefined,
    paddingTop: basePaddingY,
    paddingRight: basePaddingX + handlePadding,
    paddingBottom: basePaddingY + handlePadding,
    paddingLeft: basePaddingX,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: borderColor,
    backgroundColor: disabled ? colors.surface : colors.background,
    color: colors.text,
    fontSize: fontSize,
    lineHeight: lineHeight,
    boxSizing: "border-box",
    outline: "none",
    resize: resizeMode,
    transition: flags.reducedMotion
      ? "none"
      : "border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
    opacity: disabled ? 0.7 : 1,
  };

  if (height !== undefined) {
    textareaStyle.height = height;
  } else {
    textareaStyle.minHeight = minHeightBase;
  }

  if (focused && !disabled) {
    textareaStyle.borderColor = focusColor;
    textareaStyle.boxShadow = "0 0 0 3px " + focusColor;
  }

  if (readOnly) {
    textareaStyle.backgroundColor = colors.surface;
  }

  mergeStyle(textareaStyle, props.textareaStyle);

  const wrapperStyle: AnyStyle = {
    display: "flex",
    flexDirection: "column",
    width: fullWidth ? "100%" : "auto",
    position: "relative",
  };

  mergeStyle(wrapperStyle, props.style);

  const labelStyle: AnyStyle = {
    fontSize: labelFontSize,
    lineHeight: typography.lineHeight,
    color: colors.text,
    fontWeight: 600,
  };

  if (showLabel) {
    labelStyle.marginBottom = labelGap;
  } else if (showHiddenLabel) {
    applySrOnlyStyle(labelStyle);
  }

  if (disabled) labelStyle.opacity = 0.7;

  const helperStyle: AnyStyle = {
    fontSize: typography.caption,
    lineHeight: typography.lineHeight,
    color: secondaryTextColor,
    marginTop: Math.max(4, Math.round(spacing.gapY * 0.4)),
  };

  const textareaProps: TextareaHTMLAttributes<HTMLTextAreaElement> = {};
  textareaProps.id = textareaId;
  textareaProps.className = "adaptive-textarea__field " + textareaClassNameProp;
  textareaProps.style = textareaStyle as any;

  if (props.name !== undefined) textareaProps.name = props.name;
  if (props.value !== undefined) textareaProps.value = props.value;
  if (props.defaultValue !== undefined) textareaProps.defaultValue = props.defaultValue;
  if (placeholderValue !== undefined) textareaProps.placeholder = placeholderValue;
  if (props.autoComplete !== undefined) textareaProps.autoComplete = props.autoComplete;
  if (props.autoFocus !== undefined) textareaProps.autoFocus = props.autoFocus;
  if (props.disabled !== undefined) textareaProps.disabled = props.disabled;
  if (props.readOnly !== undefined) textareaProps.readOnly = props.readOnly;
  if (props.required !== undefined) textareaProps.required = props.required;
  if (props.maxLength !== undefined) textareaProps.maxLength = props.maxLength;
  if (props.minLength !== undefined) textareaProps.minLength = props.minLength;
  if (props.wrap !== undefined) textareaProps.wrap = props.wrap;
  if (props.cols !== undefined) textareaProps.cols = props.cols;
  if (rows !== undefined) textareaProps.rows = rows;
  if (props.onChange !== undefined) textareaProps.onChange = props.onChange;
  if (props.onInput !== undefined) textareaProps.onInput = props.onInput;
  if (props.onKeyDown !== undefined) textareaProps.onKeyDown = props.onKeyDown;
  if (props.onKeyUp !== undefined) textareaProps.onKeyUp = props.onKeyUp;
  if (props.onKeyPress !== undefined) textareaProps.onKeyPress = props.onKeyPress;
  if (props.onPaste !== undefined) textareaProps.onPaste = props.onPaste;
  if (props.onClick !== undefined) textareaProps.onClick = props.onClick;
  if (props.onMouseEnter !== undefined) textareaProps.onMouseEnter = props.onMouseEnter;
  if (props.onMouseLeave !== undefined) textareaProps.onMouseLeave = props.onMouseLeave;

  textareaProps.onFocus = (event) => {
    setFocused(true);
    if (props.onFocus) props.onFocus(event);
  };

  textareaProps.onBlur = (event) => {
    setFocused(false);
    if (props.onBlur) props.onBlur(event);
  };

  if (ariaLabelProp !== undefined) {
    (textareaProps as any)["aria-label"] = ariaLabelProp;
  } else if (!hasLabel && placeholderValue) {
    (textareaProps as any)["aria-label"] = placeholderValue;
  }

  if (describedBy) {
    (textareaProps as any)["aria-describedby"] = describedBy;
  }

  return React.createElement(
    "div",
    { style: wrapperStyle, className: "adaptive-textarea " + classNameProp } as any,
    showLabel || showHiddenLabel
      ? React.createElement(
          "label",
          {
            htmlFor: textareaId,
            id: labelId,
            style: labelStyle,
            className: "adaptive-textarea__label",
          } as any,
          label
        )
      : null,
    React.createElement("textarea", textareaProps as any),
    helperText
      ? React.createElement(
          "div",
          { id: helperId, style: helperStyle, className: "adaptive-textarea__helper" } as any,
          helperText
        )
      : null
  );
}
