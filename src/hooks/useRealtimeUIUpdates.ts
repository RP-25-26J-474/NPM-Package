import { useEffect } from 'react';
import { useAdaptive } from '../AdaptiveProvider';
import { createAdaptiveCssVariables } from '../adaptiveCssVariables';

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

    const variables = createAdaptiveCssVariables(tokens);
    Object.entries(variables).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });

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
