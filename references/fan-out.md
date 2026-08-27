# When to fan out (and when a single agent is correct)

The decision rule for parallel sub-agents and `Workflow` runs, in one place so the
skills that need it can point here instead of each carrying their own copy.

## The hard constraint, first

**A skill may never launch a `Workflow` on its own.** Workflow runs spawn fleets and
spend real money, so the tool requires Aaron to opt in explicitly — by saying
"use a workflow" / "fan this out" / "ultracode", or by invoking a command whose
instructions call for one. A skill's job is to **notice** that a task is wide, say so
in one line with a rough cost, and let Aaron decide.

Correct: "This touches 34 files across 4 domains — want me to fan it out? Roughly a
dozen agents. Otherwise I'll work through it sequentially."

Wrong: silently spawning twelve agents because the diff looked big.

Parallel `Agent` calls for **reading** (exploration, search) are a different case and
are fine unprompted — they are cheap, bounded, and already how `dev-build` scouts a
codebase. The opt-in rule is about fleets that write, judge, or run long.

## The fake-edge test

Walk the work step by step. At each step ask: **does this step actually need the result
of the one before it?**

- Yes -> the dependency is real, keep the order.
- No -> there is no dependency, and the wait is wasted. Those steps can run at once.

If you cannot find two jobs with no edge between them, **there is no fan-out to build.**
It is a sequence, and a sequence is fine. Most tasks are sequences.

## When fan-out pays

The work must be **wide**: many items, each independently answerable, where no item's
answer changes another's.

| Fits | Does not fit |
|---|---|
| Review a large diff across many files or several independent dimensions | Fix one bug, add one function |
| Audit every route / every wiki page / every package for one property | Anything you want to approve step by step |
| Research a question from several independent angles | Exploratory work where you do not yet know what you want |
| A migration applying the same transform to many files | Genuinely sequential work (TDD: red -> green -> refactor) |

Fan-out buys **breadth**. It does not buy better judgment. If the problem is that the
answer is hard rather than that there is a lot of it, more agents will not help.

## The shape that works

Fan out -> reduce in plain code -> verify -> synthesize.

- **Fan out** where the work is independent. One agent per item.
- **Reduce with code, not a model.** Dedupe, filter, group in plain JS inside the
  script. Free, deterministic, and it does not hallucinate.
- **Verify on a fresh context.** The agent that produced a finding must never be the one
  that checks it — same context means it is agreeing with itself in a different font.
  Use a different model for the judge where judgment matters.
- **Synthesize once** at the end, from the survivors.

Prefer `pipeline()` over `parallel()` between stages: a barrier is only correct when a
stage genuinely needs every prior result at once (dedupe across the whole set, an
early-exit on zero findings). "It reads more cleanly" is not a reason to make everything
wait for the slowest item.

## The three ways it breaks

1. **Context collapse** — 200 raw outputs poured into one synthesis step blows the
   window. Batch, summarize each batch, then combine summaries.
2. **False independence** — two agents look independent but write the same file or hit
   the same rate-limited API. That is a hidden dependency. Give writers isolated
   worktrees (`isolation: "worktree"`), and audit for shared *resources*, not just
   shared data.
3. **Silent node failure** — in a sequence a failure stops everything, which is
   obvious. In a fan-out, one dead agent among forty slips into a report that looks
   complete. **Always count returns against what you dispatched and say so when they
   differ.** Never synthesize a partial set and present it as whole.

## Anchors — the failure that survives good topology

A fleet where every node reads another node's report is internally consistent and
verifies nothing. It fails the same way one agent does, later and more expensively,
with more green lights on the way down.

Ground findings in things that cannot be argued with: a test that actually ran, the
`swarm check arch` output, a type error, a number from the source system. "The agent
said it was done" is not evidence. If a whole run contains nothing that could have come
back negative, the run proved nothing.

## Cost

Say the rough agent count before running, not after. A wide run is worth it when the
alternative is an hour of sequential grinding — not to make a five-file review feel
thorough.
