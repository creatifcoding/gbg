export class FakeClock {
  #ms: number;

  constructor(iso = '2026-08-21T00:00:00.000Z') {
    this.#ms = Date.parse(iso);
  }

  now(): Date {
    return new Date(this.#ms);
  }

  iso(): string {
    return this.now().toISOString();
  }

  advance(ms: number): void {
    this.#ms += ms;
  }
}

export const FROZEN_ISO = '2026-08-21T00:00:00.000Z';
