---
name: copy
description: >
  Voice and copy for every word a user reads. Use when writing or reviewing UI strings, empty and
  error states, buttons, toasts, push notifications, emails, onboarding, marketing headlines, or
  App Store text. Also use when the user says copy sounds "generic", "AI-written", "off-brand",
  "slop", or asks about tone, humor, em dashes, microcopy, or naming a button. Companion to the
  `design` skill: design owns pixels, this owns words.
---

# Copy

You write the words. The `design` skill owns the pixels; this owns everything a
user reads. Both defer to the app's own in-repo law.

## The law lives in the repo, not here

This skill is the METHOD. The app's actual voice is the LAW, and it lives with
the code:

```
<repo>/docs/design/voice-and-copy.md    ← the voice law (golf/Bagman today)
<repo>/DESIGN.md                        ← tokens (generated, CI-diffed)
```

**Read the repo's voice law before writing a single string.** If it disagrees
with this skill, it wins — it carries that app's dials, its banned words, and
its worked examples. If a repo has no voice law yet, your first job is to write
one with the user (see "Finding a voice" below), not to start guessing at copy.

## The non-negotiables (every app)

These hold regardless of brand:

1. **Say the thing.** Cut every word that isn't load-bearing. "No friends yet"
   beats "It looks like you haven't added any friends yet."
2. **Every line pays rent.** A second line must carry NEW information, never
   paraphrase the title. If you can't say what a line adds, delete it. Text
   costs real estate and attention.
3. **Name the outcome.** Buttons say what happens ("Ask to join", not
   "Continue"); the confirmation reuses the same verb ("Asked").
4. **No apology, no blame.** Errors state the situation and the way out. Never
   "Oops", "Whoops", "Sorry", or a bare "Something went wrong".
5. **No exclamation marks.** The voice doesn't need to raise itself.
6. **Never invent an identity.** No "User A", no "Player 1", no id or code
   standing in for a person's name.
7. **Never show `0` for unknown.** In a scoring app 0 is a real value. Use a
   null glyph in a data grid, words in prose.
8. **Read it out loud.** If you wouldn't say it to a person, rewrite it.

## The AI-slop tells

These are what make copy read as machine-written. Hunt them:

- **The em dash as a mid-sentence joiner** — the single biggest tell. "X lands
  here — you can do Y." A period is right ~80% of the time. (An em dash as a
  standalone null glyph in a data cell is fine; that's typography, not prose.)
- **"not just X, but Y"** and **"it's not X — it's Y"** unless the contrast is
  genuinely the thesis.
- **Triads.** "Fast, simple, and secure." Three adjectives in a row is a
  language model breathing.
- **"Seamless", "effortless", "elevate", "empower", "unlock", "leverage",
  "robust", "delve", "in today's world".**
- **Hedging**: "It looks like", "It seems", "Please note that", "simply just".
- **Restating the title** in the body line.
- **Enthusiasm that wasn't earned**: "Great job!", "You're all set!"

## Finding a voice (when the repo has none)

Never ask for adjectives. "Friendly but professional" produces copy nobody can
check. Instead:

1. **Run the four dials** (Nielsen Norman Group's tone-of-voice model, the
   industry standard): funny↔serious, formal↔casual, respectful↔irreverent,
   enthusiastic↔matter-of-fact. Four independent sliders, not one personality.
2. **Anchor each dial with a REAL string from the app**, three versions, and
   let the user pick. A picked example is enforceable; an adjective is not.
3. **Write the humor matrix**: not "how funny" but WHERE. A grid of surfaces
   (empty states, celebrations, errors, money, destructive, auth) × allowed
   register (never / dry wit / jokes). This is the most useful artifact a voice
   guide can carry.
4. **Set tone by surface.** One voice, many tones (Mailchimp's rule). The
   plainest copy in any app belongs on money, destructive actions, and
   security. The most voice belongs on empty states and celebrations.
5. **Write it down** as the repo's voice law, with worked before/after pairs
   pulled from real screens.

Deliver the questionnaire the way the `design` skill delivers mocks: a
self-contained HTML board with the real strings side by side, IDs to reply
with, and a recommendation marked on each. Never a plain-text quiz.

## Reviewing copy

Use `references/review-criteria/copy.md` in this marketplace as the checklist.
For a diff, review only strings that CHANGED, plus any string on a screen whose
layout changed (new real estate = new chance for a line that doesn't pay rent).

## Enforcement (so the standard survives you)

Three layers, weakest to strongest:

1. **A CI arch rule** for the mechanical half — em dashes in user-facing
   literals, exclamation marks, banned phrases, placeholder identities. In this
   stack that's a swarm semantic rule (`no-slop-copy`), enabled per-repo in
   `arch.config.ts`, with `// arch-allow no-slop-copy: <reason>` as the escape
   hatch.
2. **Review criteria** so human/agent review checks words, not just structure.
3. **A write-time hook** that flags slop as it's typed (mirrors the design
   hook), which is where it's cheapest to fix.

Tooling notes: [Vale](https://vale.sh) is the industry prose linter (GitLab,
Microsoft, and Google publish their style guides as Vale packages) and is worth
adding for markdown docs and marketing sites — but it can't reach strings inside
TSX, which is where product copy lives. Avoid Grammarly-class tools on product
copy: they optimize toward generic business English and sand off exactly the
voice you're building.
