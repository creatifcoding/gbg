/**
 * TMNL Footer Module
 *
 * Exports both raw and layer-wrapped versions.
 */

import { withLayering } from '@/lib/layers';
import { STATIC_UI_Z_INDEX } from '@/lib/layers/static-ui/types';
import { StatusFooter, type StatusFooterProps } from './Footer';

// Raw component
export { StatusFooter, type StatusFooterProps } from './Footer';

// Layer-wrapped version
export const FooterLayer = withLayering<StatusFooterProps>(StatusFooter, {
  name: 'tmnl-footer',
  zIndex: STATIC_UI_Z_INDEX.footer,
  positionMode: 'relative',
  pointerEvents: 'auto',
});
