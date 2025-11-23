import React, { FC, ReactNode } from 'react';
import { useAdaptive } from './AdaptiveProvider';
import type { AdaptiveComponentProps } from './types';

export const AdaptiveText: FC<AdaptiveComponentProps & { variant?: 'h1' | 'h2' | 'h3' | 'p' | 'caption' }> = ({ 
  children, 
  className = '', 
  style = {}, 
  variant = 'p' 
}) => {
  const { styles } = useAdaptive();

  const fontSize = variant === 'h1' ? styles.typography.h1Size : 
                   variant === 'h2' ? styles.typography.h2Size : 
                   variant === 'h3' ? styles.typography.h3Size : 
                   variant === 'p' ? styles.typography.paragraphSize : 
                   styles.typography.captionSize;

  const textStyle = {
    fontFamily: styles.typography.fontFamily,
    fontSize,
    lineHeight: styles.typography.lineHeight,
    letterSpacing: styles.typography.letterSpacing,
    color: styles.theme.textColor,
    textAlign: styles.typography.textAlign,
    ...style,
  };

  return React.createElement(
    'span',
    {
      className: `adaptive-text adaptive-${variant} ${className}`,
      style: textStyle,
    },
    children
  ) as React.ReactElement;
};