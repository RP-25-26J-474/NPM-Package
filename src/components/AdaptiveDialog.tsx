// src/components/AdaptiveDialog.tsx
import React, { useEffect, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";
import { AdaptiveButton } from "./AdaptiveButton";

export interface AdaptiveDialogProps extends AdaptiveComponentProps {
  open: boolean;
  onClose: () => void;

  title?: string;
  description?: string;

  children?: React.ReactNode;
  actions?: React.ReactNode;

  maxWidthPx?: number;

  textScale?: number;
  buttonMinHeightPx?: number;
  gapPx?: number;

  showCloseIcon?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;

  portalTo?: HTMLElement | null;
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[role="button"]',
  ].join(",");
  return Array.from(root.querySelectorAll<HTMLElement>(selectors)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true"
  );
}

export function AdaptiveDialog({
  open,
  onClose,
  title = "Dialog",
  description,
  children,
  actions,
  maxWidthPx,
  textScale = 1,
  buttonMinHeightPx,
  gapPx,
  showCloseIcon = true,
  closeOnBackdrop = true,
  closeOnEsc = true,
  portalTo,
  className,
  style,
}: AdaptiveDialogProps) {
  const { tokens } = useAdaptive();
  const { colors, typography, spacing, controls, flags } = tokens;

  const dialogId = useId();
  const titleId = `aura-dialog-title-${dialogId}`;
  const descId = `aura-dialog-desc-${dialogId}`;

  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  // ✅ keep latest onClose without re-running effects
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const GAP = Math.max(gapPx ?? spacing.gapY * 2, 12);
  const btnMinH = Math.max(buttonMinHeightPx ?? controls.minTargetSize, 44);
  const maxW = Math.max(320, maxWidthPx ?? 640);

  // ✅ Focus trap: run ONLY when dialog opens/closes
  useEffect(() => {
    if (!open) return;

    lastFocusRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    if (panel) {
      const focusables = getFocusable(panel);
      (focusables[0] ?? panel).focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key !== "Tab") return;

      const panelEl = panelRef.current;
      if (!panelEl) return;

      const focusables = getFocusable(panelEl);
      if (!focusables.length) {
        e.preventDefault();
        panelEl.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !panelEl.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      lastFocusRef.current?.focus?.();
    };
  }, [open, closeOnEsc]);

  if (!open) return null;

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 11000,
    background: flags.highContrast ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: Math.max(spacing.pagePaddingX, 16),
  };

  const panelStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: maxW,
    borderRadius: 18,
    border: flags.highContrast ? `2px solid ${colors.text}` : `1px solid ${colors.border}`,
    background: colors.surface,
    color: colors.text,
    boxShadow: flags.highContrast ? "none" : "0 24px 80px rgba(0,0,0,0.25)",
    padding: Math.max(spacing.pagePaddingX, 16),
    display: "grid",
    gap: GAP,
    outline: "none",
    transition: flags.reducedMotion ? "none" : "transform 160ms ease",
    ...style,
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.gapX,
  };

  const closeBtnStyle: React.CSSProperties = {
    height: btnMinH,
    minWidth: btnMinH,
    borderRadius: 999,
    border: flags.highContrast ? `2px solid ${colors.text}` : `1px solid ${colors.border}`,
    background: colors.background,
    color: colors.text,
    cursor: "pointer",
    fontWeight: 900,
    lineHeight: 1,
  };

  const bodyTextStyle: React.CSSProperties = {
    fontSize: `${Math.max(12, Math.round(typography.basePx * textScale))}px`,
    lineHeight: typography.lineHeight,
  };

  const actionsWrapStyle: React.CSSProperties = {
    display: "flex",
    gap: spacing.gapX,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  };

  const content = (
    <div
      style={overlayStyle}
      onMouseDown={(e) => {
        if (!closeOnBackdrop) return;
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={panelRef}
        className={className}
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <div style={headerStyle}>
          <div style={{ minWidth: 0 }}>
            {/* Use native element for id support */}
            <h3
              id={titleId}
              style={{
                fontSize: `${Math.max(
                  16,
                  Math.round(typography.basePx * 1.25 * textScale)
                )}px`,
                lineHeight: typography.lineHeight,
                fontWeight: 900,
                margin: 0,
                color: colors.text,
                wordBreak: "break-word",
              }}
            >
              {title}
            </h3>

            {description ? (
              <div
                id={descId}
                style={{ ...bodyTextStyle, opacity: 0.9, marginTop: 6 }}
              >
                {description}
              </div>
            ) : null}
          </div>

          {showCloseIcon ? (
            <button
              type="button"
              onClick={() => onCloseRef.current()}
              aria-label="Close dialog"
              style={closeBtnStyle}
            >
              ✕
            </button>
          ) : null}
        </div>

        <div style={bodyTextStyle}>{children}</div>

        {actions ? (
          <div style={actionsWrapStyle}>{actions}</div>
        ) : (
          <div style={actionsWrapStyle}>
            <AdaptiveButton onClick={() => onCloseRef.current()} style={{ minHeight: btnMinH }}>
              Close
            </AdaptiveButton>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, portalTo ?? document.body);
}
