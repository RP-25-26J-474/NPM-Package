// src/components/AdaptiveFeedback.tsx
import React, { useEffect, useState, type CSSProperties } from "react";
import { useAdaptive } from "../AdaptiveProvider";

export function AdaptiveFeedback() {
  const { behaviorTracker, userId, apiEndpoint, profile, applySettings } = useAdaptive();
  
  // State for the new flow
  const [step, setStep] = useState<"idle" | "validation" | "fetching" | "suggestion">("idle");
  const [anomaly, setAnomaly] = useState<any>(null);
  const [suggestion, setSuggestion] = useState<any>(null);
  const [targetParam, setTargetParam] = useState<string>("");

  useEffect(() => {
    const handleAnomaly = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log("🚨 [AdaptiveFeedback] Anomaly event received:", customEvent.detail);
      setAnomaly(customEvent.detail);
      setStep("validation"); // Start the flow
    };

    window.addEventListener("aura-anomaly", handleAnomaly);
    document.addEventListener("aura-anomaly", handleAnomaly);

    return () => {
      window.removeEventListener("aura-anomaly", handleAnomaly);
      document.removeEventListener("aura-anomaly", handleAnomaly);
    };
  }, []);

  // --- SMART INFERENCE LOGIC ---
  const getSmartSuggestion = (type: string, data?: any) => {
    // 1. Rage Click (Motor Control)
    if (type === 'rage_click') {
      return {
        category: "Motor Control / Precision",
        issue: "It seems like hitting buttons might be difficult.",
        suggestion: "Increase Button Size",
        actionLabel: "Make Targets Bigger",
        relevantParam: "targetSize" // Changed to camelCase to match app.py
      };
    }
    
    // 2. Dead Click (Vision/Affordance)
    if (type === 'dead_click') {
        // If on a text/image element -> Maybe high contrast needed?
        // If on a container -> maybe element spacing?
        return {
          category: "Visual Perception",
          issue: "It's not clear what is clickable.",
          suggestion: "High Contrast Mode",
          actionLabel: "Turn On High Contrast",
          relevantParam: "contrastMode"
        };
    }

    // 3. Scroll Thrashing (Cognitive/Layout)
    if (type === 'scroll_thrashing') {
        return {
          category: "Cognitive Load / Readability",
          issue: "You might be searching for information.",
          suggestion: "Simplify Layout & Spacing",
          actionLabel: "Optimize Layout",
          relevantParam: "elementSpacing" // Suggest spacing first, or layout_simplification
        };
    }

    // 4. Fallback (General)
    return {
      category: "General Usability",
      issue: "You seem to be having trouble.",
      suggestion: "Adjust View Settings",
      actionLabel: "Optimize View",
      relevantParam: "theme"
    };
  };

  const handleUserValidation = async (confirmed: boolean) => {
    if (!confirmed) {
      setStep("idle");
      setAnomaly(null);
      return;
    }

    // User confirmed -> Neg Feedback for current
    setStep("fetching");
    
    // Get parameter from our smart inference
    const smartInference = getSmartSuggestion(anomaly.type, anomaly.data);
    const param = smartInference.relevantParam;
    
    setTargetParam(param);

    const backendUrl = process.env.AURA_RL_URL || "https://rl-service.fly.dev";

    // Helper to build a local suggestion without needing the RL backend
    const buildLocalSuggestion = (p: string): { action: any; reasoning: { recommendation: string }; success: boolean } => {
      const paramMap: Record<string, string> = {
        'fontSize': 'font_size', 'targetSize': 'target_size', 'contrastMode': 'contrast_mode',
        'elementSpacing': 'element_spacing_y', 'layoutSimplification': 'layout_simplification',
        'reducedMotion': 'reduced_motion', 'theme': 'theme'
      };
      const apiP = paramMap[p] || p;
      const cur = profile?.[apiP as keyof typeof profile];
      let action: any;
      let label: string;
      switch (p) {
        case 'targetSize':
          action = Math.min(56, (typeof cur === 'number' ? cur : 32) + 8);
          label = `Increase touch target size to ${action}px`; break;
        case 'fontSize':
          action = Math.min(22, (typeof cur === 'number' ? cur : 16) + 2);
          label = `Increase font size to ${action}px`; break;
        case 'contrastMode':
          action = 'high'; label = 'Enable high contrast mode'; break;
        case 'elementSpacing':
          action = Math.min(24, (typeof cur === 'number' ? cur : 10) + 4);
          label = `Increase element spacing to ${action}px`; break;
        case 'reducedMotion':
          action = true; label = 'Enable reduced motion'; break;
        case 'layoutSimplification':
          action = true; label = 'Simplify the layout'; break;
        default:
          action = cur; label = `Adjust ${p}`;
      }
      return { action, reasoning: { recommendation: label }, success: true };
    };

    try {
      const paramMap: Record<string, string> = {
          'fontSize': 'font_size', 'targetSize': 'target_size', 'contrastMode': 'contrast_mode',
          'elementSpacing': 'element_spacing', 'layoutSimplification': 'layout_simplification',
          'reducedMotion': 'reduced_motion', 'theme': 'theme'
      };
      const apiParam = paramMap[param] || param;
      const currentAction = profile?.[apiParam as keyof typeof profile] || "unknown";

      // 1. Send Negative Feedback (fire-and-forget – don't block on it)
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

      // 2. Ask RL for a Solution
      const response = await fetch(`${backendUrl}/rl/choose-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId || "guest",
          parameter: param,
          context: { lastFeedback: "negative", avoidCurrent: true },
          state: { [param]: profile?.[param as keyof typeof profile] }
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setSuggestion(data);
        setStep("suggestion");
      } else {
        // RL returned no valid action – use local fallback
        setSuggestion(buildLocalSuggestion(param));
        setStep("suggestion");
      }

    } catch (e) {
      // Backend offline – build suggestion locally so the flow still works
      setSuggestion(buildLocalSuggestion(param));
      setStep("suggestion");
    }
  };

  const handleDismissSuggestion = async () => {
    if (!suggestion || !targetParam) return;
    
    const backendUrl = process.env.AURA_RL_URL || "https://rl-service.fly.dev";

    try {
      // Send Negative Feedback for the REJECTED suggestion
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
      console.log("Sent negative feedback for rejected suggestion");
    } catch (e) {
      console.error("Failed to send rejection feedback:", e);
    }

    setStep("idle");
    setAnomaly(null);
    setSuggestion(null);
  };

  const handleApplySuggestion = async () => {
    if (!suggestion || !targetParam) return;

    // targetParam is already camelCase (e.g. 'targetSize', 'fontSize') from the RL engine.
    // handleSettingsUpdate reads camelCase keys — do NOT convert to snake_case here.
    // Map contrastMode → contrast because handleSettingsUpdate uses settings.contrast
    const rlToCamel: Record<string, string> = { contrastMode: 'contrast', elementSpacing: 'spacing' };
    const settingKey = rlToCamel[targetParam] ?? targetParam;
    const settingPayload: Record<string, any> = { [settingKey]: suggestion.action };

    // 1. Apply immediately via context (works offline, no backend required)
    if (applySettings) {
      applySettings(settingPayload, 'user');
    }

    // 2. Fire-and-forget server calls (non-blocking)
    const reportApi = apiEndpoint || "http://localhost:5000/api";
    const backendUrl = "https://rl-service.fly.dev";

    fetch(`${reportApi}/manual-settings/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userId || "guest", settings: settingPayload }),
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

  // --- RENDER ---
  return React.createElement(
    React.Fragment,
    null,
    // Debug Button
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
            position: "fixed", bottom: 80, right: 20, zIndex: 100000,
            background: "red", color: "white", padding: "4px 8px", fontSize: "10px",
            border: "none", borderRadius: "4px", cursor: "pointer",
          },
        },
        "TEST ANOMALY"
      ),

    // Validation Step
    step === "validation" && anomaly &&
      React.createElement(
        "div",
        { style: popupStyle },
        React.createElement("div", { style: { fontSize: 24, marginBottom: 8 } }, "🤔"),
        React.createElement("h3", { style: headerStyle }, "Trouble with the interface?"),
        React.createElement("p", { style: textStyle }, 
          `We detected a "${anomaly.type}". Is this causing issues?`
        ),
        React.createElement(
          "div",
          { style: { display: "flex", gap: 8 } },
          React.createElement("button", { onClick: () => handleUserValidation(false), style: secondaryButtonStyle }, "No, I'm fine"),
          React.createElement("button", { onClick: () => handleUserValidation(true), style: primaryButtonStyle }, "Yes, Fix it")
        )
      ),

    // Suggestion Step
    step === "suggestion" && suggestion &&
      React.createElement(
        "div",
        { style: popupStyle },
        React.createElement("div", { style: { fontSize: 24, marginBottom: 8 } }, "💡"),
        React.createElement("h3", { style: headerStyle }, "AI Suggestion"),
        React.createElement("p", { style: textStyle }, 
          // Use reason from RL or fallback
          suggestion.reasoning?.recommendation || `Try setting ${targetParam} to ${suggestion.action}`
        ),
        
        React.createElement(
          "div",
          { style: { marginTop: 12, padding: 8, background: "#f3f4f6", borderRadius: 4, marginBottom: 12, fontSize: 13, fontWeight: "bold", textAlign: "center" } },
          `${targetParam}: ${suggestion.action}` 
        ),

        React.createElement(
          "div",
          { style: { display: "flex", gap: 8 } },
          React.createElement("button", { onClick: handleDismissSuggestion, style: secondaryButtonStyle }, "Dismiss"),
          React.createElement("button", { onClick: handleApplySuggestion, style: primaryButtonStyle }, "Apply Change")
        )
      ),
      
    // Fetching Indicator
    step === "fetching" && 
      React.createElement("div", { style: popupStyle }, "Consulting AI Agent...")
  );
}

// Styles (Reused)
const popupStyle: CSSProperties = {
  position: "fixed", bottom: 20, right: 20, backgroundColor: "white", padding: 16,
  borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", border: "1px solid #e5e7eb",
  zIndex: 99999, maxWidth: 320, animation: "aura-fade-in 0.3s ease-out", fontFamily: "system-ui, sans-serif", color: "black",
};
const headerStyle: CSSProperties = { margin: "0 0 8px 0", fontSize: 15, fontWeight: "bold", color: "#1f2937" };
const textStyle: CSSProperties = { margin: "0 0 16px 0", fontSize: 13, color: "#4b5563", lineHeight: 1.4 };
const primaryButtonStyle: CSSProperties = { flex: 1, padding: "8px 12px", fontSize: 13, color: "white", background: "#2563eb", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
const secondaryButtonStyle: CSSProperties = { flex: 1, padding: "8px 12px", fontSize: 13, color: "#374151", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer" };

