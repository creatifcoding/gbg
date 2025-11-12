@component
export class FetchExampleGET extends BaseScriptComponent {
  @input internetModule: InternetModule;

  private ws: WebSocket

  // Method called when the script is awake
  async onAwake() {

    this.ws = this.internetModule.createWebSocket("wss://api.whitebit.com/ws");

    this.ws.binaryType = "blob";

    this.ws.onopen = (event: WebSocketEvent) => {
        this.ws.send("Message from Lens Studio");

        const message: number[] = [11, 22, 33, 44, 55, 66, 77, 88, 99, 100];
        const bytes = new Uint8Array(message);
        this.ws.send(bytes);
    }

    setInterval(() => {
        if (this.ws.readyState === 1) {
            this.ws.send(JSON.stringify({
                id: 0,
                method: "ping",
                params: [],
            }));
        }
    }, 5000);

    this.ws.onerror = (event: WebSocketEvent) => {
        print("WebSocket error: " + event);
    }

    this.ws.onclose = (event: WebSocketEvent) => {
        print("WebSocket closed: " + event);
    }

    this.ws.onmessage = (event: WebSocketEvent) => {
        print("WebSocket message received.");
    }


  }
}