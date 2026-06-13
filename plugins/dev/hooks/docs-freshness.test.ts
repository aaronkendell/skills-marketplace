import assert from "node:assert/strict";
import { test } from "node:test";
import { findStaleDocs, globToRegExp, parseOwnershipTable } from "./docs-freshness.ts";

test("globToRegExp: ** crosses directories, * does not", () => {
	assert.equal(globToRegExp("apps/api/**").test("apps/api/src/deep/file.ts"), true);
	assert.equal(globToRegExp("apps/api/**").test("apps/mobile/src/file.ts"), false);
	assert.equal(globToRegExp("apps/*/src/index.ts").test("apps/api/src/index.ts"), true);
	assert.equal(globToRegExp("apps/*/src/index.ts").test("apps/api/src/sub/index.ts"), false);
	assert.equal(globToRegExp("**/*.test.ts").test("a/b/c.test.ts"), true);
	assert.equal(globToRegExp("**/*.test.ts").test("c.test.ts"), true); // **/ matches zero segments
	assert.equal(globToRegExp("docs/api.md").test("docs/api.md"), true);
	assert.equal(globToRegExp("docs/api.md").test("docs/apixmd"), false); // dot is escaped
	assert.equal(globToRegExp("src/?.ts").test("src/a.ts"), true);
	assert.equal(globToRegExp("src/?.ts").test("src/ab.ts"), false);
});

test("parseOwnershipTable: only backticked two-cell rows", () => {
	const md = [
		"# Docs Map",
		"| code glob | owning doc |",
		"|-----------|------------|",
		"| `apps/api/**` | `docs/architecture/api.md` |",
		"| `packages/golf-domains/**` | `docs/architecture/overview.md` |",
		"| not a rule | plain text row |",
		"| `docs/product/prd.md` | current | What the product is |",
	].join("\n");
	assert.deepEqual(parseOwnershipTable(md), [
		{ glob: "apps/api/**", doc: "docs/architecture/api.md" },
		{ glob: "packages/golf-domains/**", doc: "docs/architecture/overview.md" },
	]);
});

test("findStaleDocs: flags matched globs whose doc is untouched, dedupes by doc", () => {
	const rows = [
		{ glob: "apps/api/**", doc: "docs/architecture/api.md" },
		{ glob: "apps/mobile/**", doc: "docs/architecture/mobile.md" },
		{ glob: "apps/realtime/**", doc: "docs/architecture/api.md" },
	];
	const changed = ["apps/api/src/app.ts", "apps/realtime/config.ts", "docs/architecture/mobile.md", "apps/mobile/app/index.tsx"];
	const stale = findStaleDocs(changed, rows);
	assert.deepEqual(stale.map((s) => s.doc), ["docs/architecture/api.md"]);
});

test("findStaleDocs: empty when nothing matches", () => {
	assert.deepEqual(findStaleDocs(["README.md"], [{ glob: "apps/api/**", doc: "docs/architecture/api.md" }]), []);
});
