/**
 * Intake well. Chrome is look-only. Live carries the file bind.
 * Surfaces own class names and copy.
 *
 * @module @tmnl/specimendb/ui
 */

import type { ReactNode } from 'react';
import type { IntakeBind } from './intake-bind.js';

type IntakeBase = {
  readonly className: string;
  readonly children: ReactNode;
  readonly vid?: string;
};

export type IntakeChrome = IntakeBase & {
  readonly kind: 'chrome';
};

export type IntakeLive = IntakeBase & {
  readonly kind: 'live';
  readonly bind: IntakeBind;
  readonly status: 'idle' | 'dropping' | 'error';
  readonly error: string | null;
};

export type IntakeProps = IntakeChrome | IntakeLive;

export function Intake(props: IntakeProps) {
  if (props.kind === 'chrome') {
    return (
      <div className={props.className} vid={props.vid}>
        {props.children}
      </div>
    );
  }
  const { bind, status, error } = props;
  return (
    <>
      <input
        ref={bind.inputRef}
        className="sdb-file-input"
        data-testid="intake-file"
        type="file"
        accept="image/jpeg,image/heic,image/heif,.jpg,.jpeg,.heic,.heif"
        multiple
        onChange={bind.onChange}
      />
      <button
        type="button"
        className={props.className}
        data-testid="intake-zone"
        data-active={bind.active ? 'true' : 'false'}
        data-status={status}
        vid={props.vid}
        onClick={bind.open}
        onDragEnter={bind.onDragEnter}
        onDragOver={bind.onDragOver}
        onDragLeave={bind.onDragLeave}
        onDrop={bind.onDrop}
      >
        {props.children}
      </button>
      {error !== null ? (
        <p className="sdb-x-error" data-testid="intake-error">
          {error}
        </p>
      ) : null}
    </>
  );
}
