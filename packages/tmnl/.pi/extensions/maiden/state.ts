/**
 * Maiden Extension — State Management
 *
 * MaidenState tracks agent mode, strategy, server status, conversation count.
 * Persists to Pi session entries and restores on session start/switch.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { DEFAULT_STRATEGY, STRATEGIES, type Strategy, isStrategy } from "./config.js";

export interface MaidenState {
	agentMode: boolean;
	strategy: Strategy;
	serverOnline: boolean;
	lastError?: string;
	conversationCount: number;
}

export function createState(): MaidenState {
	return {
		agentMode: false,
		strategy: DEFAULT_STRATEGY,
		serverOnline: false,
		conversationCount: 0,
	};
}

export function persistState(pi: ExtensionAPI, state: MaidenState): void {
	pi.appendEntry("maiden-state", {
		agentMode: state.agentMode,
		strategy: state.strategy,
		conversationCount: state.conversationCount,
	});
}

export function restoreState(state: MaidenState, ctx: ExtensionContext): void {
	for (const entry of ctx.sessionManager.getEntries()) {
		if (entry.type === "custom" && entry.customType === "maiden-state") {
			const data = (entry as any).data;
			if (data) {
				state.strategy = isStrategy(data.strategy) ? data.strategy : DEFAULT_STRATEGY;
				state.conversationCount = data.conversationCount ?? 0;
			}
		}
	}
}
