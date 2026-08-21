/**
 * Status well. Missing value stays empty. Surfaces own class names.
 *
 * @module @tmnl/specimendb/ui
 */

import type { ReactNode } from 'react';
import type { SpecimenStatus } from '../schemas/components.js';

export type StatusPromote = (event: {
  readonly stopPropagation: () => void;
  readonly preventDefault: () => void;
}) => void;

type StatusBase = {
  readonly tag: 'div' | 'span';
  readonly className: string;
  readonly children?: ReactNode;
  readonly vid?: string;
};

export type StatusEmpty = StatusBase & {
  readonly kind: 'empty';
  readonly testId?: string;
};

export type StatusValue = StatusBase & {
  readonly kind: 'value';
  readonly value: SpecimenStatus;
  readonly testId: string;
  readonly onPromote?: StatusPromote;
};

export type StatusProps = StatusEmpty | StatusValue;

export function Status(props: StatusProps) {
  const Tag = props.tag;
  if (props.kind === 'empty') {
    return (
      <Tag className={props.className} data-testid={props.testId} vid={props.vid}>
        {props.children}
      </Tag>
    );
  }
  const promote = props.onPromote;
  return (
    <Tag
      className={props.className}
      data-status={props.value}
      data-testid={props.testId}
      vid={props.vid}
      {...(promote !== undefined ? { 'data-promote': 'true', onClick: promote } : {})}
    >
      {props.children ?? props.value}
    </Tag>
  );
}
