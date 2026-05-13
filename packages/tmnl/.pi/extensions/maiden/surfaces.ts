/**
 * Maiden Extension — Surface System
 *
 * All UI rendering in one place. Subscribes to MaidenEventBus
 * and manages Pi widget slots, footer, header, and working messages.
 *
 * Surfaces:
 *   melanie-stream  — Live streaming content during asks (above editor)
 *   melanie-status  — Persistent status bar when agent mode on (above editor)
 *   footer          — Strategy/connection indicator in footer
 *   header          — Custom header bar in agent mode
 *   working         — Bottom working message during streaming
 */

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { MaidenEventBus, MaidenEvent } from "./events.js";
import type { MaidenState } from "./state.js";
import type { MelanieChannel } from "./channel.js";
import { STRATEGY_ICONS, STRATEGY_LABELS, type Strategy } from "./config.js";

// ── Stream State (internal to surfaces) ─────────────────────

interface StreamState {
	active: boolean;
	query: string;
	strategy: string;
	answer: string;
	thinking: string;
	iteration: number;
	activeTools: string[];
	toolLog: ToolEntry[];
}

interface ToolEntry {
	name: string;
	args?: string;
	result?: string;
	durationMs?: number;
	done: boolean;
}

function freshStreamState(): StreamState {
	return {
		active: false,
		query: "",
		strategy: "adaptive",
		answer: "",
		thinking: "",
		iteration: 0,
		activeTools: [],
		toolLog: [],
	};
}

// ── Widget IDs ──────────────────────────────────────────────

const STREAM_WIDGET = "melanie-stream";
const STATUS_WIDGET = "melanie-status";

// ── Surface Manager ─────────────────────────────────────────

export class MaidenSurfaces {
	private stream: StreamState = freshStreamState();
	private ctx: ExtensionContext | null = null;

	constructor(
		private bus: MaidenEventBus,
		private state: MaidenState,
		private channel: MelanieChannel,
	) {
		this.bus.on((event) => this.handleEvent(event));
	}

	/** Bind to a context (called on session_start / session_switch) */
	bind(ctx: ExtensionContext): void {
		this.ctx = ctx;
	}

	/** Force a full UI refresh */
	refresh(): void {
		this.renderStatus();
		if (this.stream.active) {
			this.renderStream();
		}
	}

	// ── Event Handler ─────────────────────────────────────────

	private handleEvent(event: MaidenEvent): void {
		switch (event.type) {
			case "stream:start":
				this.stream = { ...freshStreamState(), active: true, query: event.query, strategy: event.strategy };
				this.renderStream();
				this.setWorking("Connecting...");
				break;

			case "stream:delta":
				if (event.chunkType === "thinking") {
					this.stream.thinking += event.text;
				} else {
					this.stream.answer += event.text;
				}
				this.renderStreamThrottled();
				break;

			case "stream:thinking":
				this.stream.thinking += event.text;
				this.renderStreamThrottled();
				break;

			case "stream:llm:start":
				this.stream.iteration = event.iteration;
				this.setWorking(`Thinking (iter ${event.iteration})...`);
				this.renderStream();
				break;

			case "stream:llm:done":
				this.stream.thinking = "";
				this.renderStream();
				break;

			case "stream:tool:start": {
				this.stream.activeTools.push(event.toolName);
				this.stream.toolLog.push({
					name: event.toolName,
					args: event.args,
					done: false,
				});
				this.setWorking(`🔧 ${event.toolName}...`);
				this.renderStream();
				break;
			}

			case "stream:tool:end": {
				this.stream.activeTools = this.stream.activeTools.filter((t) => t !== event.toolName);
				const entry = this.stream.toolLog.find((t) => t.name === event.toolName && !t.done);
				if (entry) {
					entry.done = true;
					entry.result = event.result;
					entry.durationMs = event.durationMs;
				}
				this.setWorking(this.stream.activeTools.length > 0 ? `🔧 ${this.stream.activeTools.join(", ")}...` : "Processing...");
				this.renderStream();
				break;
			}

			case "stream:done":
				this.stream.active = false;
				this.stream.answer = event.answer;
				this.clearStream();
				this.clearWorking();
				this.renderStatus();
				break;

			case "stream:error":
				this.stream.active = false;
				this.clearStream();
				this.clearWorking();
				break;

			case "stream:cancel":
				this.stream.active = false;
				this.clearStream();
				this.clearWorking();
				break;

			case "connection:online":
			case "connection:offline":
			case "conversation:clear":
				this.renderStatus();
				break;

			case "mode:toggle":
				this.renderHeader(event.agentMode);
				this.renderStatus();
				break;

			case "strategy:change":
				this.renderStatus();
				break;
		}
	}

	// ── Stream Widget ─────────────────────────────────────────

	private lastRender = 0;
	private renderTimer: ReturnType<typeof setTimeout> | null = null;

	private renderStreamThrottled(): void {
		const now = Date.now();
		if (now - this.lastRender < 80) {
			// Throttle to ~12fps
			if (!this.renderTimer) {
				this.renderTimer = setTimeout(() => {
					this.renderTimer = null;
					this.renderStream();
				}, 80);
			}
			return;
		}
		this.renderStream();
	}

