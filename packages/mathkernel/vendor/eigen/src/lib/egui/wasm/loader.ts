export type EguiWebHandle = {
  start: (canvas: HTMLCanvasElement) => Promise<void>;
  send_command?: (command: unknown) => void;
  drain_events?: () => unknown;
  set_event_callback?: (callback: (events: unknown) => void) => void;
  clear_event_callback?: () => void;
  destroy?: () => void;
  has_panicked?: () => boolean;
};

export type EguiWasmModule = {
  default: (...args: unknown[]) => Promise<void>;
  WebHandle: new () => EguiWebHandle;
};

export const DEFAULT_EGUI_BASE_PATH = 'egui';

const resolveEguiBasePath = (basePath: string) => {
  if (/^https?:\/\//.test(basePath)) {
    return basePath.replace(/\/+$/, '');
  }

  if (basePath.startsWith('/')) {
    return new URL(basePath, window.location.origin)
      .toString()
      .replace(/\/+$/, '');
  }

  const baseUrl = new URL(
    import.meta.env.BASE_URL ?? '/',
    window.location.origin
  );
  return new URL(`${basePath.replace(/^\/+/, '')}/`, baseUrl)
    .toString()
    .replace(/\/+$/, '');
};

export const loadEguiWasmModule = async (
  basePath: string = DEFAULT_EGUI_BASE_PATH
): Promise<EguiWasmModule> => {
  const moduleUrl = `${resolveEguiBasePath(basePath)}/tmnl_egui_wasm.js`;
  const module = await import(/* @vite-ignore */ moduleUrl);
  return module as EguiWasmModule;
};
