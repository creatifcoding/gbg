import * as Schema from 'effect-v4/Schema';

export const MoveIdentifier = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9_]*$/),
).pipe(Schema.brand('MoveIdentifier'));
export type MoveIdentifier = typeof MoveIdentifier.Type;
