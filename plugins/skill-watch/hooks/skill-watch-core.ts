import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface SkillExpectation {
	skill: string;
	reason: string;
	confidence: "high" | "medium" | "low";
}

export interface ClassificationInput {
	prompt?: string;
	cwd?: string;
	touchedFiles?: string[];
}

export interface SkillWatchEvent {
	type: "prompt" | "tool" | "deviation" | "promotion";
	createdAt: string;
	skill?: string;
	key?: string;
	message?: string;
	prompt?: string;
	cwd?: string;
	expectations?: SkillExpectation[];
	toolName?: string;
	command?: string;
	exitCode?: number;
	touchedFiles?: string[];
}

export interface PromotionCandidate {
	skill: string;
	key: string;
	count: number;
	messages: string[];
}

const DEFAULT_MARKETPLACE = path.join(
	os.homedir(),
	"repos",
	"bokendell",
	"skills-marketplace",
);

const SKILL_PATHS: Record<string, string> = {
	"dev:dev-build": "plugins/dev/skills/dev-build/SKILL.md",
	"dev:dev-plan": "plugins/dev/skills/dev-plan/SKILL.md",
	"dev:dev-research": "plugins/dev/skills/dev-research/SKILL.md",
	"dev:dev-ship": "plugins/dev/skills/dev-ship/SKILL.md",
	"dev:design": "plugins/dev/skills/design/SKILL.md",
	"dev:review": "plugins/dev/skills/review/SKILL.md",
	"dev:scope-detection": "plugins/dev/skills/scope-detection/SKILL.md",
	"skill-watch:skill-watch": "plugins/skill-watch/skills/skill-watch/SKILL.md",
	"skill-watch:skill-watch-promote":
		"plugins/skill-watch/skills/skill-watch-promote/SKILL.md",
	"skill-watch:skill-watch-review":
		"plugins/skill-watch/skills/skill-watch-review/SKILL.md",
};

export function normalizeSkillName(skill: string): string {
	const clean = skill.trim().replace(/^\/+/, "");
	if (clean.includes(":")) return clean;
	const devSkills = new Set([
		"dev",
		"dev-build",
		"dev-plan",
		"dev-research",
		"dev-ship",
		"design",
		"review",
		"scope-detection",
	]);
	if (devSkills.has(clean)) return `dev:${clean}`;
	if (clean.startsWith("skill-watch")) return `skill-watch:${clean}`;
	return clean;
}

export function classifyPrompt(input: ClassificationInput): SkillExpectation[] {
	const prompt = (input.prompt ?? "").toLowerCase();
	const cwd = (input.cwd ?? "").toLowerCase();
	const files = (input.touchedFiles ?? []).join("\n").toLowerCase();
	const haystack = [prompt, cwd, files].join("\n");
	const expectations = new Map<string, SkillExpectation>();
	const add = (
		skill: string,
		reason: string,
		confidence: SkillExpectation["confidence"] = "medium",
	) => {
		expectations.set(skill, { skill, reason, confidence });
	};

	add(
		"skill-watch:skill-watch",
		"Record skill expectations and drift signals for this turn.",
		"low",
	);

	if (
		/\b(review|audit|pattern|ddd|architecture|arch|check arch|biome|lint|violation|standard)\b/.test(
			haystack,
		)
	) {
		add(
			"dev:review",
			"Prompt asks for standards, architecture, or pattern review.",
			"high",
		);
	}

	if (
		/\b(implement|fix|build|migrate|wire|refactor|test|tdd|service|repository|route|api|schema|mobile)\b/.test(
			haystack,
		)
	) {
		add(
			"dev:dev-build",
			"Prompt changes code or asks for implementation workflow.",
			"medium",
		);
	}

	if (
		/\b(design|ui|ux|studio|sketch|mock|prototype|visual|screen|component|primitive|motion|animation|polish|golf-design-studio)\b/.test(
			haystack,
		) ||
		/apps\/design|packages\/ui|apps\/mobile|apps\/admin/.test(haystack)
	) {
		add(
			"dev:design",
			"Prompt or path involves visual/design/studio work; design now owns app-specific studio routing.",
			"high",
		);
	}

	if (
		/\b(linear|prd|plan|issue breakdown|break down|research|design doc)\b/.test(
			haystack,
		)
	) {
		add(
			"dev:dev-plan",
			"Prompt touches planning or Linear issue decomposition.",
			"medium",
		);
	}

	if (/\b(ship|commit|push|pr|pull request|merge)\b/.test(haystack)) {
		add("dev:dev-ship", "Prompt asks for shipping or PR workflow.", "high");
	}

	return [...expectations.values()];
}

