export default {
  mainEntrypoint: 'index.circuit.tsx',
  platformConfig: {
    // The default parts engine writes JLCPCB SKUs. BOM does not select those.
    partsEngineDisabled: true,
  },
};
