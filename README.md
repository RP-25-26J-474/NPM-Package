# @aura-adaptive/aura-ui-adaptor

[![npm version](https://img.shields.io/npm/v/@aura-adaptive/aura-ui-adaptor.svg)](https://www.npmjs.com/package/@aura-adaptive/aura-ui-adaptor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**@aura-adaptive/aura-ui-adaptor** is a powerful React component library that intelligently adapts UI presentation in real-time based on ML-driven user profiles and JSON rules. It empowers developers to build highly accessible, personalized, and adaptive web applications with minimal effort.

## Features

- **ML-Driven Personalization:** Automatically adapts UI components using profiles from the AURA browser extension.
- **Extensive Component Library:** Offers a wide range of adaptive primitives (Buttons, Cards, Inputs, Tables, Dialogs, etc.).
- **Accessibility First:** Applies adaptive design tokens for typography, spacing, contrast, motion, layout, and interaction comfort.
- **Behavior-Aware Adaptation:** Uses lightweight runtime interaction signals such as click rate, scroll speed, and interaction timing to support adaptive UI refinement.
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
    <AdaptiveProvider simulateExtensionInstalled={false}>
      <AdaptiveProfileInspector />
      <main>
        <AdaptiveText variant="h1">Welcome to AURA</AdaptiveText>
        <AdaptiveText variant="body">
          Experience a dynamically adapting user interface.
        </AdaptiveText>
        <AdaptiveButton variant="primary" onClick={() => alert('Clicked!')}>
          Get Started
        </AdaptiveButton>
      </main>
    </AdaptiveProvider>
  );
}

```

## Provider Behavior

The `AdaptiveProvider` is the core of the adaptation engine. It intelligently manages how user profiles are loaded:

1. Default extension mode tries to read the active profile from the AURA browser extension.
2. If no extension profile is available, the provider falls back to the bundled prediction model and cached fallback data.
3. Behavior signals observe non-content interaction patterns such as click rate, scroll behavior, and interaction timing to support adaptive refinement.

When the extension is unavailable, the provider can also render a configurable installation prompt.

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

### Core Hooks & Providers

- `AdaptiveProvider`: The root context provider for AURA adaptation.
- `useAdaptive`: Access the resolved profile, adaptive tokens, loading state, and reload action.
- `predictFallbackTokens`: Run the bundled fallback prediction path when extension data is unavailable.

### UI Components

| Layout & Containers | Forms & Inputs | Feedback & Navigation | Typography & Media |
|---------------------|----------------|-----------------------|--------------------|
| `AdaptiveCard`      | `AdaptiveInput` | `AdaptiveAlert`      | `AdaptiveText` |
| `AdaptiveGrid`      | `AdaptiveSelect` | `AdaptiveDialog`    | `AdaptiveImageFilter` |
| `AdaptiveDrawer`    | `AdaptiveSwitch` | `AdaptiveTooltip`   | |
| `AdaptiveList`      | `AdaptiveCheckbox` | `AdaptiveMenu`    | |
| `AdaptiveTable`     | `AdaptiveTextarea` | `AdaptiveNavbar`  | |
| `AdaptiveDropdown`  | `AdaptiveButton` | `AdaptivePagination` | |

### Adaptive Runtime Utilities

- `BehaviorTracker`
- `useRealtimeUIUpdates`
- `useSettingsSync`
- `useUserSettingsStore`
- `useTrialManager`
- `AdaptiveChangeConfirmation`
- `AdaptiveDifficultyDetector`
- `AdaptiveFeedback`
- `AdaptiveFeedbackPrompt`
- `AdaptiveRevert`
- `AdaptiveTempUserPrompt`
- `ComponentFeedbackModal`
- `DirectionalFeedbackPrompt`
- `MLFeedbackPrompt`

## Exported Components

The package exports:

- `AdaptiveProvider`
- `useAdaptive`
- `predictFallbackTokens`
- `AdaptiveAlert`
- `AdaptiveButton`
- `AdaptiveCard`
- `AdaptiveCheckbox`
- `AdaptiveDialog`
- `AdaptiveDrawer`
- `AdaptiveDropdown`
- `AdaptiveGrid`
- `AdaptiveImageFilter`
- `AdaptiveInput`
- `AdaptiveList`
- `AdaptiveMenu`
- `AdaptiveNavbar`
- `AdaptivePagination`
- `AdaptiveProfileInspector`
- `AdaptiveSelect`
- `AdaptiveSwitch`
- `AdaptiveTable`
- `AdaptiveText`
- `AdaptiveTextarea`
- `AdaptiveTooltip`

## Build

```bash
npm install
npm run build
```

## License

MIT


