/**
 * Maiden Extension — Orchestrator
 *
 * Wires together the modular pieces:
 *   config.ts    — Strategy types, constants, tool labels
 *   channel.ts   — Persistent Phoenix WebSocket connection
 *   state.ts     — State management + session persistence
 *   events.ts    — Typed event bus (routing → surfaces)
 *   surfaces.ts  — All UI: stream widget, status widget, footer, header
 *   renderers.ts — Custom message renderers
 *   routing.ts   — Stream query → channel → emit events
 *   tool.ts      — ask_maiden LLM tool
 *
 * This file is deliberately thin — it only owns:
 *   1. Creating shared instances (channel, state, bus, surfaces)
 *   2. Registering commands/shortcuts/flags
 *   3. Wiring event handlers
 *   4. The ensureChannel() bridge function
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";
import {
	MAIDEN_API,
	MAIDEN_WS,
	STRATEGIES,
	STRATEGY_ICONS,
	STRATEGY_LABELS,
	STRATEGY_SHORT,
	isStrategy,
	type Strategy,
} from "./config.js";
import { MelanieChannel } from "./channel.js";
import { createState, persistState, restoreState } from "./state.js";
import { MaidenEventBus } from "./events.js";
import { MaidenSurfaces } from "./surfaces.js";
import { registerRenderers } from "./renderers.js";
import { registerTool } from "./tool.js";
import { routeToMelanie } from "./routing.js";

export default function maidenExtension(pi: ExtensionAPI): void {
	// ── Shared Instances ───────────────────────────────────────
	const state = createState();
	const channel = new MelanieChannel(MAIDEN_WS, "maiden:melanie");
	const bus = new MaidenEventBus();
	const surfaces = new MaidenSurfaces(bus, state, channel);

	/** Ensure channel is connected, emitting connection events */
	async function ensureChannel(): Promise<boolean> {
		if (channel.isConnected) {
			state.serverOnline = true;
			return true;
		}
		try {
			await channel.connect();
			state.serverOnline = true;
			bus.emit({ type: "connection:online" });
			return true;
		} catch {
			state.serverOnline = false;
			bus.emit({ type: "connection:offline" });
			return false;
		}
	}

	async function toggleAgentMode(ctx: import("@mariozechner/pi-coding-agent").ExtensionContext): Promise<void> {
		state.agentMode = !state.agentMode;

		if (state.agentMode) {
			const connected = await ensureChannel();
			if (!connected) {
				ctx.ui.notify(`Maiden server not reachable at ${MAIDEN_API}`, "error");
				state.agentMode = false;
				bus.emit({ type: "mode:toggle", agentMode: false });
				return;
			}
			ctx.ui.notify(
				`Melanie activated [${STRATEGY_SHORT[state.strategy]}]. Messages route to Melanie. /melanie to deactivate.`,
				"info",
			);
		} else {
			ctx.ui.notify("Melanie deactivated. Messages return to Pi.", "info");
		}

		bus.emit({ type: "mode:toggle", agentMode: state.agentMode });
		persistState(pi, state);
	}

	// ── Registration ───────────────────────────────────────────

	registerRenderers(pi);
	registerTool(pi, state, channel, bus, ensureChannel);

	// ── Flag ───────────────────────────────────────────────────

	pi.registerFlag("melanie", {
		description: "Start with Melanie agent mode active",
		type: "boolean",
		default: false,
	});

	// ── Commands ───────────────────────────────────────────────

	pi.registerCommand("melanie", {
		description: "Toggle Melanie agent mode, or send a one-shot query",
		getArgumentCompletions: (prefix: string) => {
			const items = [
				{ value: "on", label: "on", description: "Activate Melanie" },
				{ value: "off", label: "off", description: "Deactivate Melanie" },
				{ value: "clear", label: "clear", description: "Clear conversation history" },
				...STRATEGIES.map((s) => ({
					value: s,
					label: `${STRATEGY_ICONS[s]} ${s}`,
					description: STRATEGY_LABELS[s],
				})),
			];
			const filtered = items.filter((i) => i.value.startsWith(prefix));
			return filtered.length > 0 ? filtered : null;
		},
		handler: async (args, ctx) => {
			const trimmed = args.trim();

			if (!trimmed || trimmed === "on" || trimmed === "off") {
				if (trimmed === "on" && state.agentMode) {
					ctx.ui.notify("Melanie is already active", "info");
					return;
				}
				if (trimmed === "off" && !state.agentMode) {
					ctx.ui.notify("Melanie is already inactive", "info");
					return;
				}
				await toggleAgentMode(ctx);
				return;
			}

			if (trimmed === "clear") {
				channel.clearHistory();
				state.conversationCount = 0;
				bus.emit({ type: "conversation:clear" });
				ctx.ui.notify("Melanie's conversation memory cleared", "info");
				persistState(pi, state);
				return;
			}

			if (isStrategy(trimmed)) {
				state.strategy = trimmed;
				bus.emit({ type: "strategy:change", strategy: trimmed });
				ctx.ui.notify(`Strategy: ${STRATEGY_ICONS[trimmed]} ${STRATEGY_SHORT[trimmed]}`, "info");
				persistState(pi, state);
				return;
			}

			// One-shot query
			const connected = await ensureChannel();
			if (!connected) {
				ctx.ui.notify(`Maiden server not reachable at ${MAIDEN_API}`, "error");
				return;
			}
			await routeToMelanie(trimmed, pi, ctx, state, channel, bus, ensureChannel);
		},
	});

	pi.registerCommand("strategy", {
		description: "Select Melanie's reasoning strategy",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;

			const options = STRATEGIES.map((s) => `${STRATEGY_ICONS[s]} ${STRATEGY_SHORT[s]} — ${STRATEGY_LABELS[s]}`);
			const choice = await ctx.ui.select("Select reasoning strategy:", options);
			if (!choice) return;

			const selected = STRATEGIES.find((s) => choice.includes(STRATEGY_SHORT[s]));
			if (selected) {
				state.strategy = selected;
				bus.emit({ type: "strategy:change", strategy: selected });
				ctx.ui.notify(`Strategy: ${STRATEGY_ICONS[selected]} ${STRATEGY_SHORT[selected]}`, "info");
				persistState(pi, state);
			}
		},
	});

	// ── Shortcut ───────────────────────────────────────────────

	pi.registerShortcut(Key.ctrlAlt("m"), {
		description: "Toggle Melanie agent mode",
		handler: async (ctx) => toggleAgentMode(ctx),
	});

	// ── Input Interception ─────────────────────────────────────

	pi.on("input", async (event, ctx) => {
		if (!state.agentMode) return { action: "continue" as const };
		if (event.source === "extension") return { action: "continue" as const };

		await routeToMelanie(event.text, pi, ctx, state, channel, bus, ensureChannel);
		return { action: "handled" as const };
	});

	// ── Session Events ─────────────────────────────────────────

	pi.on("session_start", async (_event, ctx) => {
		restoreState(state, ctx);
		surfaces.bind(ctx);

		if (pi.getFlag("melanie") === true && !state.agentMode) {
			state.agentMode = true;
			const connected = await ensureChannel();
			if (!connected) {
				state.agentMode = false;
				ctx.ui.notify(`Maiden server not reachable at ${MAIDEN_API}`, "error");
			}
		}

		bus.emit({ type: "mode:toggle", agentMode: state.agentMode });
	});

	pi.on("session_shutdown", async () => {
		channel.disconnect();
	});

	pi.on("session_switch", async (_event, ctx) => {
		restoreState(state, ctx);
		surfaces.bind(ctx);
		bus.emit({ type: "mode:toggle", agentMode: state.agentMode });
	});
}
