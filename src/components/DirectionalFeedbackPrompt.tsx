import React, { useState, useEffect } from 'react';

export interface DirectionalFeedbackProps {
  /** Trial ID to associate feedback with */
  trialId: string;
  /** Setting that was changed */
  settingName: string;
  /** Old value */
  oldValue: string;
  /** New value */
  newValue: string;
  /** Callback when feedback is given */
  onFeedback?: (feedback: { type: 'like' | 'dislike'; reason?: 'too_big' | 'too_small' | 'dismiss' | 'other' }) => void;
  /** Auto-dismiss after ms (0 = never) */
  autoDismiss?: number;
  /** Position on screen */
  position?: 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left';
}

/**
 * DirectionalFeedbackPrompt
 * 
 * Asks user for feedback with directional options (too big/too small).
 * Only shown after anomaly detection during trial evaluation.
 * Implements smart cooldown to prevent rapid asking.
 */
export function DirectionalFeedbackPrompt({
  trialId,
  settingName,
  oldValue,
  newValue,
  onFeedback,
  autoDismiss = 0,
  position = 'bottom-right',
}: DirectionalFeedbackProps) {
  const [visible, setVisible] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (autoDismiss > 0 && visible) {
      const timer = window.setTimeout(() => {
        setVisible(false);
      }, autoDismiss);

      return () => window.clearTimeout(timer);
    }
  }, [autoDismiss, visible]);

  const handleFeedback = async (type: 'like' | 'dislike', reason?: 'too_big' | 'too_small' | 'dismiss' | 'other') => {
    setSubmitting(true);

    try {
      if (onFeedback) {
        await onFeedback({ type, reason });
      }

      // Hide prompt after feedback
      setTimeout(() => setVisible(false), 500);
    } catch (err) {
      console.error('[AURA] Failed to submit feedback:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) {
    return null;
  }

  const positionStyles: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10000,
    ...(position === 'top-right' && { top: '20px', right: '20px' }),
    ...(position === 'bottom-right' && { bottom: '20px', right: '20px' }),
    ...(position === 'bottom-left' && { bottom: '20px', left: '20px' }),
    ...(position === 'top-left' && { top: '20px', left: '20px' }),
  };

  const containerStyle: React.CSSProperties = {
    ...positionStyles,
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
    maxWidth: '360px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    border: '2px solid #e2e8f0',
  };

  const headerStyle: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: '12px',
  };

  const changeInfoStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#64748b',
    marginBottom: '16px',
    padding: '10px 12px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    borderLeft: '3px solid #667eea',
  };

  const questionStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#475569',
    marginBottom: '12px',
    fontWeight: 500,
  };

  const buttonGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '8px',
  };

  const buttonBaseStyle: React.CSSProperties = {
    padding: '10px 16px',
    border: '2px solid',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: submitting ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    opacity: submitting ? 0.6 : 1,
  };

  const likeButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: '#10b981',
    borderColor: '#10b981',
    color: '#ffffff',
  };

  const dislikeButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: 'white',
    borderColor: '#e2e8f0',
    color: '#1e293b',
  };

  const dismissButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    color: '#94a3b8',
    fontSize: '13px',
    justifyContent: 'center',
  };

  const closeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    fontSize: '20px',
    padding: '0',
    lineHeight: '1',
  };

  return React.createElement(
    'div',
    { style: containerStyle },
    React.createElement(
      'button',
      {
        style: closeButtonStyle,
        onClick: () => handleFeedback('dislike', 'dismiss'),
        disabled: submitting,
        'aria-label': 'Dismiss',
      },
      '×'
    ),
    React.createElement(
      'div',
      { style: headerStyle },
      '💡 We adjusted your settings'
    ),
    React.createElement(
      'div',
      { style: changeInfoStyle },
      React.createElement(
        'div',
        { style: { marginBottom: '4px', fontWeight: 500, color: '#475569' } },
        `${settingName}: ${oldValue} → ${newValue}`
      ),
      React.createElement(
        'div',
        { style: { fontSize: '12px' } },
        'How does this feel?'
      )
    ),
    React.createElement(
      'p',
      { style: questionStyle },
      'Is this change working for you?'
    ),
    React.createElement(
      'div',
      { style: buttonGridStyle },
      React.createElement(
        'button',
        {
          style: likeButtonStyle,
          onClick: () => handleFeedback('like'),
          disabled: submitting,
          onMouseEnter: (e) => {
            if (!submitting) (e.target as HTMLButtonElement).style.backgroundColor = '#059669';
          },
          onMouseLeave: (e) => {
            if (!submitting) (e.target as HTMLButtonElement).style.backgroundColor = '#10b981';
          },
        },
        React.createElement('span', null, '👍'),
        React.createElement('span', null, submitting ? 'Saving...' : 'Yes, keep it')
      ),
      React.createElement(
        'button',
        {
          style: dislikeButtonStyle,
          onClick: () => handleFeedback('dislike', 'too_big'),
          disabled: submitting,
          onMouseEnter: (e) => {
            if (!submitting) (e.target as HTMLButtonElement).style.backgroundColor = '#f8fafc';
          },
          onMouseLeave: (e) => {
            if (!submitting) (e.target as HTMLButtonElement).style.backgroundColor = 'white';
          },
        },
        React.createElement('span', null, '⬇️'),
        React.createElement('span', null, submitting ? 'Saving...' : 'Too large / Too much')
      ),
      React.createElement(
        'button',
        {
          style: dislikeButtonStyle,
          onClick: () => handleFeedback('dislike', 'too_small'),
          disabled: submitting,
          onMouseEnter: (e) => {
            if (!submitting) (e.target as HTMLButtonElement).style.backgroundColor = '#f8fafc';
          },
          onMouseLeave: (e) => {
            if (!submitting) (e.target as HTMLButtonElement).style.backgroundColor = 'white';
          },
        },
        React.createElement('span', null, '⬆️'),
        React.createElement('span', null, submitting ? 'Saving...' : 'Too small / Not enough')
      ),
      React.createElement(
        'button',
        {
          style: dismissButtonStyle,
          onClick: () => handleFeedback('dislike', 'dismiss'),
          disabled: submitting,
        },
        submitting ? 'Saving...' : 'Not sure / Don\'t ask again'
      )
    )
  );
}
