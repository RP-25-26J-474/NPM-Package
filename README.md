# @aura-adaptive/aura-ui-adaptor

[![npm version](https://img.shields.io/npm/v/@aura-adaptive/aura-ui-adaptor.svg)](https://www.npmjs.com/package/@aura-adaptive/aura-ui-adaptor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**@aura-adaptive/aura-ui-adaptor** is a token-first React adaptive UI runtime and component library. It adapts UI presentation in real time from AURA profile data, exposes token-driven CSS variables and `a-*` utility classes, and keeps the optional adaptive component layer for teams that want ready-made primitives.

## Features

- **ML-Driven Personalization:** Automatically adapts UI components using profiles from the AURA browser extension.
- **Extensive Component Library:** Offers a wide range of adaptive primitives (Buttons, Cards, Inputs, Tables, Dialogs, etc.).
- **Accessibility First:** Applies adaptive design tokens for typography, spacing, contrast, motion, layout, and interaction comfort.
- **Behavior-Aware Adaptation:** Uses lightweight runtime interaction signals such as click rate, scroll speed, and interaction timing to support adaptive UI refinement.
- **Token-Driven Utility Classes:** Injects optional `a-*` utility classes such as `a-card`, `a-readable`, and `a-action-primary`.
- **Adaptive CSS Variables:** Updates `:root` variables whenever the active ML profile changes.
- **Seamless Integration:** Easy-to-use `AdaptiveProvider` and hooks for effortless adoption in existing React applications.
- **Fallback Mechanism:** Built-in prediction models ensure a graceful fallback when the extension is not available.

## Installation

Install the package via npm:

```bash
npm install @aura-adaptive/aura-ui-adaptor
```

Or using yarn:

```bash
yarn add @aura-adaptive/aura-ui-adaptor
```
Or using pnpm:

```bash
pnpm add @aura-adaptive/aura-ui-adaptor
```

> **Note:** This package requires `react` and `react-dom` (v18 or v19) as peer dependencies.

## Quick Start

Wrap your application's root with the `AdaptiveProvider` and start using the adaptive components.

```tsx
import React from 'react';
import {
  AdaptiveProvider,
  AdaptiveButton,
  AdaptiveText,
  AdaptiveProfileInspector,
} from "@aura-adaptive/aura-ui-adaptor";

export function App() {
  return (
    <AdaptiveProvider>
      <main className="a-page">
        <section className="a-card a-stack">
        <AdaptiveText variant="h1">Welcome to AURA</AdaptiveText>
        <AdaptiveText variant="body">
          Experience a dynamically adapting user interface.
        </AdaptiveText>
        <AdaptiveButton variant="primary" onClick={() => alert('Clicked!')}>
          Get Started
        </AdaptiveButton>
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

## WCAG 1.4.4 Resize Text Support

AURA typography tokens are relative to `rem` and include `--aura-text-scale`, so text responds to browser font settings and can be scaled up to 200% without assistive technology. The package exports small helpers for building text-size controls:

```tsx
import {
  decreaseAuraTextScale,
  increaseAuraTextScale,
  setAuraTextScale,
} from "@aura-adaptive/aura-ui-adaptor";

setAuraTextScale(2);          // 200%
increaseAuraTextScale(0.1);   // +10%
decreaseAuraTextScale(0.1);   // -10%, clamped at 100%
```

The utility classes and adaptive button/text primitives allow wrapping by default to reduce clipping at larger text sizes. Avoid using `truncate`, `maxLines`, fixed-height text containers, or non-wrapping custom CSS for content that must remain fully available at 200%.

## CSS Variables

`AdaptiveProvider` writes variables such as:

```css
--aura-text-scale
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

## Privacy-Conscious Runtime Signals

`@aura-adaptive/aura-ui-adaptor` includes lightweight behavior-signal monitoring as part of its adaptive runtime, such as click patterns, scroll activity, interaction timing, viewport changes, and adaptation-related events. These signals are used to improve interface personalization and adaptation quality, not to capture private user content. The package is designed to avoid collecting passwords, form input values, or raw user-entered text. Developers should ensure that their application-level privacy notice accurately reflects the use of adaptive interaction signals where required.

## Optional Profile Inspector

Render `<AdaptiveProfileInspector />` anywhere inside `AdaptiveProvider` to add a draggable floating AURA button. Clicking it opens a read-only inspector panel that shows:

- user/runtime state
- extension availability and login status
- extension storage profiles for personalized, adaptive, and final selection
- the live profile currently applied by `AdaptiveProvider`
- differences between the final extension profile and the applied runtime profile
- fallback/runtime details when the extension path is unavailable

This inspector is a separate module. `AdaptiveProvider` does not mount it automatically and its existing behavior is unchanged when the inspector is not rendered.

## API Reference

### UI Components

| Layout & Containers | Forms & Inputs | Feedback & Navigation | Typography & Media |
|---------------------|----------------|-----------------------|--------------------|
| `AdaptiveCard`      | `AdaptiveInput` | `AdaptiveAlert`      | `AdaptiveText` |
| `AdaptiveGrid`      | `AdaptiveSelect` | `AdaptiveDialog`    | `AdaptiveImageFilter` |
| `AdaptiveDrawer`    | `AdaptiveSwitch` | `AdaptiveTooltip`   | |
| `AdaptiveList`      | `AdaptiveCheckbox` | `AdaptiveMenu`    | |
| `AdaptiveTable`     | `AdaptiveTextarea` | `AdaptiveNavbar`  | |
| `AdaptiveDropdown`  | `AdaptiveButton` | `AdaptivePagination` | |


## Contributing

We welcome contributions! Please feel free to submit a Pull Request or open an issue if you have suggestions or find bugs.

To build the project locally:

```bash
npm install
npm run build
```

## License

MIT
