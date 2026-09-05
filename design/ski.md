# 🎿 Kelpie Downhill — כלב גולש

**Drawing:** asked for in chat, not drawn. "Could you make a Babylon.js game in which this dog
skis down a snowy mountain?" — the dog is the black-and-tan kelpie photo that was rebuilt as a
3D model (Blender, procedural; `src/assets/dog.glb` is its game export). Made 2026-09-04.

**Fantasy:** our dog on red skis, flying down a mountain that never ends.

**Player verbs:** lean into a carve (left/right) · tuck for speed · jump · spin in the air ·
thread a gate · follow the bones — each gate has a trail of bones curving in from the previous
gate and ending at its centre, so the bones *are* the course line (and the trees keep clear of it).

**Enemy verbs:** the mountain does the work — pines close in as you go (a wide corridor at the
top narrows chunk by chunk), rocks appear, kickers launch you whether you asked or not; the
valley walls push you back to the run.

**Goal:** score — distance, gates (+50), bones (+10), big air (+20), full spins (+100 each).
**Fail:** three bones (lives); a tree or rock costs one, with a two-second grace period.

**Skiing model (2026-09-05, third pass):** the input asks for a *lean*, not a turn — like a bike.
Starting or reversing a turn first sways the body the other way for 0.11 s (the counter-steer
kick, with the knees extending), then the body falls into the turn on a stiff spring (`leanSpring`
95, `leanDamp` 13) and the skis carve at the rate a balanced edge allows, ω = g·tan(lean)/v, so
the turn widens with speed. On top of the carve the skis pivot immediately with the input
(`skidSteer`, strongest at low speed) so a turn starts within a couple of frames; past `grip`
(1.7 g) the edge skids: extra drag and spray. Releasing the input leans the body back toward the
fall line (`recentre`); gravity's cross-slope pull also bends the line downhill. Spray comes off the
outside ski in proportion to edge force and skid; the camera rolls a little with the dog.

**The dog moves (2026-09-05):** the GLB carries a 22-joint skeleton (hips → spine → chest → neck →
head, ears, three tail bones, four three-bone legs; weights painted by distance in the Blender
build). `animateRig` poses it every frame in dog space with matrices (the glTF root is mirrored, so
quaternion composition of world rotations is wrong there): the hips drop with the crouch and each
leg solves two-bone IK so the paws stay on the skis (elbows fold back, knees forward); hips, spine,
chest, neck and head counter-roll against the lean (angulation) and the head looks into the turn
and tucks; the tail swings faster the harder the edge bites and whips on landing; the ears flap with
speed and lift in the air. Without a skeleton the old morph target and squash still work.

**Difficulty ramp:** the first chunks are an open piste — a 26 m clear corridor with a handful of
trees, no rocks, no kickers; over the first ~11 chunks (≈ 660 m) the corridor narrows to 3 m, the
trees multiply (6 → 120 per chunk and climbing), rocks appear from chunk 4 and kickers from chunk 2.

**Twist:** take-off is physical. You lift off when the snow curves away faster than gravity
can pull you down (v²·κ > g), so the same kicker is a tiny hop at 30 km/h and a two-metre
flight at 70. Steer in the air and the dog spins.

**Round length:** 60–120 seconds; speed settles around 74 km/h on a straight run.

**Knobs (src/ski.js `T`):** `slopeDeg`, `drag` / `dragTuck` (terminal speed), `carveDrag`,
`leanBase`/`leanPerSpeed`/`leanMax`, `leanSpring`/`leanDamp`, `kickTime`/`kickLean`, `grip`, `skidSteer`,
`recentre`, `jumpV`, `lives`, `kneeDrop`; the ramp (`corridor`, `nTrees`, rock count) in `makeChunk`;
the course in `gatesFor` (gate reach 0.45·Δz, ≤ 18 m; trail of ≤ 9 bones 3 m apart).

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
- The glTF `__root__` has scaling (1, 1, −1): bone `absoluteRotationQuaternion`s don't compose, so
  the rig is driven with world matrices (rotate about the joint, then `world × parent⁻¹`, decompose).
  IK bones get an absolute dog-space orientation; the spine chain gets relative deltas.

## Playtest log
- 2026-09-04 · first build · "are we skiing backwards?" — yes; orientation fixed
- 2026-09-04 · "more real skiing: lean to turn, like a bike, spray, knees" — lean-driven carve with a
  counter-steer kick, edge-force spray, knee-bend morph, camera roll
- 2026-09-05 · "turning too slow, the dog is rigid like a frozen cube, start easier" — skid-steer pivot on
  top of the carve and a stiffer lean spring; a real skeleton (IK legs, angulation, head look, tail,
  ears); open piste that narrows over the first 660 m
- 2026-09-05 · "the bones should lead to the gates, they're off course" — gates chained within reach of
  each other; bones laid as a smooth trail from the previous gate into each gate, spilling across
  chunk boundaries; trees and rocks keep 3.2 m off the trail
