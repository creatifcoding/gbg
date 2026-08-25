import type { ICellRendererParams, IHeaderParams } from 'ag-grid-community';
import { chrome } from '../lib/chrome.js';
import { Kicker } from './Kicker.js';
import { Label } from './Label.js';
import { Mono } from './Mono.js';
import { PILL_TONES, Pill, type PillTone } from './Pill.js';
import { Socket } from './Socket.js';

function headerText(params: IHeaderParams): string {
  return params.displayName?.trim() ? params.displayName : ' ';
}

export function HeaderCell(params: IHeaderParams) {
  return <Label>{headerText(params)}</Label>;
}

export function KickerHeader(params: IHeaderParams) {
  return <Kicker>{headerText(params)}</Kicker>;
}

export function SocketCell(_params: ICellRendererParams) {
  return (
    <Socket
      style={{
        width: '100%',
        height: '100%',
        minHeight: chrome.space.valueMin,
        border: 'none',
      }}
    />
  );
}

function isPillTone(value: unknown): value is PillTone {
  return typeof value === 'string' && (PILL_TONES as readonly string[]).includes(value);
}

export function StatusCell(params: ICellRendererParams) {
  const tone = isPillTone(params.value) ? params.value : 'empty';
  return <Pill tone={tone} />;
}

export function ValueCell(params: ICellRendererParams) {
  const text =
    params.value == null || params.value === '' ? '' : String(params.value);
  return <Mono>{text}</Mono>;
}
