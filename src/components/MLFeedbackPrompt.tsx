// src/components/MLFeedbackPrompt.tsx
// Feedback component that sends data to RL model for learning

import React, { useState, useEffect } from 'react';

interface MLFeedbackPromptProps {
  userId: string;
  settingKey: string;
  oldValue: any;
  newValue: any;
  mlConfidence: number;
  source: 'ml' | 'manual' | 'trial';
  apiEndpoint: string;
  onFeedback?: (sentiment: 'positive' | 'negative' | 'neutral') => void;
  onClose?: () => void;
  position?: 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left';
}

export function MLFeedbackPrompt({
  userId,
  settingKey,
  oldValue,
  newValue,
  mlConfidence,
  source,
  apiEndpoint,
  onClose,
  onFeedback,
  position = 'bottom-right'
}: MLFeedbackPromptProps): React.ReactElement | null {
  const [isVisible, setIsVisible] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // Auto-dismiss after 20 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 20000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose?.();
    }, 300);
  };

  const sendFeedback = async (feedback: 'positive' | 'neutral' | 'negative') => {
    setIsSending(true);

    try {
      console.log('[AURA] 🎯 Sending feedback to RL model:', feedback);

      // Use keepalive to ensure request completes even if component unmounts
      const response = await fetch(`${apiEndpoint}/api/users/${userId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true, 
        body: JSON.stringify({
          parameter: settingKey,
          currentValue: newValue,
          previousValue: oldValue,
          feedback: {
            type: feedback,
            rating: feedback === 'positive' ? 5 : feedback === 'negative' ? 1 : 3,
            accepted: feedback !== 'negative'
          },
          context: {
            source,
            deviceType: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop'
          },
          state: {} // Fallback empty state
        })
      });

      const data = await response.json();

      console.log('[AURA] ✅ RL model feedback passed to Backend:', data);

    } catch (error) {
      console.error('[AURA] ❌ Error sending feedback:', error);
    } finally {
      // Notify parent (which will likely unmount this component)
      if (onFeedback) {
        onFeedback(feedback);
      } else {
        // Fallback internal close if no parent handler
        setTimeout(() => {
            handleClose();
        }, 500);
      }
    }
  };

  if (!isVisible) return null;

  const positionStyles: Record<string, React.CSSProperties> = {
    'bottom-right': { bottom: 20, right: 20 },
    'bottom-left': { bottom: 20, left: 20 },
    'top-right': { top: 20, right: 20 },
    'top-left': { top: 20, left: 20 }
  };

  const formatValue = (key: string, val: any): string => {
    if (key === 'theme') return val;
    if (key === 'font_size' || key === 'fontSize') return val;
    if (key === 'target_size' || key === 'targetSize') return `${val}px`;
    if (key.includes('color') || key.includes('Color')) return val;
    return String(val);
  };

  // Using React.createElement to avoid JSX compilation issues
  return React.createElement('div', {
    style: {
      position: 'fixed',
      ...positionStyles[position],
      zIndex: 9999,
      maxWidth: 380,
      background: 'linear-gradient(135deg, rgba(26, 115, 232, 0.98), rgba(13, 71, 161, 0.98))',
      borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      padding: 20,
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }
  }, 
    React.createElement('div', { style: { fontSize: 18, fontWeight: 'bold' } }, 
      `🤖 ML Setting Applied (${(mlConfidence * 100).toFixed(0)}%)`
    ),
    React.createElement('div', { style: { fontSize: 14, marginTop: 10 } },
      `${settingKey}: ${formatValue(settingKey, oldValue)} → ${formatValue(settingKey, newValue)}`
    ),
    React.createElement('div', { style: { display: 'grid', gap: 10, marginTop: 14 } },
      React.createElement('button', {
        onClick: () => sendFeedback('positive'),
        disabled: isSending,
        style: {
          background: '#4caf50',
          border: 'none',
          borderRadius: 10,
          padding: '12px 16px',
          color: 'white',
          fontSize: 14,
          fontWeight: 'bold',
          cursor: isSending ? 'not-allowed' : 'pointer'
        }
      }, '👍 Better - Save It!'),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
        React.createElement('button', {
          onClick: () => sendFeedback('neutral'),
          disabled: isSending,
          style: {
            background: 'rgba(255, 255, 255, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: 10,
            padding: '10px 12px',
            color: 'white',
            fontSize: 13,
            cursor: isSending ? 'not-allowed' : 'pointer'
          }
        }, '😐 Same'),
        React.createElement('button', {
          onClick: () => sendFeedback('negative'),
          disabled: isSending,
          style: {
            background: 'rgba(244, 67, 54, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: 10,
            padding: '10px 12px',
            color: 'white',
            fontSize: 13,
            cursor: isSending ? 'not-allowed' : 'pointer'
          }
        }, '👎 Worse')
      )
    ),
    React.createElement('button', {
      onClick: handleClose,
      style: {
        background: 'transparent',
        border: 'none',
        color: 'white',
        fontSize: 12,
        marginTop: 10,
        cursor: 'pointer',
        textDecoration: 'underline'
      }
    }, 'Dismiss')
  );
}
