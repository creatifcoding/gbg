/**
 * TMNL Header Module
 *
 * Exports both raw and layer-wrapped versions.
 */

import { withLayering } from '@/lib/layers';
import { STATIC_UI_Z_INDEX } from '@/lib/layers/static-ui/types';
import { Header, type HeaderProps } from './Header';

// Raw component
export { Header, type HeaderProps } from './Header';

// Layer-wrapped version
export const HeaderLayer = withLayering<HeaderProps>(Header, {
  name: 'tmnl-header',
  zIndex: STATIC_UI_Z_INDEX.header,
  positionMode: 'relative',
  pointerEvents: 'auto',
});
