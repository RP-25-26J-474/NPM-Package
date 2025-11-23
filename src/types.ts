export interface MlEngineRules {
    theme: {
      primaryColor: string;
      secondaryColor: string;
      backgroundColor: string;
      textColor: string;
      accentColor: string;
      borderColor: string;
      hoverColor: string;
      activeColor: string;
      disabledColor: string;
      errorColor: string;
      successColor: string;
      warningColor: string;
      infoColor: string;
      gradientStart: string;
      gradientEnd: string;
      shadowColor: string;
      opacity: number;
    };
    typography: {
      fontFamily: string;
      fontSizeBase: string;
      h1Size: string;
      h2Size: string;
      h3Size: string;
      h4Size: string;
      h5Size: string;
      h6Size: string;
      paragraphSize: string;
      captionSize: string;
      lineHeight: number;
      letterSpacing: string;
      wordSpacing: string;
      textAlign: string;
      textTransform: string;
      fontWeight: number;
      fontStyle: string;
      textDecoration: string;
    };
    buttons: {
      minWidth: string;
      minHeight: string;
      padding: string;
      borderRadius: string;
      fontSize: string;
      hoverScale: number;
      clickTargetSize: 'small' | 'medium' | 'large';
      animationDuration: string;
      disabledOpacity: number;
      cursor: string;
    };
    texts: {
      highlightColor: string;
      selectionColor: string;
      readabilityScore: number;
      hyphenation: boolean;
      kerning: string;
    };
    cards: {
      width: string;
      height: string;
      borderRadius: string;
      elevation: string;
      padding: string;
      margin: string;
      backgroundOpacity: number;
    };
    lists: {
      itemSpacing: string;
      bulletSize: string;
      indentation: string;
      listStyle: string;
    };
    grids: {
      columns: number;
      gap: string;
      rowHeight: string;
      alignItems: string;
      justifyItems: string;
    };
    layouts: {
      maxWidth: string;
      minHeight: string;
      padding: string;
      margin: string;
      flexDirection: string;
      justifyContent: string;
      alignItems: string;
      position: string;
      zIndex: number;
    };
    animations: {
      enabled: boolean;
      duration: string;
      delay: string;
      easing: string;
      fadeIn: boolean;
      slideDistance: string;
      rotation: string;
      scale: number;
    };
    accessibility: {
      highContrast: boolean;
      screenReaderSupport: boolean;
      tabIndex: number;
      focusOutline: string;
      skipToContent: boolean;
      motionReduction: boolean;
    };
    forms: {
      inputWidth: string;
      inputHeight: string;
      labelSize: string;
      placeholderColor: string;
      errorMessageSize: string;
      submitButtonWidth: string;
    };
    images: {
      maxWidth: string;
      maxHeight: string;
      borderRadius: string;
      opacity: number;
      filter: string;
    };
    navigation: {
      navHeight: string;
      linkSpacing: string;
      activeLinkColor: string;
      hoverLinkColor: string;
    };
    modals: {
      width: string;
      height: string;
      overlayOpacity: number;
      closeButtonSize: string;
    };
    tables: {
      rowHeight: string;
      columnGap: string;
      headerBackground: string;
      borderWidth: string;
    };
    tooltips: {
      fontSize: string;
      backgroundColor: string;
      textColor: string;
      arrowSize: string;
    };
    custom: {
      customAttribute1: string;
      customAttribute2: number;
      customAttribute3: boolean;
    };
  }
  
  export interface AdaptiveComponentProps {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }
  
  export interface UserPersonalizationContext {
    userId: string | null;
    rules: MlEngineRules | null;
    isExtensionInstalled: boolean;
    loadPersonalization: (userId: string) => Promise<void>;  // Simulated fetch
  }