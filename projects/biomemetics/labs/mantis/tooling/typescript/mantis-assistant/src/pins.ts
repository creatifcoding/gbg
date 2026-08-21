/** Exact A0 package pins. Change only with a compatibility re-proof. */
export const PINS = {
  mastraCore: '1.61.0',
  mastraCodeSdk: '1.4.0',
  mastraClientJs: '1.42.0',
  mastraMemory: '1.27.0',
  mastraObservability: '1.17.1',
  mastraEvals: '1.9.0',
  mastraLibsql: '1.21.1',
  aguiMastra: '1.1.2',
  aguiCore: '0.0.58',
  aguiClient: '0.0.58',
  copilotkitRuntime: '1.68.3',
  copilotkitShared: '1.68.3',
  effect: '4.0.0-beta.93',
  typescript: '5.9.3',
  ajv: '8.20.0',
  zod: '3.25.76',
  packageManager: 'npm@10.9.7',
  node: '>=22.14.0',
  liveNode: '>=22.19.0',
  controllerConfig: 'mantis-controller@0.1.0',
  fakeModel: 'mantis-fake-model@1.0.0',
  liveModel: 'gpt-5.6-luna',
  liveReasoningLevel: 'max',
} as const;

export type PinName = keyof typeof PINS;
