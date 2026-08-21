import type { EventStore } from '../kernel/log';
import { KeeperProvider } from '../state/keeper';
import { CopilotHost } from './CopilotHost';
import { Shell } from './Shell';
import './styles.css';

export function App({ store }: { store?: EventStore }) {
  return (
    <CopilotHost>
      <KeeperProvider store={store}>
        <Shell />
      </KeeperProvider>
    </CopilotHost>
  );
}
