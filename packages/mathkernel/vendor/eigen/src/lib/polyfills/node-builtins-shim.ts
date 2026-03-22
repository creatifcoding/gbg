/**
 * Node.js Builtins Shim for Browser/Tauri Builds
 *
 * Provides empty/no-op exports for Node.js built-in modules that leak
 * into the browser bundle via transitive dependencies. These modules
 * exist in lazy-loaded chunks only (Phase A barrel surgery ensures
 * the eager app shell has no Node.js dependencies).
 *
 * Used by resolve.alias in vite.config.ts to prevent bare `import from "path"`
 * etc. from crashing the WebKitGTK webview at module resolution time.
 *
 * @module polyfills/node-builtins-shim
 */

// path — used by escalade, yargs, @osdk/maker, axiom targets
export const join = (...args: string[]) => args.join('/');
export const resolve = (...args: string[]) => args.join('/');
export const dirname = (p: string) => p.replace(/\/[^/]*$/, '') || '.';
export const basename = (p: string) => p.replace(/.*\//, '');
export const extname = (p: string) => {
  const m = p.match(/\.[^.]*$/);
  return m ? m[0] : '';
};
export const sep = '/';
export const delimiter = ':';
export const posix = { join, resolve, dirname, basename, extname, sep, delimiter };
export const isAbsolute = (p: string) => p.startsWith('/');
export const relative = (_from: string, _to: string) => _to;
export const normalize = (p: string) => p;
export const parse = (p: string) => ({ root: '', dir: dirname(p), base: basename(p), ext: extname(p), name: basename(p).replace(/\.[^.]*$/, '') });
export const format = (o: any) => `${o.dir}/${o.base}`;

export default {
  join, resolve, dirname, basename, extname, sep, delimiter, posix,
  isAbsolute, relative, normalize, parse, format,
};
