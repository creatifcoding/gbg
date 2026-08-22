import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { importedA0Dir, assistantRootFromLab } from './paths.ts';

export type A0PinSnapshot = {
  readonly schemaVersion: '1.0.0';
  readonly kind: 'A0PinSnapshot';
  readonly pr: 100;
  readonly branch: 'cursor/mantis-assistant-a0-9bdb';
  readonly sha: string;
  readonly mastraCore: string;
  readonly copilotkitRuntime: string;
  readonly aguiMastra: string;
  readonly liveModel: string;
  readonly controllerConfig: string;
  readonly omLiveObserverReflector: 'QUARANTINED_UPSTREAM';
};

const loadJson = <T>(filePath: string): T =>
  JSON.parse(readFileSync(filePath, 'utf8')) as T;

export const loadPinSnapshot = (): A0PinSnapshot =>
  loadJson(path.join(importedA0Dir, 'pins.json'));

export const resolveA0File = (relativeFromAssistant: string, assistantRoot?: string): string => {
  const liveRoot = assistantRoot ?? assistantRootFromLab;
  const live = path.join(liveRoot, relativeFromAssistant);
  if (existsSync(live)) return live;
  return path.join(importedA0Dir, path.basename(relativeFromAssistant));
};

export const loadA0Json = <T>(relativeFromAssistant: string, assistantRoot?: string): T =>
  loadJson(resolveA0File(relativeFromAssistant, assistantRoot));
