import React, { useEffect, useMemo } from "react";
import { useAdaptive } from "../AdaptiveProvider";
import type { AdaptiveComponentProps } from "../types";

export type AdaptiveDrawerItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

export interface AdaptiveDrawerProps extends AdaptiveComponentProps {
  /** Controlled open state */
  open: boolean;

  /** Close handler (required for clear close) */
  onClose: () => void;

  /** Drawer title */
  title?: string;

  /** Optional items list (simple nav list) */
  items?: AdaptiveDrawerItem[];

  /** Called when an item is clicked */
  onItemClick?: (id: string) => void;

  /** Optional custom content (below title) */
  children?: React.ReactNode;

  /** Adaptable features */
  widthPx?: number;
  itemGapPx?: number;
  closeButtonSizePx?: number;

  /** If true, clicking backdrop closes drawer (default true) */
  closeOnBackdrop?: boolean;
}

/**
 * AdaptiveDrawer (left)
 * Adaptable features:
 * - Width (defaults adaptively)
 * - Item spacing
 * - Close button size (clear close)
 *
 * Rules:
 * - Provide clear close button: always top-right inside drawer + big target size
 */
export function AdaptiveDrawer({
  open,
  onClose,
  title = "Menu",
  items,
  onItemClick,
  children,
  widthPx,
  itemGapPx,
  closeButtonSizePx,
  closeOnBackdrop = true,
  className,
  style,
}: AdaptiveDrawerProps) {
  const { tokens } = useAdaptive();
  const { colors, spacing, typography, controls, flags } = tokens;

  const computedWidth = useMemo(() => {
    // Simple adaptive widths: larger when layoutSimplification is on
    const base = widthPx ?? (flags.layoutSimplification ? 360 : 320);
    return Math.max(260, base);
  }, [widthPx, flags.layoutSimplification]);

  const computedItemGap = Math.max(itemGapPx ?? spacing.gapY, 6);

  const closeSize = useMemo(() => {
    const base = closeButtonSizePx ?? controls.minTargetSize;
    return Math.max(base, 36);
  }, [closeButtonSizePx, controls.minTargetSize]);

  // Escape closes drawer
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when drawer open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: flags.highContrast ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.4)",
    zIndex: 10000,
  };

  const drawerStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    height: "100vh",
    width: computedWidth,
    background: colors.surface,
    color: colors.text,
    borderRight: flags.highContrast ? `2px solid ${colors.text}` : `1px solid ${colors.border}`,
    boxShadow: flags.highContrast ? "none" : "20px 0 60px rgba(0,0,0,0.25)",
    padding: spacing.pagePaddingX,
    zIndex: 10001,
    transform: "translateX(0)",
    transition: flags.reducedMotion ? "none" : "transform 180ms ease",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: spacing.gapY * 2,
    ...style,
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.gapX,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: typography.h3,
    lineHeight: typography.lineHeight,
    fontWeight: 800,
    margin: 0,
  };

  const closeBtnStyle: React.CSSProperties = {
    height: closeSize,
    minWidth: closeSize,
    borderRadius: 999,
    border: flags.highContrast ? `2px solid ${colors.text}` : `1px solid ${colors.border}`,
    background: colors.background,
    color: colors.text,
    cursor: "pointer",
    fontSize: `${Math.max(14, Math.round(typography.basePx * 0.95))}px`,
    fontWeight: 900,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const itemBtnStyle: React.CSSProperties = {
    height: Math.max(40, controls.minTargetSize),
    width: "100%",
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    background: colors.background,
    color: colors.text,
    paddingLeft: spacing.padX,
    paddingRight: spacing.padX,
    display: "flex",
    alignItems: "center",
    gap: spacing.gapX,
    fontSize: typography.baseSize,
    lineHeight: typography.lineHeight,
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={overlayStyle}
        onClick={() => {
          if (closeOnBackdrop) onClose();
        }}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={className}
        style={drawerStyle}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div style={headerStyle}>
          <h2 style={titleStyle}>{title}</h2>

          {/* Clear close button */}
          <button type="button" onClick={onClose} aria-label="Close drawer" style={closeBtnStyle}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ display: "grid", gap: spacing.gapY * 2, overflow: "auto" }}>
          {children ? <div>{children}</div> : null}

          {items?.length ? (
            <nav aria-label="Drawer navigation">
              <div style={{ display: "grid", gap: computedItemGap }}>
                {items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    disabled={it.disabled}
                    onClick={() => {
                      if (it.disabled) return;
                      onItemClick?.(it.id);
                    }}
                    style={{
                      ...itemBtnStyle,
                      opacity: it.disabled ? 0.55 : 1,
                      cursor: it.disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {it.icon ? <span aria-hidden="true">{it.icon}</span> : null}
                    <span>{it.label}</span>
                  </button>
                ))}
              </div>
            </nav>
          ) : null}
        </div>
      </aside>
    </>
  );
}
