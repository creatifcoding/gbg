/**
 * Node.js `stream` module shim for browser bundle.
 * Provides stubs — real streaming uses Web Streams API.
 */
export class Readable { pipe() { return this; } on() { return this; } }
export class Writable { write() {} end() {} on() { return this; } }
export class Transform extends Readable {}
export class Duplex extends Readable {}
export class PassThrough extends Transform {}
export const pipeline = (...args: any[]) => { const cb = args[args.length - 1]; if (typeof cb === 'function') cb(); };
export default { Readable, Writable, Transform, Duplex, PassThrough, pipeline };
