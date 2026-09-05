# 🥊 Punch Game — משחק אגרופים

**Drawing:** `drawings/punch-fighters-1.webp` (the cat), `drawings/punch-fighters-2.webp`
(the emperor, king, queen, creature)

**Fantasy:** "Five fighters in a forest, everyone punches everyone, Space punches, last
one standing wins. We're the green cat."

**Player verbs:** move · **stretch-punch** (the cat's comically long arms shoot out and
clobber everything in a line, auto-aimed) · **dash** (Shift: a burst with a moment of
invulnerability — dodge a swing or close a gap) · knock fighters into trees for extra
damage.

**Enemy verbs:** the king whips his crescent tail at whoever is near; the queen spins her
whole body and skates away after a hit; the emperor is slow with a huge double-damage
reach; the creature zigzags and dashes in. At most two of them hunt the cat at once; the
rest brawl among themselves. They steer around trunks and hold grudges.

**Goal:** clear the wave (all four down) → the next wave arrives tougher and the cat heals
two hearts; score for hits, knockouts, tree bonks and waves. **Fail:** the cat falls.

**Twist:** real physics — punches send fighters flying, trees shake and duck out of the
camera's way; a second player can join as the blue cat (WASD).

**Round length:** 60–120 seconds for a few waves.

**Knobs (src/punch.js):** `SPECS` (hearts / reach / cooldown per fighter), the hunter cap
and `playerBonus` in `pickTarget`, `DASH_*`, `TREE_BONK_SPEED`, `WAVE_HEAL`.

**Verified by:** `tests/games.spec.js` — with the cat only fleeing, the roster must not
wipe itself out in the first fifteen seconds; restart must rebuild the match without a
page reload; two-player mode must spawn six fighters.

## Playtest log
- 2026-08-13 · the kid · punches felt short and the fighters looked alike · stretch punch
  and silhouette fixes (done)
- 2026-09-04 · review · NPCs knocked each other out in 14 s while the cat watched ·
  player-priority AI with a hunter cap, dash, waves, score, 2P, restart
