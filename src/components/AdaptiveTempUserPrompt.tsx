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

  if (!showModal) return null;

  return React.createElement('div', {
    style: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 100000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(4px)'
    }
  },
    React.createElement('div', {
      style: {
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        width: '90%',
        maxWidth: '500px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      }
    },
      // Icon
      React.createElement('div', {
        style: {
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: '#FFF4E5',
          color: '#FF9800',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          margin: '0 auto 24px auto'
        }
      }, '🛡️'),

      // Title
      React.createElement('h2', {
        style: {
          textAlign: 'center',
          color: '#1A202C',
          fontSize: '24px',
          fontWeight: '700',
          marginBottom: '12px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }
      }, 'Optimize Your Experience?'),

      // Description
      React.createElement('p', {
        style: {
          textAlign: 'center',
          color: '#4A5568',
          fontSize: '16px',
          lineHeight: '1.6',
          marginBottom: '32px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }
      }, `We noticed some unusual activity on your account. Would you like to temporarily reset to default settings for this session, or keep your current personalized settings?`),

      // Buttons
      React.createElement('div', { style: { display: 'flex', gap: '16px' } },
        React.createElement('button', {
          onClick: handleKeep,
          disabled: isApplying,
          style: {
            flex: 1,
            padding: '14px',
            borderRadius: '12px',
            border: '2px solid #E2E8F0',
            backgroundColor: 'transparent',
            color: '#4A5568',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          },
          onMouseOver: (e: any) => e.target.style.backgroundColor = '#F7FAFC',
          onMouseOut: (e: any) => e.target.style.backgroundColor = 'transparent'
        }, 'Keep Settings'),

        React.createElement('button', {
          onClick: handleResetTemporary,
          disabled: isApplying,
          style: {
            flex: 1,
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: '#3182CE',
            color: 'white',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(49, 130, 206, 0.4)',
            transition: 'all 0.2s',
            opacity: isApplying ? 0.7 : 1
          },
          onMouseOver: (e: any) => !isApplying && (e.target.style.transform = 'translateY(-2px)'),
          onMouseOut: (e: any) => !isApplying && (e.target.style.transform = 'translateY(0)')
        }, isApplying ? 'Applying...' : 'Reset Temporarily')
      ),

      // Animation Styles
      React.createElement('style', {}, `
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `)
    )
  );
}
