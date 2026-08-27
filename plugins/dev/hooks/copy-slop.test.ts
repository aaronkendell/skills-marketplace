import { describe, expect, it } from "vitest";
import { findSlop } from "./copy-slop";

describe("findSlop", () => {
	it("flags an em dash used as a mid-sentence joiner", () => {
		const found = findSlop('<Text>{"Rounds land here — watch live or ask for a seat."}</Text>');
		expect(found.map((f) => f.rule)).toContain("em dash in prose");
	});

	it("ignores the standalone null glyph — the one legal em dash", () => {
		expect(findSlop('{handicap ?? "—"}')).toHaveLength(0);
		expect(findSlop('<Cell value="—" />')).toHaveLength(0);
	});

	it("ignores em dashes in comments, which are internal prose", () => {
		expect(findSlop("// the mark is a hero — not chrome")).toHaveLength(0);
		expect(findSlop(" * Sizing follows Apple — see the HIG.")).toHaveLength(0);
		expect(findSlop("/* one voice — many tones */")).toHaveLength(0);
	});

	it("flags exclamation marks in copy", () => {
		const found = findSlop('title="Round saved!"');
		expect(found.map((f) => f.rule)).toContain("exclamation mark");
	});

	it("flags apology filler and hedging", () => {
		expect(findSlop('message="Oops, that didn\'t work"').map((f) => f.rule)).toContain(
			"apology filler",
		);
		expect(findSlop('message="It looks like you have no friends"').map((f) => f.rule)).toContain(
			"hedging",
		);
	});

	it("flags placeholder identities", () => {
		expect(findSlop('name="Player 1"').map((f) => f.rule)).toContain("placeholder identity");
	});

	it("flags marketing filler", () => {
		expect(findSlop('body="A seamless way to track your rounds"').map((f) => f.rule)).toContain(
			"marketing filler",
		);
	});

	it("stays silent on clean copy", () => {
		expect(findSlop('title="No friends yet"')).toHaveLength(0);
		expect(
			findSlop('message="Rounds are better with a crew. Add someone and you\'ll see."'),
		).toHaveLength(0);
	});

	it("does not flag identifiers or short non-prose literals", () => {
		expect(findSlop('import { Box } from "@bokendell/golf-ui/components/box";')).toHaveLength(0);
		expect(findSlop('const key = "a";')).toHaveLength(0);
	});
});
