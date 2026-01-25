/**
 * TMNL Theia Frontend Module
 *
 * Inversify ContainerModule that binds TMNL-specific contributions
 * to the Theia frontend. This is the entry point for all custom
 * frontend extensions.
 *
 * @module theia-ide/browser
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { VantaThemeContribution } from './vanta-theme/vanta-theme-contribution';

export default new ContainerModule((bind) => {
  // VANTA Theme Integration
  bind(VantaThemeContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(VantaThemeContribution);
});
