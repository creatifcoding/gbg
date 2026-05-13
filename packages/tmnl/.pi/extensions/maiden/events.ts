/**
 * Maiden Extension — Typed Event Bus
 *
 * Clean separation between streaming lifecycle (routing.ts)
 * and display concerns (surfaces.ts). Routing emits, surfaces subscribe.
 */

// ── Event Types ──────────────────────────────────────────────

export type MaidenEvent =
	| { type: "stream:start"; query: string; strategy: string }
	| { type: "stream:delta"; text: string; chunkType: string }
	| { type: "stream:thinking"; text: string }
	| { type: "stream:llm:start"; iteration: number }
	| { type: "stream:llm:done"; iteration: number; text: string }
	| { type: "stream:tool:start"; toolName: string; args?: string }
	| { type: "stream:tool:end"; toolName: string; result?: string; durationMs?: number }
	| {
			type: "stream:done";
			answer: string;
			query: string;
			strategy: string;
			ms: number;
			iterations: number;
			usage: { input_tokens: number; output_tokens: number };
			toolsUsed: string[];
	  }
	| { type: "stream:error"; reason: string; query?: string }
	| { type: "stream:cancel" }
	| { type: "connection:online" }
	| { type: "connection:offline" }
	| { type: "conversation:clear" }
	| { type: "mode:toggle"; agentMode: boolean }
	| { type: "strategy:change"; strategy: string };

export type MaidenEventHandler = (event: MaidenEvent) => void;

// ── Event Bus ────────────────────────────────────────────────

export class MaidenEventBus {
	private handlers = new Set<MaidenEventHandler>();

	on(handler: MaidenEventHandler): void {
		this.handlers.add(handler);
	}

	off(handler: MaidenEventHandler): void {
		this.handlers.delete(handler);
	}

	emit(event: MaidenEvent): void {
		for (const handler of this.handlers) {
			try {
				handler(event);
			} catch {
				// Swallow — surfaces should never crash routing
			}
		}
	}
}
