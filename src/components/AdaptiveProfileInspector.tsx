import React, { useEffect, useRef, useState } from "react";

import { useAdaptive } from "../AdaptiveProvider";
import { loadInspectorStateFromExtension } from "../extensionBridge";
import { buildAuraInspectorSnapshot } from "../profileInspector";

import type {
  AuraInspectorExtensionState,
  AuraInspectorRuntimeState,
  AuraProfileV2,
} from "../types";

type AdaptiveProfileInspectorProps = {
  initiallyOpen?: boolean;
};

type Point = {
  x: number;
  y: number;
};

const EDGE_GAP = 12;
const BUTTON_SIZE = 56;
const PANEL_GAP = 12;
const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 540;

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function getViewport() {
  if (typeof window === "undefined") {
    return { width: 1280, height: 720 };
  }

  return { width: window.innerWidth, height: window.innerHeight };
}

function getDefaultButtonPosition(): Point {
  const viewport = getViewport();
  return {
    x: Math.max(EDGE_GAP, viewport.width - BUTTON_SIZE - 20),
    y: Math.max(EDGE_GAP, viewport.height - BUTTON_SIZE - 28),
  };
}

function clampButtonPosition(point: Point, viewport = getViewport()): Point {
  return {
    x: clamp(point.x, EDGE_GAP, viewport.width - BUTTON_SIZE - EDGE_GAP),
    y: clamp(point.y, EDGE_GAP, viewport.height - BUTTON_SIZE - EDGE_GAP),
  };
}

function createEmptyExtensionState(
  fallbackUserId?: string
): AuraInspectorExtensionState {
  return {
    status: {
      extensionPresent: false,
      loggedIn: false,
      userId: fallbackUserId ?? null,
    },
    personalized: null,
    adaptive: null,
    final: null,
    normalizedFinalEnvelope: null,
  };
}

function formatPrimitive(value: unknown): string {
  if (value === null || value === undefined) return "Not available";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NaN";
  if (typeof value === "string") return value || "Empty";
  return JSON.stringify(value);
}

function inferFallbackReason(input: {
  source: AuraInspectorRuntimeState["source"];
  isExtensionInstalled: boolean;
  isExtensionLoggedIn?: boolean;
}): string | null {
  if (input.source !== "fallback" && input.isExtensionInstalled) return null;
  if (!input.isExtensionInstalled) {
    return "Extension is unavailable. This standalone inspector is reading the current fallback-applied runtime state without altering AdaptiveProvider.";
  }
  if (input.isExtensionLoggedIn === false) {
    return "Extension is installed but the user is not logged in. AdaptiveProvider is using its fallback path.";
  }
  return "AdaptiveProvider is in fallback mode. Because this inspector is separate from the provider, the fallback-created profile is approximated from the current applied profile.";
}

function StatusChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "good" | "warn";
}) {
  const palette =
    tone === "good"
      ? {
          background: "#dcfce7",
          color: "#166534",
          borderColor: "#86efac",
        }
      : tone === "warn"
      ? {
          background: "#fef3c7",
          color: "#92400e",
          borderColor: "#fcd34d",
        }
      : {
          background: "#e5e7eb",
          color: "#1f2937",
          borderColor: "#d1d5db",
        };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 24,
        padding: "0 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.02em",
        border: `1px solid ${palette.borderColor}`,
        background: palette.background,
        color: palette.color,
      }}
    >
      {label}
    </span>
  );
}

function ValueBox({ value }: { value: unknown }) {
  const text = formatPrimitive(value);
  const tone =
    typeof value === "boolean"
      ? value
        ? "good"
        : "warn"
      : value === null || value === undefined
      ? "warn"
      : "neutral";

  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        background: "#f8fafc",
        border: "1px solid #dbe4ea",
        color: "#0f172a",
        fontSize: 13,
        lineHeight: 1.45,
        wordBreak: "break-word",
      }}
    >
      {typeof value === "boolean" ? <StatusChip label={text} tone={tone} /> : text}
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 140px) minmax(0, 1fr)",
        gap: 10,
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "#334155",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <div>{value}</div>
    </div>
  );
}

function SummaryList({
  rows,
}: {
  rows: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((row) => (
        <SummaryRow key={row.label} label={row.label} value={row.value} />
      ))}
    </div>
  );
}