export function recommendValidationCommands(input: {
	hasSwarmCli: boolean;
	touchedFiles: string[];
}): string[] {
	const commands: string[] = [];
	if (input.hasSwarmCli) {
		commands.push("pnpm swarm check arch");
	}
	const touchedSource = input.touchedFiles.filter((file) =>
		/\.(ts|tsx|js|jsx|json|md)$/.test(file),
	);
	if (touchedSource.length > 0) {
		commands.push(`pnpm exec biome check ${touchedSource.join(" ")}`);
	}
	if (input.touchedFiles.some((file) => file.includes("/domains/"))) {
		commands.push("pnpm test -- --run");
	}
	return commands;
}

export function groupPromotionCandidates(
	events: SkillWatchEvent[],
	threshold = 3,
): PromotionCandidate[] {
	const groups = new Map<string, PromotionCandidate>();
	for (const event of events) {
		if (event.type !== "deviation" || !event.skill || !event.key) continue;
		const groupKey = `${event.skill}::${event.key}`;
		const current = groups.get(groupKey) ?? {
			skill: event.skill,
			key: event.key,
			count: 0,
			messages: [],
		};
		current.count += 1;
		if (event.message && !current.messages.includes(event.message)) {
			current.messages.push(event.message);
		}
		groups.set(groupKey, current);
	}
	return [...groups.values()]
		.filter((candidate) => candidate.count >= threshold)
		.sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill));
}

export function resolveMarketplaceRoot(
	pluginRoot = process.env.CLAUDE_PLUGIN_ROOT ?? process.env.CODEX_PLUGIN_ROOT,
): string {
	if (process.env.SKILL_WATCH_MARKETPLACE_ROOT) {
		return process.env.SKILL_WATCH_MARKETPLACE_ROOT;
	}
	if (pluginRoot) {
		const local = path.resolve(pluginRoot, "..", "..");
		if (fs.existsSync(path.join(local, ".claude-plugin", "marketplace.json"))) {
			return local;
		}
	}
	if (
		fs.existsSync(
			path.join(DEFAULT_MARKETPLACE, ".claude-plugin", "marketplace.json"),
		)
	) {
		return DEFAULT_MARKETPLACE;
	}
	return process.cwd();
}

export function getSkillWatchDir(marketplaceRoot: string): string {
	return path.join(marketplaceRoot, ".skill-watch");
}

export function appendEvent(
	marketplaceRoot: string,
	event: Omit<SkillWatchEvent, "createdAt">,
): SkillWatchEvent {
	const full: SkillWatchEvent = {
		...event,
		createdAt: new Date().toISOString(),
	};
	const dir = getSkillWatchDir(marketplaceRoot);
	fs.mkdirSync(dir, { recursive: true });
	fs.appendFileSync(
		path.join(dir, "events.jsonl"),
		`${JSON.stringify(full)}\n`,
	);
	return full;
}

export function readEvents(marketplaceRoot: string): SkillWatchEvent[] {
	const file = path.join(getSkillWatchDir(marketplaceRoot), "events.jsonl");
	if (!fs.existsSync(file)) return [];
	return fs
		.readFileSync(file, "utf8")
		.split("\n")
		.filter(Boolean)
		.flatMap((line) => {
			try {
				return [JSON.parse(line) as SkillWatchEvent];
			} catch {
				return [];
			}
		});
}

export function hasSwarmCli(cwd: string): boolean {
	if (fs.existsSync(path.join(cwd, "bokendell.config.json"))) return true;
	try {
		execFileSync("pnpm", ["swarm", "--help"], {
			cwd,
			stdio: "ignore",
			timeout: 3000,
		});
		return true;
	} catch {
		return false;
	}
}

export function getChangedFiles(cwd: string): string[] {
	const git = (args: string[]) => {
		try {
			return execFileSync("git", args, {
				cwd,
				encoding: "utf8",
				timeout: 5000,
			}).trim();
		} catch {
			return "";
		}
	};
	return [
		...git(["diff", "--name-only", "HEAD"]).split("\n"),
		...git(["ls-files", "--others", "--exclude-standard"]).split("\n"),
	].filter(Boolean);
}

export function extractPrompt(input: unknown): string {
	if (!input || typeof input !== "object") return "";
	const record = input as Record<string, unknown>;
	for (const key of ["prompt", "user_prompt", "message", "input"]) {
		const value = record[key];
		if (typeof value === "string") return value;
	}
	const nested = record.hook_event ?? record.event;
	if (nested && typeof nested === "object") return extractPrompt(nested);
	return "";
}

