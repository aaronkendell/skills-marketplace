# Grading — mobile-purity

RECALL against planted violations. Score each independently.

The response MUST identify all three:

1. **Screen calls domain/business hooks directly.** `useScorecardStore` and
   `useQuery` are called in a screen file; data access belongs in a container that
   passes results down as props. Credit if either is named as a purity violation.
2. **`useMemo` outside a container.** `useMemo` is used in this presentational
   screen. The rule is `useMemo` only in containers, never in presentational
   components. Credit only if the response ties `useMemo` to the container rule —
   a generic "this memo is unnecessary" performance note does not count.
3. **Raw color instead of a design token.** `backgroundColor: "#1a1a1a"` must come
   from the design tokens, not a hex literal.

Do NOT deduct for additional correct findings (e.g. the untyped `fetch` response,
inline styles). Do deduct if the response rewrites the component instead of
reviewing it, or reports no violations.

Score = fraction of the three planted violations correctly identified.
