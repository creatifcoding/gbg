/**
 * fs module shim — no-op stubs for browser bundle.
 * Real fs usage only happens in Node.js contexts (axiom scaffolding, etc.)
 */
const noop = (..._args: any[]) => {};
const noopCb = (...args: any[]) => { const cb = args[args.length - 1]; if (typeof cb === 'function') cb(null); };
export const readFileSync = () => '';
export const writeFileSync = noop;
export const writeFile = noopCb;
export const readFile = noopCb;
export const mkdirSync = noop;
export const mkdir = noopCb;
export const existsSync = () => false;
export const accessSync = noop;
export const access = noopCb;
export const statSync = () => ({ isFile: () => false, isDirectory: () => false, size: 0 });
export const stat = noopCb;
export const readdirSync = () => [] as string[];
export const readdir = noopCb;
export const unlinkSync = noop;
export const unlink = noopCb;
export const rmdirSync = noop;
export const rmdir = noopCb;
export const createReadStream = () => null;
export const createWriteStream = () => null;
export const watch = () => ({ close: noop, on: () => {} });
export const chmod = noopCb;
export const chown = noopCb;
export const rename = noopCb;
export const copyFile = noopCb;
export const constants = { F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1 };
export const spawn = noop;
export const promises = {
  readFile: async () => '',
  writeFile: async () => {},
  mkdir: async () => {},
  stat: async () => ({ isFile: () => false }),
  readdir: async () => [],
};
export default {
  readFileSync, writeFileSync, mkdirSync, existsSync, statSync,
  readdirSync, unlinkSync, rmdirSync, createReadStream, createWriteStream, promises,
};
