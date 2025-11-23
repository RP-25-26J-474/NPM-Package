import React, { FC, ReactNode } from 'react';
import { useAdaptive } from './AdaptiveProvider';
import type { AdaptiveComponentProps } from './types';

export const AdaptiveButton: FC<AdaptiveComponentProps & { 
  disabled?: boolean; 
  onClick?: () => void;
  children: ReactNode;
}> = ({ 
  children, 
  className = '', 
  style = {}, 
  disabled = false, 
  onClick 
}) => {
  const { styles } = useAdaptive();

  const buttonStyle = {
    minWidth: styles.buttons.minWidth,
    minHeight: styles.buttons.minHeight,
    padding: styles.buttons.padding,
    borderRadius: styles.buttons.borderRadius,
    fontSize: styles.buttons.fontSize,
    backgroundColor: disabled ? styles.theme.disabledColor : styles.theme.primaryColor,
    color: styles.theme.textColor,
    border: `1px solid ${styles.theme.borderColor}`,
    cursor: disabled ? 'not-allowed' : styles.buttons.cursor,
    transition: `transform ${styles.buttons.animationDuration} ease`,
    transform: 'scale(1)',
    opacity: disabled ? styles.buttons.disabledOpacity : 1,
    ...style,
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick && !disabled) onClick();
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      e.currentTarget.style.transform = `scale(${styles.buttons.hoverScale})`;
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
  };

  return React.createElement(
    'button',
    {
      className: `adaptive-button ${className}`,
      style: buttonStyle,
      onClick: handleClick,
      disabled: disabled,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
    children
  ) as React.ReactElement;
};