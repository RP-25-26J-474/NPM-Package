import React, { useEffect, useState, useRef } from 'react';
import { BehaviorTracker } from '../BehaviorTracker';

export interface AdaptiveTempUserPromptProps {
  userId: string;
  apiEndpoint: string;
  tracker: BehaviorTracker | null;
  enabled?: boolean;
  checkInterval?: number;
  onResetConfirmed?: () => void;
}

export function AdaptiveTempUserPrompt(props: AdaptiveTempUserPromptProps) {
  const { userId, apiEndpoint, tracker, enabled = true, checkInterval = 15000, onResetConfirmed } = props;

  const [isTempUser, setIsTempUser] = useState(false);
  const [detectionReason, setDetectionReason] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const checkTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !tracker) return;

    const checkTempStatus = async () => {
      // Don't check if already showing modal
      if (showModal) return;

      const metrics = tracker.getAnomalyMetrics();
      const recentInteractions = tracker.getRecentInteractions();

      // Only check if there's enough activity (e.g., > 5 clicks)
      if (metrics.clickCount < 5) return;

      try {
        const response = await fetch(`${apiEndpoint.replace(/\/+$/, "")}/temp-user/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            metrics,
            recent_interactions: recentInteractions
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.isTempUser) {
            console.warn('[AdaptiveTempUserPrompt] Temp user detected:', result.reason);
            setIsTempUser(true);
            setDetectionReason(result.reason || 'Unusual activity detected');
            setShowModal(true);
          }
        }
      } catch (error) {
        console.error('[AdaptiveTempUserPrompt] Error checking status:', error);
      }
    };

    // Initial check after 5s, then periodic
    const initialTimer = setTimeout(checkTempStatus, 5000);
    checkTimerRef.current = window.setInterval(checkTempStatus, checkInterval);

    // Debug listener
    const handleDebugTrigger = () => {
      console.log('⚡ Debug trigger received: Forcing Temp User Popup');
      setIsTempUser(true);
      setDetectionReason('Manual Debug Trigger');
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

  const handleReset = async () => {
    setIsResetting(true);
    try {
      // Call reset endpoint
      await fetch(`${apiEndpoint}/users/${userId}/reset`, { method: 'POST' });
      
      // Also notify parent/reload
      if (onResetConfirmed) {
        onResetConfirmed();
      } else {
        window.location.reload();
      }
      
      setShowModal(false);
    } catch (error) {
      console.error('Error resetting settings:', error);
      alert('Failed to reset settings. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDismiss = () => {
    setShowModal(false);
    // Pause checking for a while? Or just let it re-trigger if behavior continues?
    // For now, let's just close it.
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
      }, `We detected some ${detectionReason === 'erratic_mouse_movement' ? 'erratic mouse movement' : 'unusual activity'}. Would you like to reset to the default view for a cleaner experience?`),

      // Buttons
      React.createElement('div', { style: { display: 'flex', gap: '16px' } },
        React.createElement('button', {
          onClick: handleDismiss,
          disabled: isResetting,
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
        }, 'No, Keep Custom'),

        React.createElement('button', {
          onClick: handleReset,
          disabled: isResetting,
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
            opacity: isResetting ? 0.7 : 1
          },
          onMouseOver: (e: any) => !isResetting && (e.target.style.transform = 'translateY(-2px)'),
          onMouseOut: (e: any) => !isResetting && (e.target.style.transform = 'translateY(0)')
        }, isResetting ? 'Resetting...' : 'Yes, Reset View')
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
