import React, { useState, useEffect } from 'react';
import { useAdaptive } from '../AdaptiveProvider';

export interface FeedbackPromptProps {
  /** Delay in ms before showing prompt (default: 30000 = 30s) */
  delay?: number;
  /** Position on screen */
  position?: 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left';
  /** Auto-dismiss after this many ms (default: never) */
  autoDismiss?: number;
}

/**
 * AdaptiveFeedbackPrompt
 * 
 * Shows a lightweight "Was this better?" feedback prompt after UI changes.
 * Only appears once per session, after a delay, and if user hasn't reverted.
 */
export function AdaptiveFeedbackPrompt({
  delay = 30000,
  position = 'bottom-right',
  autoDismiss,
}: FeedbackPromptProps) {
  const { submitFeedback, source, sessionId, loading, tokens } = useAdaptive();
  const [visible, setVisible] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [changes, setChanges] = useState<string[]>([]);

  useEffect(() => {
    // Only show for personalized UI (not baseline)
    if (loading || source === 'category' || source === 'fallback' || !sessionId) {
      return;
    }

    // Don't show if already answered
    const storageKey = `aura_feedback_${sessionId}`;
    if (typeof window !== 'undefined' && window.localStorage.getItem(storageKey)) {
      return;
    }

    // Detect what changes were applied
    const detectedChanges: string[] = [];
    if (tokens) {
      // Check font size changes
      const baseSize = tokens.typography?.baseSize;
      const baseSizeNum = baseSize ? parseInt(baseSize) : 16;
      if (baseSizeNum > 16) {
        detectedChanges.push(`Larger text (${baseSize})`);
      } else if (baseSizeNum < 16) {
        detectedChanges.push(`Smaller text (${baseSize})`);
      }

      // Check contrast/theme
      if (tokens.flags?.highContrast || tokens.flags?.theme === 'dark') {
        detectedChanges.push('High contrast mode');
      }

      // Check spacing
      const spacing = tokens.spacing?.base;
      if (spacing && spacing > 8) {
        detectedChanges.push('Wider spacing');
      } else if (spacing && spacing < 8) {
        detectedChanges.push('Compact spacing');
      }

      // Check button/target size
      const targetSize = tokens.controls?.minTargetSize;
      if (targetSize && targetSize > 44) {
        detectedChanges.push(`Larger buttons (${targetSize}px)`);
      }

      // Check animations
      if (tokens.flags?.reducedMotion === true) {
        detectedChanges.push('Reduced animations');
      }
    }

    setChanges(detectedChanges);

    // Show after delay
    const timer = window.setTimeout(() => {
      setVisible(true);

      // Auto-dismiss if configured
      if (autoDismiss) {
        window.setTimeout(() => {
          setVisible(false);
        }, autoDismiss);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [delay, autoDismiss, loading, source, sessionId, tokens]);

  const handleAnswer = async (answer: 'yes' | 'no') => {
    setAnswered(true);
    setVisible(false);

    // Store that user answered
    if (typeof window !== 'undefined' && sessionId) {
      window.localStorage.setItem(`aura_feedback_${sessionId}`, answer);
    }

    // Submit feedback
    try {
      if (submitFeedback) {
        await submitFeedback({
          type: 'explicit',
          value: answer === 'yes' ? 1.0 : 0.0,
          comment: `User explicitly ${answer === 'yes' ? 'liked' : 'disliked'} UI changes`,
        });
      }
    } catch (err) {
      console.error('[AURA] Failed to submit feedback:', err);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    if (typeof window !== 'undefined' && sessionId) {
      window.localStorage.setItem(`aura_feedback_${sessionId}`, 'dismissed');
    }
  };

  if (!visible || answered) {
    return null;
  }

  const positionStyles: Record<string, React.CSSProperties> = {
    'top-right': { top: '20px', right: '20px' },
    'bottom-right': { bottom: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'top-left': { top: '20px', left: '20px' },
  };

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    ...positionStyles[position],
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    zIndex: 9999,
    maxWidth: '320px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  const questionStyle: React.CSSProperties = {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: 500,
    color: '#1e293b',
  };

  const buttonContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
  };

  const buttonBaseStyle: React.CSSProperties = {
    flex: 1,
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const yesButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: '#10b981',
    color: '#ffffff',
  };

  const noButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: '#ef4444',
    color: '#ffffff',
  };

  const dismissButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    fontSize: '18px',
    padding: '0',
    lineHeight: '1',
  };

  return React.createElement(
    'div',
    { style: containerStyle },
    React.createElement(
      'button',
      {
        style: dismissButtonStyle,
        onClick: handleDismiss,
        'aria-label': 'Dismiss',
      },
      '×'
    ),
    React.createElement('p', { style: questionStyle }, 'We personalized your experience:'),
    changes.length > 0 && React.createElement(
      'ul',
      {
        style: {
          margin: '0 0 12px 0',
          padding: '0 0 0 20px',
          fontSize: '13px',
          color: '#475569',
          lineHeight: 1.6,
        },
      },
      changes.map((change, idx) =>
        React.createElement('li', { key: idx }, change)
      )
    ),
    React.createElement('p', { style: { ...questionStyle, fontSize: '13px', marginTop: '8px' } }, 'Do you like these changes?'),
    React.createElement(
      'div',
      { style: buttonContainerStyle },
      React.createElement(
        'button',
        {
          style: yesButtonStyle,
          onClick: () => handleAnswer('yes'),
          onMouseEnter: (e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#059669';
          },
          onMouseLeave: (e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#10b981';
          },
        },
        '👍 Yes'
      ),
      React.createElement(
        'button',
        {
          style: noButtonStyle,
          onClick: () => handleAnswer('no'),
          onMouseEnter: (e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#dc2626';
          },
          onMouseLeave: (e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#ef4444';
          },
        },
        '👎 No'
      )
    )
  );
}
