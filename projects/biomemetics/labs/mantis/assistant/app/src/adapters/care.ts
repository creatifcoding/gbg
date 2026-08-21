import type { AdapterEnvelope, CareAdvice, LocationGrant } from '../contracts/types';
import { randomId } from '../kernel/crypto';
import careSources from '../../../fixtures/golden-care/care-sources.json' with { type: 'json' };
import scenario from '../../../fixtures/golden-care/scenario.json' with { type: 'json' };

export interface CareSourceRecord {
  readonly sourceId: string;
  readonly title: string;
  readonly citation: string;
  readonly applicability: string;
  readonly reviewed: true;
  readonly claims: readonly {
    readonly id: string;
    readonly text: string;
    readonly numerical: boolean;
    readonly applicableWhen: string;
  }[];
}

const sources = careSources as unknown as { sources: readonly CareSourceRecord[] };

export const lookupCareAdvice = (input: {
  readonly careSubjectId: string;
  readonly now: string;
  readonly online: boolean;
}): AdapterEnvelope<CareAdvice> => {
  const orderLevel = sources.sources.find((s) => s.sourceId === 'pretes-1999-praying-mantids');
  const withheldReason =
    'Taxon and life stage are unknown. Numerical prey size/count is withheld until a reviewed CarePlan applies.';

  const advice: CareAdvice = {
    schemaVersion: 1,
    kind: 'CareAdvice',
    adviceId: randomId('adv'),
    careSubjectId: input.careSubjectId,
    offeredAt: input.now,
    doNow: [
      'Keep the animal in the current temporary housing. Do not upgrade enclosure until identity and molt risk are reviewed.',
      'Offer live prey only if the animal is visibly alert. Do not infer that a recommendation was eaten.',
      'Provide a misted surface; avoid standing water you have not confirmed as appropriate.',
    ],
    warnings: [
      'A photo does not establish taxon, locality, health, or body length without scale.',
      'Guessed identity is not a confirmed species and must not drive climate or diet numbers.',
    ],
    numericalClaims: [
      {
        text: 'Species-specific prey count and size',
        status: 'withheld',
        reason: withheldReason,
      },
    ],
    supplies: ['live feeder insects sized to the animal, once identity/stage is reviewed', 'soft tweezers', 'spray bottle'],
    sources: orderLevel
      ? [
          {
            sourceId: orderLevel.sourceId,
            title: orderLevel.title,
            citation: orderLevel.citation,
            applicability: orderLevel.applicability,
            reviewed: true,
          },
        ]
      : [],
    confidence: 'low',
    applicability: 'temporary housing; taxon unknown; order-level husbandry only',
    epistemic: 'recommended',
    becomesCareEvent: false,
  };

  return {
    timestamp: input.now,
    freshness: input.online ? 'offline-fixture' : 'offline-fixture',
    source: 'golden-care.care-source',
    confidence: 'low',
    applicability: advice.applicability,
    privacyClass: 'no-exact-location',
    timeoutMs: 800,
    offline: 'available',
    assayed: true,
    value: advice,
  };
};

export const locationGrant = (nowIso: string, ttlMs = 60_000): LocationGrant => ({
  purpose: 'supply-transit',
  precision: 'coarse',
  token: randomId('loc'),
  expiresAt: new Date(Date.parse(nowIso) + ttlMs).toISOString(),
  persist: false,
  writesLocality: false,
});

export interface SupplyHit {
  readonly name: string;
  readonly kind: 'feeder' | 'enclosure' | 'transit';
  readonly availability: string;
  readonly current: boolean;
}

export const lookupSupplyTransit = (input: {
  readonly now: string;
  readonly grant: LocationGrant | null;
  readonly manualPlace: string | null;
  readonly online: boolean;
}): AdapterEnvelope<{ hits: readonly SupplyHit[]; locationMode: 'ephemeral' | 'manual' | 'declined' }> => {
  if (!input.online) {
    return {
      timestamp: input.now,
      freshness: 'unavailable',
      source: 'golden-care.supply-transit',
      confidence: 'unknown',
      applicability: 'current inventory/transit requires a live assayed adapter',
      privacyClass: 'no-exact-location',
      timeoutMs: 1500,
      offline: 'unavailable',
      assayed: true,
      value: {
        hits: [],
        locationMode: input.grant ? 'ephemeral' : input.manualPlace ? 'manual' : 'declined',
      },
    };
  }

  if (input.grant && Date.parse(input.grant.expiresAt) <= Date.parse(input.now)) {
    throw new Error('location grant expired; lookup must not retain the token');
  }

  const place = input.manualPlace ? `manual:${input.manualPlace}` : 'ephemeral-coarse';
  const fixture = scenario.supplyTransit as {
    feeders: readonly { name: string; availability: string }[];
    transit: readonly { name: string; availability: string }[];
  };

  return {
    timestamp: input.now,
    freshness: 'current',
    source: `golden-care.supply-transit:${place}`,
    confidence: 'medium',
    applicability: 'fixture inventory; not a purchase; no navigation launch',
    privacyClass: 'ephemeral-coarse-location',
    timeoutMs: 1500,
    offline: 'unavailable',
    assayed: true,
    value: {
      locationMode: input.grant ? 'ephemeral' : input.manualPlace ? 'manual' : 'declined',
      hits: [
        ...fixture.feeders.map((f) => ({
          name: f.name,
          kind: 'feeder' as const,
          availability: f.availability,
          current: true,
        })),
        ...fixture.transit.map((t) => ({
          name: t.name,
          kind: 'transit' as const,
          availability: t.availability,
          current: true,
        })),
      ],
    },
  };
};
