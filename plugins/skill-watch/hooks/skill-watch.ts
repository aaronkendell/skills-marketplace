#!/usr/bin/env npx tsx

import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import {
	appendEvent,
	applyPromotion,
	buildPromptContext,
	classifyPrompt,
	extractPrompt,
	extractTool,
	getChangedFiles,
	groupPromotionCandidates,
	hasSwarmCli,
	parseArchViolations,
	readEvents,
	recommendValidationCommands,
	resolveMarketplaceRoot,
} from "./skill-watch-core.ts";

function readStdinJson(): unknown {
	try {
		const raw = fs.readFileSync(0, "utf8");
		if (!raw.trim()) return {};
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

function hookCwd(input: unknown): string {
	if (input && typeof input === "object") {
		const record = input as Record<string, unknown>;
		if (typeof record.cwd === "string") return record.cwd;
		if (typeof record.project_dir === "string") return record.project_dir;
	}
	return (
		process.env.CLAUDE_PROJECT_DIR ??
		process.env.CODEX_PROJECT_DIR ??
		process.cwd()
	);
}

function runPrompt(input: unknown): void {
	const cwd = hookCwd(input);
	const marketplaceRoot = resolveMarketplaceRoot();
	const touchedFiles = getChangedFiles(cwd);
	const expectations = classifyPrompt({
		prompt: extractPrompt(input),
		cwd,
		touchedFiles,
	});
	const validationCommands = recommendValidationCommands({
		hasSwarmCli: hasSwarmCli(cwd),
		touchedFiles,
	});
	appendEvent(marketplaceRoot, {
		type: "prompt",
		prompt: extractPrompt(input).slice(0, 2000),
		cwd,
		expectations,
		touchedFiles,
	});
	const context = buildPromptContext(expectations, validationCommands);
	if (context.trim()) {
		process.stdout.write(JSON.stringify({ context }));
	}
}

function runPostTool(input: unknown): void {
	const cwd = hookCwd(input);
	const marketplaceRoot = resolveMarketplaceRoot();
	const tool = extractTool(input);
	appendEvent(marketplaceRoot, {
		type: "tool",
		cwd,
		toolName: tool.toolName,
		command: tool.command,
		exitCode: tool.exitCode,
		touchedFiles: getChangedFiles(cwd),
	});
	const command = (tool.command ?? "").toLowerCase();
	if (command.includes("check arch") || command.includes("swarm check arch")) {
		appendEvent(marketplaceRoot, {
			type: "tool",
			skill: "dev:review",
			key: "arch-check-used",
			message: "Architecture check was run during review/build work.",
			cwd,
		});
		// Record WHICH rules fired, not just that the check ran. These are
		// deliberately type "signal", never "deviation": a firing arch rule means
		// the rule already exists and the code is drifting past it, which calls for
		// fixing the code or escalating warn -> error. Filing it as a deviation
		// would feed groupPromotionCandidates and append yet another paragraph to a
		// SKILL.md about a rule that is already being enforced mechanically.
		for (const violation of parseArchViolations(tool.output ?? "")) {
			appendEvent(marketplaceRoot, {
				type: "signal",
				skill: "dev:review",
				key: `arch-violation:${violation.rule}`,
				message: `${violation.severity} x${violation.count} — rule '${violation.rule}' is firing; fix the code or escalate the rule.`,
				cwd,
			});
		}
	}
	if (typeof tool.exitCode === "number" && tool.exitCode !== 0) {
		appendEvent(marketplaceRoot, {
			type: "deviation",
			skill: "dev:review",
			key: "tool-failure-needs-standard",
			message: `Tool ${tool.toolName ?? "unknown"} failed; consider whether a skill or rule should catch this earlier.`,
			cwd,
		});
	}
}

function runStop(input: unknown): void {
	const cwd = hookCwd(input);
	const marketplaceRoot = resolveMarketplaceRoot();
	const events = readEvents(marketplaceRoot);
	const candidates = groupPromotionCandidates(events).filter(
		(candidate) => candidate.key !== "arch-check-used",
	);
	const changed: string[] = [];
	for (const candidate of candidates) {
		const applied = applyPromotion(marketplaceRoot, candidate);
		if (applied) {
			changed.push(applied);
			appendEvent(marketplaceRoot, {
				type: "promotion",
				skill: candidate.skill,
				key: candidate.key,
				message: `Applied recurring learning to ${applied}`,
				cwd,
			});
		}
	}
	if (changed.length > 0) {
		process.stdout.write(
			JSON.stringify({
				context: `Skill-watch applied recurring learning updates in the marketplace working tree:\n${changed
					.map((file) => `- ${file}`)
					.join("\n")}`,
			}),
		);
	}
}

function main(): void {
	const mode = process.argv[2] ?? "prompt";
	const input = readStdinJson();
	if (mode === "prompt") runPrompt(input);
	else if (mode === "post-tool") runPostTool(input);
	else if (mode === "stop") runStop(input);
	else {
		process.stderr.write(`Unknown skill-watch mode: ${mode}\n`);
		process.exit(2);
	}
}

const isDirectRun =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
	try {
		main();
	} catch {
		process.exit(0);
	}
}