export function extractTool(input: unknown): {
	toolName?: string;
	command?: string;
	exitCode?: number;
	output?: string;
} {
	if (!input || typeof input !== "object") return {};
	const record = input as Record<string, unknown>;
	const toolName =
		typeof record.tool_name === "string"
			? record.tool_name
			: typeof record.toolName === "string"
				? record.toolName
				: undefined;
	const command =
		typeof record.command === "string"
			? record.command
			: typeof record.tool_input === "object" &&
					record.tool_input &&
					typeof (record.tool_input as Record<string, unknown>).command ===
						"string"
				? ((record.tool_input as Record<string, unknown>).command as string)
				: undefined;
	const exitCode =
		typeof record.exit_code === "number"
			? record.exit_code
			: typeof record.exitCode === "number"
				? record.exitCode
				: undefined;
	return { toolName, command, exitCode, output: extractToolOutput(record) };
}

/**
 * PostToolUse carries the command's own output in `tool_response`, whose shape
 * varies by host: a bare string, `{ stdout, stderr }`, or `{ output }`. Reading
 * it is what lets the hook record WHAT a check found rather than only that it
 * ran — the difference between telemetry you can act on and a counter.
 *
 * Capped hard: these events are appended to a JSONL file on every tool call, and
 * an uncapped build log would turn the telemetry into the largest file in the
 * repo within a day.
 */
const MAX_CAPTURED_OUTPUT = 20_000;

function extractToolOutput(record: Record<string, unknown>): string | undefined {
	const response = record.tool_response ?? record.toolResponse ?? record.output;
	if (typeof response === "string") return response.slice(0, MAX_CAPTURED_OUTPUT);
	if (response && typeof response === "object") {
		const nested = response as Record<string, unknown>;
		const parts = [nested.stdout, nested.stderr, nested.output]
			.filter((part): part is string => typeof part === "string")
			.join("\n");
		if (parts) return parts.slice(0, MAX_CAPTURED_OUTPUT);
	}
	return undefined;
}

/**
 * Pulls the violated RULE NAMES out of `swarm check arch` output.
 *
 * The printed shape is `  [warn]  [rule-name] /abs/path:line`, so the rule name
 * is the second bracketed token on the line. Returns one entry per distinct
 * rule with its worst severity and how many times it fired, because the useful
 * question is "which rule is being ignored, and is it an error yet" — not which
 * individual files happen to be dirty this run.
 */
export function parseArchViolations(
	output: string,
): { rule: string; severity: "error" | "warn"; count: number }[] {
	const pattern = /\[(error|warn)\]\s+\[([a-z0-9][a-z0-9-]*)\]/gi;
	const seen = new Map<string, { rule: string; severity: "error" | "warn"; count: number }>();
	for (const match of output.matchAll(pattern)) {
		const severity = match[1].toLowerCase() === "error" ? "error" : "warn";
		const rule = match[2];
		const current = seen.get(rule);
		if (current) {
			current.count += 1;
			if (severity === "error") current.severity = "error";
		} else {
			seen.set(rule, { rule, severity, count: 1 });
		}
	}
	return [...seen.values()].sort((a, b) => b.count - a.count || a.rule.localeCompare(b.rule));
}

export function buildPromptContext(
	expectations: SkillExpectation[],
	validationCommands: string[],
): string {
	const lines = [
		"Skill-watch context:",
		...expectations
			.filter((expectation) => expectation.confidence !== "low")
			.map(
				(expectation) =>
					`- Expected ${expectation.skill}: ${expectation.reason}`,
			),
	];
	if (validationCommands.length > 0) {
		lines.push("Suggested validation commands for this repo:");
		lines.push(...validationCommands.map((command) => `- ${command}`));
	}
	return lines.join("\n");
}

export function applyPromotion(
	marketplaceRoot: string,
	candidate: PromotionCandidate,
): string | null {
	const skillPath = SKILL_PATHS[candidate.skill];
	if (!skillPath) return null;
	const absolutePath = path.join(marketplaceRoot, skillPath);
	if (!fs.existsSync(absolutePath)) return null;
	const existing = fs.readFileSync(absolutePath, "utf8");
	const marker = "<!-- skill-watch-learnings -->";
	const learning = [
		`- ${new Date().toISOString().slice(0, 10)}: ${candidate.key} recurred ${candidate.count} times.`,
		`  Add/keep explicit guidance for: ${candidate.messages.slice(0, 2).join(" / ")}`,
	].join("\n");
	if (existing.includes(learning)) return absolutePath;
	const section = ["## Skill-watch Learnings", "", marker, learning, ""].join(
		"\n",
	);
	const updated = existing.includes(marker)
		? existing.replace(marker, `${marker}\n${learning}`)
		: `${existing.trimEnd()}\n\n${section}`;
	fs.writeFileSync(absolutePath, updated);
	return absolutePath;
}
