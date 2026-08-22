import type { ComponentPropsWithoutRef } from 'react';
import { chrome } from '../lib/chrome.js';
import type { TypeSize } from '../lib/type.js';

export type MonoProps = ComponentPropsWithoutRef<'span'> & {
  readonly size?: TypeSize;
};

export function Mono({ size = 'body', children, style, ...props }: MonoProps) {
  return (
    <span
      {...props}
      style={{
        color: chrome.color.textmain,
        fontFamily: chrome.font.mono,
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
