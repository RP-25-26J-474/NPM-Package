// src/components/AdaptiveInput.tsx
import React, { useId, useState, type InputHTMLAttributes } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

type AnyStyle = Record<string, any>;

export type AdaptiveInputLabelMode = "visible" | "placeholder" | "hidden";

export interface AdaptiveInputProps
  extends AdaptiveComponentProps,
    InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  labelMode?: AdaptiveInputLabelMode;
  labelFontSize?: string;
  labelGap?: number;

  inputHeight?: number;

  helperText?: string;
  error?: string;
  showError?: boolean;

  fullWidth?: boolean;
  inputClassName?: string;
  inputStyle?: React.CSSProperties;
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

export function AdaptiveInput(props: AdaptiveInputProps) {
  const { tokens } = useAdaptive();
  const { colors, typography, spacing, controls, flags } = tokens;

  const autoId = useId();
  const [focused, setFocused] = useState(false);

  const label = props.label;
  const labelMode: AdaptiveInputLabelMode =
    props.labelMode === undefined
      ? flags.layoutSimplification
        ? "placeholder"
        : "visible"
      : props.labelMode;

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

  const baseHeight = Math.max(
    controls.minTargetSize,
    Math.round(typography.basePx * 2.2),
    spacing.padY * 2 + typography.basePx
  );

  const inputHeight = props.inputHeight;

  const disabled = props.disabled === true;
  const readOnly = props.readOnly === true;

  const classNameProp = props.className === undefined ? "" : props.className;
  const inputClassNameProp =
    props.inputClassName === undefined ? "" : props.inputClassName;

  const typeProp = props.type === undefined ? "text" : props.type;

  const inputId = props.id === undefined ? "adaptive-input-" + autoId : props.id;
  const labelId = label ? inputId + "-label" : undefined;
  const helperId = helperText ? inputId + "-help" : undefined;
  const errorId = error ? inputId + "-error" : undefined;

  const ariaLabelProp = (props as any)["aria-label"];
  const ariaDescribedByProp = (props as any)["aria-describedby"];

  const describedByParts = [];
  if (ariaDescribedByProp) describedByParts.push(ariaDescribedByProp);
  if (helperId) describedByParts.push(helperId);
  if (errorId) describedByParts.push(errorId);

  const describedBy =
    describedByParts.length > 0 ? describedByParts.join(" ") : undefined;

  const placeholderProp = props.placeholder;
  const hasLabel = typeof label === "string" && label.length > 0;

  let placeholderValue = placeholderProp;
  if (labelMode === "placeholder" && hasLabel) {
    placeholderValue = placeholderProp === undefined ? label : placeholderProp;
  }

  const showLabel = hasLabel && labelMode === "visible";
  const showHiddenLabel = hasLabel && labelMode !== "visible";

  const borderColor = error ? colors.accent : colors.border;
  const focusColor = error ? colors.accent : colors.primary;

  const inputStyle: AnyStyle = {
    width: fullWidth ? "100%" : undefined,
    padding: Math.max(6, spacing.padY).toString() + "px " + Math.max(10, spacing.padX).toString() + "px",
    borderRadius: 10,
    border: "1px solid " + borderColor,
    backgroundColor: disabled ? colors.surface : colors.background,
    color: colors.text,
    fontSize: typography.body,
    lineHeight: typography.lineHeight,
    boxSizing: "border-box",
    appearance: "none",
    outline: "none",
    transition: flags.reducedMotion
      ? "none"
      : "border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
    opacity: disabled ? 0.7 : 1,
  };

  if (inputHeight !== undefined) {
    inputStyle.height = inputHeight;
  } else {
    inputStyle.minHeight = baseHeight;
  }

  if (focused && !disabled) {
    inputStyle.borderColor = focusColor;
    inputStyle.boxShadow = "0 0 0 3px " + focusColor;
  }

  if (readOnly) {
    inputStyle.backgroundColor = colors.surface;
  }

  mergeStyle(inputStyle, props.inputStyle);

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

  const inputProps: InputHTMLAttributes<HTMLInputElement> = {};
  inputProps.id = inputId;
  inputProps.type = typeProp;
  inputProps.className = "adaptive-input__field " + inputClassNameProp;
  inputProps.style = inputStyle as any;

  if (props.name !== undefined) inputProps.name = props.name;
  if (props.value !== undefined) inputProps.value = props.value;
  if (props.defaultValue !== undefined) inputProps.defaultValue = props.defaultValue;
  if (placeholderValue !== undefined) inputProps.placeholder = placeholderValue;
  if (props.autoComplete !== undefined) inputProps.autoComplete = props.autoComplete;
  if (props.autoFocus !== undefined) inputProps.autoFocus = props.autoFocus;
  if (props.disabled !== undefined) inputProps.disabled = props.disabled;
  if (props.readOnly !== undefined) inputProps.readOnly = props.readOnly;
  if (props.required !== undefined) inputProps.required = props.required;
  if (props.min !== undefined) inputProps.min = props.min;
  if (props.max !== undefined) inputProps.max = props.max;
  if (props.step !== undefined) inputProps.step = props.step;
  if (props.pattern !== undefined) inputProps.pattern = props.pattern;
  if (props.inputMode !== undefined) inputProps.inputMode = props.inputMode;
  if (props.maxLength !== undefined) inputProps.maxLength = props.maxLength;
  if (props.minLength !== undefined) inputProps.minLength = props.minLength;
  if (props.size !== undefined) inputProps.size = props.size;
  if (props.multiple !== undefined) inputProps.multiple = props.multiple;
  if (props.onChange !== undefined) inputProps.onChange = props.onChange;
  if (props.onInput !== undefined) inputProps.onInput = props.onInput;
  if (props.onKeyDown !== undefined) inputProps.onKeyDown = props.onKeyDown;
  if (props.onKeyUp !== undefined) inputProps.onKeyUp = props.onKeyUp;
  if (props.onKeyPress !== undefined) inputProps.onKeyPress = props.onKeyPress;
  if (props.onPaste !== undefined) inputProps.onPaste = props.onPaste;
  if (props.onWheel !== undefined) inputProps.onWheel = props.onWheel;
  if (props.onClick !== undefined) inputProps.onClick = props.onClick;
  if (props.onMouseEnter !== undefined) inputProps.onMouseEnter = props.onMouseEnter;
  if (props.onMouseLeave !== undefined) inputProps.onMouseLeave = props.onMouseLeave;

  inputProps.onFocus = (event) => {
    setFocused(true);
    if (props.onFocus) props.onFocus(event);
  };

  inputProps.onBlur = (event) => {
    setFocused(false);
    if (props.onBlur) props.onBlur(event);
  };

  if (ariaLabelProp !== undefined) {
    (inputProps as any)["aria-label"] = ariaLabelProp;
  } else if (!hasLabel && placeholderValue) {
    (inputProps as any)["aria-label"] = placeholderValue;
  }

  if (describedBy) {
    (inputProps as any)["aria-describedby"] = describedBy;
  }

  if (error) {
    (inputProps as any)["aria-invalid"] = true;
  }

  return React.createElement(
    "div",
    { style: wrapperStyle, className: "adaptive-input " + classNameProp } as any,
    showLabel || showHiddenLabel
      ? React.createElement(
          "label",
          {
            htmlFor: inputId,
            id: labelId,
            style: labelStyle,
            className: "adaptive-input__label",
          } as any,
          label
        )
      : null,
    React.createElement("input", inputProps as any),
    helperText
      ? React.createElement(
          "div",
          { id: helperId, style: helperStyle, className: "adaptive-input__helper" } as any,
          helperText
        )
      : null,
    error
      ? React.createElement(
          "div",
          {
            id: errorId,
            style: errorStyle,
            className: "adaptive-input__error",
            "aria-live": "polite",
            "aria-atomic": "true",
          } as any,
          error
        )
      : null
  );
}
