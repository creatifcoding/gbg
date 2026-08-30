import { z } from 'zod';

import { explain } from './explain.ts';
import { loadPlant } from './fixtures.ts';
import { READ_TOOL_DESCRIPTION, READ_TOOL_ID, refuseWrite } from './refuse-write.ts';
import { view } from './view.ts';

export const readInputSchema = z
  .object({
    fixtureId: z.string().min(1).optional(),
  })
  .strict();

export const runRead = (input: unknown) => {
  refuseWrite(input);
  const parsed = readInputSchema.parse(input ?? {});
  const painted = view(loadPlant(parsed.fixtureId ?? 'known-fresh'));
  return {
    sourceClass: 'simulated' as const,
    view: painted,
    explanation: explain(painted),
  };
};

export { READ_TOOL_DESCRIPTION, READ_TOOL_ID };
