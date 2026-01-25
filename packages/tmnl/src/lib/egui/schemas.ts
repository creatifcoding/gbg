import { Schema } from 'effect';

export const EguiCommand = Schema.Union(
  Schema.TaggedStruct('Increment', {}),
  Schema.TaggedStruct('Reset', {})
);
export type EguiCommand = Schema.Schema.Type<typeof EguiCommand>;

export const EguiEvent = Schema.Union(
  Schema.TaggedStruct('CounterChanged', {
    value: Schema.Number,
  })
);
export type EguiEvent = Schema.Schema.Type<typeof EguiEvent>;

export const EguiEventList = Schema.Array(EguiEvent);
export type EguiEventList = Schema.Schema.Type<typeof EguiEventList>;
