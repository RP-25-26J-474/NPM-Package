import React, { FC, ReactNode } from 'react';
import { useAdaptive } from './AdaptiveProvider';
import type { AdaptiveComponentProps } from './types';

export const AdaptiveList: FC<AdaptiveComponentProps & { items: string[]; ordered?: boolean }> = ({ 
  items, 
  ordered = false, 
  className = '', 
  style = {} 
}) => {
  const { styles } = useAdaptive();

  const listStyle = {
    listStyleType: ordered ? 'decimal' : styles.lists.listStyle,
    paddingLeft: styles.lists.indentation,
    margin: '0',
    ...style,
  };

  const itemStyle = {
    marginBottom: styles.lists.itemSpacing,
  };

  return React.createElement(
    ordered ? 'ol' : 'ul',
    {
      className: `adaptive-list ${className}`,
      style: listStyle,
    },
    items.map((item, index) => 
      React.createElement(
        'li',
        { key: index, style: itemStyle },
        item
      )
    )
  ) as React.ReactElement;
};