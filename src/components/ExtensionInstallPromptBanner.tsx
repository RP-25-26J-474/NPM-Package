import React, { useEffect, useState } from "react";

import type { AuraTokens } from "../types";

type AnyStyle = Record<string, any>;

export interface ExtensionInstallPromptBannerProps {
  tokens: AuraTokens;
  message: string;
  ctaLabel: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  onDismiss: () => void;
  dismissLabel: string;
  containerStyle?: React.CSSProperties;
  messageStyle?: React.CSSProperties;
  ctaStyle?: React.CSSProperties;
  dismissStyle?: React.CSSProperties;
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

function getPrefersDarkMode() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ExtensionInstallPromptBanner({
  tokens,
  message,
  ctaLabel,
  ctaHref,
  onCtaClick,
  onDismiss,
  dismissLabel,
  containerStyle: containerStyleOverride,
  messageStyle: messageStyleOverride,
  ctaStyle: ctaStyleOverride,
  dismissStyle: dismissStyleOverride,
}: ExtensionInstallPromptBannerProps) {
  const [isDarkMode, setIsDarkMode] = useState(getPrefersDarkMode);
  const { typography, spacing, controls, flags } = tokens;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateMode = () => setIsDarkMode(media.matches);
    updateMode();

    if (media.addEventListener) {
      media.addEventListener("change", updateMode);
      return () => media.removeEventListener("change", updateMode);
    }

    media.addListener(updateMode);
    return () => media.removeListener(updateMode);
  }, []);

  const palette = flags.highContrast
    ? {
        panel: tokens.colors.background,
        panelSoft: tokens.colors.surface,
        border: tokens.colors.text,
        borderSoft: tokens.colors.text,
        text: tokens.colors.text,
        muted: tokens.colors.text,
        accent: tokens.colors.text,
        accentSoft: tokens.colors.text,
        ctaBg: tokens.colors.text,
        ctaBorder: tokens.colors.text,
        ctaText: tokens.colors.background,
        dismissBg: "transparent",
        shadow: "none",
      }
    : isDarkMode
    ? {
        panel: "#101418",
        panelSoft: "#171d22",
        border: "#2b333a",
        borderSoft: "#334047",
        text: "#eef3f0",
        muted: "#9aa8a1",
        accent: "#22c55e",
        accentSoft: "#1f3b2b",
        ctaBg: "#bbf7d0",
        ctaBorder: "#86efac",
        ctaText: "#052e16",
        dismissBg: "#171d22",
        shadow: "0 24px 60px rgba(0, 0, 0, 0.38), 0 1px 0 rgba(255, 255, 255, 0.06) inset",
      }
    : {
        panel: "#f8faf9",
        panelSoft: "#ffffff",
        border: "#d9e2dd",
        borderSoft: "#e7eee9",
        text: "#1f2933",
        muted: "#637068",
        accent: "#16a34a",
        accentSoft: "#dcfce7",
        ctaBg: "#bbf7d0",
        ctaBorder: "#86efac",
        ctaText: "#14532d",
        dismissBg: "#ffffff",
        shadow: "0 24px 56px rgba(15, 23, 42, 0.18), 0 1px 0 rgba(255, 255, 255, 0.86) inset",
      };

  const containerStyle: AnyStyle = {
    position: "fixed",
    top: Math.max(16, Math.round(spacing.gapY * 1.4)),
    right: Math.max(16, Math.round(spacing.gapX * 1.4)),
    width: "min(440px, calc(100vw - 32px))",
    maxWidth: "calc(100vw - 32px)",
    boxSizing: "border-box",
    display: "grid",
    gap: Math.max(12, spacing.gapX),
    padding:
      Math.max(16, spacing.padY).toString() +
      "px " +
      Math.max(18, spacing.padX).toString() +
      "px",
    borderRadius: 14,
    borderWidth: flags.highContrast ? 2 : 1,
    borderStyle: "solid",
    borderColor: palette.border,
    background:
      flags.highContrast
        ? palette.panel
        : `linear-gradient(135deg, ${palette.panelSoft} 0%, ${palette.panel} 100%)`,
    color: palette.text,
    boxShadow: palette.shadow,
    zIndex: 2147483000,
  };
  mergeStyle(containerStyle, containerStyleOverride);

  const headerStyle: AnyStyle = {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: Math.max(10, Math.round(spacing.gapX * 0.9)),
    alignItems: "start",
  };

  const markStyle: AnyStyle = {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: flags.highContrast ? "transparent" : palette.accentSoft,
    border: `1px solid ${palette.borderSoft}`,
    color: palette.accent,
    flex: "0 0 auto",
  };

  const titleStyle: AnyStyle = {
    margin: 0,
    fontSize: Math.max(14, Math.round(typography.basePx * 0.95)),
    lineHeight: 1.25,
    fontWeight: 700,
    color: palette.text,
  };

  const messageStyle: AnyStyle = {
    marginTop: 4,
    fontSize: typography.body,
    lineHeight: typography.lineHeight,
    fontWeight: 500,
    maxWidth: "100%",
    color: palette.muted,
  };
  mergeStyle(messageStyle, messageStyleOverride);

  const actionsStyle: AnyStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: Math.max(8, Math.round(spacing.gapX * 0.8)),
    width: "100%",
  };

  const buttonBaseStyle: AnyStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    padding:
      Math.max(8, Math.round(spacing.padY * 0.6)).toString() +
      "px " +
      Math.max(12, Math.round(spacing.padX * 0.9)).toString() +
      "px",
    minHeight: Math.max(34, Math.round(controls.minTargetSize * 0.72)),
    textDecoration: "none",
    fontSize: typography.body,
    lineHeight: typography.lineHeight,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const ctaStyle: AnyStyle = {
    ...buttonBaseStyle,
    gap: Math.max(6, Math.round(spacing.gapX * 0.5)),
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: palette.ctaBorder,
    backgroundColor: palette.ctaBg,
    color: palette.ctaText,
    fontWeight: 700,
    boxShadow: flags.highContrast ? "none" : "0 10px 22px rgba(34, 197, 94, 0.22)",
  };
  mergeStyle(ctaStyle, ctaStyleOverride);

  const dismissStyle: AnyStyle = {
    ...buttonBaseStyle,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: palette.borderSoft,
    backgroundColor: palette.dismissBg,
    color: palette.text,
    fontWeight: 600,
  };
  mergeStyle(dismissStyle, dismissStyleOverride);

  const iconEl = React.createElement(
    "svg",
    {
      width: 18,
      height: 18,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true,
    },
    React.createElement("path", { d: "M12 3v12" }),
    React.createElement("path", { d: "m7 10 5 5 5-5" }),
    React.createElement("path", { d: "M5 21h14" })
  );

  const messageEl = React.createElement(
    "div",
    { style: headerStyle },
    React.createElement("div", { style: markStyle }, iconEl),
    React.createElement(
      "div",
      null,
      React.createElement("p", { style: titleStyle }, "AURA Extension"),
      React.createElement("div", { style: messageStyle }, message)
    )
  );

  let ctaEl: React.ReactNode = null;
  if (ctaHref || onCtaClick) {
    const handleCtaClick = () => {
      if (onCtaClick) onCtaClick();
    };

    ctaEl = ctaHref
      ? React.createElement(
          "a",
          {
            href: ctaHref,
            target: "_blank",
            rel: "noopener noreferrer",
            style: ctaStyle,
            onClick: handleCtaClick,
          },
          ctaLabel
        )
      : React.createElement(
          "button",
          {
            type: "button",
            style: ctaStyle,
            onClick: handleCtaClick,
          },
          ctaLabel
        );
  }

  const dismissEl = React.createElement(
    "button",
    {
      type: "button",
      style: dismissStyle,
      onClick: onDismiss,
      "aria-label": dismissLabel,
    },
    dismissLabel
  );

  const actionsEl = React.createElement(
    "div",
    { style: actionsStyle },
    ctaEl,
    dismissEl
  );

  return React.createElement(
    "div",
    { role: "status", "aria-live": "polite", style: containerStyle },
    messageEl,
    actionsEl
  );
}
