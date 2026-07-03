/**
 * Deterministic property-style tests.
 *
 * We keep this dependency-free for now to avoid lockfile churn. The harness is
 * seeded and exercises generated cases across subject resolution, codec
 * roundtrips, and JWT expiry parsing.
 */

import { describe, expect, it } from 'vitest';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

import { NatsCodec } from '../src/nats/codec';
import { parseJwtExpiry } from '../src/auth/rotation';
import {
  SubjectSpec,
  type DomainId,
  type EntityType,
  type SubjectSpecId,
} from '../src/subject';

const PropertyEvent = Schema.Struct({
  id: Schema.String,
  value: Schema.Number,
  nested: Schema.Struct({
    flag: Schema.Boolean,
    labels: Schema.Array(Schema.String),
  }),
});

type PropertyEvent = typeof PropertyEvent.Type;

const makeRng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const token = (rng: () => number, prefix: string): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = prefix;
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(rng() * alphabet.length)];
  }
  return out;
};

const makeJwt = (claims: Record<string, unknown>): string => {
  const encode = (value: unknown) => btoa(JSON.stringify(value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(claims)}.sig`;
};

describe('property: subject pattern algebra', () => {
  it('resolve(subject params) produces a matching subject and recoverable params', () => {
    const rng = makeRng(0x5eed);

    for (let i = 0; i < 120; i += 1) {
      const domain = token(rng, 'd') as DomainId;
      const entityType = token(rng, 'e') as EntityType;
      const idName = token(rng, 'id');
      const actionName = token(rng, 'a');
      const idValue = token(rng, 'v');
      const actionValue = token(rng, 'x');
      const pattern = `${domain}.${entityType}.{entityId}.${actionName}.{actionId}`;

      const spec = new SubjectSpec({
        id: `${domain}.${entityType}.${actionName}` as SubjectSpecId,
        domain,
        entityType,
        description: 'generated subject property case',
        pattern,
        schemaId: 'PropertyEvent',
        streamMapping: { _tag: 'entityType' as const },
        registeredAt: new Date(0),
      });

      const subject = spec.resolve({ entityId: idValue, actionId: actionValue });

      expect(spec.matches(subject), `case ${i}: ${pattern} -> ${subject}`).toBe(true);
      expect(spec.extractParams(subject)).toEqual({ entityId: idValue, actionId: actionValue });
      expect(spec.wildcardPattern()).toBe(`${domain}.${entityType}.*.${actionName}.*`);
      expect(spec.capturePattern()).toBe(`${domain}.${entityType}.>`);
    }
  });

  it('does not let mutated literal tokens match placeholder patterns', () => {
    const rng = makeRng(0x5afe);

    for (let i = 0; i < 120; i += 1) {
      const domain = token(rng, 'd') as DomainId;
      const entityType = token(rng, 'e') as EntityType;
      const actionName = token(rng, 'a');
      const entityValue = token(rng, 'v');
      const pattern = `${domain}.${entityType}.{entityId}.${actionName}`;

      const spec = new SubjectSpec({
        id: `${domain}.${entityType}.${actionName}` as SubjectSpecId,
        domain,
        entityType,
        description: 'generated subject literal-boundary case',
        pattern,
        schemaId: 'PropertyEvent',
        streamMapping: { _tag: 'entityType' as const },
        registeredAt: new Date(0),
      });

      const literalPrefixMutated = `${domain}X${entityType}.${entityValue}.${actionName}`;
      const literalSuffixMutated = `${domain}.${entityType}.${entityValue}.${actionName}X`;
      const dottedPlaceholder = `${domain}.${entityType}.${entityValue}.extra.${actionName}`;

      expect(spec.matches(literalPrefixMutated), `case ${i}: ${literalPrefixMutated}`).toBe(false);
      expect(spec.matches(literalSuffixMutated), `case ${i}: ${literalSuffixMutated}`).toBe(false);
      expect(spec.matches(dottedPlaceholder), `case ${i}: ${dottedPlaceholder}`).toBe(false);
      expect(spec.extractParams(literalPrefixMutated)).toBeNull();
      expect(spec.extractParams(literalSuffixMutated)).toBeNull();
      expect(spec.extractParams(dottedPlaceholder)).toBeNull();
    }
  });
});

describe('property: codec roundtrip', () => {
  it('roundtrips generated JSON-safe payloads through Schema encode/decode', async () => {
    const rng = makeRng(0xc0de);

    await Effect.runPromise(
      Effect.forEach(Array.from({ length: 100 }, (_, i) => i), (i) => {
        const value: PropertyEvent = {
          id: token(rng, `evt${i}-`),
          value: Math.floor(rng() * 1_000_000) / 100,
          nested: {
            flag: rng() > 0.5,
            labels: [token(rng, 'l'), token(rng, 'l')],
          },
        };

        return Effect.gen(function* () {
          const encoded = yield* NatsCodec.encodeJson(PropertyEvent, value);
          const decoded = yield* NatsCodec.decodeJson(PropertyEvent, { subject: `property.${i}` })(encoded);
          expect(decoded).toEqual(value);
        });
      }),
    );
  });
});

describe('property: JWT expiry parsing', () => {
  it('extracts generated exp values without altering seconds precision', () => {
    const rng = makeRng(0xdeadbeef);

    for (let i = 0; i < 100; i += 1) {
      const exp = Math.floor(rng() * 4_102_444_800); // roughly through year 2100
      const jwt = makeJwt({ sub: token(rng, 'u'), exp });
      expect(parseJwtExpiry(jwt)).toBe(exp);
    }
  });
});
