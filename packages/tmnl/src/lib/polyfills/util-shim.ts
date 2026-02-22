/**
 * Node.js `util` module shim for browser bundle.
 * Provides stubs for commonly used util functions.
 */
export const format = (...args: unknown[]) => args.map(String).join(' ');
export const inspect = (obj: unknown) => JSON.stringify(obj, null, 2);
export const deprecate = (fn: Function, _msg: string) => fn;
export const inherits = (ctor: any, superCtor: any) => {
  if (superCtor) {
    ctor.super_ = superCtor;
    Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
  }
};
export const promisify = (fn: Function) => fn;
export const types = { isDate: (v: unknown) => v instanceof Date };
export const TextEncoder = globalThis.TextEncoder;
export const TextDecoder = globalThis.TextDecoder;
export default { format, inspect, deprecate, inherits, promisify, types, TextEncoder, TextDecoder };
