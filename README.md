# 🎳⚽ משחקי הטוש (The Marker Games)

Three.js games designed by a kid, drawn with markers, and brought to life.

**Game 1 — כדור באולינג בורח (Bowling Escape)** — open `/` (index.html)
**Game 2 — פנדלים בנגיחה (Header Penalties)** — open `/pendel.html`
**Game 3 — תופסת שניצל (Schnitzel Tag)** — open `/schnitzel.html`
**Game 4 — דינו במבוך (Dino Maze)** — open `/dino.html`
**Game 5 — משחק אגרופים (Punch Game)** — open `/punch.html`

## 🥊 משחק אגרופים (Punch Game)

Five fighters in a forest, everyone against everyone, last one standing wins.
You are the green cat-head (drawn with two mismatched ears, one buck tooth and
long stick arms). Against you: the King (no arms — he whips his blue crescent
tail around himself, crown bobbing), the Queen (no arms either — she spins her
whole curled body like a figure skater, winking her V eye), the Emperor (a very
tall wavy tube with a purple outline and bent blue BUG ARMS, mantis-style, with
spiky claws) and the creature with the green mohawk (solid blue, electric spiky
aura, the only one with proper stick arms). All of them are built straight from
the kids' drawings. Move with arrows/WASD, punch with Space. The cat's punch is
a STRETCH punch — his comically long drawing-arms shoot out ~4 units like
elastic (fattening rubber-hose style as they fly), auto-aiming at the nearest
fighter and clobbering everyone along the line, then snapping back with a
boing. Punches send fighters flying with real physics (Rapier) — knock someone
into a tree and it hurts extra. Treetops politely squash themselves down
whenever they'd block your view of the action. NPCs genuinely fight each other, each with its own personality: the King
hunts whoever is closest, the Queen picks on the weakest and dashes in and out,
the Emperor is slow with a huge reach and double damage, and the creature is
fast, twitchy and random.

## 🦖 דינו במבוך (Dino Maze)

You are the big dinosaur, seen from above, loose in a maze that never ends
(it's generated from a hash — walk in any direction forever). Eat the little
dinosaurs (+10 each; speed 5 out of 10). A fire-breathing dragon (speed 4)
hunts *you* through the maze — one lick of flame and you're toast, literally.
It inhales before it breathes, so duck behind a wall or shoot it with Space:
three hits and it flees (+100), but it always comes back. Survive 200 seconds
to win. The 🐉 compass on the screen edge shows where the danger is.

## 🍳 תופסת שניצל (Schnitzel Tag)

You are a happy schnitzel. An angry frying pan chases you around the kitchen
and scoops you up like a spatula — and when it catches you, the expressions
swap: the pan gloats, the schnitzel sulks. Move in all directions, jump over
the pan with Space, dodge the table and the pot. 3 lives, survive as many
seconds as you can. Your best time is saved.

## ⚽ פנדלים בנגיחה (Header Penalties)

There's a goal, and inside it a goalkeeper — actually two, one standing on the
other's head, exactly as drawn. The ball comes **lobbed from behind you**, over
your head. Aim the red reticle with the arrows, press Space as the ball arrives
to jump and head it. Every goal is one point, and the keeper tower gets sharper
with every goal you score.

## 🎳 כדור באולינג בורח (Bowling Escape)

A bowling ball flees from monsters down an endless paper lane. Hit the pins —
it's **always a strike** — and score 10 points. The twist: **the world only
moves when the ball moves.** Stand still and everything freezes.

## How to play

- **Arrows / WASD** — roll the ball
- **Space** — shoot mini bowling balls at monsters (strikes refill your ammo)
- **Enter / Space** — start or restart
- Touching a monster (or a grabber tip, when you're slow) = caught!
- Fast balls rip free from grabber tips; standing still freezes the world — use it!

## The monsters

All designed on paper with markers: the purple loop on wheels, the green
stalk-eyed zigzag, the yellow spoked wheel, the snake with the blue head,
the dino with orange legs, the orange spiral snail — plus one from Claude's
imagination: the Scribble Monster. Each one grabs with a different body part.

## Run it

```bash
npm install
npm run dev
```

Build for production with `npm run build`.

🤖 Built with [Claude Code](https://claude.com/claude-code)
