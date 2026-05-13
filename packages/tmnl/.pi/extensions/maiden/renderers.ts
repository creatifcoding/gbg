/**
 * Maiden Extension — Message Renderers
 *
 * Custom TUI rendering for Melanie's injected messages:
 *   - melanie-response: Full answer with metadata + tool log
 *   - melanie-thinking: Inline "asking..." indicator
 *   - melanie-error: Error display
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Box, Text } from "@mariozechner/pi-tui";
import { STRATEGY_ICONS, STRATEGY_SHORT, toolLabel, type Strategy } from "./config.js";

export function registerRenderers(pi: ExtensionAPI): void {
	pi.registerMessageRenderer("melanie-response", (message, { expanded }, theme) => {
		const details = message.details as {
			strategy?: string;
			ms?: number;
			iterations?: number;
			usage?: { input_tokens: number; output_tokens: number };
			query?: string;
			toolsUsed?: string[];
		} | undefined;

		const strategy = details?.strategy ?? "unknown";
		const ms = details?.ms;
		const iterations = details?.iterations;
		const usage = details?.usage;
		const toolsUsed = details?.toolsUsed ?? [];
		const icon = STRATEGY_ICONS[strategy as Strategy] ?? "📚";
		const label = STRATEGY_SHORT[strategy as Strategy] ?? strategy;

		// Header line
		const header =
			theme.fg("accent", theme.bold(`${icon} Melanie`)) +
			theme.fg("dim", ` [${label}]`) +
			(ms ? theme.fg("dim", ` ${(ms / 1000).toFixed(1)}s`) : "") +
			(iterations && iterations > 1 ? theme.fg("dim", ` ${iterations} iter`) : "") +
			(usage ? theme.fg("dim", ` ${usage.input_tokens}↓${usage.output_tokens}↑`) : "");

		// Tool log
		let toolSection = "";
		if (toolsUsed.length > 0) {
			toolSection = "\n" + toolsUsed.map(t => theme.fg("success", `  ✓ ${toolLabel(t)}`)).join("\n");
		}

		const sep = theme.fg("dim", "─".repeat(50));
		let text = `${header}${toolSection}\n${sep}\n${message.content}`;

		if (expanded && details?.query) {
			text += `\n\n${theme.fg("dim", "Query: ")}${theme.fg("muted", details.query)}`;
		}

		const box = new Box(1, 1, (t: string) => theme.bg("customMessageBg", t));
		box.addChild(new Text(text, 0, 0));
		return box;
	});

	pi.registerMessageRenderer("melanie-thinking", (message, _options, theme) => {
		const details = message.details as { strategy?: string } | undefined;
		const strategy = (details?.strategy as Strategy) ?? "adaptive";
		const icon = STRATEGY_ICONS[strategy] ?? "🔮";
		const label = STRATEGY_SHORT[strategy] ?? strategy;

		const text =
			theme.fg("dim", `${icon} `) +
			theme.fg("muted", theme.italic(`Asking Melanie [${label}]: `)) +
			theme.fg("dim", `"${message.content}"`);

		return new Text(text, 0, 0);
	});

	pi.registerMessageRenderer("melanie-error", (message, _options, theme) => {
		const text =
			theme.fg("error", "✗ ") +
			theme.fg("accent", "Melanie: ") +
			theme.fg("error", message.content);
		return new Text(text, 1, 0);
	});
}
