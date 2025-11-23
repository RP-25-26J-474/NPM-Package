# Aura UI Personalizer

A React provider for applying UI personalizations.

## Installation
npm install aura-ui-personalizer

## Usage
import PersonalizationProvider from 'aura-ui-personalizer';

const personalizationData = { theme: 'dark', fontSize: '18px' /* etc. */ };

<PersonalizationProvider personalization={personalizationData}>
  <App />
</PersonalizationProvider>