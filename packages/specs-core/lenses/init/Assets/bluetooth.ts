@component
export class NewScript extends BaseScriptComponent {
    onAwake() {
        const scanFilter = new Bluetooth.ScanFilter()

        print(scanFilter);
    }
}
