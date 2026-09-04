# 🎿 Kelpie Downhill — כלב גולש

**Drawing:** asked for in chat, not drawn. "Could you make a Babylon.js game in which this dog
skis down a snowy mountain?" — the dog is the black-and-tan kelpie photo that was rebuilt as a
3D model (Blender, procedural; `src/assets/dog.glb` is its game export). Made 2026-09-04.

**Fantasy:** our dog on red skis, flying down a mountain that never ends.

**Player verbs:** carve left/right · tuck for speed · jump · spin in the air · thread a gate ·
grab a bone.

**Enemy verbs:** the mountain does the work — pines close in as you go (a wide corridor at the
top narrows chunk by chunk), rocks appear, kickers launch you whether you asked or not; the
valley walls push you back to the run.

**Goal:** score — distance, gates (+50), bones (+10), big air (+20), full spins (+100 each).
**Fail:** three bones (lives); a tree or rock costs one, with a two-second grace period.

**Twist:** take-off is physical. You lift off when the snow curves away faster than gravity
can pull you down (v²·κ > g), so the same kicker is a tiny hop at 30 km/h and a two-metre
flight at 70. Steer in the air and the dog spins.

**Round length:** 60–120 seconds; speed settles around 74 km/h on a straight run.

**Knobs (src/ski.js `T`):** `slopeDeg`, `drag` / `dragTuck` (terminal speed), `carveDrag`,
`turnRate`, `jumpV`, `lives`, tree corridor (`9.5 - i * 1.3`) and count (`40 + i * 6`) in
`makeChunk`.

**Verified by:** `tests/games.spec.js` "Kelpie Downhill" — slope, terminal speed, carving,
straightening, jump + landing, spin scoring, gate scoring, tree hit costs one life, finite
state, chunk streaming, no console errors.

## Notes
- Babylon.js (npm `@babylonjs/core` legacy bundle + glTF loader), not the three.js kit; the
  HUD, input, audio, manifest links and `?sim` hook are the kit's, so it behaves like its
  siblings. `dog.glb` is imported with `?url`; the artifact build inlines it as a data URL
  (`assetsInlineLimit` in vite.config.js).
- Thin instances on a `clone()`d mesh render nothing until `makeGeometryUnique()`.
- Babylon's `Quaternion.FromLookDirectionLH` faces a mesh *away* from the direction; the
  dog is oriented with an explicit axes matrix instead (it skied backwards once).

## Playtest log
- 2026-09-04 · first build · "are we skiing backwards?" — yes; orientation fixed
