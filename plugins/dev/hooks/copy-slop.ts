#!/usr/bin/env npx tsx
// PostToolUse hook: flags AI-slop copy in user-facing strings the moment it's
// written, which is where it's cheapest to fix. The CI arch rule
// (`no-slop-copy`) is the backstop; this is the fast feedback.
//
// Deliberately conservative — it only reports, never blocks, and it stays
// silent on anything that isn't clearly product copy. A hook that cries wolf
// gets ignored, and an ignored hook is worse than no hook.
//
// No file / not a source file / no repo voice law → silent exit 0.
// Never throws (a broken hook must not break sessions).

import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

export interface SlopFinding {
	line: number;
	rule: string;
	snippet: string;
	fix: string;
}

/** Paths whose strings are never read by a user. */
const EXEMPT = [
	/\/packages\/dev\//,
	/\/apps\/design\//,
	/\.test\.[jt]sx?$/,
	/\.spec\.[jt]sx?$/,
	/\/__tests__\//,
	/\/scripts\//,
	/\/gallery\//,
];

/** A line that is entirely a comment — internal prose, never product copy. */
const COMMENT_LINE = /^\s*(\/\/|\*|\/\*)/;

/** Matches a quoted/backticked literal that contains at least one word char. */
const PROSE_LITERAL = /(["'`])((?:(?!\1)[^\\]|\\.)*?[A-Za-z]{2,}(?:(?!\1)[^\\]|\\.)*?)\1/g;

const BANNED_PHRASES: ReadonlyArray<{ re: RegExp; rule: string; fix: string }> = [
	{
		re: /\b(oops|whoops|uh[- ]oh)\b/i,
		rule: "apology filler",
		fix: "name the actual failure instead",
	},
	{ re: /\bsorry\b/i, rule: "apology", fix: "state the situation and the way out" },
	{
		re: /\b(User|Player)\s+[A-Z0-9]\b/,
		rule: "placeholder identity",
		fix: "use a real name, or a human fallback",
	},
	{
		re: /\b(seamless|effortless|elevate|empower|unlock|leverage|robust)\b/i,
		rule: "marketing filler",
		fix: "say what it actually does",
	},
	{
		re: /\b(it looks like|it seems like|please note that|simply just)\b/i,
		rule: "hedging",
		fix: "cut the hedge and say it",
	},
];

/** Scan one file's source for slop in user-facing string literals. */
export function findSlop(source: string): SlopFinding[] {
	const out: SlopFinding[] = [];
	source.split("\n").forEach((line, idx) => {
		if (COMMENT_LINE.test(line)) return;
		PROSE_LITERAL.lastIndex = 0;
		for (const m of line.matchAll(PROSE_LITERAL)) {
			const text = m[2] ?? "";
			const at = idx + 1;
			const snippet = text.length > 60 ? `${text.slice(0, 57)}…` : text;
			// Em dash in prose. A STANDALONE "—" is the legal null glyph and never
			// reaches here (the literal must carry two word chars to match).
			if (text.includes("—")) {
				out.push({
					line: at,
					rule: "em dash in prose",
					snippet,
					fix: "split into two sentences with a period",
				});
			}
			if (/[A-Za-z]!/.test(text)) {
				out.push({
					line: at,
					rule: "exclamation mark",
					snippet,
					fix: "say it flat — the voice doesn't need to raise itself",
				});
			}
			for (const { re, rule, fix } of BANNED_PHRASES) {
				if (re.test(text)) out.push({ line: at, rule, snippet, fix });
			}
		}
	});
	return out;
}

function isCandidate(file: string): boolean {
	if (!/\.(tsx|ts)$/.test(file)) return false;
	return !EXEMPT.some((re) => re.test(file));
}

/** The repo's voice law, if it has one — cited in the report so the fix is findable. */
function findVoiceLaw(file: string): string | null {
	let dir = path.dirname(file);
	for (let i = 0; i < 8; i++) {
		const candidate = path.join(dir, "docs", "design", "voice-and-copy.md");
		if (fs.existsSync(candidate)) return path.relative(dir, candidate);
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return null;
}

export function report(file: string, findings: SlopFinding[], law: string | null): string {
	const head = `[copy] ${findings.length} possible slop finding(s) in ${path.basename(file)}:`;
	const lines = findings
		.slice(0, 8)
		.map((f) => `  L${f.line} [${f.rule}] "${f.snippet}" → ${f.fix}`);
	const more = findings.length > 8 ? [`  …and ${findings.length - 8} more`] : [];
	const cite = law
		? [`  Voice law: ${law}`]
		: ["  No voice law found — consider writing docs/design/voice-and-copy.md"];
	return [head, ...lines, ...more, ...cite].join("\n");
}

async function main(): Promise<void> {
	try {
		const raw = fs.readFileSync(0, "utf8");
		const payload = JSON.parse(raw) as {
			tool_input?: { file_path?: string };
		};
		const file = payload.tool_input?.file_path;
		if (!file || !isCandidate(file) || !fs.existsSync(file)) return;
		const findings = findSlop(fs.readFileSync(file, "utf8"));
		if (findings.length === 0) return;
		// stdout on a PostToolUse hook surfaces as context to the agent.
		process.stdout.write(report(file, findings, findVoiceLaw(file)));
	} catch {
		// A hook must never break the session.
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	void main();
}