	private renderStream(): void {
		this.lastRender = Date.now();
		const ctx = this.ctx;
		if (!ctx?.hasUI) return;

		const s = this.stream;
		const icon = STRATEGY_ICONS[s.strategy as Strategy] ?? "🔮";

		ctx.ui.setWidget(STREAM_WIDGET, (_tui, theme) => {
			const lines: string[] = [];

			// Header
			lines.push(
				theme.fg("accent", theme.bold(`${icon} Melanie`)) +
					theme.fg("dim", ` [${s.strategy}]`) +
					(s.iteration > 0 ? theme.fg("dim", ` iter ${s.iteration}`) : ""),
			);

			// Active tools
			for (const tool of s.activeTools) {
				lines.push(theme.fg("warning", `  🔧 ${tool}...`));
			}

			// Completed tools (last 4)
			const doneTool = s.toolLog.filter((t) => t.done).slice(-4);
			for (const t of doneTool) {
				const dur = t.durationMs ? theme.fg("dim", ` ${t.durationMs}ms`) : "";
				const preview = t.result ? ` → ${t.result.slice(0, 50)}${t.result.length > 50 ? "…" : ""}` : "";
				lines.push(theme.fg("success", `  ✓ ${t.name}`) + theme.fg("dim", preview) + dur);
			}

			// Separator + answer text
			if (s.answer) {
				lines.push(theme.fg("dim", "─".repeat(50)));
				const answerLines = s.answer.split("\n");
				const maxLines = 10;
				const tail = answerLines.slice(-maxLines);
				if (answerLines.length > maxLines) {
					lines.push(theme.fg("dim", `  … ${answerLines.length - maxLines} lines above`));
				}
				for (const l of tail) {
					lines.push(l);
				}
			}

			// Thinking (only when no answer yet)
			if (s.thinking && !s.answer) {
				lines.push(theme.fg("dim", "─".repeat(50)));
				const thinkLines = s.thinking.split("\n").slice(-3);
				for (const l of thinkLines) {
					lines.push(theme.fg("muted", theme.italic(`💭 ${l}`)));
				}
			}

			return new Text(lines.join("\n"), 0, 0);
		});
	}

	private clearStream(): void {
		this.ctx?.ui.setWidget(STREAM_WIDGET, undefined);
		if (this.renderTimer) {
			clearTimeout(this.renderTimer);
			this.renderTimer = null;
		}
	}

	// ── Status Widget ─────────────────────────────────────────

	private renderStatus(): void {
		const ctx = this.ctx;
		if (!ctx?.hasUI) return;

		const s = this.state;
		const icon = STRATEGY_ICONS[s.strategy] ?? "🔮";
		const connIcon = this.channel.isConnected ? "⚡" : s.serverOnline ? "◯" : "✗";
		const connColor = this.channel.isConnected ? "success" : s.serverOnline ? "muted" : "error";
		const modeLabel = s.agentMode ? "AGENT" : "TOOL";
		const msgs = s.conversationCount > 0 ? ` · ${s.conversationCount} msgs` : "";

		ctx.ui.setStatus(
			"maiden",
			`${icon} ${modeLabel} [${s.strategy}]${msgs}`,
		);

		// Widget only in agent mode
		if (s.agentMode && !this.stream.active) {
			ctx.ui.setWidget(STATUS_WIDGET, (_tui, theme) => {
				const line =
					theme.fg("accent", theme.bold(`${icon} Melanie`)) +
					theme.fg("dim", ` [${STRATEGY_LABELS[s.strategy]}]`) +
					theme.fg(connColor, ` ${connIcon}`) +
					(s.conversationCount > 0 ? theme.fg("dim", ` · ${s.conversationCount} turns`) : "");
				return new Text(line, 0, 0);
			});
		} else if (!this.stream.active) {
			ctx.ui.setWidget(STATUS_WIDGET, undefined);
		}
	}

	// ── Header ────────────────────────────────────────────────

	private renderHeader(agentMode: boolean): void {
		const ctx = this.ctx;
		if (!ctx?.hasUI) return;

		if (agentMode) {
			ctx.ui.setHeader?.((tui, theme) => {
				const w = tui.width;
				const label = " MELANIE MODE ";
				const pad = Math.max(0, Math.floor((w - label.length) / 2));
				const line = "─".repeat(pad) + label + "─".repeat(w - pad - label.length);
				return {
					render: () => [theme.fg("accent", line)],
					height: 1,
					invalidate: () => {},
				};
			});
		} else {
			ctx.ui.setHeader?.(undefined);
		}
	}

	// ── Working Message ───────────────────────────────────────

	private setWorking(text: string): void {
		const icon = STRATEGY_ICONS[this.stream.strategy as Strategy] ?? "🔮";
		this.ctx?.ui.setWorkingMessage(`${icon} ${text}`);
	}

	private clearWorking(): void {
		this.ctx?.ui.setWorkingMessage();
	}
}
