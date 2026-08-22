import type { ComponentPropsWithoutRef } from 'react';
import { chrome } from '../lib/chrome.js';

export type KickerSize = 10 | 11;
export type KickerTone = 'muted' | 'dim';

export type KickerProps = Omit<ComponentPropsWithoutRef<'span'>, 'children'> & {
  readonly children: string;
  readonly size?: KickerSize;
  readonly tone?: KickerTone;
};

const sizeValue = {
  10: chrome.type.size.label,
  11: chrome.type.size.kicker,
} as const;

const toneValue = {
  muted: chrome.color.secondary,
  dim: chrome.color.muted,
} as const;

export function Kicker({
  children,
  size = 10,
  tone = 'muted',
  style,
  ...props
}: KickerProps) {
  return (
    <span
      {...props}
      style={{
        color: toneValue[tone],
        fontFamily: chrome.font.mono,
        fontSize: sizeValue[size],
        fontWeight: chrome.type.weight.regular,
        letterSpacing: chrome.type.tracking.kicker,
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
