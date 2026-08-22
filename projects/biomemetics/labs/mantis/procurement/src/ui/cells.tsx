import { Pill, Socket } from '@gbg/lab-ui';

type CellParams = {
  value?: unknown;
};

const textOf = (value: unknown): string => {
  if (value == null) {
    return '';
  }
  const text = String(value);
  return text.trim();
};

export function ClassCell(params: CellParams) {
  const text = textOf(params.value);
  if (text === '') {
    return <Socket aria-label="class" />;
  }
  return <Pill>{text}</Pill>;
}
