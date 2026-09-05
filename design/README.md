# How a game gets made here

Each game in this folder has a one-page **verb sheet**. It is written before the first
line of code and updated when the kids' verdict comes in. Bowling Escape was the only
early game that landed with the kids, and it is the only one that would have passed
this sheet on paper: several player verbs and a real twist. Schnitzel Tag (one verb, one
enemy, no goal) failed it and was removed.

## The verb sheet

```
Drawing:      drawings/<file>  (or "told, not drawn")
Fantasy:      one sentence, in the kid's words
Player verbs: at least three, e.g. move · shoot · freeze the world
Enemy verbs:  what THEY do that the player must read and answer
Goal:         how a round is won
Fail:         how a round is lost
Twist:        the one rule that makes this game not-another-chaser
Round length: 60–120 seconds
Knobs:        the 3–5 constants you expect to tune, by name
Verified by:  the headless check in tests/ that guards the balance
```

## The process

1. **Grey-box the twist first.** Cubes, one afternoon, the kid plays it. If the twist
   isn't fun with cubes, marker art will not save it.
2. **The drawing is the spec.** Keep it in `drawings/`, link it from the sheet and from
   the top of the source file. When a body part is ambiguous, ask the kid, don't guess.
3. **Simulate before shipping.** Every game exposes `window.__<game>` with `step(dt)` and
   `render()`, and `?sim` in the URL stops the animation loop so a test can drive it.
   `npm test` steps each game for a minute or two and checks the balance invariants.
4. **Iterate on the game the kid liked.** A second commit on a good game beats a first
   commit on a new one.

## The playtest log

Keep it at the bottom of each sheet, newest first:

```
2026-09-04 · who played · what they laughed at · where they got stuck · verdict · next change
```
