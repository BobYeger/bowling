# 🦖 Dino Maze — דינו במבוך

**Drawing:** told, not drawn. "You're the big dinosaur in a maze that never ends, you eat
the little dinosaurs (speed 5), a fire dragon chases you (speed 4)."

**Player verbs:** run · eat (and **chain** eats into a sprint) · shoot the dragon (Space,
auto-aim) · hide behind walls from the flame · find the exit.

**Enemy verbs:** little dinos graze, then flee and U-turn when you charge; the dragon
paths through the maze to you, inhales (the warning), breathes a flame that walls stop;
driven off, it returns faster each time; a second dragon joins at the halfway mark; when
the clock hits zero the dragons get angry (overtime: faster, fire more often).

**Goal:** eat 15 little dinos → the exit opens somewhere in the maze (a compass points at
it) → reach it. **Fail:** the flame touches you.

**Twist:** an endless hash-generated maze — every direction goes on forever, every game
is a new maze.

**Round length:** 60–120 seconds; 150 seconds on the clock before overtime.

**Knobs (src/dino.js):** `GOAL_EAT`, `ROUND_TIME`, `BOOST_MUL`, `BOOST_T`,
`DRAGON_SPEED` (+12% per return), `FIRE_RANGE`, `CHARGE_T`.

**Verified by:** `tests/games.spec.js` — feeding the dino 15 times must open the exit and
spawn the second dragon; standing on the exit must win; the clock at zero must switch
on overtime.

## Playtest log
- 2026-09-04 · review · the old build was "survive 200 seconds" with no escalation ·
  goal-based win, eat chains, dragon escalation added
