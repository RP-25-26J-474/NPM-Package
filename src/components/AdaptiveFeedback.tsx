// src/components/AdaptiveFeedback.tsx
import React, { useEffect, useState, type CSSProperties } from "react";
import { useAdaptive } from "../AdaptiveProvider";

const ANOMALY_META: Record<string, { title: string; description: string }> = {
  rage_click: {
    title: "Button Interaction Difficulty",
    description:
      "We noticed repeated tapping on interactive elements. Would you like us to increase button and target sizes for easier interaction?",
  },
  dead_click: {
    title: "Navigation Clarity Issue",
    description:
      "We noticed taps on non-interactive areas. Would you like us to enhance visual clarity and affordances?",
  },
  scroll_thrashing: {
    title: "Scrolling Difficulty Detected",
    description:
      "We noticed rapid back-and-forth scrolling. Would you like us to optimise the layout and element spacing?",
  },
};

const DEFAULT_ANOMALY_META = {
  title: "Interface Difficulty Detected",
  description:
    "We detected an unusual interaction pattern. Would you like us to adjust your interface settings?",
};

const SUGGESTION_META: Record<
  string,
  { title: string; getReason: (action: any) => string }
> = {
  targetSize: {
    title: "Touch Target Optimisation",
    getReason: (action) =>
      typeof action === "number"
        ? `Increasing button and touch target size to ${action}px to improve interaction precision.`
        : "Increasing button and touch target sizes for easier interaction.",
  },
  fontSize: {
    title: "Text Size Adjustment",
    getReason: (action) =>
      typeof action === "number"
        ? `Increasing font size to ${action}px for improved readability.`
        : "Increasing text size for improved readability.",
  },
  contrastMode: {
    title: "Display Contrast Enhancement",
    getReason: () =>
      "Enabling high contrast mode to improve element visibility and reduce eyestrain.",
  },
  elementSpacing: {
    title: "Layout Spacing Optimisation",
    getReason: (action) =>
      typeof action === "number"
        ? `Adjusting element spacing to ${action}px to reduce visual density.`
        : "Applying optimised layout spacing to improve content flow.",
  },
  reducedMotion: {
    title: "Motion Reduction",
    getReason: () =>
      "Disabling animations and transitions to reduce visual distractions.",
  },
  layoutSimplification: {
    title: "Layout Simplification",
    getReason: () =>
      "Simplifying the interface layout to reduce visual complexity.",
  },
};

