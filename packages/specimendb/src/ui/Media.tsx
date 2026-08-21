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

export type MediaProps = MediaEmpty | MediaBytes;

export function Media(props: MediaProps) {
  if (props.kind === 'empty') {
    return (
      <div className={props.className} vid={props.vid}>
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
