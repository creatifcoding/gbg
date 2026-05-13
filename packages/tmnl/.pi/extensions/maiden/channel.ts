/**
 * Maiden Extension — Phoenix Channel Client
 *
 * Persistent WebSocket connection using Phoenix V2 JSON protocol.
 * One connection per Pi session — conversation history is maintained
 * server-side in Jido.AI.Context.
 *
 * Wire format: [join_ref, ref, topic, event, payload]
 */

export interface StreamCallbacks {
	onRequestStart?: (payload: Record<string, unknown>) => void;
	onDelta?: (text: string, chunkType: string) => void;
	onLlmStart?: (payload: Record<string, unknown>) => void;
	onLlmDone?: (payload: Record<string, unknown>) => void;
	onToolStart?: (toolName: string, payload: Record<string, unknown>) => void;
	onToolEnd?: (toolName: string, payload: Record<string, unknown>) => void;
	onDone?: (answer: string, payload: Record<string, unknown>) => void;
	onError?: (reason: string, payload: Record<string, unknown>) => void;
}

export class MelanieChannel {
	private ws: WebSocket | null = null;
	private refCounter = 0;
	private joinRef: string | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private replyResolvers = new Map<string, (payload: Record<string, unknown>) => void>();

	// Per-request streaming state — swapped for each ask
	private streamCallbacks: StreamCallbacks | null = null;
	private streamResolve: (() => void) | null = null;
	private streamReject: ((err: Error) => void) | null = null;

	constructor(
		private url: string,
		private topic: string,
	) {}

	// ── Public API ───────────────────────────────────────────────────

	get isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN && this.joinRef !== null;
	}

	/**
	 * Connect to WebSocket and join the channel.
	 * Call once — connection persists across asks.
	 * Safe to call multiple times (no-ops if already connected).
	 */
	async connect(): Promise<void> {
		if (this.isConnected) return;

		this.cleanup();

		return new Promise((resolve, reject) => {
			this.ws = new WebSocket(this.url);

			this.ws.onopen = async () => {
				this.startHeartbeat();

				try {
					await this.join();
					resolve();
				} catch (e) {
					reject(e);
				}
			};

			this.ws.onerror = () => {
				reject(new Error("WebSocket connection failed"));
			};

			this.ws.onclose = () => {
				this.cleanup();
				// Reject any in-flight stream
				this.streamReject?.(new Error("Connection closed"));
				this.clearStreamState();
			};

			this.ws.onmessage = (event) => {
				this.handleMessage(event.data as string);
			};
		});
	}

	/**
	 * Stream an ask over the persistent channel.
	 * Conversation history is maintained server-side in Jido.AI.Context.
	 * Resolves when the stream completes (done/error/cancel).
	 */
	async ask(query: string, strategy: string, callbacks: StreamCallbacks, signal?: AbortSignal): Promise<void> {
		if (!this.isConnected) {
			await this.connect();
		}

		this.streamCallbacks = callbacks;

		const onAbort = () => {
			this.push("cancel", {});
			this.streamReject?.(new Error("Aborted"));
			this.clearStreamState();
		};
		signal?.addEventListener("abort", onAbort, { once: true });

		try {
			await new Promise<void>((resolve, reject) => {
				this.streamResolve = resolve;
				this.streamReject = reject;
				this.push("ask", { query, strategy });
			});
		} finally {
			signal?.removeEventListener("abort", onAbort);
			this.clearStreamState();
		}
	}

	/** Clear server-side conversation history */
	clearHistory(): void {
		if (this.isConnected) {
			this.push("clear", {});
		}
	}

	/** Cleanly close the WebSocket */
	disconnect(): void {
		if (this.ws) {
			this.ws.close(1000);
		}
		this.cleanup();
	}

	// ── Protocol ─────────────────────────────────────────────────────

	private async join(): Promise<void> {
		this.joinRef = this.nextRef();
		const ref = this.joinRef;

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error("Join timeout")), 10_000);

			this.replyResolvers.set(ref, (payload) => {
				clearTimeout(timeout);
				const resp = payload as { status?: string };
				if (resp.status === "ok") {
					resolve();
				} else {
					reject(new Error(`Join failed: ${JSON.stringify(payload)}`));
				}
			});

			this.send(this.joinRef, ref, this.topic, "phx_join", {});
		});
	}

	private push(event: string, payload: unknown): string {
		const ref = this.nextRef();
		this.send(this.joinRef, ref, this.topic, event, payload);
		return ref;
	}

	private handleMessage(raw: string): void {
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return;
		}

		if (!Array.isArray(parsed) || parsed.length < 5) return;

		const [, ref, topic, event, payload] = parsed as [
			string | null,
			string | null,
			string,
			string,
			Record<string, unknown>,
		];

		// Handle replies (join, heartbeat)
		if (event === "phx_reply" && ref && this.replyResolvers.has(ref)) {
			const resolver = this.replyResolvers.get(ref)!;
			this.replyResolvers.delete(ref);
			resolver(payload);
			return;
		}

		// Route channel events to streaming callbacks
		if (topic === this.topic && this.streamCallbacks) {
			this.handleStreamEvent(event, (payload ?? {}) as Record<string, unknown>);
		}
	}

	private handleStreamEvent(event: string, payload: Record<string, unknown>): void {
		const cb = this.streamCallbacks;
		if (!cb) return;

		switch (event) {
			case "request:start":
				cb.onRequestStart?.(payload);
				break;
			case "llm:start":
				cb.onLlmStart?.(payload);
				break;
			case "delta":
				cb.onDelta?.(payload.text as string ?? "", payload.chunk_type as string ?? "content");
				break;
			case "llm:done":
				cb.onLlmDone?.(payload);
				break;
			case "tool:start":
				cb.onToolStart?.(payload.tool_name as string ?? "unknown", payload);
				break;
			case "tool:end":
				cb.onToolEnd?.(payload.tool_name as string ?? "unknown", payload);
				break;
			case "done":
				cb.onDone?.(payload.answer as string ?? "", payload);
				this.streamResolve?.();
				break;
			case "error":
				cb.onError?.(payload.reason as string ?? "unknown", payload);
				this.streamReject?.(new Error(payload.reason as string ?? "Stream error"));
				break;
			case "cancelled":
				this.streamResolve?.();
				break;
		}
	}

	// ── Internals ────────────────────────────────────────────────────

	private nextRef(): string {
		return String(++this.refCounter);
	}

	private send(joinRef: string | null, ref: string | null, topic: string, event: string, payload: unknown): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify([joinRef, ref, topic, event, payload]));
		}
	}

	private startHeartbeat(): void {
		this.heartbeatTimer = setInterval(() => {
			this.send(null, this.nextRef(), "phoenix", "heartbeat", {});
		}, 30_000);
	}

	private clearStreamState(): void {
		this.streamCallbacks = null;
		this.streamResolve = null;
		this.streamReject = null;
	}

	private cleanup(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
		this.ws = null;
		this.joinRef = null;
		this.replyResolvers.clear();
		this.clearStreamState();
	}
}
