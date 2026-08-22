import type { ComponentPropsWithoutRef } from 'react';
import { chrome } from '../lib/chrome.js';

export type SocketKind = 'value' | 'media';

export type SocketProps = ComponentPropsWithoutRef<'div'> & {
  readonly kind?: SocketKind;
};

export function Socket({ kind = 'value', children, style, ...props }: SocketProps) {
  const ariaHidden =
    children == null && props['aria-label'] == null && props['aria-labelledby'] == null
      ? true
      : props['aria-hidden'];

  return (
    <div
      {...props}
      aria-hidden={ariaHidden}
      data-socket={kind}
      style={{
        boxSizing: 'border-box',
        minHeight:
          kind === 'media' ? chrome.space.mediaHeight : chrome.space.valueMin,
        background:
          kind === 'media' ? chrome.color.void : chrome.color.charcoal500,
        border: `1px solid ${
          kind === 'media' ? chrome.color.charcoal200 : chrome.color.charcoal300
        }`,
        borderRadius: chrome.radius.frame,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
