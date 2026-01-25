import { EguiEventBridge } from '../components/EguiEventBridge';
import { EguiEventProvider } from '../registry';
import { registerPanelType } from '@/lib/floating/PanelRegistry';

export const EGUI_PANEL_TYPE = 'egui-canvas';

export function EguiCanvasPanel({ panelId }: { panelId: string }) {
  return (
    <EguiEventProvider>
      <div className="h-full w-full p-3" data-panel-id={panelId}>
        <EguiEventBridge />
      </div>
    </EguiEventProvider>
  );
}

registerPanelType({
  id: EGUI_PANEL_TYPE,
  title: 'egui Canvas',
  component: EguiCanvasPanel,
  defaultDimensions: { width: 720, height: 520 },
  minDimensions: { width: 420, height: 320 },
  resizable: true,
  minimizable: true,
  closable: true,
});
