import React, { FC, ReactNode } from 'react';
import { useAdaptive } from './AdaptiveProvider';
import type { AdaptiveComponentProps } from './types';

export const AdaptiveGrid: FC<AdaptiveComponentProps & { children: ReactNode }> = ({ 
  children, 
  className = '', 
  style = {} 
}) => {
  const { styles } = useAdaptive();

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${styles.grids.columns}, 1fr)`,
    gap: styles.grids.gap,
    rowHeight: styles.grids.rowHeight,
    alignItems: styles.grids.alignItems,
    justifyItems: styles.grids.justifyItems,
    ...style,
  };

  return React.createElement(
    'div',
    {
      className: `adaptive-grid ${className}`,
      style: gridStyle,
    },
    children
  ) as React.ReactElement;
};