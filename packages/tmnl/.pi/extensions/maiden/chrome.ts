/**
 * Maiden Extension — UI Chrome
 *
 * Powerline footer, widget above editor, custom header.
 * All UI that frames the Melanie experience in Pi's TUI.
 */

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { MAIDEN_API, STRATEGY_ICONS, STRATEGY_LABELS, type Strategy } from "./config.js";
import type { MelanieChannel } from "./channel.js";
import type { MaidenState } from "./state.js";

export function updateChrome(ctx: ExtensionContext, state: MaidenState, channel: MelanieChannel): void {
	if (!ctx.hasUI) return;
	const th = ctx.ui.theme;

	// ── Footer Status ──
	if (state.agentMode) {
		const icon = STRATEGY_ICONS[state.strategy];
		const name = th.fg("accent", "Melanie");
		const strat = th.fg("muted", `[${state.strategy}]`);
		const conn = channel.isConnected ? th.fg("success", "●") : th.fg("error", "●");
		ctx.ui.setStatus("maiden", `${conn} ${icon} ${name} ${strat}`);
	} else {
		ctx.ui.setStatus("maiden", undefined);
	}

	// ── Widget Above Editor ──
	if (state.agentMode) {
		ctx.ui.setWidget("maiden-agent", (_tui, theme) => {
			const conn = channel.isConnected ? theme.fg("success", "●") : theme.fg("error", "●");
			const icon = STRATEGY_ICONS[state.strategy];
			const modeLine =
				`${conn} ${icon} ${theme.fg("accent", theme.bold("Melanie"))} ` +
				`${theme.fg("dim", "—")} ${theme.fg("muted", STRATEGY_LABELS[state.strategy])}`;

			const rightSide = channel.isConnected
				? theme.fg("dim", `ws connected • ${state.conversationCount} msgs`)
				: theme.fg("error", "✗ disconnected");

			return {
				render(width: number): string[] {
					const sep = theme.fg("dim", "─".repeat(width));
					return [sep, ` ${modeLine}  ${rightSide}`, sep];
				},
				invalidate() {},
			};
		});
	} else {
		ctx.ui.setWidget("maiden-agent", undefined);
	}
}

export function setHeader(ctx: ExtensionContext, active: boolean): void {
	if (!ctx.hasUI) return;

	if (active) {
		ctx.ui.setHeader((_tui, theme) => ({
			render(_width: number): string[] {
				const name = theme.fg("accent", theme.bold("  MELANIE"));
				const sub = theme.fg("muted", "  Knowledge Librarian • mAIden Agent");
				const line3 = theme.fg("dim", "  ─────────────────────────────────");
				return ["", name, sub, line3, ""];
			},
			invalidate() {},
		}));
	} else {
		ctx.ui.setHeader(undefined);
	}
}
