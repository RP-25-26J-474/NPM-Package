// src/BehaviorTracker.ts
/**
 * BehaviorTracker - Silently tracks user behavior WITHOUT prompts
 * 
 * Tracks:
 * - Time on page
 * - Interaction count (clicks, inputs)
 * - Error count
 * - Scroll depth
 * - Task completion
 * - Immediate reversion (critical signal!)
 * 
 * Sends data to YOUR backend every 5 minutes or on page close.
 * NO USER PROMPTS - Just observing behavior silently.
 */

export interface BehaviorMetrics {
  duration: number;
  interactionCount: number;
  errorCount: number;
  scrollDepth: number;
  tasksCompleted: number;
  immediateReversion: boolean;
  settingChanges: Array<{
    timestamp: number;
    setting: string;
    oldValue: any;
    newValue: any;
  }>;
  events: Array<{
    timestamp: number;
    type: string;
    data?: any;
  }>;
}

export interface BehaviorTrackerConfig {
  userId: string;
  uiVariant: string;
  apiEndpoint: string;
  sendInterval?: number;
  debugMode?: boolean;
  clientDomain?: string; // For multi-tenant tracking
  personalizationSessionId?: string; // Session from personalization service
}

type BehaviorTrackerResolvedConfig = {
  userId: string;
  uiVariant: string;
  apiEndpoint: string;
  sendInterval: number;
  debugMode: boolean;
  clientDomain: string;
  personalizationSessionId?: string;
};

export class BehaviorTracker {
  private config: BehaviorTrackerResolvedConfig;
  private sessionId: string;
  private sessionStart: number;
  private lastInteractionTime: number;

  private metrics: BehaviorMetrics = {
    duration: 0,
    interactionCount: 0,
    errorCount: 0,
    scrollDepth: 0,
    tasksCompleted: 0,
    immediateReversion: false,
    settingChanges: [],
    events: [],
  };

  private flushTimer: number | null = null;
  private isDestroyed: boolean = false;

