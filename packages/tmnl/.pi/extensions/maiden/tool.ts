/**
 * Maiden Extension — ask_maiden Tool
 *
 * LLM-callable tool that queries Melanie with streaming onUpdate.
 * Emits events through the bus so surfaces can display progress.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { MAIDEN_API, STRATEGY_ICONS, STRATEGY_SHORT, toolLabel, type Strategy } from "./config.js";
import type { MelanieChannel } from "./channel.js";
import type { MaidenState } from "./state.js";
import type { MaidenEventBus } from "./events.js";

export function registerTool(
	pi: ExtensionAPI,
	state: MaidenState,
	channel: MelanieChannel,
	bus: MaidenEventBus,
	ensureChannel: () => Promise<boolean>,
): void {
	pi.registerTool({
		name: "ask_maiden",
		label: "Ask Maiden",
		description:
			"Query Melanie, the Knowledge Librarian agent. She searches across codebases, documentation, and notes to find information, summarize content, and discover connections. Use this when you need to search for knowledge, find cross-references, or get summaries of technical content.",
		parameters: Type.Object({
			query: Type.String({ description: "The question or search query for Melanie" }),
			strategy: Type.Optional(
				StringEnum(["react", "cot", "cod", "adaptive"] as const, {
					description: "Reasoning strategy. Default: adaptive (auto-selects)",
				}),
			),
		}),

		async execute(_toolCallId, params, signal, onUpdate, _ctx) {
			const strategy = (params.strategy as Strategy) ?? state.strategy;

			onUpdate?.({
				content: [{ type: "text", text: `Connecting to Melanie [${strategy}]...` }],
				details: { status: "connecting", strategy },
			});

			try {
				const connected = await ensureChannel();
				if (!connected) {
					return {
						content: [
							{
								type: "text",
								text: `Maiden server is offline at ${MAIDEN_API}. Start it with: cd src/lib/maidens/server && iex -S mix phx.server`,
							},
						],
						details: { error: "server_offline" },
						isError: true,
					};
				}

				let answer = "";
				let toolsUsed: string[] = [];
				let totalMs = 0;
				let iterations = 0;
				let usage = { input_tokens: 0, output_tokens: 0 };

				bus.emit({ type: "stream:start", query: params.query, strategy });

				await channel.ask(params.query, strategy, {
					onRequestStart: () => {
						onUpdate?.({
							content: [{ type: "text", text: `Melanie is reasoning [${strategy}]...` }],
							details: { status: "reasoning", strategy },
						});
					},

					onLlmStart: (payload) => {
						const iter = (payload.iteration as number) ?? 1;
						iterations = iter;
						bus.emit({ type: "stream:llm:start", iteration: iter });
					},

					onDelta: (text, chunkType) => {
						if (chunkType !== "thinking") {
							answer += text;
							onUpdate?.({
								content: [{ type: "text", text: answer }],
								details: { status: "streaming", strategy },
							});
						}
						bus.emit({ type: "stream:delta", text, chunkType });
					},

					onToolStart: (toolName, payload) => {
						bus.emit({ type: "stream:tool:start", toolName, args: payload.arguments as string });
						onUpdate?.({
							content: [{ type: "text", text: `${answer}\n\n${toolLabel(toolName)}...` }],
							details: { status: "tool", strategy, tool: toolName },
						});
					},

					onToolEnd: (toolName, payload) => {
						toolsUsed.push(toolName);
						bus.emit({ type: "stream:tool:end", toolName, result: payload.result as string });
					},

					onDone: (finalAnswer, payload) => {
						answer = finalAnswer;
						totalMs = (payload.ms as number) ?? 0;
						iterations = (payload.iterations as number) ?? iterations;
						usage = (payload.usage as typeof usage) ?? usage;
					},

					onError: (reason) => {
						bus.emit({ type: "stream:error", reason });
						throw new Error(reason);
					},
				}, signal);

				state.conversationCount++;

				bus.emit({
					type: "stream:done",
					answer,
					query: params.query,
					strategy,
					ms: totalMs,
					iterations,
					usage,
					toolsUsed,
				});

				return {
					content: [{ type: "text", text: answer }],
					details: { strategy, agent: "melanie", ms: totalMs, iterations, usage, toolsUsed },
				};
			} catch (err: any) {
				return {
					content: [{ type: "text", text: `Melanie error: ${err.message}` }],
					details: { error: err.message, query: params.query },
					isError: true,
				};
			}
		},

		renderCall(args, theme) {
			const strategy = args.strategy ?? state.strategy;
			const icon = STRATEGY_ICONS[strategy as Strategy] ?? "📚";
			const label = STRATEGY_SHORT[strategy as Strategy] ?? strategy;

			const text =
				theme.fg("toolTitle", theme.bold("ask_maiden ")) +
				theme.fg("dim", `[${label}] `) +
				theme.fg("muted", `"${args.query}"`);
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) {
				const details = result.details as Record<string, unknown> | undefined;
				const status = (details?.status as string) ?? "working";
				const strategy = (details?.strategy as string) ?? "adaptive";
				const tool = details?.tool as string | undefined;
				const icon = STRATEGY_ICONS[strategy as Strategy] ?? "🔮";
				const toolStr = tool ? ` ${toolLabel(tool)}` : "";
				return new Text(theme.fg("warning", `${icon} ${status}${toolStr}...`), 0, 0);
			}

			const details = result.details as Record<string, unknown> | undefined;

			if (details?.error) {
				return new Text(theme.fg("error", `✗ ${details.error}`), 0, 0);
			}

			const strategy = (details?.strategy as string) ?? "unknown";
			const ms = details?.ms as number | undefined;
			const iterations = details?.iterations as number | undefined;
			const usage = details?.usage as { input_tokens: number; output_tokens: number } | undefined;
			const toolsUsed = (details?.toolsUsed as string[]) ?? [];
			const icon = STRATEGY_ICONS[strategy as Strategy] ?? "📚";

			let text =
				theme.fg("success", "✓ ") +
				theme.fg("accent", `${icon} Melanie`) +
				theme.fg("dim", ` [${STRATEGY_SHORT[strategy as Strategy] ?? strategy}]`) +
				(ms ? theme.fg("dim", ` ${(ms / 1000).toFixed(1)}s`) : "") +
				(iterations ? theme.fg("dim", ` ${iterations} iter`) : "") +
				(usage ? theme.fg("dim", ` ${usage.input_tokens}↓${usage.output_tokens}↑`) : "");

			if (toolsUsed.length > 0) {
				text += "\n" + toolsUsed.map((t) => theme.fg("success", `  ✓ ${toolLabel(t)}`)).join("\n");
			}

			if (expanded) {
				const content = result.content[0];
				if (content?.type === "text") {
					const lines = content.text.split("\n").slice(0, 20);
					text += "\n" + theme.fg("dim", "─".repeat(40));
					text += "\n" + lines.map((l: string) => `  ${l}`).join("\n");
					if (content.text.split("\n").length > 20) {
						text += "\n" + theme.fg("dim", `  … ${content.text.split("\n").length - 20} more lines`);
					}
				}
			}

			return new Text(text, 0, 0);
		},
	});
}
