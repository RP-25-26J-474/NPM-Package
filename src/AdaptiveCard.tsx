import React, { FC, ReactNode } from 'react';
import { useAdaptive } from './AdaptiveProvider';
import type { AdaptiveComponentProps } from './types';

export const AdaptiveCard: FC<AdaptiveComponentProps> = ({ 
  children, 
  className = '', 
  style = {} 
}) => {
  const { styles } = useAdaptive();

  const cardStyle = {
    width: styles.cards.width,
    height: styles.cards.height,
    borderRadius: styles.cards.borderRadius,
    padding: styles.cards.padding,
    margin: styles.cards.margin,
    backgroundColor: styles.theme.backgroundColor,
    opacity: styles.cards.backgroundOpacity,
    border: `1px solid ${styles.theme.borderColor}`,
    boxShadow: styles.theme.shadowColor ? `0 ${styles.cards.elevation} ${styles.theme.shadowColor}` : 'none',
    ...style,
  };

  return React.createElement(
    'div',
    {
      className: `adaptive-card ${className}`,
      style: cardStyle,
    },
    children
  ) as React.ReactElement;
};