function ProfileSummary({
  profile,
}: {
  profile: AuraProfileV2 | null;
}) {
  if (!profile) {
    return <ValueBox value={"Not available"} />;
  }

  return (
    <SummaryList
      rows={[
        {
          label: "Theme",
          value: <ValueBox value={profile.theme} />,
        },
        {
          label: "Contrast",
          value: <ValueBox value={profile.contrast_mode} />,
        },
        {
          label: "Typography",
          value: (
            <ValueBox
              value={`Font ${profile.font_size}px, line height ${profile.line_height}`}
            />
          ),
        },
        {
          label: "Spacing",
          value: (
            <ValueBox
              value={`Gap ${profile.element_spacing_x}px × ${profile.element_spacing_y}px, padding ${profile.element_padding_x}px × ${profile.element_padding_y}px`}
            />
          ),
        },
        {
          label: "Controls",
          value: <ValueBox value={`Target size ${profile.target_size}px`} />,
        },
        {
          label: "Flags",
          value: (
            <ValueBox
              value={`Reduced motion: ${profile.reduced_motion ? "on" : "off"}, tooltip assist: ${profile.tooltip_assist ? "on" : "off"}, simplified layout: ${profile.layout_simplification ? "on" : "off"}`}
            />
          ),
        },
      ]}
    />
  );
}

function Section({
  id,
  title,
  summary,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  summary?: React.ReactNode;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #cbd5e1",
        borderRadius: 16,
        background: "#ffffff",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 16px",
          border: "none",
          background: "#f8fafc",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            {title}
          </span>
          {summary ? <span style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{summary}</span> : null}
        </div>
        <span
          aria-hidden="true"
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#0f766e",
            lineHeight: 1,
          }}
        >
          {expanded ? "−" : "+"}
        </span>
      </button>
      {expanded ? <div style={{ padding: 16 }}>{children}</div> : null}
    </section>
  );
}

function AuraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M14 4.5L20.5 22.5H17.6L16.2 18.4H11.8L10.4 22.5H7.5L14 4.5Z"
        fill="#ffffff"
      />
      <path
        d="M12.55 15.8H15.45L14 11.3L12.55 15.8Z"
        fill="#16a34a"
      />
      <circle cx="21.2" cy="8.3" r="2.2" fill="#dcfce7" />
    </svg>
  );
}

