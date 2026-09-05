# 🎳 Bowling Escape — כדור באולינג בורח

**Drawing:** `drawings/bowling-lane-and-monsters.jpg`, `bowling-monsters-2.jpg`,
`bowling-monsters-3-whiteboard.png`

**Fantasy:** "A bowling ball runs away from monsters that chase it, and when it hits the
pins you get 10 points — it's always a strike."

**Player verbs:** roll (arrows / stick) · shoot mini balls (Space, ammo from strikes) ·
**freeze** (stop rolling and the whole world stops) · aim strikes at racks.

**Enemy verbs:** each monster has its own move — the purple loop and yellow wheel charge
in straight lines and turn wide; the green zigzag waits and lunges; the snake and worm
slither; the dino bounds in hops; the snail barely moves but its arm reaches far; the
scribble monster tumbles about in jittery sidesteps (it used to blink closer, which read as
popping in and out of existence — removed 2026-09-04); the lollipop sways and fishes from above;
the alien mirrors your sideways moves. Every one grabs with a long body part; a slow ball
gets caught, a fast ball rips free.

**Goal:** none — it's an endless run; the score and the strike count are the trophy.
**Fail:** a grabber catches the ball, or you bump a monster's body.

**Twist:** the world only moves when the ball moves. Shots obey it too — stand still,
fire a volley, then roll and they all launch.

**Difficulty:** the CROWD. The lane starts with three monsters and wants one more for
every 12 seconds the world was actually moving and one more for every two strikes, up
to sixteen. Monster speed only creeps up, so the lane stays readable.

**Round length:** open-ended; a good run is a minute or two.

**Knobs (src/main.js):** `MONSTERS_START`, `CROWD_EVERY_S`, `CROWD_EVERY_STRIKES`,
`MAX_MONSTERS`, `BALL_MAX_SPEED`, `BREAK_SPEED`, the `BRAINS` table (speed / agility /
pattern per monster).

**Verified by:** `tests/games.spec.js` — a dodging controller must survive and strike;
the crowd cap must grow with rolling time and with strikes; strikes must never end the
game.

**Not in the game yet:** the yellow crown and the small striped fish on the second sheet.

## Playtest log
- 2026-09-04 · the user · no ending after ten strikes, no ball trail, the alien must match
  the whiteboard drawing, difficulty = more and more adversaries · done the same day
- 2026-08-12 · the kid · "OK" · wanted new games rather than more of this · next: monster
  personalities (done 2026-09-04)
