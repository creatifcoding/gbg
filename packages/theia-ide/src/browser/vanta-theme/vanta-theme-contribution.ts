/**
 * VANTA Theme Contribution
 *
 * Injects VANTA design tokens into Theia on application startup.
 * This FrontendApplicationContribution runs before the UI renders,
 * ensuring consistent theming from first paint.
 *
 * @module theia-ide/browser/vanta-theme
 */

import { injectable } from '@theia/core/shared/inversify';
import {
  FrontendApplicationContribution,
  FrontendApplication,
} from '@theia/core/lib/browser';
import { VANTA_TO_THEIA_TOKENS, VANTA_STYLE_OVERRIDES } from './vanta-tokens';

@injectable()
export class VantaThemeContribution implements FrontendApplicationContribution {
  /**
   * Called when the frontend application starts.
   * Injects VANTA tokens before any UI renders.
   */
  async onStart(_app: FrontendApplication): Promise<void> {
    this.injectVantaTokens();
    this.injectStyleOverrides();
    console.log('[VANTA] Theme tokens injected');
  }

  /**
   * Inject CSS variables into document root
   */
  private injectVantaTokens(): void {
    const root = document.documentElement;

    for (const [variable, value] of Object.entries(VANTA_TO_THEIA_TOKENS)) {
      root.style.setProperty(variable, value);
    }
  }

  /**
   * Inject style overrides via <style> element for !important rules
   */
  private injectStyleOverrides(): void {
    // Check if already injected (for hot reload scenarios)
    const existingStyle = document.getElementById('vanta-theme-overrides');
    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement('style');
    style.id = 'vanta-theme-overrides';
    style.textContent = VANTA_STYLE_OVERRIDES;
    document.head.appendChild(style);
  }
}
