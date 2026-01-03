// src/components/AdaptiveDifficultyDetector.tsx
/**
 * Automatic Difficulty Detection with Browser Console Logging
 * 
 * Monitors user behavior and shows detailed logs in browser console
 */

import React, { useEffect, useState, useRef } from 'react';

export interface DifficultyIssue {
  type: 'rage_clicks' | 'misclicks' | 'errors' | 'slow_interaction';
  severity: 'low' | 'medium' | 'high';
  description: string;
  metrics: Record<string, any>;
}

export interface AdaptiveDifficultyDetectorProps {
  userId: string;
  apiEndpoint: string;
  enabled?: boolean;
  checkInterval?: number;
  onIssueDetected?: (issue: DifficultyIssue) => void;
}

export function AdaptiveDifficultyDetector(props: AdaptiveDifficultyDetectorProps) {
  const { userId, apiEndpoint, enabled = true, checkInterval = 10000, onIssueDetected } = props;
  
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentIssue, setCurrentIssue] = useState<DifficultyIssue | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const checkTimerRef = useRef<number | null>(null);
  const lastCheckRef = useRef<number>(Date.now());
  const logTimerRef = useRef<number | null>(null);
  
  const metricsRef = useRef({
    rageClickCount: 0,
    misclickCount: 0,
    errorCount: 0,
    clickCount: 0,
    avgTimeToClick: 0,
    clickHistory: [] as Array<{ x: number; y: number; time: number }>,
    lastClickTime: null as { x: number; y: number; time: number } | null,
    clickTimes: [] as number[]
  });

  // Periodic metric logging
  useEffect(() => {
    if (!enabled) return;

    const logMetrics = () => {
      const m = metricsRef.current;
      const duration = Date.now() - lastCheckRef.current;
      
      console.log('%c📊 Behavior Metrics', 'color: #2196F3; font-weight: bold', {
        clicks: m.clickCount,
        rageClicks: m.rageClickCount,
        misclicks: m.misclickCount,
        errors: m.errorCount,
        avgClickTime: m.avgTimeToClick ? `${Math.round(m.avgTimeToClick)}ms` : 'N/A',
        duration: `${Math.round(duration / 1000)}s`,
        misclickRate: m.clickCount > 0 ? `${Math.round((m.misclickCount / m.clickCount) * 100)}%` : 'N/A'
      });
    };

    logTimerRef.current = window.setInterval(logMetrics, 5000);
    return () => {
      if (logTimerRef.current) window.clearInterval(logTimerRef.current);
    };
  }, [enabled]);

  // Click tracking
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleClick = (event: MouseEvent) => {
      const m = metricsRef.current;
      const now = Date.now();
      const x = event.clientX;
      const y = event.clientY;

      m.clickCount++;
      m.clickHistory.push({ x, y, time: now });
      m.clickHistory = m.clickHistory.filter(c => now - c.time < 2000);

      // Rage click
      const recent = m.clickHistory.filter(
        c => now - c.time < 1000 && Math.abs(c.x - x) < 50 && Math.abs(c.y - y) < 50
      );

      if (recent.length >= 3) {
        m.rageClickCount++;
        console.warn('%c🔴 RAGE CLICK', 'color: #ff6b6b; font-weight: bold', {
          count: recent.length,
          position: { x, y },
          total: m.rageClickCount
        });
      }

      // Click timing
      m.clickTimes.push(now);
      m.clickTimes = m.clickTimes.filter(t => now - t < 10000);

      if (m.clickTimes.length > 1) {
        const avg = m.clickTimes.reduce((sum, t, i, arr) => {
          if (i === 0) return 0;
          return sum + (arr[i] - arr[i - 1]);
        }, 0) / (m.clickTimes.length - 1);
        m.avgTimeToClick = avg;
      }

      // Misclick detection
      m.lastClickTime = { x, y, time: now };
      setTimeout(() => {
        if (m.lastClickTime && m.lastClickTime.time === now) {
          m.misclickCount++;
          const rate = m.clickCount > 0 ? (m.misclickCount / m.clickCount) * 100 : 0;
          console.warn('%c❌ MISCLICK', 'color: #ff9800; font-weight: bold', {
            position: { x, y },
            total: m.misclickCount,
            rate: `${Math.round(rate)}%`
          });
        }
      }, 500);
    };

    const handleError = (event: ErrorEvent) => {
      metricsRef.current.errorCount++;
      console.error('%c⚠️ ERROR', 'color: #f44336; font-weight: bold', {
        message: event.message,
        file: event.filename,
        line: event.lineno,
        total: metricsRef.current.errorCount
      });
    };

    window.addEventListener('click', handleClick);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('error', handleError);
    };
  }, [enabled]);

  // Difficulty checking
  useEffect(() => {
    if (!enabled) return;

    const checkDifficulties = () => {
      const m = metricsRef.current;
      const elapsed = Date.now() - lastCheckRef.current;
      
      if (elapsed < checkInterval || m.clickCount < 3) return;

      let issue: DifficultyIssue | null = null;

      if (m.rageClickCount >= 2) {
        issue = {
          type: 'rage_clicks',
          severity: 'high',
          description: 'Multiple rage clicks - user frustrated',
          metrics: { rageClickCount: m.rageClickCount }
        };
      } else if (m.misclickCount >= 5 && m.clickCount > 0 && m.misclickCount / m.clickCount > 0.3) {
        issue = {
          type: 'misclicks',
          severity: 'medium',
          description: 'High misclick rate - targets too small',
          metrics: { misclickCount: m.misclickCount }
        };
      } else if (m.errorCount >= 2) {
        issue = {
          type: 'errors',
          severity: 'high',
          description: 'Multiple errors detected',
          metrics: { errorCount: m.errorCount }
        };
      } else if (m.avgTimeToClick > 5000 && m.clickCount >= 5) {
        issue = {
          type: 'slow_interaction',
          severity: 'low',
          description: 'Slow interactions - visibility issue',
          metrics: { avgTimeToClick: m.avgTimeToClick }
        };
      }

      if (issue) {
        console.error('%c🚨 DIFFICULTY DETECTED', 'color: #f44336; font-weight: bold; font-size: 16px', {
          type: issue.type,
          severity: issue.severity,
          description: issue.description,
          metrics: issue.metrics
        });
        
        setCurrentIssue(issue);
        setShowFeedback(true);
        onIssueDetected?.(issue);

        metricsRef.current = {
          rageClickCount: 0,
          misclickCount: 0,
          errorCount: 0,
          clickCount: 0,
          avgTimeToClick: 0,
          clickHistory: [],
          lastClickTime: null,
          clickTimes: []
        };
        lastCheckRef.current = Date.now();
      }
    };

    checkTimerRef.current = window.setInterval(checkDifficulties, checkInterval);
    return () => {
      if (checkTimerRef.current) window.clearInterval(checkTimerRef.current);
    };
  }, [enabled, checkInterval, onIssueDetected]);

  const handleFeedback = async (feedback: 'good' | 'bad' | 'neutral') => {
    if (!currentIssue) return;

    setIsAnalyzing(true);
    setShowFeedback(false);

    try {
      console.log('%c📤 FEEDBACK SUBMITTED', 'color: #4caf50; font-weight: bold', {
        response: feedback,
        issue: currentIssue.type,
        action: feedback === 'bad' ? 'Optimizing...' : 'Recording...'
      });

      const response = await fetch(`${apiEndpoint}/behavior-rl/analyze-and-optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          lookbackMinutes: 5,
          issueDetected: currentIssue,
          userFeedback: feedback
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('%c✅ RL OPTIMIZATION COMPLETE', 'color: #4caf50; font-weight: bold; font-size: 16px', {
          applied: data.appliedSettings,
          suggestions: data.optimizationSuggestions,
          message: data.message
        });
      }
    } catch (error) {
      console.error('Feedback error:', error);
    } finally {
      setIsAnalyzing(false);
      setCurrentIssue(null);
    }
  };

  if (!enabled || !showFeedback || !currentIssue) return null;

  return React.createElement('div', {
    style: {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'white',
      border: '2px solid #ff6b6b',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      zIndex: 99999,
      maxWidth: '420px',
      width: 'calc(100% - 40px)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      animation: 'slideUpFadeIn 0.3s ease-out'
    }
  },
    React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }
    },
      React.createElement('span', { style: { fontSize: '24px' } }, 
        currentIssue.severity === 'high' ? '🚨' : currentIssue.severity === 'medium' ? '⚠️' : 'ℹ️'
      ),
      React.createElement('strong', { style: { fontSize: '16px', color: '#333' } }, 'Having trouble?')
    ),

    React.createElement('p', {
      style: { fontSize: '14px', color: '#666', margin: '0 0 16px 0', lineHeight: '1.5' }
    }, currentIssue.description),

    React.createElement('p', {
      style: { fontSize: '14px', color: '#333', margin: '0 0 12px 0', fontWeight: '500' }
    }, 'Are you experiencing difficulty?'),

    React.createElement('div', { style: { display: 'flex', gap: '8px', marginBottom: '8px' } },
      React.createElement('button', {
        onClick: () => handleFeedback('bad'),
        disabled: isAnalyzing,
        style: {
          flex: 1,
          padding: '10px',
          border: 'none',
          borderRadius: '6px',
          backgroundColor: '#ff6b6b',
          color: 'white',
          fontSize: '14px',
          cursor: isAnalyzing ? 'wait' : 'pointer',
          fontWeight: '500'
        }
      }, '😞 Yes'),

      React.createElement('button', {
        onClick: () => handleFeedback('neutral'),
        disabled: isAnalyzing,
        style: {
          flex: 1,
          padding: '10px',
          border: '1px solid #ddd',
          borderRadius: '6px',
          backgroundColor: 'white',
          color: '#666',
          fontSize: '14px',
          cursor: isAnalyzing ? 'wait' : 'pointer'
        }
      }, '😐 Okay'),

      React.createElement('button', {
        onClick: () => handleFeedback('good'),
        disabled: isAnalyzing,
        style: {
          flex: 1,
          padding: '10px',
          border: 'none',
          borderRadius: '6px',
          backgroundColor: '#51cf66',
          color: 'white',
          fontSize: '14px',
          cursor: isAnalyzing ? 'wait' : 'pointer',
          fontWeight: '500'
        }
      }, '😊 No')
    ),

    React.createElement('button', {
      onClick: () => { setShowFeedback(false); setCurrentIssue(null); },
      style: {
        width: '100%',
        padding: '8px',
        border: 'none',
        background: 'none',
        color: '#999',
        fontSize: '12px',
        cursor: 'pointer',
        textDecoration: 'underline'
      }
    }, 'Dismiss')
  );
}
