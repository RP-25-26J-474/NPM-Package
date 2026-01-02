// src/components/AdaptiveRevert.tsx
import React, { useState, type CSSProperties } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

export interface AdaptiveRevertProps extends AdaptiveComponentProps {
  onRevert?: () => void;
  label?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  showConfirmation?: boolean;
}

/**
 * AdaptiveRevert - Allows users to revert to baseline UI
 * 
 * CRITICAL: This tracks user rejection of personalization!
 * If user clicks this, it's a strong negative signal.
 */
export function AdaptiveRevert(props: AdaptiveRevertProps) {
  const {
    onRevert,
    label = '↶ Reset to Default',
    position = 'bottom-right',
    showConfirmation = true,
    style,
    className,
  } = props;

  const { tokens, source, reload } = useAdaptive();
  const { colors, spacing } = tokens;
  const [showConfirm, setShowConfirm] = useState(false);

  // Only show if we're not already on baseline/fallback
  if (source === 'fallback' || source === 'category') {
    return null;
  }

  const handleClick = () => {
    if (showConfirmation && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    // Track revert behavior
    if (typeof window !== 'undefined' && (window as any).__behaviorTracker) {
      (window as any).__behaviorTracker.trackRevert();
    }

    // Call user's callback
    if (onRevert) {
      onRevert();
    }

    // Reload with baseline
    reload();
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  // Use actual spacing token properties
  const spacingLg = `${spacing.base * 2}px`; // 32px typically
  const spacingSm = `${spacing.base * 0.5}px`; // 8px typically
  const spacingMd = `${spacing.base}px`; // 16px typically
  const spacingXs = `${spacing.base * 0.25}px`; // 4px typically

  const positionStyles: Record<string, CSSProperties> = {
    'bottom-right': { bottom: spacingLg, right: spacingLg },
    'bottom-left': { bottom: spacingLg, left: spacingLg },
    'top-right': { top: spacingLg, right: spacingLg },
    'top-left': { top: spacingLg, left: spacingLg },
  };

  const baseStyle: CSSProperties = {
    position: 'fixed',
    ...positionStyles[position],
    padding: `${spacingSm} ${spacingMd}`,
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'system-ui, sans-serif',
    color: colors.text,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    zIndex: 9999,
    transition: 'all 0.2s ease',
    ...style,
  };

  if (showConfirm) {
    const confirmContainerStyle: CSSProperties = {
      marginBottom: spacingSm,
      fontWeight: 500,
    };

    const buttonContainerStyle: CSSProperties = {
      display: 'flex',
      gap: spacingSm,
    };

    const yesButtonStyle: CSSProperties = {
      padding: `${spacingXs} ${spacingSm}`,
      background: colors.primary,
      color: colors.onPrimary || colors.text,
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
    };

    const cancelButtonStyle: CSSProperties = {
      padding: `${spacingXs} ${spacingSm}`,
      background: 'transparent',
      color: colors.text,
      border: `1px solid ${colors.border}`,
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
    };

    return React.createElement(
      "div",
      { style: baseStyle, className },
      React.createElement("div", { style: confirmContainerStyle }, "Reset to default UI?"),
      React.createElement(
        "div",
        { style: buttonContainerStyle },
        React.createElement("button", { onClick: handleClick, style: yesButtonStyle }, "Yes"),
        React.createElement("button", { onClick: handleCancel, style: cancelButtonStyle }, "Cancel")
      )
    );
  }

  return React.createElement(
    "button",
    {
      onClick: handleClick,
      style: baseStyle,
      className,
      title: "Reset to default UI settings",
    },
    label
  );
}
