# ⚽ Header Penalties — פנדלים בנגיחה

**Drawing:** `drawings/header-penalties.jpg`

**Fantasy:** "There's a goal with a goalkeeper in it, penalties by heading, the ball comes
lobbed from behind, every goal is one point."

**Player verbs:** aim the reticle (any time) · time the header (Space — a PERFECT press
right at the forehead fires a fast true shot; early/late shots wobble and fly slower) ·
read the keeper's lean and fake him.

**Enemy verbs:** the keeper shuffles, then at the last second **leans** toward the side
he's guessing (he reads your reticle more often as he warms up, and occasionally
bluffs), then dives and leaps at that side. His silhouette — body plus wide arms — is
what saves; there is no free zone in the goal.

**Goal:** five kicks per round, most goals wins (stars on the round card). **Fail:** none
in one-player; in two-player the other kid scores more.

**Twist:** two players — one heads, the other IS the keeper (A/D + jump), then they swap.

**Round length:** ~35 seconds per five kicks.

**Knobs (src/pendel.js):** `SILHOUETTE` boxes, `LEAN_AT`, `PERFECT_DIST`,
`KEEPER_JUMP`, the read/bluff probabilities in `cpuLean`, `sharpness()`.

**Verified by:** `tests/games.spec.js` — dead-centre shots (high and low) must be saved
sometimes; a round must end after five kicks; the two-player flow must reach the final
card without input.

## Playtest log
- 2026-09-04 · review · the old build read the drawing as two keepers stacked and any
  header aimed at the top of the goal always scored (6/6) · rebuilt from the drawing
