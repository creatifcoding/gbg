/**
 * Pepr Entry Point
 * Pattern: pepr-excellent-examples/pepr-operator
 */

import { PeprModule } from 'pepr'
import cfg from './package.json'
import { CosmoController } from './controller'

new PeprModule(cfg, [CosmoController])
