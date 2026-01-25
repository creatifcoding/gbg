/**
 * View registry types for DynamicIslandCard
 *
 * @module morph-card/types/view-registry
 */

import type { ReactNode } from 'react';
import type { TransitionGrammar } from '../schemas/transition-grammar';
import type { ReticleVariant } from '../schemas/animation-config';
import type { ViewSpecData } from '../schemas/tab-schemas';

export interface ViewSpecBase<Keys extends string = string> {
  /** Unique view identifier */
  id: string;
  /** Tab label */
  label: string;
  /** Optional icon name */
  icon?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Optional ordering */
  order?: number;
  /** Optional sizeKey override for this view */
  sizeKey?: Keys;
  /** Optional transition override for this view */
  transition?: string | TransitionGrammar;
  /** Optional reticle override for this view */
  reticle?: ReticleVariant;
  /** Whether this view should be treated as a complex transition */
  complex?: boolean;
  /** Keep this view mounted when inactive (default: true) */
  keepMounted?: boolean;
  /** Optional content tree for generated views */
  content?: ViewSpecData['content'];
  /** Optional layout intent for view-driven sizing */
  layout?: ViewSpecData['layout'];
  /** Optional dynamic sizing for this view */
  dynamicSize?: boolean;
  /** Optional minimum width when dynamic sizing */
  minWidth?: number;
  /** Optional maximum width when dynamic sizing */
  maxWidth?: number;
  /** Optional minimum height when dynamic sizing */
  minHeight?: number;
  /** Optional maximum height when dynamic sizing */
  maxHeight?: number;
}

export interface ViewSpec<Keys extends string = string> extends ViewSpecBase<Keys> {
  /** Render function for view content */
  render?: (ctx: { active: boolean; sizeKey: Keys }) => ReactNode;
}

export type ViewRegistry<Keys extends string = string> = {
  [Id in string]: ViewSpec<Keys> & { id: Id };
};

export type ViewIdsFromRegistry<R extends ViewRegistry> = keyof R & string;
