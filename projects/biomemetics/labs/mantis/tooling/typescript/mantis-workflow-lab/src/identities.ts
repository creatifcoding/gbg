export const ComposerBrand = Symbol("Composer");
export const AssessorBrand = Symbol("Assessor");
export const AdversarialBrand = Symbol("Adversarial");
export const HumanGovernorBrand = Symbol("HumanGovernor");
export const DraftBrand = Symbol("Draft");
export const SignedBrand = Symbol("Signed");
export const ActiveBrand = Symbol("Active");
export const RevokedBrand = Symbol("Revoked");

export type Composer = {
  readonly [ComposerBrand]: true;
  readonly id: string;
  readonly role: "composer";
};

export type Assessor = {
  readonly [AssessorBrand]: true;
  readonly id: string;
  readonly role: "assessor";
};

export type AdversarialReviewer = {
  readonly [AdversarialBrand]: true;
  readonly id: string;
  readonly role: "adversarial-reviewer";
};

export type HumanGovernor = {
  readonly [HumanGovernorBrand]: true;
  readonly id: string;
  readonly role: "human";
};

const minted = new WeakSet<object>();

function mint<T extends object>(value: T): T {
  minted.add(value);
  return value;
}

export function isMintedIdentity(value: object): boolean {
  return minted.has(value);
}

export function asComposer(id: string): Composer {
  if (id.trim() === "") {
    throw new Error("composer id required");
  }
  return mint({ id, role: "composer", [ComposerBrand]: true as const });
}

export function asAssessor(id: string): Assessor {
  if (id.trim() === "") {
    throw new Error("assessor id required");
  }
  return mint({ id, role: "assessor", [AssessorBrand]: true as const });
}

export function asAdversarialReviewer(id: string): AdversarialReviewer {
  if (id.trim() === "") {
    throw new Error("adversarial reviewer id required");
  }
  return mint({
    id,
    role: "adversarial-reviewer",
    [AdversarialBrand]: true as const,
  });
}

export function asHumanGovernor(id: string): HumanGovernor {
  if (id.trim() === "") {
    throw new Error("human governor id required");
  }
  return mint({ id, role: "human", [HumanGovernorBrand]: true as const });
}

export function assertHumanGovernor(
  value: unknown,
): asserts value is HumanGovernor {
  if (
    typeof value !== "object" ||
    value === null ||
    !isMintedIdentity(value) ||
    !("role" in value) ||
    (value as { role: string }).role !== "human"
  ) {
    throw Object.assign(new Error("human governor identity required"), {
      code: "identity-required",
      path: "/reviewer",
    });
  }
}
