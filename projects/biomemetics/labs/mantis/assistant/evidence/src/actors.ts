export type ActorId = string & { readonly __brand: 'ActorId' };

export type Curator = {
  readonly actorId: ActorId;
  readonly role: 'evidence-curator';
};

export type AdversarialReviewer = {
  readonly actorId: ActorId;
  readonly role: 'adversarial-reviewer';
};

export type GovernedReviewer = {
  readonly actorId: ActorId;
  readonly role: 'governed-reviewer';
};

export type Actor = Curator | AdversarialReviewer | GovernedReviewer;

const brandActorId = (id: string): ActorId => {
  if (id.trim() === '') {
    throw new TypeError('actor id is blank');
  }
  return id as ActorId;
};

export function curator(id: string): Curator {
  return { actorId: brandActorId(id), role: 'evidence-curator' };
}

export function adversarialReviewer(id: string): AdversarialReviewer {
  return { actorId: brandActorId(id), role: 'adversarial-reviewer' };
}

export function governedReviewer(id: string): GovernedReviewer {
  return { actorId: brandActorId(id), role: 'governed-reviewer' };
}
