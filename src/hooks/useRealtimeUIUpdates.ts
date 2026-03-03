import { useEffect } from 'react';
import { useAdaptive } from '../AdaptiveProvider';

/**
 * Hook to apply UI tokens to document root in realtime
 * Updates CSS variables whenever tokens change
 */
export function useRealtimeUIUpdates() {
  const { tokens, loading } = useAdaptive();

  useEffect(() => {
    if (loading || typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;

    // Apply typography
    root.style.setProperty('--aura-font-size-base', tokens.typography.baseSize);
    root.style.setProperty('--aura-line-height', String(tokens.typography.lineHeight));
    root.style.setProperty('--aura-font-h1', tokens.typography.h1);
    root.style.setProperty('--aura-font-h2', tokens.typography.h2);
    root.style.setProperty('--aura-font-h3', tokens.typography.h3);
    root.style.setProperty('--aura-font-body', tokens.typography.body);

    // Apply colors
    root.style.setProperty('--aura-color-primary', tokens.colors.primary);
    root.style.setProperty('--aura-color-secondary', tokens.colors.secondary);
    root.style.setProperty('--aura-color-accent', tokens.colors.accent);
    root.style.setProperty('--aura-color-background', tokens.colors.background);
    root.style.setProperty('--aura-color-text', tokens.colors.text);
    root.style.setProperty('--aura-color-border', tokens.colors.border);

    // Apply spacing
    root.style.setProperty('--aura-spacing-base', `${tokens.spacing.gapY}px`);
    root.style.setProperty('--aura-spacing-gap', `${tokens.spacing.gapX}px`);
    root.style.setProperty('--aura-spacing-padding', `${tokens.spacing.pagePaddingX}px`);

    // Apply controls
    root.style.setProperty('--aura-target-size', `${tokens.controls.minTargetSize}px`);

    // Apply theme class
    root.classList.remove('aura-theme-light', 'aura-theme-dark');
    root.classList.add(`aura-theme-${tokens.flags.theme}`);

    // Apply reduced motion
    if (tokens.flags.reducedMotion) {
      root.classList.add('aura-reduced-motion');
    } else {
      root.classList.remove('aura-reduced-motion');
    }

    console.log('[AURA] 🎨 UI tokens applied in realtime:', tokens);
    console.log('[AURA] 📐 CSS Variables set:');
    console.log('  --aura-font-size-base:', tokens.typography.baseSize);
    console.log('  --aura-color-primary:', tokens.colors.primary);
    console.log('  --aura-color-background:', tokens.colors.background);
    console.log('  --aura-color-text:', tokens.colors.text);
    console.log('  Theme class:', `aura-theme-${tokens.flags.theme}`);

  }, [tokens, loading]);
}
