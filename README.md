# @aura-adaptive/aura-ui-adaptor

[![npm version](https://img.shields.io/npm/v/@aura-adaptive/aura-ui-adaptor.svg)](https://www.npmjs.com/package/@aura-adaptive/aura-ui-adaptor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**@aura-adaptive/aura-ui-adaptor** is a powerful React component library that intelligently adapts UI presentation in real-time based on ML-driven user profiles and JSON rules. It empowers developers to build highly accessible, personalized, and adaptive web applications with minimal effort.

## ✨ Features

- 🧠 **ML-Driven Personalization:** Automatically adapts UI components using profiles from the AURA browser extension.
- 🎨 **Extensive Component Library:** Offers a wide range of adaptive primitives (Buttons, Cards, Inputs, Tables, Dialogs, etc.).
- 🛡️ **Accessibility First:** Ensures all adapted interfaces meet high accessibility standards out of the box.
- 🔌 **Seamless Integration:** Easy-to-use `AdaptiveProvider` and hooks for effortless adoption in existing React applications.
- 🪟 **Fallback Mechanism:** Built-in prediction models ensure a graceful fallback when the extension is not available.

## 📦 Installation

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

## 🚀 Quick Start

Wrap your application's root with the `AdaptiveProvider` and start using the adaptive components.

```tsx
import React from 'react';
import {
  AdaptiveProvider,
  AdaptiveButton,
  AdaptiveText,
} from '@aura-adaptive/aura-ui-adaptor';

export function App() {
  return (
    <AdaptiveProvider>
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

## 🛠️ Provider Behavior

The `AdaptiveProvider` is the core of the adaptation engine. It intelligently manages how user profiles are loaded:

1. **Extension Mode (Default):** Attempts to securely read the active profile from the AURA browser extension.
2. **Fallback Mode:** If the extension is unavailable, it gracefully falls back to a bundled prediction model and locally cached fallback data.
3. **Installation Prompt:** Can be configured to render an installation prompt for the AURA extension to enhance the user experience.

## 📚 API Reference

### Core Hooks & Providers
- `AdaptiveProvider`: The root context provider for AURA adaptation.

### UI Components
The library exports a comprehensive suite of adaptive components, designed to automatically respond to the user's AURA profile:

| Layout & Containers | Forms & Inputs | Feedback & Navigation | Typography |
|---------------------|----------------|-----------------------|------------|
| `AdaptiveCard`      | `AdaptiveInput`| `AdaptiveAlert`       | `AdaptiveText` |
| `AdaptiveGrid`      | `AdaptiveSelect`| `AdaptiveDialog`     |            |
| `AdaptiveDrawer`    | `AdaptiveSwitch`| `AdaptiveTooltip`    |            |
| `AdaptiveList`      | `AdaptiveCheckbox`| `AdaptiveMenu`     |            |
| `AdaptiveTable`     | `AdaptiveTextarea`| `AdaptiveNavbar`   |            |
| `AdaptiveDropdown`  | `AdaptiveButton`| `AdaptivePagination` |            |

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request or open an issue if you have suggestions or find bugs.

To build the project locally:

```bash
npm install
npm run build
```

## 📄 License

This project is licensed under the [MIT License](LICENSE).