export function AdaptiveProfileInspector({
  initiallyOpen = false,
}: AdaptiveProfileInspectorProps) {
  const adaptive = useAdaptive();
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [buttonPosition, setButtonPosition] = useState<Point>(() =>
    getDefaultButtonPosition()
  );
  const [viewport, setViewport] = useState(() => getViewport());
  const [extensionState, setExtensionState] = useState<AuraInspectorExtensionState>(
    () => createEmptyExtensionState(adaptive.userId)
  );
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    user: true,
    extension: true,
    storage: false,
    applied: true,
    differences: false,
    fallback: true,
    notes: true,
  });

  const dragRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });

  const runtime: AuraInspectorRuntimeState = {
    requestedUserId: adaptive.userId,
    resolvedUserId: adaptive.userId,
    source: adaptive.source,
    loading: adaptive.loading,
    error: adaptive.error,
    isExtensionInstalled: adaptive.isExtensionInstalled,
    isExtensionLoggedIn: adaptive.isExtensionLoggedIn,
    simulateExtensionInstalled: false,
    appliedProfile: adaptive.profile,
    appliedAt: null,
    fallbackCreatedProfile:
      adaptive.source === "fallback" || adaptive.isExtensionInstalled === false
        ? adaptive.profile
        : null,
    fallbackReason: inferFallbackReason({
      source: adaptive.source,
      isExtensionInstalled: adaptive.isExtensionInstalled,
      isExtensionLoggedIn: adaptive.isExtensionLoggedIn,
    }),
  };

  const refreshExtensionState = async () => {
    setIsRefreshing(true);

    try {
      const nextState = await loadInspectorStateFromExtension(adaptive.userId);
      setExtensionState(nextState);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setViewport(getViewport());

    function handleResize() {
      const nextViewport = getViewport();
      setViewport(nextViewport);
      setButtonPosition((current) => clampButtonPosition(current, nextViewport));
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setExtensionState((current) => ({
      ...current,
      status: {
        ...current.status,
        userId: adaptive.userId ?? null,
      },
    }));
  }, [adaptive.userId]);

  useEffect(() => {
    if (!isOpen) return;

    void refreshExtensionState();

    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      if (!event.data || event.data.source !== "aura-extension") return;
      if (
        event.data.type !== "AURA_EXT_PROFILE_CHANGED" &&
        event.data.type !== "AURA_USER_UPDATE"
      ) {
        return;
      }

      void refreshExtensionState();
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isOpen, adaptive.userId]);

  const snapshot = buildAuraInspectorSnapshot(extensionState, runtime);
  const finalProfile = snapshot.extension.normalizedFinalEnvelope?.profile.profile ?? null;

  const panelWidth = Math.min(PANEL_WIDTH, viewport.width - EDGE_GAP * 2);
  const preferredLeft = buttonPosition.x + BUTTON_SIZE - panelWidth;
  const panelLeft = clamp(
    preferredLeft,
    EDGE_GAP,
    viewport.width - panelWidth - EDGE_GAP
  );
  const preferredTop = buttonPosition.y - PANEL_HEIGHT - PANEL_GAP;
  const fallbackTop = buttonPosition.y + BUTTON_SIZE + PANEL_GAP;
  const panelTop =
    preferredTop >= EDGE_GAP
      ? preferredTop
      : clamp(fallbackTop, EDGE_GAP, viewport.height - 240);
  const panelMaxHeight = Math.max(240, viewport.height - panelTop - EDGE_GAP);

  const toggleSection = (id: string) => {
    setExpandedSections((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  return (
    <>
      {isOpen ? (
        <div
          style={{
            position: "fixed",
            top: panelTop,
            left: panelLeft,
            width: panelWidth,
            maxWidth: `calc(100vw - ${EDGE_GAP * 2}px)`,
            maxHeight: panelMaxHeight,
            overflow: "auto",
            zIndex: 2147483001,
            borderRadius: 22,
            border: "1px solid #86efac",
            background:
              "linear-gradient(180deg, rgba(240,253,244,0.98) 0%, rgba(255,255,255,0.98) 35%)",
            boxShadow: "0 30px 70px rgba(15, 23, 42, 0.22)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              padding: "16px 18px 14px",
              borderBottom: "1px solid #d1fae5",
              background:
                "linear-gradient(180deg, rgba(240,253,244,0.99) 0%, rgba(248,250,252,0.96) 100%)",
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  color: "#14532d",
                  letterSpacing: "0.02em",
                }}
              >
                AURA Profile Inspector
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <StatusChip
                  label={
                    snapshot.extension.status.extensionPresent
                      ? "Extension available"
                      : "Extension unavailable"
                  }
                  tone={snapshot.extension.status.extensionPresent ? "good" : "warn"}
                />
                <StatusChip
                  label={snapshot.user.source === "fallback" ? "Fallback mode" : "Runtime active"}
                  tone={snapshot.user.source === "fallback" ? "warn" : "neutral"}
                />
                {isRefreshing ? <StatusChip label="Refreshing" tone="warn" /> : null}
              </div>
            </div>
            <button
              type="button"
              aria-label="Close AURA profile inspector"
              onClick={() => setIsOpen(false)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                border: "1px solid #86efac",
                background: "#ffffff",
                color: "#166534",
                fontSize: 18,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: "grid", gap: 12, padding: 16 }}>
            <Section
              id="status"
              title="Runtime Status"
              expanded={expandedSections.status !== false}
              onToggle={toggleSection}
              summary={
                <>
                  <StatusChip
                    label={
                      snapshot.comparison.hasDifference ? "Does not match" : "Matches"
                    }
                    tone={snapshot.comparison.hasDifference ? "warn" : "good"}
                  />
                  <StatusChip
                    label={`Source: ${snapshot.user.source}`}
                    tone={snapshot.user.source === "fallback" ? "warn" : "good"}
                  />
                </>
              }
            >
              <SummaryList
                rows={[
                  {
                    label: "Extension",
                    value: (
                      <StatusChip
                        label={
                          snapshot.extension.status.extensionPresent
                            ? "Installed"
                            : "Not installed"
                        }
                        tone={
                          snapshot.extension.status.extensionPresent ? "good" : "warn"
                        }
                      />
                    ),
                  },
                  {
                    label: "Login",
                    value: (
                      <StatusChip
                        label={
                          snapshot.extension.status.loggedIn
                            ? "Logged in"
                            : "Not logged in"
                        }
                        tone={snapshot.extension.status.loggedIn ? "good" : "warn"}
                      />
                    ),
                  },
                  {
                    label: "Active Source",
                    value: <ValueBox value={snapshot.user.source} />,
                  },
                  {
                    label: "Profile Diff",
                    value: (
                      <StatusChip
                        label={
                          snapshot.comparison.hasDifference
                            ? "Does not match"
                            : "Matches"
                        }
                        tone={snapshot.comparison.hasDifference ? "warn" : "good"}
                      />
                    ),
                  },
                ]}
              />
            </Section>

            <Section
              id="final"
              title="Final Selected Profile"
              expanded={expandedSections.final !== false}
              onToggle={toggleSection}
              summary={
                <StatusChip
                  label={finalProfile ? "Available" : "Not available"}
                  tone={finalProfile ? "good" : "warn"}
                />
              }
            >
              <ProfileSummary profile={finalProfile} />
            </Section>

            <Section
              id="applied"
              title="AdaptiveProvider Applied Profile"
              expanded={expandedSections.applied !== false}
              onToggle={toggleSection}
              summary={
                <StatusChip
                  label={snapshot.runtime.appliedProfile ? "Applied" : "Not applied"}
                  tone={snapshot.runtime.appliedProfile ? "good" : "warn"}
                />
              }
            >
              <ProfileSummary profile={snapshot.runtime.appliedProfile} />
            </Section>

            <Section
              id="diff"
              title="Diff Status"
              expanded={expandedSections.diff !== false}
              onToggle={toggleSection}
              summary={
                <StatusChip
                  label={snapshot.comparison.hasDifference ? "Does not match" : "Matches"}
                  tone={snapshot.comparison.hasDifference ? "warn" : "good"}
                />
              }
            >
              <ValueBox
                value={
                  snapshot.comparison.hasDifference
                    ? "Applied profile does not match the final selected profile."
                    : "Applied profile matches the final selected profile."
                }
              />
            </Section>

            {snapshot.fallback.active ? (
              <Section
                id="fallback"
                title="Fallback Mode"
                expanded={expandedSections.fallback !== false}
                onToggle={toggleSection}
                summary={
                  <StatusChip label="Fallback active" tone="warn" />
                }
              >
                <SummaryList
                  rows={[
                    {
                      label: "Reason",
                      value: <ValueBox value={snapshot.fallback.reason || null} />,
                    },
                  ]}
                />
              </Section>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Open AURA profile inspector"
        onPointerDown={(event) => {
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: buttonPosition.x,
            originY: buttonPosition.y,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragRef.current.pointerId !== event.pointerId) return;

          const deltaX = event.clientX - dragRef.current.startX;
          const deltaY = event.clientY - dragRef.current.startY;
          if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
            dragRef.current.moved = true;
          }

          if (!dragRef.current.moved) return;

          setButtonPosition(
            clampButtonPosition(
              {
                x: dragRef.current.originX + deltaX,
                y: dragRef.current.originY + deltaY,
              },
              viewport
            )
          );
        }}
        onPointerUp={(event) => {
          if (dragRef.current.pointerId !== event.pointerId) return;
          event.currentTarget.releasePointerCapture(event.pointerId);
          dragRef.current.pointerId = null;
        }}
        onPointerCancel={() => {
          dragRef.current.pointerId = null;
        }}
        onClick={() => {
          if (dragRef.current.moved) {
            dragRef.current.moved = false;
            return;
          }
          setIsOpen((current) => !current);
        }}
        style={{
          position: "fixed",
          left: buttonPosition.x,
          top: buttonPosition.y,
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          borderRadius: 999,
          border: "1px solid #22c55e",
          background:
            "radial-gradient(circle at 30% 30%, #4ade80 0%, #22c55e 45%, #15803d 100%)",
          boxShadow: "0 18px 36px rgba(21, 128, 61, 0.28)",
          display: "grid",
          placeItems: "center",
          cursor: "grab",
          zIndex: 2147483000,
          touchAction: "none",
        }}
      >
        <AuraIcon />
      </button>
    </>
  );
}
