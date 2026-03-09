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
  // NEW: Anomaly detection metrics
  clickCount?: number;
  misclickCount?: number;
  rageClickCount?: number;
  avgTimeToClick?: number;
  formErrorCount?: number;
  zoomEventCount?: number;
  // NEW: GDPR-compliant tracking
  mouseDistance?: number;
  mouseMovingTime?: number;
  focusCount?: number;
  blurCount?: number;
  viewportWidth?: number;
  viewportHeight?: number;
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
    // NEW: Anomaly metrics
    clickCount: 0,
    misclickCount: 0,
    rageClickCount: 0,
    avgTimeToClick: 0,
    formErrorCount: 0,
    zoomEventCount: 0,
  };

  // NEW: Track clicks for misclick/rage detection
  private clickHistory: Array<{ x: number; y: number; time: number }> = [];
  
  // NEW: Scroll analysis state
  private scrollHistory: Array<{ timestamp: number; direction: 'up' | 'down'; scrollTop: number }> = [];
  private lastScrollTop: number = 0;
  private lastThrashTime: number = 0;
  private totalScrollPx: number = 0; // cumulative absolute scroll pixels for velocity

  private lastClickTime: { x: number; y: number; time: number } | null = null;
  private clickTimes: number[] = [];

  // NEW: Mouse tracking state
  private lastMousePos: { x: number; y: number } | null = null;
  private lastMouseMoveTime: number = 0;
  private mouseMoveThrottleTimer: number | null = null;

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

    if (typeof window !== 'undefined') {
      this.metrics.viewportWidth = window.innerWidth;
      this.metrics.viewportHeight = window.innerHeight;
    }

    this.startTracking();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update the userId after construction (e.g. when a real user logs in).
   */
  public updateUserId(newUserId: string) {
    if (newUserId && newUserId !== this.config.userId) {
      this.log(`userId updated: ${this.config.userId} → ${newUserId}`);
      this.config.userId = newUserId;
    }
  }

  private log(message: string, data?: any) {
    if (this.config.debugMode) {
      //console.log(`[BehaviorTracker] ${message}`, data || '');
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

    // NEW: Track zoom events
    window.addEventListener('wheel', this.handleWheel, { passive: true });

    // NEW: Track aggregated mouse movements (GDPR compliant)
    window.addEventListener('mousemove', this.handleMouseMove, { passive: true });

    // NEW: Track input focus interactions (without values)
    document.addEventListener('focusin', this.handleFocusIn);
    document.addEventListener('focusout', this.handleFocusOut);

    // NEW: Track viewport changes
    window.addEventListener('resize', this.handleResize);

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
    this.metrics.clickCount = (this.metrics.clickCount || 0) + 1;
    this.lastInteractionTime = Date.now();

    const x = event.clientX;
    const y = event.clientY;
    const now = Date.now();
    const target = event.target as HTMLElement;

    // --- 1. Dead Click Detection ---
    const interactiveTags = ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'LABEL', 'SUMMARY', 'VIDEO', 'AUDIO'];
    // Allow clicks on anything with onClick (hard to detect, but we can check a few things)
    // or role=button.
    const isInteractive = interactiveTags.includes(target.tagName) || 
                          target.hasAttribute('onclick') || // rarely works in React
                          target.getAttribute('role') === 'button' ||
                          target.closest('a') !== null ||
                          target.closest('button') !== null ||
                          // Heuristic: Check if this element or parent has a click listener? (Impossible in standard JS)
                          // Instead, assume if correct cursor
                          false;

    if (!isInteractive) {
        // Potential dead click. Check if it looks misleading 
        const style = window.getComputedStyle(target);
        
        // If cursor is pointer but not interactive tag -> Dead Click Candidate
        // (Note: React often puts click handlers on divs with cursor:pointer)
        const looksClickable = style.cursor === 'pointer' || style.textDecorationLine === 'underline';
        
        // To avoid false positives on React divs, we only flag if:
        // No click handler fired? (We can't know).
        // Let's rely on User Frustration: 
        // Dead Click is usually repeated.
        
        // For MVP: Log it. Real app might check if DOM changes occurred after click.
        if (looksClickable) {
             this.log('⚠️ Dead Click Candidate', { tag: target.tagName });
             // Only dispatch if repeated on same element?
             // Or dispatch immediately with low confidence?
             this.dispatchAnomaly('dead_click', {
                 type: 'dead_click',
                 description: 'Potential Dead Click (Non-interactive element with pointer)',
                 targetMetadata: { tagName: target.tagName, className: target.className, text: target.innerText?.substring(0,30) }
             });
        }
    }

    // --- 2. Rage Click ---
    this.clickHistory.push({ x, y, time: now });
    this.clickHistory = this.clickHistory.filter((click) => now - click.time < 2000);

    const recentClicks = this.clickHistory.filter(
      (click) => now - click.time < 1000 && Math.abs(click.x - x) < 50 && Math.abs(click.y - y) < 50
    );

    if (recentClicks.length >= 3) {
      this.metrics.rageClickCount = (this.metrics.rageClickCount || 0) + 1;
      this.log('🔴 Rage click detected', { x, y, count: recentClicks.length });
      
      this.dispatchAnomaly('rage_click', {
          type: 'rage_click',
          description: 'Rapid clicking detected (global)',
          x, y
      });
      // Clear history nearby to prevent spamming
      this.clickHistory = this.clickHistory.filter(c => now - c.time >= 1000); 
    }

    // Track click timing for time-to-click
    this.clickTimes.push(now);
    this.clickTimes = this.clickTimes.filter((t) => now - t < 10000);

    if (this.clickTimes.length > 0) {
      const avgTime = this.clickTimes.reduce((a, b) => a + (now - b), 0) / this.clickTimes.length;
      this.metrics.avgTimeToClick = Math.round(avgTime);
    }

    // Misclick detection: click with no follow-up interaction
    this.lastClickTime = { x, y, time: now };
    setTimeout(() => {
      if (this.lastClickTime && this.lastClickTime.time === now && !this.isDestroyed) {
        // No interaction detected after click
        this.metrics.misclickCount = (this.metrics.misclickCount || 0) + 1;
        this.log('❌ Misclick detected', { x, y });
      }
    }, 500);

    this.trackEvent('click', {
      tagName: target.tagName,
      className: target.className,
      id: target.id,
    });

    this.log('Click tracked', {
      total: this.metrics.clickCount,
      misclicks: this.metrics.misclickCount,
      rageClicks: this.metrics.rageClickCount,
      target: target.tagName,
    });
  };

  /**
   * Track interaction with a specific component
   * Called by AdaptiveButton, AdaptiveText, etc.
   */
  public trackInteraction(componentId: string, type: string, metadata?: any) {
    if (this.isDestroyed) return;

    this.log(`Component interaction: ${componentId} (${type})`, metadata);

    // Track for Rage Clicks on this specific component
    const now = Date.now();
    
    // Filter history for this component
    const recentComponentClicks = this.clickHistory.filter(c => 
      now - c.time < 1000 && (c as any).componentId === componentId
    );

    // Add current click to history with componentId
    if (type === 'click') {
      // Find the last click added by handleClick (global listener) and tag it, 
      // OR push a new one if timing is slightly off. 
      // Simpler: Just rely on the global one for position, but use internal list for component rage detection?
      // Actually, let's keep a separate map for component rage clicks to be precise.
    }

    if (type === 'click' || type === 'rage_click_check') {
        const lastClick = this.clickHistory[this.clickHistory.length - 1];
        if (lastClick && now - lastClick.time < 100) {
            (lastClick as any).componentId = componentId;
        }

        // Check rage click specifically on this component
        const componentClicks = this.clickHistory.filter(c => 
            now - c.time < 1000 && (c as any).componentId === componentId
        );

        if (componentClicks.length >= 3) {
            this.metrics.rageClickCount = (this.metrics.rageClickCount || 0) + 1;
            this.log(`🔴 Rage click detected on component ${componentId}`, { count: componentClicks.length });
            
            // Dispatch anomaly event for immediate feedback
            this.dispatchAnomaly('rage_click', {
                componentId,
                type: 'rage_click',
                description: 'Rapid clicking detected',
                ...metadata
            });
        }
    }

    // Generic event tracking
    this.trackEvent('component_interaction', {
      componentId,
      type,
      ...metadata
    });
  }

  /**
   * Dispatch an anomaly event
   */
  private dispatchAnomaly(type: string, data: any) {
      this.log(`Attempting to dispatch anomaly event: ${type}`);
      if (typeof window !== 'undefined') {
          const event = new CustomEvent('aura-anomaly', {
              bubbles: true, // Allow bubbling
              detail: { type, data }
          });
          window.dispatchEvent(event);
          document.dispatchEvent(event); // Dispatch to document as well for redundancy
          this.log(`Anomaly event dispatched: ${type}`);
      }
  }

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

    // --- Scroll Thrashing Detection ---
    const now = Date.now();
    const diff = scrollTop - this.lastScrollTop;
    
    if (Math.abs(diff) > 10) { // Ignore micro-scrolls
        this.totalScrollPx += Math.abs(diff); // accumulate for velocity
        const direction = diff > 0 ? 'down' : 'up';
        
        // Add to history
        this.scrollHistory.push({ timestamp: now, direction, scrollTop });
        
        // Keep last 2 seconds
        this.scrollHistory = this.scrollHistory.filter(s => now - s.timestamp < 2000);

        // Analyze reversals
        let reversals = 0;
        let lastDir = this.scrollHistory[0]?.direction;
        
        for (let i = 1; i < this.scrollHistory.length; i++) {
            if (this.scrollHistory[i].direction !== lastDir) {
                reversals++;
                lastDir = this.scrollHistory[i].direction;
            }
        }
        
        // Up-Down-Up-Down (> 4 reversals is huge thrashing)
        if (reversals > 4) { 
             this.log('🎢 Scroll Thrashing Detected!', { reversals });
             // Debounce dispatch (5s)
             if (!this.lastThrashTime || now - this.lastThrashTime > 5000) {
                 this.dispatchAnomaly('scroll_thrashing', {
                     type: 'scroll_thrashing',
                     description: 'Erratic scrolling behavior detected',
                     reversals
                 });
                 this.lastThrashTime = now;
             }
        }
    }
    
    this.lastScrollTop = scrollTop;
  };

  private handleError = (event: ErrorEvent) => {
    if (this.isDestroyed) return;

    this.metrics.errorCount++;
    this.metrics.formErrorCount = (this.metrics.formErrorCount || 0) + 1;
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

  // NEW: Track zoom events
  private handleWheel = (event: WheelEvent) => {
    if (this.isDestroyed) return;

    if (event.ctrlKey) {
      this.metrics.zoomEventCount = (this.metrics.zoomEventCount || 0) + 1;
      this.log('🔍 Zoom event detected', {
        zoomCount: this.metrics.zoomEventCount,
      });
    }
  };

  // NEW: Track mouse movement (aggregated distance/time)
  private handleMouseMove = (event: MouseEvent) => {
    if (this.isDestroyed) return;

    const now = Date.now();
    // Throttle to avoid heavy calculation on every pixel
    if (!this.mouseMoveThrottleTimer || now - this.lastMouseMoveTime > 50) {
      if (this.lastMousePos) {
        const dx = event.clientX - this.lastMousePos.x;
        const dy = event.clientY - this.lastMousePos.y;
        this.metrics.mouseDistance = (this.metrics.mouseDistance || 0) + Math.sqrt(dx * dx + dy * dy);
        
        // If moving actively (within 500ms of last move), add to active moving time
        if (now - this.lastMouseMoveTime < 500) {
            this.metrics.mouseMovingTime = (this.metrics.mouseMovingTime || 0) + (now - this.lastMouseMoveTime);
        }
      }
      
      this.lastMousePos = { x: event.clientX, y: event.clientY };
      this.lastMouseMoveTime = now;
      this.lastInteractionTime = now;

      // Reset throttle
      if (this.mouseMoveThrottleTimer) window.clearTimeout(this.mouseMoveThrottleTimer);
      this.mouseMoveThrottleTimer = window.setTimeout(() => {
          this.mouseMoveThrottleTimer = null;
      }, 50);
    }
  };

  // NEW: Track Input interactions (accessibility and frustration signaling securely)
  private handleFocusIn = () => {
      if (this.isDestroyed) return;
      this.metrics.focusCount = (this.metrics.focusCount || 0) + 1;
      this.lastInteractionTime = Date.now();
  };

  private handleFocusOut = () => {
      if (this.isDestroyed) return;
      this.metrics.blurCount = (this.metrics.blurCount || 0) + 1;
  };

  // NEW: Track responsiveness adaptations
  private handleResize = () => {
      if (this.isDestroyed) return;
      this.metrics.viewportWidth = window.innerWidth;
      this.metrics.viewportHeight = window.innerHeight;
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
    if (!this.config.apiEndpoint) {
      this.log('No apiEndpoint configured — skipping metrics flush');
      return;
    }

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
      //console.error('[BehaviorTracker] Failed to send metrics:', error);
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
   * Get anomaly metrics for detection
   */
  public getAnomalyMetrics() {
    const sessionSec = Math.max(1, (Date.now() - this.sessionStart) / 1000);
    return {
      clickCount: this.metrics.clickCount || 0,
      misclickCount: this.metrics.misclickCount || 0,
      rageClickCount: this.metrics.rageClickCount || 0,
      avgTimeToClick: this.metrics.avgTimeToClick || 0,
      errorCount: this.metrics.errorCount || 0,
      duration: Date.now() - this.sessionStart,
      interactionCount: this.metrics.interactionCount,
      mouseDistance: this.metrics.mouseDistance || 0,
      mouseMovingTime: this.metrics.mouseMovingTime || 0,
      focusCount: this.metrics.focusCount || 0,
      blurCount: this.metrics.blurCount || 0,
      // Fields consumed by temp-user detection feature vector
      zoomEventCount: this.metrics.zoomEventCount || 0,
      scrollVelocity: Math.round(this.totalScrollPx / sessionSec), // px/s
    };
  }

  /**
   * Get recent interactions for advanced analysis
   */
  public getRecentInteractions() {
      // limited to last 50 for payload size
      return this.clickHistory.slice(-50); 
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
      window.removeEventListener('wheel', this.handleWheel); // NEW
      window.removeEventListener('mousemove', this.handleMouseMove); // NEW
      document.removeEventListener('focusin', this.handleFocusIn); // NEW
      document.removeEventListener('focusout', this.handleFocusOut); // NEW
      window.removeEventListener('resize', this.handleResize); // NEW
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
