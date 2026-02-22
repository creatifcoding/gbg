/**
 * Node.js `url` module shim for browser bundle.
 * Provides fileURLToPath and URL compat stubs.
 */
export const fileURLToPath = (url: string | URL) => {
  const str = typeof url === 'string' ? url : url.href;
  return str.replace('file://', '');
};
export const pathToFileURL = (p: string) => new URL(`file://${p}`);
export const URL = globalThis.URL;
export const URLSearchParams = globalThis.URLSearchParams;
export const parse = (urlString: string) => new globalThis.URL(urlString);
export const format = (urlObj: any) => urlObj.href || String(urlObj);
export const resolve = (from: string, to: string) => new globalThis.URL(to, from).href;
export default { fileURLToPath, pathToFileURL, URL, URLSearchParams, parse, format, resolve };
