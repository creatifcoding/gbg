import { PINS } from './pins.ts';

process.stdout.write(`${JSON.stringify({ kind: 'MantisAssistantPins', pins: PINS }, null, 2)}\n`);
