/**
 * Node.js `net` module shim for browser bundle.
 */
export class Socket { connect() { return this; } on() { return this; } write() {} end() {} destroy() {} }
export const createConnection = () => new Socket();
export const connect = createConnection;
export const isIP = () => 0;
export const isIPv4 = () => false;
export const isIPv6 = () => false;
export default { Socket, createConnection, connect, isIP, isIPv4, isIPv6 };
