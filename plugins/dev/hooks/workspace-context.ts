#!/usr/bin/env npx tsx

import * as fs from "node:fs";
import * as path from "node:path";

interface WorkspaceJson {
	name: string;
	index: number;
	project: string;
	ports: Record<string, number>;
	hostnames: Record<string, string>;
	neonBranchName: string;
	databaseUrl: string;
	branch: string;
	path: string;
	createdAt: string;
	devPid?: number;
}

function findWorkspaceJson(startDir: string): string | null {
	let current = startDir;

	while (true) {
		const candidate = path.join(current, ".workspace.json");
		if (fs.existsSync(candidate)) {
			return candidate;
		}

		const parent = path.dirname(current);
		if (parent === current) {
			// Reached filesystem root
			return null;
		}
		current = parent;
	}
}

function buildContextMarkdown(ws: WorkspaceJson): string {
	const lines: string[] = [];

	lines.push(`## Active Workspace: \`${ws.name}\``);
	lines.push("");
	lines.push(`- **Index**: ${ws.index}`);
	lines.push(`- **Project**: ${ws.project}`);
	lines.push(`- **Neon DB Branch**: \`${ws.neonBranchName}\``);
	lines.push(`- **Git Branch**: \`${ws.branch}\``);
	lines.push("");

	lines.push("### Dev URLs");
	const apps = Object.keys(ws.hostnames);
	if (apps.length > 0) {
		for (const app of apps) {
			const hostname = ws.hostnames[app];
			const port = ws.ports[app];
			const portSuffix = port !== undefined ? `:${port}` : "";
			lines.push(`- **${app}**: https://${hostname}${portSuffix}`);
		}
	} else {
		lines.push("- No dev URLs configured");
	}

	lines.push("");
	lines.push("### Key Guidance");
	lines.push("- Use the tunnel URLs above in curl commands and browser testing (not localhost)");
	lines.push(
		"- `DATABASE_URL` for this workspace is isolated to its own Neon branch — changes here do not affect other workspaces",
	);
	lines.push(
		"- Use `pnpm swarm workspace` commands to manage this workspace (status, stop, switch)",
	);

	return lines.join("\n");
}

function main() {
	const cwd = process.env.CLAUDE_CWD ?? process.cwd();

	const workspaceJsonPath = findWorkspaceJson(cwd);
	if (!workspaceJsonPath) {
		process.exit(1);
	}

	let ws: WorkspaceJson;
	try {
		const raw = fs.readFileSync(workspaceJsonPath, "utf-8");
		ws = JSON.parse(raw) as WorkspaceJson;
	} catch {
		process.exit(1);
	}

	if (!ws || typeof ws.name !== "string") {
		process.exit(1);
	}

	const context = buildContextMarkdown(ws);
	process.stdout.write(JSON.stringify({ context }));
	process.exit(0);
}

main();
