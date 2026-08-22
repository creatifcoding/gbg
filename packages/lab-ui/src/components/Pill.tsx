import type { ComponentPropsWithoutRef } from 'react';
import { chrome } from '../lib/chrome.js';

export const PILL_TONES = ['empty', 'working', 'raw', 'filed', 'dead'] as const;
export type PillTone = (typeof PILL_TONES)[number];

export type PillProps = Omit<ComponentPropsWithoutRef<'span'>, 'children'> & {
  readonly tone?: PillTone;
  readonly children?: string;
};

const toneColor = {
  empty: chrome.color.textdim,
  working: chrome.color.emerald500,
  raw: chrome.color.amber500,
  filed: chrome.color.cyan500,
  dead: chrome.color.rose500,
} as const;

export function Pill({ tone = 'empty', children, style, ...props }: PillProps) {
  const color = toneColor[tone];
  const ariaHidden =
    children == null && props['aria-label'] == null && props['aria-labelledby'] == null
      ? true
      : props['aria-hidden'];

  return (
    <span
      {...props}
      aria-hidden={ariaHidden}
      data-tone={tone}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: chrome.space.statusDot,
        minHeight: chrome.space.statusDot,
        padding: `${chrome.space.pillBlockPadding} ${chrome.space.pillInlinePadding}`,
        background: chrome.color.void,
        border: `1px solid ${chrome.color.charcoal200}`,
        borderRadius: chrome.radius.frame,
        color,
        fontFamily: chrome.font.mono,
        fontSize: chrome.type.size.micro,
        letterSpacing: chrome.type.tracking.wider,
        textTransform: 'uppercase',
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          boxSizing: 'border-box',
          width: chrome.space.statusDot,
          height: chrome.space.statusDot,
          background: tone === 'empty' ? 'transparent' : color,
          border: `1px solid ${color}`,
          borderRadius: chrome.radius.statusDot,
        }}
      />
      {children}
    </span>
  );
}
