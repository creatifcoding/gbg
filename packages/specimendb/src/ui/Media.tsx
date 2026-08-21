/**
 * Media well. Missing bytes stay empty. Surfaces own class names.
 *
 * @module @tmnl/specimendb/ui
 */

import type { ReactNode } from 'react';

type MediaBase = {
  readonly className: string;
  readonly children?: ReactNode;
  readonly vid?: string;
};

export type MediaEmpty = MediaBase & {
  readonly kind: 'empty';
};

export type MediaBytes = MediaBase & {
  readonly kind: 'bytes';
  readonly src: string;
  readonly testId?: string;
};

export type MediaLabel = MediaBase & {
  readonly kind: 'label';
  readonly label: string;
  readonly testId?: string;
  readonly labelClassName?: string;
};

export type MediaProps = MediaEmpty | MediaBytes | MediaLabel;

export function Media(props: MediaProps) {
  if (props.kind === 'empty') {
    return (
      <div className={props.className} vid={props.vid}>
        {props.children}
      </div>
    );
  }
  if (props.kind === 'label') {
    return (
      <div className={props.className} vid={props.vid}>
        <span className={props.labelClassName} data-testid={props.testId}>
          {props.label}
        </span>
        {props.children}
      </div>
    );
  }
  return (
    <div className={props.className} vid={props.vid}>
      <img src={props.src} alt="" data-testid={props.testId} />
      {props.children}
    </div>
  );
}
