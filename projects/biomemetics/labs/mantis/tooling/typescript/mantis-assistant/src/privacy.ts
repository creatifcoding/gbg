const ADDRESS =
  /\b\d{1,5}\s+[A-Z]?[a-zA-Z]+(?:\s+[A-Z]?[a-zA-Z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct)\b/gi;
const GPS = /\b-?\d{1,3}\.\d{3,},\s*-?\d{1,3}\.\d{3,}\b/g;
const GPS_PART = /\b-?\d{1,3}\.\d{4,}\b/g;
const TOKEN = /\b(?:sk-|Bearer\s+)[A-Za-z0-9._-]+\b/gi;
const AUTH = /\bAuthorization\s*:\s*\S+/gi;

export const redactSensitive = (input: string): string =>
  input
    .replace(ADDRESS, '[redacted-address]')
    .replace(GPS, '[redacted-geo]')
    .replace(GPS_PART, '[redacted-geo]')
    .replace(TOKEN, '[redacted-token]')
    .replace(AUTH, 'Authorization: [redacted-token]');

export const containsForbiddenPrivacy = (input: string, needles: readonly string[]): boolean =>
  needles.some((needle) => input.includes(needle));

export interface AssistantMemoryRecord {
  readonly recordClass: 'assistant-memory';
  readonly text: string;
  readonly threadId: string;
}

export const asAssistantMemory = (threadId: string, text: string): AssistantMemoryRecord => ({
  recordClass: 'assistant-memory',
  text: redactSensitive(text),
  threadId,
});
