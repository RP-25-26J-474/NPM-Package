# @aura-adaptive/aura-ui-adaptor

`@aura-adaptive/aura-ui-adaptor` is a token-first React adaptive UI runtime. It adapts UI presentation from AURA profile data and also keeps the existing optional adaptive component layer. It provides:

- `AdaptiveProvider` for loading personalization from the AURA browser extension, local mocks, or the built-in fallback model
- automatic `a-*` utility classes such as `a-card`, `a-readable`, and `a-action-primary`
- CSS variables on `:root` that update whenever the active ML profile changes
- `useAdaptive()` for access to the resolved profile, tokens, loading state, and reload action
- optional adaptive UI primitives such as buttons, text, inputs, tables, dialogs, dropdowns, cards, alerts, and more

## Installation

```bash
npm install @aura-adaptive/aura-ui-adaptor
```

This package expects `react` and `react-dom` as peer dependencies.

## Quick Start

```tsx
import React from "react";
import { AdaptiveProvider } from "@aura-adaptive/aura-ui-adaptor";

export function App() {
  return (
    <AdaptiveProvider simulateExtensionInstalled={false}>
      <main className="a-page">
        <section className="a-card a-stack">
          <h1 className="a-heading">Welcome to AURA</h1>
          <p className="a-readable">
            This UI adapts from the active AURA profile.
          </p>
          <button className="a-action-primary">Continue</button>
        </section>
      </main>
    </AdaptiveProvider>
  );
}
```

No CSS import is required. `AdaptiveProvider` injects the AURA utility classes once and updates the adaptive CSS variables whenever tokens change.

## AURA Utility Classes

The utility layer is intentionally small and AURA-specific. Classes describe adaptive UI intent rather than fixed visual values:

- `a-page`, `a-section`, `a-stack`, `a-cluster`, `a-flow`, `a-grid-adaptive`
- `a-readable`, `a-heading`, `a-subheading`, `a-caption`, `a-muted`, `a-emphasis`
- `a-surface`, `a-panel`, `a-card`, `a-divider`, `a-border-adaptive`
- `a-action-primary`, `a-action-secondary`, `a-action-quiet`, `a-control`, `a-input`
- `a-touch-target`, `a-focus-ring`, `a-alert`, `a-alert-success`, `a-alert-warning`, `a-alert-danger`
- `a-assistive`, `a-tooltip-target`, `a-interactive`

The class names remain stable. Their behavior changes through AURA CSS variables derived from the active ML profile.

Example:

```tsx
<button className="a-action-primary a-focus-ring">
  Save changes
</button>
```

When AURA updates `font_size`, `target_size`, `contrast_mode`, `reduced_motion`, or spacing values, the button updates automatically.

## CSS Variables

`AdaptiveProvider` writes variables such as:

```css
--aura-color-background
--aura-color-surface
--aura-color-text
--aura-color-primary
--aura-color-on-primary
--aura-font-size-body
--aura-font-size-heading
--aura-line-height
--aura-spacing-gap-x
--aura-spacing-gap-y
--aura-spacing-pad-x
--aura-spacing-pad-y
--aura-control-min-target-size
--aura-motion-duration
```

You can use them in your own CSS too:

```css
.checkout-summary {
  background: var(--aura-color-surface);
  color: var(--aura-color-text);
  padding: var(--aura-spacing-pad-y) var(--aura-spacing-pad-x);
  font-size: var(--aura-font-size-body);
  line-height: var(--aura-line-height);
}
```

## Provider Behavior

`AdaptiveProvider` supports these loading paths:

1. Default extension mode tries to read the active profile from the AURA browser extension.
2. If no extension profile is available, the provider falls back to the bundled prediction model and cached fallback data.

When the extension is unavailable, the provider can also render a configurable installation prompt.

## Exported Components

The package exports:

- `AdaptiveProvider`
- `useAdaptive`
- `createAdaptiveCssVariables`
- `applyAdaptiveCssVariables`
- `predictFallbackTokens`
- `AdaptiveAlert`
- `AdaptiveButton`
- `AdaptiveCard`
- `AdaptiveCheckbox`
- `AdaptiveDialog`
- `AdaptiveDrawer`
- `AdaptiveDropdown`
- `AdaptiveGrid`
- `AdaptiveInput`
- `AdaptiveList`
- `AdaptiveMenu`
- `AdaptiveNavbar`
- `AdaptivePagination`
- `AdaptiveSelect`
- `AdaptiveSwitch`
- `AdaptiveTable`
- `AdaptiveText`
- `AdaptiveTextarea`
- `AdaptiveTooltip`

## Build

```bash
npm run build
```

The published package includes only the built `dist/` output, this README, and the license file.

## License

MIT

