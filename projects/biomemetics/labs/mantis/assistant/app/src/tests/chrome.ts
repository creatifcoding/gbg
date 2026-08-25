import { expect } from 'vitest';

export const TELEMETRY_FIELDS = ['temperature', 'humidity', 'camera', 'rail'] as const;

export function expectBlankFields(box: HTMLElement, fields: readonly string[]) {
  for (const field of fields) {
    const node = box.querySelector(`[data-field="${field}"]`);
    expect(node).toBeTruthy();
    expect(node?.textContent).toBe('');
  }
}

export function expectNoBannedCopy(root: ParentNode = document.body) {
  const text = root.textContent?.toLowerCase() ?? '';
  expect(text).not.toMatch(/empty well/);
  expect(text).not.toMatch(/\bsafe\b/);
}
