import type { MlEngineRules } from './types';

// Hardcoded ML engine JSON (simulate backend output)
export const hardcodedMlRules: MlEngineRules = {
  theme: {
    primaryColor: "#FF5733",
    secondaryColor: "#33FF57",
    backgroundColor: "#F5F5F5",
    textColor: "#333333",
    accentColor: "#FF33A1",
    borderColor: "#CCCCCC",
    hoverColor: "#E0E0E0",
    activeColor: "#999999",
    disabledColor: "#AAAAAA",
    errorColor: "#FF0000",
    successColor: "#00FF00",
    warningColor: "#FFFF00",
    infoColor: "#0000FF",
    gradientStart: "#FF5733",
    gradientEnd: "#33FF57",
    shadowColor: "#000000",
    opacity: 0.9
  },
  typography: {
    fontFamily: "Arial, sans-serif",
    fontSizeBase: "16px",
    h1Size: "32px",
    h2Size: "24px",
    h3Size: "20px",
    h4Size: "18px",
    h5Size: "16px",
    h6Size: "14px",
    paragraphSize: "16px",
    captionSize: "12px",
    lineHeight: 1.5,
    letterSpacing: "0.1em",
    wordSpacing: "0.2em",
    textAlign: "left",
    textTransform: "none",
    fontWeight: 400,
    fontStyle: "normal",
    textDecoration: "none"
  },
  buttons: {
    minWidth: "120px",
    minHeight: "40px",
    padding: "10px 20px",
    borderRadius: "5px",
    fontSize: "16px",
    hoverScale: 1.05,
    clickTargetSize: "large",
    animationDuration: "0.2s",
    disabledOpacity: 0.5,
    cursor: "pointer"
  },
  texts: {
    highlightColor: "#FFFF00",
    selectionColor: "#33FF57",
    readabilityScore: 70,
    hyphenation: true,
    kerning: "0.05em"
  },
  cards: {
    width: "300px",
    height: "200px",
    borderRadius: "8px",
    elevation: "2px",
    padding: "15px",
    margin: "10px",
    backgroundOpacity: 0.95
  },
  lists: {
    itemSpacing: "10px",
    bulletSize: "6px",
    indentation: "20px",
    listStyle: "disc"
  },
  grids: {
    columns: 3,
    gap: "15px",
    rowHeight: "auto",
    alignItems: "center",
    justifyItems: "space-between"
  },
  layouts: {
    maxWidth: "1200px",
    minHeight: "100vh",
    padding: "20px",
    margin: "0 auto",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "stretch",
    position: "relative",
    zIndex: 10
  },
  animations: {
    enabled: true,
    duration: "0.3s",
    delay: "0.1s",
    easing: "ease-in-out",
    fadeIn: true,
    slideDistance: "20px",
    rotation: "0deg",
    scale: 1.0
  },
  accessibility: {
    highContrast: true,
    screenReaderSupport: true,
    tabIndex: 0,
    focusOutline: "2px solid #0000FF",
    skipToContent: true,
    motionReduction: true
  },
  forms: {
    inputWidth: "250px",
    inputHeight: "40px",
    labelSize: "14px",
    placeholderColor: "#888888",
    errorMessageSize: "12px",
    submitButtonWidth: "100px"
  },
  images: {
    maxWidth: "100%",
    maxHeight: "300px",
    borderRadius: "4px",
    opacity: 1.0,
    filter: "none"
  },
  navigation: {
    navHeight: "60px",
    linkSpacing: "15px",
    activeLinkColor: "#FF5733",
    hoverLinkColor: "#33FF57"
  },
  modals: {
    width: "400px",
    height: "300px",
    overlayOpacity: 0.7,
    closeButtonSize: "30px"
  },
  tables: {
    rowHeight: "40px",
    columnGap: "10px",
    headerBackground: "#E0E0E0",
    borderWidth: "1px"
  },
  tooltips: {
    fontSize: "12px",
    backgroundColor: "#333333",
    textColor: "#FFFFFF",
    arrowSize: "5px"
  },
  custom: {
    customAttribute1: "value1",
    customAttribute2: 50,
    customAttribute3: true
  }
};

// Simulated "backend" rules for a specific user (e.g., "user123" with vision adaptations)
export const userSpecificRules: MlEngineRules = {
  ...hardcodedMlRules, // Spread all properties from hardcodedMlRules
  theme: {
    ...hardcodedMlRules.theme,
    backgroundColor: "#000000",  // High contrast
    textColor: "#FFFFFF",
    primaryColor: "#00FF00",
    // ... other overrides
  },
  typography: {
    ...hardcodedMlRules.typography,
    fontSizeBase: "20px",
    h1Size: "40px",
    // ... other overrides
  },
};

// Helper to get style object from ML rules
export const getAdaptiveStyles = (rules: MlEngineRules) => {
  return {
    theme: rules.theme, // Full theme object
    typography: rules.typography, // Full typography
    buttons: rules.buttons, // Full buttons
    texts: rules.texts,
    cards: rules.cards,
    lists: rules.lists,
    grids: rules.grids,
    layouts: rules.layouts,
    animations: rules.animations,
    accessibility: rules.accessibility,
    // Computed globals for convenience
    global: {
      backgroundColor: rules.theme.backgroundColor,
      color: rules.theme.textColor,
      fontFamily: rules.typography.fontFamily,
      fontSize: rules.typography.fontSizeBase,
      lineHeight: rules.typography.lineHeight,
    },
  };
};

// Simulated "fetch" function (hardcoded for now)
export const fetchPersonalizationRules = async (userId: string): Promise<MlEngineRules> => {
  // Simulate backend delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return userId === 'user123' ? userSpecificRules : hardcodedMlRules;
};