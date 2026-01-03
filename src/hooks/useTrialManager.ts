/**
 * useTrialManager - Orchestrates trial-based personalization
 * 
 * Handles:
 * 1. Proposing trials based on ML suggestions
 * 2. Starting trials (applying changes silently)
 * 3. Collecting metrics during evaluation window
 * 4. Evaluating trials (anomaly scoring)
 * 5. Showing feedback prompt if needed
 * 6. Processing user feedback
 * 7. Handling bounded search (next trial)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Trial {
  trialId: string;
  settingKey: string;
  oldValue: string;
  newValue: string;
  settingName: string;
  attemptNumber: number;
}

export interface TrialMetrics {
  clickCount: number;
  misclickCount: number;
  rageClickCount: number;
  avgTimeToClick: number;
  formErrorCount: number;
  zoomEventCount: number;
  scrollDepth?: number;
  dwellTime?: number;
}

export interface FeedbackPayload {
  type: 'like' | 'dislike';
  reason?: 'too_big' | 'too_small' | 'dismiss' | 'other';
}

export function useTrialManager(
  userId: string,
  apiEndpoint: string,
  mode: 'standard' | 'trial-based' = 'standard',
  sessionId?: string
) {
  // State
  const [activeTrial, setActiveTrial] = useState<Trial | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [trialSettings, setTrialSettings] = useState<Record<string, any>>({});
  const [metrics, setMetrics] = useState<TrialMetrics>({
    clickCount: 0,
    misclickCount: 0,
    rageClickCount: 0,
    avgTimeToClick: 0,
    formErrorCount: 0,
    zoomEventCount: 0,
  });

  const metricsRef = useRef<TrialMetrics>({
    clickCount: 0,
    misclickCount: 0,
    rageClickCount: 0,
    avgTimeToClick: 0,
    formErrorCount: 0,
    zoomEventCount: 0,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickHistoryRef = useRef<Array<{ x: number; y: number; time: number }>>([]);
  const lastClickRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const evaluationStartTimeRef = useRef<number | null>(null);

  // Only run in trial-based mode
  if (mode !== 'trial-based') {
    return {
      activeTrial: null,
      showPrompt: false,
      trialSettings: {},
      handleFeedback: async () => {},
    };
  }

  /**
   * Propose a trial based on ML suggestions
   */
  const proposeTrial = useCallback(
    async (mlSuggestedProfile?: Record<string, string>) => {
      try {
        const response = await fetch(`${apiEndpoint}/trials/propose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            sessionId: sessionId || `session-${Date.now()}`,
            mlSuggestedProfile: mlSuggestedProfile || {},
            context: {
              pageType: document.location.pathname,
              deviceType: /mobile|tablet|ipad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            },
          }),
        });

        const data = await response.json();

        if (data.success && data.hasTrial) {
          const proposal = data.proposal;
          const trial: Trial = {
            trialId: '',
            settingKey: proposal.settingKey,
            oldValue: proposal.oldValue,
            newValue: proposal.newValue,
            settingName: formatSettingName(proposal.settingKey),
            attemptNumber: proposal.attemptNumber,
          };

          await startTrial(trial);
        }
      } catch (error) {
        console.error('[useTrialManager] Error proposing trial:', error);
      }
    },
    [userId, apiEndpoint, sessionId]
  );

  /**
   * Start a trial (apply change silently)
   */
  const startTrial = useCallback(async (trial: Trial) => {
    try {
      const response = await fetch(`${apiEndpoint}/trials/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sessionId: sessionId || `session-${Date.now()}`,
          settingKey: trial.settingKey,
          oldValue: trial.oldValue,
          newValue: trial.newValue,
          context: {
            pageType: document.location.pathname,
            deviceType: /mobile|tablet|ipad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        const fullTrial: Trial = {
          ...trial,
          trialId: data.trialId,
        };

        // Apply trial settings
        setActiveTrial(fullTrial);
        setTrialSettings({ [getMappedSettingKey(trial.settingKey)]: getMappedValue(trial.newValue) });

        // Reset metrics
        metricsRef.current = {
          clickCount: 0,
          misclickCount: 0,
          rageClickCount: 0,
          avgTimeToClick: 0,
          formErrorCount: 0,
          zoomEventCount: 0,
        };

        evaluationStartTimeRef.current = Date.now();

        // Set evaluation timer (60 seconds)
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          evaluateTrial(fullTrial);
        }, data.evaluationWindow || 60000);

        // Start collecting interactions
        startMetricsCollection();
      }
    } catch (error) {
      console.error('[useTrialManager] Error starting trial:', error);
    }
  }, [userId, apiEndpoint, sessionId]);

  /**
   * Evaluate trial with collected metrics
   */
  const evaluateTrial = useCallback(
    async (trial: Trial) => {
      try {
        const response = await fetch(`${apiEndpoint}/trials/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trialId: trial.trialId,
            metrics: metricsRef.current,
          }),
        });

        const data = await response.json();

        if (data.success) {
          if (data.decision === 'revert') {
            // Revert silently
            setTrialSettings({});
            setActiveTrial(null);
            setShowPrompt(false);
          } else if (data.shouldPrompt) {
            // Show feedback prompt
            setShowPrompt(true);
          } else if (data.decision === 'accept') {
            // Accept silently, no more prompts
            setShowPrompt(false);
            setActiveTrial(null);
          }
        }
      } catch (error) {
        console.error('[useTrialManager] Error evaluating trial:', error);
      }
    },
    [apiEndpoint]
  );

  /**
   * Handle user feedback from DirectionalFeedbackPrompt
   */
  const handleFeedback = useCallback(
    async (feedback: FeedbackPayload) => {
      if (!activeTrial) return;

      try {
        const response = await fetch(`${apiEndpoint}/trials/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trialId: activeTrial.trialId,
            feedbackType: feedback.type,
            reason: feedback.reason || 'other',
          }),
        });

        const data = await response.json();

        if (data.success) {
          if (data.locked) {
            // Preference locked, stop trials for this setting
            setShowPrompt(false);
            setActiveTrial(null);
            // Keep trial settings applied
          } else if (data.nextSuggestion) {
            // Continue with bounded search
            const nextTrial: Trial = {
              trialId: '',
              settingKey: data.nextSuggestion.settingKey,
              oldValue: activeTrial.newValue,
              newValue: data.nextSuggestion.value,
              settingName: activeTrial.settingName,
              attemptNumber: data.nextSuggestion.attemptNumber,
            };

            setShowPrompt(false);
            // Wait before starting next trial (cooldown)
            setTimeout(() => {
              startTrial(nextTrial);
            }, 1000);
          }
        }
      } catch (error) {
        console.error('[useTrialManager] Error submitting feedback:', error);
      }
    },
    [activeTrial, apiEndpoint, startTrial]
  );

  /**
   * Start collecting metrics during evaluation window
   */
  const startMetricsCollection = useCallback(() => {
    // Track clicks
    const handleClick = (e: MouseEvent) => {
      metricsRef.current.clickCount++;

      const x = e.clientX;
      const y = e.clientY;
      const now = Date.now();

      // Check for rage clicks (3+ clicks in same area within 1s)
      const recentClicks = clickHistoryRef.current.filter(
        (click) => now - click.time < 1000 && Math.abs(click.x - x) < 50 && Math.abs(click.y - y) < 50
      );

      if (recentClicks.length >= 2) {
        metricsRef.current.rageClickCount++;
      }

      clickHistoryRef.current.push({ x, y, time: now });
      clickHistoryRef.current = clickHistoryRef.current.filter((click) => now - click.time < 2000);

      // Check for misclick (click then no interaction for 500ms)
      lastClickRef.current = { x, y, time: now };
      setTimeout(() => {
        if (lastClickRef.current && lastClickRef.current.time === now) {
          // No follow-up interaction
          metricsRef.current.misclickCount++;
        }
      }, 500);
    };

    // Track form errors
    const handleInput = (e: Event) => {
      if ((e.target as HTMLInputElement).getAttribute('aria-invalid') === 'true') {
        metricsRef.current.formErrorCount++;
      }
      lastClickRef.current = null;
    };

    // Track zoom events
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        metricsRef.current.zoomEventCount++;
      }
    };

    // Track scroll
    const handleScroll = () => {
      const scrollDepth = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
      metricsRef.current.scrollDepth = Math.max(metricsRef.current.scrollDepth || 0, scrollDepth);
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('input', handleInput);
    document.addEventListener('wheel', handleWheel);
    document.addEventListener('scroll', handleScroll);

    // Cleanup function
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('input', handleInput);
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('scroll', handleScroll);
    };
  }, []);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    if (mode === 'trial-based') {
      // Propose initial trial
      proposeTrial();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [mode, proposeTrial]);

  return {
    activeTrial,
    showPrompt,
    trialSettings,
    handleFeedback,
    metrics: metricsRef.current,
  };
}

/**
 * Helper: Format setting key to display name
 */
function formatSettingName(key: string): string {
  const map: Record<string, string> = {
    'visual.fontSize': 'Font Size',
    'visual.lineHeight': 'Line Height',
    'visual.contrast': 'Contrast',
    'visual.spacing': 'Spacing',
    'motor.targetSize': 'Button Size',
    'theme': 'Theme',
  };
  return map[key] || key;
}

/**
 * Helper: Map setting key to CSS property
 */
function getMappedSettingKey(key: string): string {
  const map: Record<string, string> = {
    'visual.fontSize': 'fontSize',
    'visual.lineHeight': 'lineHeight',
    'visual.contrast': 'contrast',
    'visual.spacing': 'spacing',
    'motor.targetSize': 'targetSize',
    'theme': 'theme',
  };
  return map[key] || key;
}

/**
 * Helper: Map value to CSS/config value
 */
function getMappedValue(value: string): string {
  const map: Record<string, string> = {
    small: '14px',
    medium: '16px',
    large: '18px',
    xlarge: '20px',
  };
  return map[value] || value;
}
