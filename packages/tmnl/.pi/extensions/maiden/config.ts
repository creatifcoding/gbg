/**
 * Maiden Extension — Configuration
 *
 * Strategy types, icons, labels, server endpoints, health check.
 */

// ── Server ───────────────────────────────────────────────────

export const MAIDEN_API = "http://localhost:4848";
export const MAIDEN_WS = "ws://localhost:4848/maiden/websocket?vsn=2.0.0";

// ── Strategies ───────────────────────────────────────────────

export const STRATEGIES = ["react", "cot", "cod", "adaptive"] as const;
export type Strategy = (typeof STRATEGIES)[number];

export function isStrategy(s: string): s is Strategy {
	return (STRATEGIES as readonly string[]).includes(s);
}

export const STRATEGY_ICONS: Record<Strategy, string> = {
	react: "⚡",
	cot: "🔗",
	cod: "📝",
	adaptive: "🔮",
};

export const STRATEGY_LABELS: Record<Strategy, string> = {
	react: "ReAct — Reason + Act loop with tools",
	cot: "Chain of Thought — Step-by-step reasoning",
	cod: "Chain of Draft — Concise iterative drafts",
	adaptive: "Adaptive — Auto-selects best strategy",
};

export const STRATEGY_SHORT: Record<Strategy, string> = {
	react: "ReAct",
	cot: "Chain of Thought",
	cod: "Chain of Draft",
	adaptive: "Adaptive",
};

// ── Tool Display ─────────────────────────────────────────────

/** Friendly names for Melanie's Elixir action modules */
export const TOOL_LABELS: Record<string, string> = {
	read_file: "📖 Read File",
	write_file: "✍️  Write File",
	edit_file: "✏️  Edit File",
	list_files: "📁 List Files",
	bash: "💻 Shell",
	summarize: "📋 Summarize",
	find_connections: "🔗 Find Connections",
	remember: "🧠 Remember",
	recall: "🧠 Recall",
};

export function toolLabel(name: string): string {
	return TOOL_LABELS[name] ?? `🔧 ${name}`;
}

// ── Health Check ─────────────────────────────────────────────

export async function checkServerHealth(): Promise<boolean> {
	try {
		const res = await fetch(`${MAIDEN_API}/api/health`, { signal: AbortSignal.timeout(3000) });
		return res.ok;
	} catch {
		return false;
	}
}
