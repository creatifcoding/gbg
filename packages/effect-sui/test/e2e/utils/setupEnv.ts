import { inject } from 'vitest';

import type { EffectSuiLocalnetContext } from './globalSetup';

const localnet = inject('effectSuiLocalnet') as EffectSuiLocalnetContext;

process.env.SUI_FULLNODE_URL = localnet.fullnodeUrl;
process.env.SUI_FAUCET_URL = localnet.faucetUrl;
process.env.SUI_GRAPHQL_URL = localnet.graphqlUrl;
process.env.SUI_TOOLS_TAG = localnet.suiToolsTag;
process.env.EFFECT_SUI_LOCALNET_MODE = localnet.mode;
process.env.EFFECT_SUI_LOCALNET_ENABLED = String(localnet.enabled);
