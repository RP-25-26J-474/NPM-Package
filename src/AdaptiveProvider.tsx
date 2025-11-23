import React, { createContext, useContext, ReactNode, FC, useState, useEffect } from 'react';
import type { MlEngineRules } from './types';
import { hardcodedMlRules, getAdaptiveStyles, fetchPersonalizationRules } from './utils';

interface AdaptiveContextType {
  rules: MlEngineRules;
  styles: ReturnType<typeof getAdaptiveStyles>;
  isExtensionInstalled: boolean;
  userId: string | null;
  loadPersonalization: (userId: string) => Promise<void>;
}

const defaultValue: AdaptiveContextType = {
  rules: hardcodedMlRules,
  styles: getAdaptiveStyles(hardcodedMlRules),
  isExtensionInstalled: false,
  userId: null,
  loadPersonalization: async () => {}
};

const AdaptiveContext = createContext<AdaptiveContextType>(defaultValue);

interface AdaptiveProviderProps {
  children: ReactNode;
  rules?: MlEngineRules; // Optional initial rules
  simulateExtensionCheck?: boolean; // Prop to toggle simulation
}

export const AdaptiveProvider: FC<AdaptiveProviderProps> = ({ 
  children, 
  rules = hardcodedMlRules,
  simulateExtensionCheck = true
}) => {
  const [internalRules, setInternalRules] = useState(rules);
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const styles = getAdaptiveStyles(internalRules);

  // Simulated extension check and user identification
  useEffect(() => {
    if (simulateExtensionCheck) {
      // Mock: Assume extension is installed for demo
      setIsExtensionInstalled(true);
      setUserId('user123');  // Mock user ID
      loadPersonalization('user123');
    }
  }, [simulateExtensionCheck]);

  const loadPersonalization = async (id: string) => {
    try {
      const fetchedRules = await fetchPersonalizationRules(id);
      setInternalRules(fetchedRules);
    } catch (error) {
      console.error('Failed to load personalization:', error);
      setInternalRules(hardcodedMlRules);  // Fallback
    }
  };

  const value = {
    rules: internalRules,
    styles,
    isExtensionInstalled,
    userId,
    loadPersonalization
  };

  return React.createElement(
    AdaptiveContext.Provider,
    { value },
    children
  ) as React.ReactElement;
};

export const useAdaptive = () => {
  const context = useContext(AdaptiveContext);
  return context;
};