export function AdaptiveFeedback() {
  const {
    behaviorTracker,
    userId,
    apiEndpoint,
    rlEndpoint,
    profile,
    applySettings,
  } = useAdaptive();

  const [step, setStep] = useState<
    "idle" | "validation" | "fetching" | "suggestion"
  >("idle");
  const [anomaly, setAnomaly] = useState<any>(null);
  const [suggestion, setSuggestion] = useState<any>(null);
  const [targetParam, setTargetParam] = useState<string>("");

  useEffect(() => {
    const handleAnomaly = (event: Event) => {
      const customEvent = event as CustomEvent;
      setAnomaly(customEvent.detail);
      setStep("validation");
    };

    window.addEventListener("aura-anomaly", handleAnomaly);
    document.addEventListener("aura-anomaly", handleAnomaly);

    return () => {
      window.removeEventListener("aura-anomaly", handleAnomaly);
      document.removeEventListener("aura-anomaly", handleAnomaly);
    };
  }, []);

  const getSmartSuggestion = (type: string, data?: any) => {
    if (type === "rage_click") {
      return {
        category: "Motor Control / Precision",
        issue: "It seems like hitting buttons might be difficult.",
        suggestion: "Increase Button Size",
        actionLabel: "Make Targets Bigger",
        relevantParam: "targetSize",
      };
    }
    if (type === "dead_click") {
      return {
        category: "Visual Perception",
        issue: "It's not clear what is clickable.",
        suggestion: "High Contrast Mode",
        actionLabel: "Turn On High Contrast",
        relevantParam: "contrastMode",
      };
    }
    if (type === "scroll_thrashing") {
      return {
        category: "Cognitive Load / Readability",
        issue: "You might be searching for information.",
        suggestion: "Simplify Layout & Spacing",
        actionLabel: "Optimise Layout",
        relevantParam: "elementSpacing",
      };
    }
    return {
      category: "General Usability",
      issue: "You seem to be having trouble.",
      suggestion: "Adjust View Settings",
      actionLabel: "Optimise View",
      relevantParam: "theme",
    };
  };

  const handleClose = () => {
    setStep("idle");
    setAnomaly(null);
    setSuggestion(null);
  };

  const handleUserValidation = async (confirmed: boolean) => {
    if (!confirmed) {
      setStep("idle");
      setAnomaly(null);
      return;
    }

    setStep("fetching");

    const smartInference = getSmartSuggestion(anomaly.type, anomaly.data);
    const param = smartInference.relevantParam;
    setTargetParam(param);

    const backendUrl = rlEndpoint || "https://rl-service.fly.dev";

    const buildLocalSuggestion = (
      p: string
    ): { action: any; reasoning: { recommendation: string }; success: boolean } => {
      const paramMap: Record<string, string> = {
        fontSize: "font_size",
        targetSize: "target_size",
        contrastMode: "contrast_mode",
        elementSpacing: "element_spacing_y",
        layoutSimplification: "layout_simplification",
        reducedMotion: "reduced_motion",
        theme: "theme",
      };
      const apiP = paramMap[p] || p;
      const cur = profile?.[apiP as keyof typeof profile];
      let action: any;
      let label: string;
      switch (p) {
        case "targetSize":
          action = Math.min(56, (typeof cur === "number" ? cur : 32) + 8);
          label = `Increase touch target size to ${action}px`;
          break;
        case "fontSize":
          action = Math.min(22, (typeof cur === "number" ? cur : 16) + 2);
          label = `Increase font size to ${action}px`;
          break;
        case "contrastMode":
          action = "high";
          label = "Enable high contrast mode";
          break;
        case "elementSpacing":
          action = Math.min(24, (typeof cur === "number" ? cur : 10) + 4);
          label = `Increase element spacing to ${action}px`;
          break;
        case "reducedMotion":
          action = true;
          label = "Enable reduced motion";
          break;
        case "layoutSimplification":
          action = true;
          label = "Simplify the layout";
          break;
        default:
          action = cur;
          label = `Adjust ${p}`;
      }
      return { action, reasoning: { recommendation: label }, success: true };
    };

    try {
      const paramMap: Record<string, string> = {
        fontSize: "font_size",
        targetSize: "target_size",
        contrastMode: "contrast_mode",
        elementSpacing: "element_spacing",
        layoutSimplification: "layout_simplification",
        reducedMotion: "reduced_motion",
        theme: "theme",
      };
      const apiParam = paramMap[param] || param;
      const currentAction =
        profile?.[apiParam as keyof typeof profile] || "unknown";

      fetch(`${backendUrl}/rl/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId || "guest",
          parameter: param,
          action: currentAction,
          reward: -0.5,
          metadata: { source: "user_validation", anomaly: anomaly.type },
        }),
      }).catch(() => {});

      const response = await fetch(`${backendUrl}/rl/choose-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId || "guest",
          parameter: param,
          context: { lastFeedback: "negative", avoidCurrent: true },
          state: { [param]: profile?.[param as keyof typeof profile] },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuggestion(data);
        setStep("suggestion");
      } else {
        setSuggestion(buildLocalSuggestion(param));
        setStep("suggestion");
      }
    } catch (e) {
      setSuggestion(buildLocalSuggestion(param));
      setStep("suggestion");
    }
  };

  const handleDismissSuggestion = async () => {
    if (!suggestion || !targetParam) return;

    const backendUrl = rlEndpoint || "https://rl-service.fly.dev";

    try {
      await fetch(`${backendUrl}/rl/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId || "guest",
          parameter: targetParam,
          action: suggestion.action,
          reward: -0.5,
          metadata: { source: "ai_suggestion_rejected" },
        }),
      });
    } catch (e) {}

    setStep("idle");
    setAnomaly(null);
    setSuggestion(null);
  };

  const handleApplySuggestion = async () => {
    if (!suggestion || !targetParam) return;

    const rlToCamel: Record<string, string> = {
      contrastMode: "contrast",
      elementSpacing: "spacing",
    };
    const settingKey = rlToCamel[targetParam] ?? targetParam;
    const settingPayload: Record<string, any> = {
      [settingKey]: suggestion.action,
    };

    if (applySettings) {
      applySettings(settingPayload, "user");
    }

    const reportApi = apiEndpoint || "http://localhost:5000/api";
    const backendUrl = rlEndpoint || "https://rl-service.fly.dev";

    fetch(`${reportApi}/manual-settings/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userId || "guest",
        settings: settingPayload,
      }),
    }).catch(() => {});

    fetch(`${backendUrl}/rl/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userId || "guest",
        parameter: targetParam,
        action: suggestion.action,
        reward: 1.0,
        metadata: { source: "ai_suggestion_accepted" },
      }),
    }).catch(() => {});

    setStep("idle");
    setAnomaly(null);
    setSuggestion(null);
  };

  const anomalyMeta =
    anomaly
      ? ANOMALY_META[anomaly.type] ?? DEFAULT_ANOMALY_META
      : DEFAULT_ANOMALY_META;

  const suggestionMeta = SUGGESTION_META[targetParam] ?? {
    title: "Interface Optimisation",
    getReason: (_action: any) =>
      suggestion?.reasoning?.recommendation ??
      `Adjusting your interface settings to improve your experience.`,
  };

  return React.createElement(
    React.Fragment,
    null,

    // Dev test button
    userId &&
      React.createElement(
        "button",
        {
          onClick: () => {
            const types = ["rage_click", "dead_click", "scroll_thrashing"];
            const randomType = types[Math.floor(Math.random() * types.length)];
            const evt = new CustomEvent("aura-anomaly", {
              bubbles: true,
              detail: { type: randomType, data: { timestamp: Date.now() } },
            });
            window.dispatchEvent(evt);
          },
          style: {
            position: "fixed",
            bottom: 80,
            right: 20,
            zIndex: 100000,
            background: "#111827",
            color: "white",
            padding: "4px 10px",
            fontSize: "10px",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
            letterSpacing: "0.05em",
          },
        },
        "TEST ANOMALY"
      ),

    // Validation step
    step === "validation" &&
      anomaly &&
      React.createElement(
        "div",
        { style: cardStyle },
        React.createElement(
          "div",
          { style: headerRowStyle },
          React.createElement("span", { style: badgeStyle }, "BEHAVIOUR ALERT"),
          React.createElement(
            "button",
            {
              onClick: handleClose,
              style: closeButtonStyle,
              "aria-label": "Close",
            },
            "\u00D7"
          )
        ),
        React.createElement("h3", { style: titleStyle }, anomalyMeta.title),
        React.createElement("div", { style: dividerStyle }),
        React.createElement("p", { style: bodyTextStyle }, anomalyMeta.description),
        React.createElement(
          "div",
          { style: buttonRowStyle },
          React.createElement(
            "button",
            { onClick: () => handleUserValidation(false), style: ghostButtonStyle },
            "No thanks"
          ),
          React.createElement(
            "button",
            { onClick: () => handleUserValidation(true), style: primaryButtonStyle },
            "Yes, help me fix it"
          )
        )
      ),

    // Fetching step
    step === "fetching" &&
      React.createElement(
        "div",
        { style: cardStyle },
        React.createElement(
          "div",
          { style: headerRowStyle },
          React.createElement("span", { style: badgeStyle }, "AI SUGGESTION"),
          React.createElement(
            "button",
            {
              onClick: handleClose,
              style: closeButtonStyle,
              "aria-label": "Close",
            },
            "\u00D7"
          )
        ),
        React.createElement("h3", { style: titleStyle }, "Analysing Interaction..."),
        React.createElement("div", { style: dividerStyle }),
        React.createElement(
          "p",
          { style: { ...bodyTextStyle, color: "#6b7280", marginBottom: 0 } },
          "Please wait while we determine the best adjustment for you."
        )
      ),

    // Suggestion step
    step === "suggestion" &&
      suggestion &&
      React.createElement(
        "div",
        { style: cardStyle },
        React.createElement(
          "div",
          { style: headerRowStyle },
          React.createElement("span", { style: badgeStyle }, "AI SUGGESTION"),
          React.createElement(
            "button",
            {
              onClick: handleClose,
              style: closeButtonStyle,
              "aria-label": "Close",
            },
            "\u00D7"
          )
        ),
        React.createElement("h3", { style: titleStyle }, suggestionMeta.title),
        React.createElement("div", { style: dividerStyle }),
        React.createElement(
          "p",
          { style: bodyTextStyle },
          suggestionMeta.getReason(suggestion.action)
        ),
        React.createElement(
          "div",
          { style: buttonRowStyle },
          React.createElement(
            "button",
            { onClick: handleDismissSuggestion, style: ghostButtonStyle },
            "Dismiss"
          ),
          React.createElement(
            "button",
            { onClick: handleApplySuggestion, style: primaryButtonStyle },
            "Apply Suggestion"
          )
        )
      )
  );
}

// --- Styles ---

const cardStyle: CSSProperties = {
  position: "fixed",
  bottom: 24,
  right: 24,
  width: 340,
  backgroundColor: "#ffffff",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
  padding: "20px 20px 16px",
  zIndex: 99999,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  color: "#111827",
  boxSizing: "border-box",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
};

const badgeStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#6b7280",
  backgroundColor: "#f3f4f6",
  padding: "3px 8px",
  borderRadius: 4,
};

const closeButtonStyle: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 18,
  color: "#9ca3af",
  padding: "0 2px",
  lineHeight: "1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const titleStyle: CSSProperties = {
  margin: "0 0 10px 0",
  fontSize: 15,
  fontWeight: 600,
  color: "#111827",
  lineHeight: 1.35,
};

const dividerStyle: CSSProperties = {
  height: 1,
  backgroundColor: "#f3f4f6",
  marginBottom: 12,
};

const bodyTextStyle: CSSProperties = {
  margin: "0 0 16px 0",
  fontSize: 13,
  color: "#374151",
  lineHeight: 1.55,
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
};

const primaryButtonStyle: CSSProperties = {
  flex: 1,
  padding: "9px 12px",
  fontSize: 13,
  fontWeight: 600,
  color: "#ffffff",
  backgroundColor: "#111827",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontFamily: "inherit",
};

const ghostButtonStyle: CSSProperties = {
  flex: 1,
  padding: "9px 12px",
  fontSize: 13,
  fontWeight: 500,
  color: "#374151",
  backgroundColor: "#f3f4f6",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  cursor: "pointer",
  fontFamily: "inherit",
};