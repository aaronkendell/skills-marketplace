#!/usr/bin/env npx tsx
// Stop hook: deterministic doc-freshness reminder driven by docs/MAP.md's ownership table.
// No MAP.md / no git / stop_hook_active → silent exit 0. Never throws (a broken hook must not break sessions).

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

export interface OwnershipRow {
	glob: string;
	doc: string;
}

export function globToRegExp(glob: string): RegExp {
	let re = "";
	let i = 0;
	while (i < glob.length) {
		const c = glob[i];
		if (c === "*") {
			if (glob[i + 1] === "*") {
				if (glob[i + 2] === "/") {
					re += "(?:.*/)?"; // '**/' matches zero or more whole segments
					i += 3;
				} else {
					re += ".*";
					i += 2;
				}
			} else {
				re += "[^/]*";
				i += 1;
			}
		} else if (c === "?") {
			re += "[^/]";
			i += 1;
		} else {
			re += /[.+^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
			i += 1;
		}
	}
	return new RegExp(`^${re}$`);
}

export function parseOwnershipTable(mapMd: string): OwnershipRow[] {
	const rows: OwnershipRow[] = [];
	for (const line of mapMd.split("\n")) {
		const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*$/);
		if (m) rows.push({ glob: m[1], doc: m[2] });
	}
	return rows;
}

export function findStaleDocs(changed: string[], rows: OwnershipRow[]): OwnershipRow[] {
	const changedSet = new Set(changed);
	const seen = new Set<string>();
	const stale: OwnershipRow[] = [];
	for (const row of rows) {
		if (changedSet.has(row.doc) || seen.has(row.doc)) continue;
		const re = globToRegExp(row.glob);
		if (changed.some((f) => re.test(f))) {
			seen.add(row.doc);
			stale.push(row);
		}
	}
	return stale;
}

function main(): void {
	let input: { cwd?: string; stop_hook_active?: boolean } = {};
	try {
		input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
	} catch {
		/* no stdin / bad JSON → treat as empty */
	}
	if (input.stop_hook_active) return; // already continued once for this — don't loop

	const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
	const mapPath = path.join(projectDir, "docs", "MAP.md");
	if (!fs.existsSync(mapPath)) return; // repo hasn't adopted the contract — no-op

	const rows = parseOwnershipTable(fs.readFileSync(mapPath, "utf8"));
	if (rows.length === 0) return;

	const git = (args: string[]): string => {
		try {
			return execFileSync("git", args, { cwd: projectDir, encoding: "utf8" }).trim();
		} catch {
			return ""; // one failing git call (e.g. diff HEAD in a zero-commit repo) shouldn't skip the other
		}
	};
	const changed = [
		...git(["diff", "--name-only", "HEAD"]).split("\n"),
		...git(["ls-files", "--others", "--exclude-standard"]).split("\n"),
	].filter(Boolean);

	const stale = findStaleDocs(changed, rows);
	if (stale.length === 0) return;

	const lines = stale.slice(0, 5).map((s) => `- \`${s.doc}\` (touched files matching \`${s.glob}\`)`);
	const reason = [
		"Docs freshness check (docs/MAP.md ownership table) — owning docs not updated since last commit:",
		...lines,
		"Update them (and bump their `verified:` frontmatter date), or briefly tell the user why no doc update is needed, then stop.",
	].join("\n");
	console.log(JSON.stringify({ decision: "block", reason }));
}

const isDirectRun =
	process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
	try {
		main();
	} catch {
		process.exit(0); // never break a session over a reminder
	}
}
