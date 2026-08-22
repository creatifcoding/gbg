import type { ComponentPropsWithoutRef } from 'react';
import { chrome } from '../lib/chrome.js';

export type LabelProps = Omit<ComponentPropsWithoutRef<'span'>, 'children'> & {
  readonly children: string;
};

export function Label({ children, style, ...props }: LabelProps) {
  return (
    <span
      {...props}
      style={{
        color: chrome.color.textdim,
        fontFamily: chrome.font.mono,
        fontSize: chrome.type.size.label,
        fontWeight: chrome.type.weight.regular,
        letterSpacing: chrome.type.tracking.widest,
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
