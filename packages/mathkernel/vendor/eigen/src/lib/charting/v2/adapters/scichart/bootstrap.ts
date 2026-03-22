export const loadSciChartModule = async () => {
  const scichart = await import('scichart');
  const { SciChartSurface } = scichart;

  const runtimeLicenseKey = import.meta.env.VITE_SCICHART_LICENSE_KEY;
  if (
    typeof runtimeLicenseKey === 'string' &&
    runtimeLicenseKey.trim().length > 0
  ) {
    SciChartSurface.setRuntimeLicenseKey(runtimeLicenseKey.trim());
  } else {
    SciChartSurface.UseCommunityLicense();
  }

  // Keep CDN loading behavior explicit to avoid local asset resolution drift.
  SciChartSurface.loadWasmFromCDN();

  return scichart;
};
