import type { ComponentPropsWithoutRef } from 'react';
import { chrome } from '../lib/chrome.js';
import type { TypeSize } from '../lib/type.js';

export type SansProps = ComponentPropsWithoutRef<'span'> & {
  readonly size?: TypeSize;
};

export function Sans({ size = 'copy', children, style, ...props }: SansProps) {
  return (
    <span
      {...props}
      style={{
        color: chrome.color.textmain,
        fontFamily: chrome.font.sans,
        fontSize: chrome.type.size[size],
        fontWeight: chrome.type.weight.regular,
        letterSpacing: chrome.type.tracking.tight,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