  constructor(config: BehaviorTrackerConfig) {
    this.config = {
      userId: config.userId,
      uiVariant: config.uiVariant,
      apiEndpoint: config.apiEndpoint,
      sendInterval: config.sendInterval || 300000, // 5 minutes
      debugMode: config.debugMode || false,
      clientDomain: config.clientDomain || (typeof window !== 'undefined' ? window.location.hostname : 'unknown'),
      personalizationSessionId: config.personalizationSessionId,
    };

    this.sessionId = this.generateSessionId();
    this.sessionStart = Date.now();
    this.lastInteractionTime = this.sessionStart;

    this.log('BehaviorTracker initialized', {
      sessionId: this.sessionId,
      userId: this.config.userId,
      variant: this.config.uiVariant,
    });

    this.startTracking();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private log(message: string, data?: any) {
    if (this.config.debugMode) {
      console.log(`[BehaviorTracker] ${message}`, data || '');
    }
  }

  private startTracking() {
    if (typeof window === 'undefined') {
      this.log('Not in browser environment, skipping tracking');
      return;
    }

    // Track clicks
    window.addEventListener('click', this.handleClick);

    // Track keyboard interactions
    window.addEventListener('keydown', this.handleKeydown);

    // Track scroll
    window.addEventListener('scroll', this.handleScroll, { passive: true });

    // Track errors
    window.addEventListener('error', this.handleError);

    // Track page visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Send data before page unload
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    // Periodic flush
    this.flushTimer = window.setInterval(() => {
      this.flushMetrics();
    }, this.config.sendInterval);

    this.log('Event listeners attached');
  }

  private handleClick = (event: MouseEvent) => {
    if (this.isDestroyed) return;

    this.metrics.interactionCount++;
    this.lastInteractionTime = Date.now();

    const target = event.target as HTMLElement;
    this.trackEvent('click', {
      tagName: target.tagName,
      className: target.className,
      id: target.id,
    });

    this.log('Click tracked', {
      total: this.metrics.interactionCount,
      target: target.tagName,
    });
  };

  private handleKeydown = (event: KeyboardEvent) => {
    if (this.isDestroyed) return;

    // Only count meaningful interactions (not just navigation)
    if (!['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
      this.metrics.interactionCount++;
      this.lastInteractionTime = Date.now();
    }
  };

  private handleScroll = () => {
    if (this.isDestroyed) return;

    // Calculate scroll depth (0 to 1)
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const depth = (scrollTop + windowHeight) / documentHeight;

    this.metrics.scrollDepth = Math.max(this.metrics.scrollDepth, depth);

    this.log('Scroll depth updated', {
      depth: Math.round(depth * 100) + '%',
    });
  };

  private handleError = (event: ErrorEvent) => {
    if (this.isDestroyed) return;

    this.metrics.errorCount++;
    this.trackEvent('error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
    });

    this.log('Error tracked', {
      total: this.metrics.errorCount,
      message: event.message,
    });
  };

  private handleVisibilityChange = () => {
    if (this.isDestroyed) return;

    if (document.hidden) {
      this.log('Page hidden, flushing metrics');
      this.flushMetrics();
    }
  };

  private handleBeforeUnload = () => {
    if (this.isDestroyed) return;

    this.log('Page unloading, final flush');
    this.flushMetrics(true); // Synchronous send
  };

  /**
   * Track when a UI setting changes
   * CRITICAL: Detects if user immediately reverts (negative signal!)
   */
  public trackSettingChange(setting: string, oldValue: any, newValue: any) {
    if (this.isDestroyed) return;

    const change = {
      timestamp: Date.now(),
      setting,
      oldValue,
      newValue,
    };

    this.metrics.settingChanges.push(change);

    // Check for immediate reversion (within 10 seconds of session start)
    const timeSinceStart = Date.now() - this.sessionStart;
    if (timeSinceStart < 10000 && setting === 'uiVariant' && newValue === 'baseline') {
      this.metrics.immediateReversion = true;
      this.log('⚠️ IMMEDIATE REVERSION DETECTED - User rejected personalization!');
    }

    this.log('Setting change tracked', change);
  }

  /**
   * Track custom events (task completion, form submission, etc.)
   */
  public trackEvent(type: string, data?: any) {
    if (this.isDestroyed) return;

    this.metrics.events.push({
      timestamp: Date.now(),
      type,
      data,
    });

    // Auto-detect task completion
    if (type === 'task_completed' || type === 'form_submitted') {
      this.metrics.tasksCompleted++;
      this.log('Task completed', { total: this.metrics.tasksCompleted });
    }
  }

  /**
   * Track when user explicitly reverts to baseline
   */
  public trackRevert() {
    if (this.isDestroyed) return;

    const timeSinceStart = Date.now() - this.sessionStart;

    if (timeSinceStart < 10000) {
      // Immediate revert - strong negative signal
      this.metrics.immediateReversion = true;
      this.log('⚠️ IMMEDIATE REVERT - Very negative signal!');
    } else {
      // Later revert - still negative but less severe
      this.trackEvent('delayed_revert', { timeSinceStart });
      this.log('⚠️ Delayed revert tracked', { timeSinceStart });
    }

    this.trackSettingChange('uiVariant', this.config.uiVariant, 'baseline');
    this.flushMetrics(); // Send immediately
  }

  /**
   * Send behavior data to backend
   */
  public async flushMetrics(synchronous: boolean = false) {
    if (this.isDestroyed) return;

    // Update duration
    this.metrics.duration = Date.now() - this.sessionStart;

    const payload = {
      sessionId: this.sessionId,
      userId: this.config.userId,
      clientDomain: this.config.clientDomain,
      uiVariant: this.config.uiVariant,
      personalizationSessionId: this.config.personalizationSessionId,
      metrics: { ...this.metrics },
      timestamp: new Date().toISOString(),
    };

    this.log('Flushing metrics', payload);

    try {
      if (synchronous && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        // Use sendBeacon for synchronous send on page unload
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(`${this.config.apiEndpoint}/behavior`, blob);
        this.log('Metrics sent via sendBeacon');
      } else {
        // Normal async send
        const response = await fetch(`${this.config.apiEndpoint}/behavior`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        this.log('Metrics sent successfully');
      }
    } catch (error) {
      console.error('[BehaviorTracker] Failed to send metrics:', error);
    }
  }

  /**
   * Get current session metrics (for debugging)
   */
  public getMetrics(): BehaviorMetrics {
    return {
      ...this.metrics,
      duration: Date.now() - this.sessionStart,
    };
  }

  /**
   * Clean up event listeners
   */
  public destroy() {
    if (this.isDestroyed) return;

    this.log('Destroying tracker, final flush');
    this.flushMetrics(true);

    if (typeof window !== 'undefined') {
      window.removeEventListener('click', this.handleClick);
      window.removeEventListener('keydown', this.handleKeydown);
      window.removeEventListener('scroll', this.handleScroll);
      window.removeEventListener('error', this.handleError);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }

    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    this.isDestroyed = true;
    this.log('Tracker destroyed');
  }
}
