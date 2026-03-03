import React, { useState, useEffect } from 'react';
import { useAdaptive } from '../AdaptiveProvider';

export interface AdaptiveChangeConfirmationProps {
  /** Show as modal or banner */
  variant?: 'modal' | 'banner';
  /** Position for banner variant */
  position?: 'top' | 'bottom';
}

/**
 * AdaptiveChangeConfirmation
 * 
 * Shows proposed UI changes BEFORE applying them.
 * User can preview and approve/reject changes.
 * Learns from the decision immediately.
 */
export function AdaptiveChangeConfirmation({
  variant = 'banner',
  position = 'top',
}: AdaptiveChangeConfirmationProps) {
  const { source, sessionId, submitFeedback, reload, tokens } = useAdaptive();
  const [visible, setVisible] = useState(false);
  const [changes, setChanges] = useState<string[]>([]);
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    // Only show if we have personalized suggestions (not baseline)
    if (source !== 'user' && source !== 'category') {
      return;
    }

    // Check if there are pending changes to confirm
    const checkPendingChanges = async () => {
      // For now, show on first load if personalized
      // In production, backend would return "pendingApproval: true"
      const storageKey = `aura_changes_confirmed_${sessionId}`;
      if (typeof window !== 'undefined' && window.localStorage.getItem(storageKey)) {
        return; // Already confirmed
      }

      // Detect proposed changes from tokens
      const detectedChanges: string[] = [];
      if (tokens) {
        const baseSize = tokens.typography?.baseSize;
        const baseSizeNum = baseSize ? parseInt(baseSize) : 16;
        if (baseSizeNum > 16) {
          detectedChanges.push(`Larger text (${baseSize})`);
        } else if (baseSizeNum < 16) {
          detectedChanges.push(`Smaller text (${baseSize})`);
        }

        if (tokens.flags?.highContrast || tokens.flags?.theme === 'dark') {
          detectedChanges.push('High contrast mode');
        }

        const spacing = tokens.spacing?.gapY;
        if (spacing && spacing > 8) {
          detectedChanges.push('Wider spacing');
        }

        const targetSize = tokens.controls?.minTargetSize;
        if (targetSize && targetSize > 44) {
          detectedChanges.push(`Larger buttons (${targetSize}px)`);
        }

        if (tokens.flags?.reducedMotion === true) {
          detectedChanges.push('Reduced animations');
        }
      }

      if (detectedChanges.length > 0) {
        setChanges(detectedChanges);
        setVisible(true);
      }
    };

    checkPendingChanges();
  }, [source, sessionId, tokens]);

  const handleApprove = async () => {
    setDeciding(true);
    
    try {
      // Send positive feedback BEFORE applying
      if (submitFeedback && sessionId) {
        await submitFeedback({
          type: 'explicit',
          value: 1.0,
          comment: 'User approved changes before application',
        });
      }

      // Mark as confirmed
      if (typeof window !== 'undefined' && sessionId) {
        window.localStorage.setItem(`aura_changes_confirmed_${sessionId}`, 'approved');
      }

      // Apply changes by reloading with approved flag
      setVisible(false);
      console.log('[AURA] User approved changes, applying...');
    } catch (err) {
      console.error('[AURA] Failed to approve changes:', err);
    } finally {
      setDeciding(false);
    }
  };

  const handleReject = async () => {
    setDeciding(true);
    
    try {
      // Send negative feedback immediately
      if (submitFeedback && sessionId) {
        await submitFeedback({
          type: 'explicit',
          value: 0.0,
          comment: 'User rejected changes before application',
        });
      }

      // Mark as rejected and reload to baseline
      if (typeof window !== 'undefined' && sessionId) {
        window.localStorage.setItem(`aura_changes_confirmed_${sessionId}`, 'rejected');
      }

      setVisible(false);
      console.log('[AURA] User rejected changes, keeping baseline');
      
      // Reload to get baseline
      if (reload) {
        await reload();
      }
    } catch (err) {
      console.error('[AURA] Failed to reject changes:', err);
    } finally {
      setDeciding(false);
    }
  };

  if (!visible || !changes) {
    return null;
  }

  if (variant === 'modal') {
    return React.createElement(
      'div',
      {
        style: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        },
      },
      React.createElement(
        'div',
        {
          style: {
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '500px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          },
        },
        React.createElement(
          'h2',
          {
            style: {
              margin: '0 0 16px 0',
              fontSize: '24px',
              fontWeight: 600,
              color: '#1e293b',
            },
          },
          '🎨 Personalized UI Available'
        ),
        React.createElement(
          'p',
          {
            style: {
              margin: '0 0 20px 0',
              fontSize: '15px',
              color: '#475569',
              lineHeight: 1.6,
            },
          },
          'We have personalized UI settings based on your preferences:'
        ),
        React.createElement(
          'ul',
          {
            style: {
              margin: '0 0 24px 0',
              padding: '0 0 0 20px',
              fontSize: '14px',
              color: '#334155',
              lineHeight: 1.8,
            },
          },
          changes.map((change, idx) =>
            React.createElement('li', { key: idx }, change)
          )
        ),
        React.createElement(
          'p',
          {
            style: {
              margin: '0 0 20px 0',
              fontSize: '14px',
              color: '#64748b',
              fontStyle: 'italic',
            },
          },
          'Would you like to try these changes?'
        ),
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              gap: '12px',
            },
          },
          React.createElement(
            'button',
            {
              onClick: handleApprove,
              disabled: deciding,
              style: {
                flex: 1,
                padding: '12px 24px',
                backgroundColor: deciding ? '#94a3b8' : '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 500,
                cursor: deciding ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              },
            },
            deciding ? '⏳ Applying...' : '✓ Yes, Apply Changes'
          ),
          React.createElement(
            'button',
            {
              onClick: handleReject,
              disabled: deciding,
              style: {
                flex: 1,
                padding: '12px 24px',
                backgroundColor: deciding ? '#cbd5e1' : '#ffffff',
                color: deciding ? '#64748b' : '#475569',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 500,
                cursor: deciding ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              },
            },
            deciding ? '⏳ Processing...' : '✗ No, Keep Current'
          )
        )
      )
    );
  }

  // Banner variant
  const bannerStyle: React.CSSProperties = {
    position: 'fixed',
    ...(position === 'top' ? { top: 0 } : { bottom: 0 }),
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    color: '#ffffff',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    zIndex: 10000,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  return React.createElement(
    'div',
    { style: bannerStyle },
    React.createElement(
      'div',
      { style: { flex: 1 } },
      React.createElement(
        'strong',
        { style: { fontSize: '15px' } },
        '🎨 Personalized UI Available: '
      ),
      React.createElement(
        'span',
        { style: { fontSize: '14px', opacity: 0.9 } },
        changes.join(', ')
      )
    ),
    React.createElement(
      'div',
      { style: { display: 'flex', gap: '12px' } },
      React.createElement(
        'button',
        {
          onClick: handleApprove,
          disabled: deciding,
          style: {
            padding: '8px 20px',
            backgroundColor: deciding ? '#475569' : '#10b981',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: deciding ? 'not-allowed' : 'pointer',
          },
        },
        deciding ? '⏳ Applying...' : '✓ Apply'
      ),
      React.createElement(
        'button',
        {
          onClick: handleReject,
          disabled: deciding,
          style: {
            padding: '8px 20px',
            backgroundColor: 'transparent',
            color: '#ffffff',
            border: '1px solid #ffffff',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: deciding ? 'not-allowed' : 'pointer',
          },
        },
        deciding ? '⏳ Processing...' : '✗ Dismiss'
      )
    )
  );
}
