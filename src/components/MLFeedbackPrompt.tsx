// src/components/MLFeedbackPrompt.tsx
// Feedback component that sends data to RL model for learning

import React, { useState, useEffect } from 'react';

// -- Behaviour-issue labels & setting display names ---------------------------
const ANOMALY_TITLE: Record<string, string> = {
  rage_click:    'Repeated Clicking Detected',
  dead_click:    'Interaction Difficulty Detected',
  scroll_thrash: 'Scrolling Difficulty Detected',
};

const ANOMALY_DESC: Record<string, string> = {
  rage_click:    'We noticed repeated clicking in the same area.',
  dead_click:    'An element did not seem to respond as expected.',
  scroll_thrash: 'Significant back-and-forth scrolling was detected.',
};

const SETTING_LABEL: Record<string, string> = {
  font_size:             'text size',
  line_height:           'line spacing',
  contrast_mode:         'contrast mode',
  target_size:           'button / tap target size',
  element_spacing_x:     'horizontal spacing',
  element_spacing_y:     'vertical spacing',
  element_padding_x:     'element padding',
  element_padding_y:     'element padding',
  reduced_motion:        'animation settings',
  tooltip_assist:        'tooltip hints',
  layout_simplification: 'layout complexity',
  theme:                 'colour theme',
  primary_color:         'primary colour',
};

const settingLabel = (key: string) => SETTING_LABEL[key] ?? key.replace(/_/g, ' ');

// -- Component ----------------------------------------------------------------
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
  /** When present the prompt was triggered by a detected behaviour anomaly. */
  anomalyContext?: { type: string; componentId?: string };
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
  position = 'bottom-right',
  anomalyContext,
}: MLFeedbackPromptProps): React.ReactElement | null {
  const [isVisible, setIsVisible] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Auto-dismiss after 20 seconds
  useEffect(() => {
    const timer = setTimeout(() => { handleClose(); }, 20000);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => { onClose?.(); }, 300);
  };

  const sendFeedback = async (feedback: 'positive' | 'neutral' | 'negative') => {
    setIsSending(true);
    try {
      await fetch(`${apiEndpoint}/users/${userId}/feedback`, {
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
            accepted: feedback !== 'negative',
          },
          context: {
            source,
            deviceType: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
          },
          state: {},
        }),
      });
    } catch (error) {
      console.error('[AURA] Error sending feedback:', error);
    } finally {
      if (onFeedback) {
        onFeedback(feedback);
      } else {
        setTimeout(() => handleClose(), 500);
      }
    }
  };

  if (!isVisible) return null;

  const positionStyles: Record<string, React.CSSProperties> = {
    'bottom-right': { bottom: 24, right: 24 },
    'bottom-left':  { bottom: 24, left: 24 },
    'top-right':    { top: 24, right: 24 },
    'top-left':     { top: 24, left: 24 },
  };

  const formatValue = (key: string, val: any): string => {
    if (key === 'theme') return val;
    if (key === 'font_size' || key === 'fontSize') return `${val}px`;
    if (key === 'target_size' || key === 'targetSize') return `${val}px`;
    if (key.includes('color') || key.includes('Color')) return val;
    return String(val);
  };

  const title = anomalyContext
    ? (ANOMALY_TITLE[anomalyContext.type] ?? 'Interface Issue Detected')
    : `Personalisation Update (${(mlConfidence * 100).toFixed(0)}% confidence)`;

  const description = anomalyContext
    ? `${ANOMALY_DESC[anomalyContext.type] ?? 'Something seemed off.'} Your ${settingLabel(settingKey)} was recently adjusted — is it working well for you?`
    : `${settingLabel(settingKey)} changed from ${formatValue(settingKey, oldValue)} to ${formatValue(settingKey, newValue)}.`;

  const btnBase: React.CSSProperties = {
    border: 'none',
    borderRadius: 6,
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: isSending ? 'not-allowed' : 'pointer',
    opacity: isSending ? 0.6 : 1,
    transition: 'opacity 0.15s',
    letterSpacing: '0.01em',
  };

  return React.createElement('div', {
    role: 'dialog',
    'aria-label': 'UI feedback',
    style: {
      position: 'fixed',
      ...positionStyles[position],
      zIndex: 9999,
      width: 340,
      backgroundColor: '#ffffff',
      borderRadius: 10,
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08)',
      border: '1px solid #e5e7eb',
      padding: '20px 20px 16px',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      color: '#111827',
    },
  },

    // Header row
    React.createElement('div', {
      style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
    },
      React.createElement('div', null,
        // Category badge
        React.createElement('span', {
          style: {
            display: 'inline-block',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#6b7280',
            marginBottom: 4,
          },
        }, anomalyContext ? 'Behaviour Alert' : 'Adaptive UI'),

        // Title
        React.createElement('p', {
          style: { margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: '#111827' },
        }, title),
      ),

      // Dismiss (x) button
      React.createElement('button', {
        onClick: handleClose,
        'aria-label': 'Dismiss',
        style: {
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 2,
          color: '#9ca3af',
          fontSize: 18,
          lineHeight: 1,
          marginTop: -2,
        },
      }, '\u00D7'),
    ),

    // Description
    React.createElement('p', {
      style: { margin: '0 0 16px', fontSize: 13, color: '#4b5563', lineHeight: 1.5 },
    }, description),

    // Divider
    React.createElement('div', {
      style: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 14 },
    }),

    // Action buttons
    React.createElement('div', {
      style: { display: 'flex', gap: 8 },
    },
      React.createElement('button', {
        onClick: () => sendFeedback('positive'),
        disabled: isSending,
        style: { ...btnBase, flex: 1, backgroundColor: '#111827', color: '#ffffff' },
      }, 'Working well'),

      React.createElement('button', {
        onClick: () => sendFeedback('neutral'),
        disabled: isSending,
        style: { ...btnBase, flex: 1, backgroundColor: '#f3f4f6', color: '#374151' },
      }, 'No change'),

      React.createElement('button', {
        onClick: () => sendFeedback('negative'),
        disabled: isSending,
        style: { ...btnBase, flex: 1, backgroundColor: '#fee2e2', color: '#b91c1c' },
      }, 'Revert'),
    ),
  );
}