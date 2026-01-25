import { Schema } from 'effect';
import {
  EguiCommand,
  EguiEventList,
  type EguiEvent,
  type EguiCommand as Command,
} from './schemas';

export const encodeEguiCommand = (command: Command) =>
  Schema.encodeSync(EguiCommand)(command);

export const decodeEguiEvents = (payload: unknown): readonly EguiEvent[] =>
  Schema.decodeUnknownSync(EguiEventList)(payload);
