/**
 * Locality well. Missing label stays empty. Surfaces own class names.
 *
 * @module @tmnl/specimendb/ui
 */

import type { ReactNode } from 'react';

type LocalityBase = {
  readonly tag: 'div' | 'span';
  readonly className?: string;
  readonly children?: ReactNode;
  readonly vid?: string;
};

export type LocalityEmpty = LocalityBase & {
  readonly kind: 'empty';
  readonly testId?: string;
};

export type LocalityValue = LocalityBase & {
  readonly kind: 'value';
  readonly testId: string;
  readonly label: string;
};

export type LocalityProps = LocalityEmpty | LocalityValue;

export function Locality(props: LocalityProps) {
  const Tag = props.tag;
  if (props.kind === 'empty') {
    return (
      <Tag className={props.className} data-testid={props.testId} vid={props.vid}>
        {props.children}
      </Tag>
    );
  }
  return (
    <Tag className={props.className} data-testid={props.testId} vid={props.vid}>
      {props.children}
      {props.label}
    </Tag>
  );
}
