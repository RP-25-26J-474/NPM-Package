# @aura-adaptive/aura-ui-adaptor

`@aura-adaptive/aura-ui-adaptor` is a React component library that adapts UI presentation from AURA profile data. It provides:

- `AdaptiveProvider` for loading personalization from the AURA browser extension, local mocks, or the built-in fallback model
- `useAdaptive()` for access to the resolved profile, tokens, loading state, and reload action
- adaptive UI primitives such as buttons, text, inputs, tables, dialogs, dropdowns, cards, alerts, and more

## Installation

```bash
npm install @aura-adaptive/aura-ui-adaptor
```

This package expects `react` and `react-dom` as peer dependencies.

## Quick Start

```tsx
import React from "react";
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
        <AdaptiveButton variant="primary">Continue</AdaptiveButton>
      </main>
    </AdaptiveProvider>
  );
}
```

## Provider Behavior

`AdaptiveProvider` supports these loading paths:

1. Default extension mode tries to read the active profile from the AURA browser extension.
2. If no extension profile is available, the provider falls back to the bundled prediction model and cached fallback data.

When the extension is unavailable, the provider can also render a configurable installation prompt.

## Optional Profile Inspector

Render `<AdaptiveProfileInspector />` anywhere inside `AdaptiveProvider` to add a draggable floating AURA button. Clicking it opens a read-only inspector panel that shows:

- user/runtime state
- extension availability and login status
- extension storage profiles for personalized, adaptive, and final selection
- the live profile currently applied by `AdaptiveProvider`
- differences between the final extension profile and the applied runtime profile
- fallback/runtime details when the extension path is unavailable

This inspector is a separate module. `AdaptiveProvider` does not mount it automatically and its existing behavior is unchanged when the inspector is not rendered.

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
npm run build
```

The published package includes only the built `dist/` output, this README, and the license file.

## License

MIT
