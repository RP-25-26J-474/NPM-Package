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
} from "@aura-adaptive/aura-ui-adaptor";

export function App() {
  return (
    <AdaptiveProvider simulateExtensionInstalled>
      <main>
        <AdaptiveText variant="h1">Welcome to AURA</AdaptiveText>
        <AdaptiveButton variant="primary">Continue</AdaptiveButton>
      </main>
    </AdaptiveProvider>
  );
}
```

## Using the Hook

```tsx
import React from "react";
import { AdaptiveProvider, useAdaptive } from "@aura-adaptive/aura-ui-adaptor";

function ProfileSummary() {
  const { loading, source, tokens, profile, reload } = useAdaptive();

  if (loading) return <p>Loading personalization...</p>;

  return (
    <section>
      <p>Source: {source}</p>
      <p>Theme: {tokens.flags.theme}</p>
      <p>Base font size: {tokens.typography.baseSize}</p>
      <p>Reduced motion: {String(profile?.reduced_motion)}</p>
      <button onClick={() => void reload()}>Reload profile</button>
    </section>
  );
}

export function App() {
  return (
    <AdaptiveProvider>
      <ProfileSummary />
    </AdaptiveProvider>
  );
}
```

## Provider Behavior

`AdaptiveProvider` supports three loading paths:

1. `simulateExtensionInstalled={true}` uses local mock data for development.
2. Default extension mode tries to read the active profile from the AURA browser extension.
3. If no extension profile is available, the provider falls back to the bundled prediction model and cached fallback data.

When the extension is unavailable, the provider can also render a configurable installation prompt.

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
- `AdaptiveSelect`
- `AdaptiveSwitch`
- `AdaptiveTable`
- `AdaptiveText`
- `AdaptiveTextarea`
- `AdaptiveTooltip`

It also exports the `AuraProfileV2`, `AuraMlEnvelopeV2`, `AuraTokens`, and `AdaptiveContextValue` TypeScript types.

## Build

```bash
npm run build
```

The published package includes only the built `dist/` output, this README, and the license file.

## License

MIT
