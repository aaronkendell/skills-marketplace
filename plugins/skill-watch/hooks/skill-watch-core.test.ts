import assert from "node:assert/strict";
import { test } from "node:test";
import {
	classifyPrompt,
	groupPromotionCandidates,
	normalizeSkillName,
	recommendValidationCommands,
} from "./skill-watch-core.ts";

test("classifyPrompt maps studio and visual work to design, not the golf-specific alias", () => {
	const result = classifyPrompt({
		prompt: "Create a golf design studio sketch for the in-round bell menu",
		cwd: "/repo/apps/design/src/packages/mobile/round",
	});

	assert.equal(
		result.some((item) => item.skill === "dev:design"),
		true,
	);
	assert.equal(
		result.some((item) => item.skill.includes("golf-design-studio")),
		false,
	);
	assert.equal(
		result.some((item) => item.skill === "skill-watch:skill-watch"),
		true,
	);
});

test("classifyPrompt detects review and architecture-standard work", () => {
	const result = classifyPrompt({
		prompt:
			"Review the DDD service repository pattern and run check arch for mobile imports",
		cwd: "/repo/packages/golf/domains/src/packages/rounds",
	});

	assert.equal(
		result.some((item) => item.skill === "dev:review"),
		true,
	);
	assert.equal(
		result.some((item) => item.skill === "dev:dev-build"),
		true,
	);
	assert.equal(
		result.some((item) => item.reason.includes("architecture")),
		true,
	);
});

test("recommendValidationCommands prefers swarm arch checks when the repo exposes swarm", () => {
	const commands = recommendValidationCommands({
		hasSwarmCli: true,
		touchedFiles: ["apps/mobile/src/packages/pre-round/components/foo.tsx"],
	});

	assert.equal(commands.includes("pnpm swarm check arch"), true);
	assert.equal(
		commands.includes(
			"pnpm exec biome check apps/mobile/src/packages/pre-round/components/foo.tsx",
		),
		true,
	);
});

test("groupPromotionCandidates requires recurrence before rewriting skills", () => {
	const candidates = groupPromotionCandidates([
		{
			type: "deviation",
			skill: "dev:review",
			key: "missed-arch-check",
			message: "Review finished without swarm arch check",
			createdAt: "2026-07-01T00:00:00.000Z",
		},
		{
			type: "deviation",
			skill: "dev:review",
			key: "missed-arch-check",
			message: "Review finished without swarm arch check",
			createdAt: "2026-07-01T01:00:00.000Z",
		},
		{
			type: "deviation",
			skill: "dev:review",
			key: "missed-arch-check",
			message: "Review finished without swarm arch check",
			createdAt: "2026-07-01T02:00:00.000Z",
		},
	]);

	assert.deepEqual(
		candidates.map((candidate) => candidate.skill),
		["dev:review"],
	);
	assert.equal(candidates[0].count, 3);
});

test("normalizeSkillName keeps plugin-qualified skills stable", () => {
	assert.equal(normalizeSkillName("review"), "dev:review");
	assert.equal(normalizeSkillName("dev:design"), "dev:design");
	assert.equal(
		normalizeSkillName("/taste:design-taste-frontend"),
		"taste:design-taste-frontend",
	);
});
