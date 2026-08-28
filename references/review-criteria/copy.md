# Copy Review Criteria (every word a user reads)

> Full reference: each app's own voice law. For golf/Bagman that is
> `docs/design/voice-and-copy.md` — READ IT FIRST; it outranks this checklist
> wherever they differ, and it carries the app's specific voice dials.
>
> Apply to: any diff touching a user-facing string — `apps/*/src/**` screens,
> components, containers, hooks that build messages, notification/email
> templates, and `packages/ui/**` primitives that hard-code default labels.
>
> Do NOT apply to: code comments, JSDoc, test fixtures, dev/gallery/lab
> screens, log lines, or error messages that only reach a developer.

## Blocking

- [ ] BLOCKING: No em dash inside a user-facing string, EXCEPT a standalone
      null glyph in a data cell (`{handicap ?? "—"}`). Prose em dashes split
      into two sentences with a period.
- [ ] BLOCKING: No exclamation marks in product copy.
- [ ] BLOCKING: No "Oops", "Whoops", "Sorry", or a bare "Something went wrong"
      as an entire message. Name the actual failure.
- [ ] BLOCKING: No placeholder identity ever reaches a user — no "User A",
      no "Player 1", no friend code or raw id standing in for a name.
- [ ] BLOCKING: No `0` rendered for an unknown numeric value. `0` is a real
      handicap/score. Use the null glyph in grids, words in prose.
- [ ] BLOCKING: No emoji in product copy.

## Voice

- [ ] Sentence case everywhere except mono eyebrows/labels.
- [ ] Second person, present tense ("You're up $6").
- [ ] Numerals for numbers ("4 of 4 seats", not "four of four").
- [ ] Domain words over software words (round, crew, seat, card, slip — not
      session, participant, entry, record).
- [ ] Buttons name the outcome, not the mechanic ("Ask to join", not
      "Continue"), and the confirmation reuses the same verb.

## Every line pays rent

- [ ] A message line carries NEW information; it never paraphrases its title.
      ("No friends yet" + "You have no friends yet" = cut the second line.)
- [ ] Nothing is on screen that the user does not need to read. Text costs
      real estate and attention; if you can't say what a line adds, delete it.
- [ ] Empty/error states are title + message + ≤2 actions. No eyebrow, no
      helper line, no third button.

## Tone by surface

- [ ] Money, settlement, destructive confirms, auth/billing: the PLAINEST copy
      in the app. Zero wit. State the fact and the consequence.
- [ ] Errors: name the situation and the way out. Never blame, never apologize.
- [ ] Empty states, celebrations, onboarding, the AI assistant: the most voice
      is allowed here — dry wit, never jokes.
- [ ] Destructive confirms answer the two questions actually in the user's
      head ("what happens to my data?", "can I undo this?").

## Reviewer's last pass

- [ ] Read every changed string OUT LOUD. If you wouldn't say it to a friend
      on the first tee, it's wrong.
- [ ] Would this sentence appear verbatim in any other app? If yes, it's
      generic — make it ours or make it shorter.
