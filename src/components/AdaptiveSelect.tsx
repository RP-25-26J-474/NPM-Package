// src/components/AdaptiveSelect.tsx
import React, { useId, useState, type SelectHTMLAttributes } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

type AnyStyle = Record<string, any>;

export type AdaptiveSelectLabelMode = "visible" | "hidden";

export interface AdaptiveSelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface AdaptiveSelectProps
  extends AdaptiveComponentProps,
    SelectHTMLAttributes<HTMLSelectElement> {
  options: AdaptiveSelectOption[];

  label?: string;
  labelMode?: AdaptiveSelectLabelMode;
  labelFontSize?: string;
  labelGap?: number;

  placeholder?: string;

  selectHeight?: number;
  optionSpacing?: number;
  fontSize?: string;

  helperText?: string;
  error?: string;
  showError?: boolean;

  fullWidth?: boolean;
  selectClassName?: string;
  selectStyle?: React.CSSProperties;
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

export function AdaptiveSelect(props: AdaptiveSelectProps) {
  const { tokens } = useAdaptive();
  const { colors, typography, spacing, controls, flags } = tokens;

  const autoId = useId();
  const [focused, setFocused] = useState(false);

  const label = props.label;
  const labelMode: AdaptiveSelectLabelMode =
    props.labelMode === undefined ? "visible" : props.labelMode;

  const helperText = props.helperText;
  const error = props.error;
  const showError = props.showError === undefined ? true : props.showError;

  const fullWidth = props.fullWidth === undefined ? true : props.fullWidth;

  const labelGap =
    props.labelGap === undefined
      ? Math.max(6, Math.round(spacing.gapY * 0.6))
      : props.labelGap;

  const labelFontSize =
    props.labelFontSize === undefined ? typography.body : props.labelFontSize;

  const fontSize = props.fontSize === undefined ? typography.body : props.fontSize;

  const baseHeight = Math.max(
    controls.minTargetSize,
    Math.round(typography.basePx * 2.2),
    spacing.padY * 2 + typography.basePx
  );

  const selectHeight = props.selectHeight;
  const optionSpacing =
    props.optionSpacing === undefined
      ? Math.max(2, Math.round(spacing.gapY * 0.45))
      : props.optionSpacing;

  const placeholder = props.placeholder;

  const disabled = props.disabled === true;

  const classNameProp = props.className === undefined ? "" : props.className;
  const selectClassNameProp =
    props.selectClassName === undefined ? "" : props.selectClassName;

  const selectId = props.id === undefined ? "adaptive-select-" + autoId : props.id;
  const labelId = label ? selectId + "-label" : undefined;
  const helperId = helperText ? selectId + "-help" : undefined;
  const errorId = error ? selectId + "-error" : undefined;

  const ariaLabelProp = (props as any)["aria-label"];
  const ariaDescribedByProp = (props as any)["aria-describedby"];

  const describedByParts = [];
  if (ariaDescribedByProp) describedByParts.push(ariaDescribedByProp);
  if (helperId) describedByParts.push(helperId);
  if (errorId) describedByParts.push(errorId);

  const describedBy =
    describedByParts.length > 0 ? describedByParts.join(" ") : undefined;

  const hasLabel = typeof label === "string" && label.length > 0;
  const showLabel = hasLabel && labelMode === "visible";
  const showHiddenLabel = hasLabel && labelMode !== "visible";

  const options = props.options || [];

  const isControlled = props.value !== undefined;
  const initialValue = (() => {
    if (props.value !== undefined) return props.value;
    if (props.defaultValue !== undefined) return props.defaultValue;
    if (placeholder) return "";
    if (options.length > 0) return options[0].value;
    return "";
  })();

  const [internalValue, setInternalValue] = useState<any>(initialValue);
  const selectedValue = isControlled ? props.value : internalValue;

  const placeholderActive =
    placeholder !== undefined &&
    (selectedValue === undefined || selectedValue === null || selectedValue === "");

  const placeholderColor =
    flags.theme === "dark" && !flags.highContrast ? "#9ca3af" : "#6b7280";

  const borderColor = error ? colors.accent : colors.border;
  const focusColor = error ? colors.accent : colors.primary;

  const selectStyle: AnyStyle = {
    width: fullWidth ? "100%" : undefined,
    padding: Math.max(6, spacing.padY).toString() + "px " + Math.max(10, spacing.padX).toString() + "px",
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: borderColor,
    backgroundColor: disabled ? colors.surface : colors.background,
    color: placeholderActive ? placeholderColor : colors.text,
    fontSize: fontSize,
    lineHeight: typography.lineHeight,
    boxSizing: "border-box",
    outline: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: flags.reducedMotion
      ? "none"
      : "border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
    opacity: disabled ? 0.7 : 1,
  };

  if (selectHeight !== undefined) {
    selectStyle.height = selectHeight;
  } else if (!props.multiple) {
    selectStyle.minHeight = baseHeight;
  }

  if (focused && !disabled) {
    selectStyle.borderColor = focusColor;
    selectStyle.boxShadow = "0 0 0 3px " + focusColor;
  }


  mergeStyle(selectStyle, props.selectStyle);

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
    color: colors.text,
    marginTop: Math.max(4, Math.round(spacing.gapY * 0.4)),
  };

  const errorStyle: AnyStyle = {
    fontSize: typography.caption,
    lineHeight: typography.lineHeight,
    color: colors.accent,
  };

  if (error && showError) {
    errorStyle.marginTop = Math.max(4, Math.round(spacing.gapY * 0.4));
  } else if (error && !showError) {
    applySrOnlyStyle(errorStyle);
  }

  const optionStyle: AnyStyle = {
    fontSize: fontSize,
    lineHeight: typography.lineHeight,
    padding: optionSpacing.toString() + "px " + Math.max(8, Math.round(spacing.padX * 0.8)).toString() + "px",
  };

  const selectProps: SelectHTMLAttributes<HTMLSelectElement> = {};
  selectProps.id = selectId;
  selectProps.className = "adaptive-select__field " + selectClassNameProp;
  selectProps.style = selectStyle as any;

  if (props.name !== undefined) selectProps.name = props.name;
  if (props.disabled !== undefined) selectProps.disabled = props.disabled;
  if (props.required !== undefined) selectProps.required = props.required;
  if (props.multiple !== undefined) selectProps.multiple = props.multiple;
  if (props.size !== undefined) selectProps.size = props.size;
  if (props.onInput !== undefined) selectProps.onInput = props.onInput;
  if (props.onKeyDown !== undefined) selectProps.onKeyDown = props.onKeyDown;
  if (props.onKeyUp !== undefined) selectProps.onKeyUp = props.onKeyUp;
  if (props.onKeyPress !== undefined) selectProps.onKeyPress = props.onKeyPress;
  if (props.onClick !== undefined) selectProps.onClick = props.onClick;
  if (props.onMouseEnter !== undefined) selectProps.onMouseEnter = props.onMouseEnter;
  if (props.onMouseLeave !== undefined) selectProps.onMouseLeave = props.onMouseLeave;

  selectProps.value = selectedValue;

  selectProps.onFocus = (event) => {
    setFocused(true);
    if (props.onFocus) props.onFocus(event);
  };

  selectProps.onBlur = (event) => {
    setFocused(false);
    if (props.onBlur) props.onBlur(event);
  };

  selectProps.onChange = (event) => {
    if (!isControlled) {
      setInternalValue(event.target.value);
    }
    if (props.onChange) props.onChange(event);
  };

  if (ariaLabelProp !== undefined) {
    (selectProps as any)["aria-label"] = ariaLabelProp;
  } else if (!hasLabel && placeholder) {
    (selectProps as any)["aria-label"] = placeholder;
  }

  if (describedBy) {
    (selectProps as any)["aria-describedby"] = describedBy;
  }

  if (error) {
    (selectProps as any)["aria-invalid"] = true;
  }

  return React.createElement(
    "div",
    { style: wrapperStyle, className: "adaptive-select " + classNameProp } as any,
    showLabel || showHiddenLabel
      ? React.createElement(
          "label",
          {
            htmlFor: selectId,
            id: labelId,
            style: labelStyle,
            className: "adaptive-select__label",
          } as any,
          label
        )
      : null,
    React.createElement(
      "select",
      selectProps as any,
      placeholder
        ? React.createElement(
            "option",
            { value: "", disabled: true, style: optionStyle } as any,
            placeholder
          )
        : null,
      options.map((opt, index) =>
        React.createElement(
          "option",
          {
            key: opt.value + "-" + index.toString(),
            value: opt.value as any,
            disabled: opt.disabled === true,
            style: optionStyle,
          } as any,
          opt.label
        )
      )
    ),
    helperText
      ? React.createElement(
          "div",
          { id: helperId, style: helperStyle, className: "adaptive-select__helper" } as any,
          helperText
        )
      : null,
    error
      ? React.createElement(
          "div",
          {
            id: errorId,
            style: errorStyle,
            className: "adaptive-select__error",
            "aria-live": "polite",
            "aria-atomic": "true",
          } as any,
          error
        )
      : null
  );
}
