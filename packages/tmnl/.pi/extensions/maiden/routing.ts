/**
 * Maiden Extension — Streaming Query Router
 *
 * Pure lifecycle management — routes a query through the channel
 * and emits typed events. Display is handled by surfaces.ts.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { MAIDEN_API } from "./config.js";
import type { MelanieChannel } from "./channel.js";
import type { MaidenState } from "./state.js";
import type { MaidenEventBus } from "./events.js";
import { persistState } from "./state.js";

export async function routeToMelanie(
	query: string,
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	state: MaidenState,
	channel: MelanieChannel,
	bus: MaidenEventBus,
	ensureChannel: () => Promise<boolean>,
): Promise<void> {
	// Inject "thinking" indicator
	pi.sendMessage(
		{
			customType: "melanie-thinking",
			content: query,
			display: true,
			details: { strategy: state.strategy, query },
		},
		{ triggerTurn: false },
	);

	let answer = "";
	let toolsUsed: string[] = [];
	let iterations = 0;
	let totalMs = 0;
	let usage = { input_tokens: 0, output_tokens: 0 };

	bus.emit({ type: "stream:start", query, strategy: state.strategy });

	try {
		const connected = await ensureChannel();
		if (!connected) {
			throw new Error(`Server not reachable at ${MAIDEN_API}`);
		}

		await channel.ask(query, state.strategy, {
			onRequestStart: () => {
				// No-op — stream:start already emitted
			},

			onLlmStart: (payload) => {
				const iter = (payload.iteration as number) ?? 1;
				iterations = iter;
				bus.emit({ type: "stream:llm:start", iteration: iter });
			},

			onDelta: (text, chunkType) => {
				if (chunkType === "thinking") {
					bus.emit({ type: "stream:thinking", text });
				} else {
					answer += text;
					bus.emit({ type: "stream:delta", text, chunkType });
				}
			},

			onLlmDone: (payload) => {
				const iter = (payload.iteration as number) ?? iterations;
				const text = (payload.text as string) ?? "";
				bus.emit({ type: "stream:llm:done", iteration: iter, text });
			},

			onToolStart: (toolName, payload) => {
				const args = payload.arguments as string | undefined;
				bus.emit({ type: "stream:tool:start", toolName, args });
			},

			onToolEnd: (toolName, payload) => {
				const result = payload.result as string | undefined;
				toolsUsed.push(toolName);
				bus.emit({ type: "stream:tool:end", toolName, result });
			},

			onDone: (finalAnswer, payload) => {
				answer = finalAnswer;
				totalMs = (payload.ms as number) ?? 0;
				iterations = (payload.iterations as number) ?? iterations;
				usage = (payload.usage as typeof usage) ?? usage;
			},

			onError: (reason) => {
				throw new Error(reason);
			},
		});

		state.conversationCount++;

		bus.emit({
			type: "stream:done",
			answer,
			query,
			strategy: state.strategy,
			ms: totalMs,
			iterations,
			usage,
			toolsUsed,
		});

		// Inject final answer as a custom rendered message
		pi.sendMessage(
			{
				customType: "melanie-response",
				content: answer,
				display: true,
				details: {
					strategy: state.strategy,
					agent: "melanie",
					ms: totalMs,
					iterations,
					usage,
					query,
					toolsUsed,
				},
			},
			{ triggerTurn: false },
		);

		persistState(pi, state);
	} catch (err: any) {
		bus.emit({ type: "stream:error", reason: err.message, query });

		state.lastError = err.message;

		if (
			err.message?.includes("WebSocket") ||
			err.message?.includes("Connection") ||
			err.message?.includes("not reachable")
		) {
			state.serverOnline = false;
			bus.emit({ type: "connection:offline" });
		}

		pi.sendMessage(
			{
				customType: "melanie-error",
				content: `Failed to reach Melanie: ${err.message}`,
				display: true,
				details: { error: err.message, query },
			},
			{ triggerTurn: false },
		);
	}
}
