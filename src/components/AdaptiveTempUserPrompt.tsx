import React, { useEffect, useState, useRef } from 'react';
import { BehaviorTracker } from '../BehaviorTracker';

export interface AdaptiveTempUserPromptProps {
  userId: string;
  apiEndpoint: string;
  tracker: BehaviorTracker | null;
  enabled?: boolean;
  checkInterval?: number;
  /** Called when the user chooses "Reset Temporarily" — apply default settings in-session */
  onResetConfirmed?: () => void;
  /** Milliseconds to pause re-checks after any user response (default 10 min) */
  pauseAfterResponseMs?: number;
}

export function AdaptiveTempUserPrompt(props: AdaptiveTempUserPromptProps) {
  const {
    userId, apiEndpoint, tracker,
    enabled = true,
    checkInterval = 15000,
    onResetConfirmed,
    pauseAfterResponseMs = 600_000,
  } = props;

  const [detectionReason, setDetectionReason] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const checkTimerRef  = useRef<number | null>(null);
  const pausedUntilRef = useRef<number>(0);   // epoch ms — no checks before this time

  useEffect(() => {
    if (!enabled || !tracker) return;

    const checkTempStatus = async () => {
      if (showModal) return;
      if (Date.now() < pausedUntilRef.current) return;   // still in grace period

      const metrics = tracker.getAnomalyMetrics();
      const recentInteractions = tracker.getRecentInteractions();

      if (metrics.clickCount < 5) return;

      try {
        const response = await fetch(`${apiEndpoint.replace(/\/+$/, "")}/temp-user/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, metrics, recent_interactions: recentInteractions })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.isTempUser) {
            console.warn('[AdaptiveTempUserPrompt] Temp user detected:', result.reason);
            setDetectionReason(result.reason || 'unusual_activity');
            setShowModal(true);
          }
        }
      } catch (error) {
        console.error('[AdaptiveTempUserPrompt] Error checking status:', error);
      }
    };

    const initialTimer = setTimeout(checkTempStatus, 5000);
    checkTimerRef.current = window.setInterval(checkTempStatus, checkInterval);

    const handleDebugTrigger = () => {
      console.log('⚡ Debug trigger: forcing temp-user popup');
      setDetectionReason('debug_trigger');
      setShowModal(true);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('aura-test-temp-user', handleDebugTrigger);
    }

    return () => {
      clearTimeout(initialTimer);
      if (checkTimerRef.current) window.clearInterval(checkTimerRef.current);
      if (typeof window !== 'undefined') {
        window.removeEventListener('aura-test-temp-user', handleDebugTrigger);
      }
    };
  }, [enabled, tracker, showModal, apiEndpoint, userId, checkInterval]);

  /** "Reset Temporarily" — apply default profile for this session, no DB write */
  const handleResetTemporary = async () => {
    setIsApplying(true);
    try {
      if (onResetConfirmed) {
        onResetConfirmed();
      }
    } finally {
      setIsApplying(false);
      setShowModal(false);
      pausedUntilRef.current = Date.now() + pauseAfterResponseMs;
    }
  };

  /** "Keep Settings" — dismiss and pause re-checks */
  const handleKeep = () => {
    setShowModal(false);
    pausedUntilRef.current = Date.now() + pauseAfterResponseMs;
  };

  return React.createElement(
    React.Fragment,
    null,

    showModal &&
    React.createElement('div', {
      style: {
        position: 'fixed',
        bottom: 24,
        left: 24,
        width: 340,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
        padding: '20px 20px 16px',
        zIndex: 99999,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        color: '#111827',
        boxSizing: 'border-box' as const,
      }
    },
      // Header row: badge + close
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }
      },
        React.createElement('span', {
          style: {
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
            color: '#6b7280', backgroundColor: '#f3f4f6', padding: '3px 8px', borderRadius: 4,
          }
        }, 'SESSION ALERT'),
        React.createElement('button', {
          onClick: handleKeep,
          'aria-label': 'Close',
          style: {
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, color: '#9ca3af', padding: '0 2px', lineHeight: '1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }
        }, '\u00D7')
      ),

      // Title
      React.createElement('h3', {
        style: { margin: '0 0 10px 0', fontSize: 15, fontWeight: 600, color: '#111827', lineHeight: 1.35 }
      }, 'Unusual Interaction Detected'),

      // Divider
      React.createElement('div', { style: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 12 } }),

      // Description
      React.createElement('p', {
        style: { margin: '0 0 16px 0', fontSize: 13, color: '#374151', lineHeight: 1.55 }
      }, 'Your interaction pattern differs from your saved profile. Would you like to keep your personalised settings or reset to defaults for this session?'),

      // Buttons
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('button', {
          onClick: handleKeep,
          disabled: isApplying,
          style: {
            flex: 1, padding: '9px 12px', fontSize: 13, fontWeight: 500,
            color: '#374151', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb',
            borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
          }
        }, 'Keep Settings'),

        React.createElement('button', {
          onClick: handleResetTemporary,
          disabled: isApplying,
          style: {
            flex: 1, padding: '9px 12px', fontSize: 13, fontWeight: 600,
            color: '#ffffff', backgroundColor: '#111827', border: 'none',
            borderRadius: 6, cursor: isApplying ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: isApplying ? 0.6 : 1,
          }
        }, isApplying ? 'Applying...' : 'Reset for Session')
      )
    )
  );
}
