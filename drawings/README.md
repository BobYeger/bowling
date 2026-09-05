# The drawings are the spec

Every game in this repo started as a marker drawing (or a spoken description) by the
kids. The drawings live here so that anyone building or fixing a game reads the
original instead of a paraphrase — two of the five games shipped with a misread
drawing before these were checked in (a goalkeeper "standing on another keeper's head",
a dino with its back spikes turned into legs).

| File | Game | What's on it |
|---|---|---|
| `bowling-lane-and-monsters.jpg` | Bowling Escape | The lane with its two brown edge lines, the six pins (blue outline, red band), the red scribble ball with three holes, the yellow wheel with red spokes, the purple loop on wheels, the green stalk-eyed zigzag monster. The text is the rules: the ball runs from chasing monsters, hitting pins is always a strike, 10 points. |
| `bowling-monsters-2.jpg` | Bowling Escape | The long green snake with purple zigzags, a blue scribble head with a purple horn and two little wheels at its tail; the orange spiral snail with a spiky crown; the green dino with orange triangles down its BACK. A yellow crown and a small yellow striped fish are also on the page and are not in the game yet. |
| `bowling-monsters-3-whiteboard.png` | Bowling Escape | The lollipop (grey ball with a red asterisk on a teal double pole), the grey peanut-head worm with red dangling legs and a red dot on its tail, and the green stick alien with big black eyes and twig hands and feet. |
| `header-penalties.jpg` | Header Penalties | A domed goal net, a green goalkeeper with his arms flung wide and polka-dot gloves standing in it, and — nearer to us — a big kid in a blue-and-white striped shirt with huge arms and the ball on his head. Vertical stacking in a kid's drawing means depth, not a tower. |
| `punch-fighters-1.webp` | Punch Game | The player: a green cat head with mismatched ears, one big eye and one small, asterisk whiskers, a buck tooth, and two long stick arms ending in mitten fists. |
| `ski-dog-reference.png` | Kelpie Downhill | The dog itself (a black-and-tan kelpie), cut out from the photo the model was built from — this is the reference `src/assets/dog.glb` was fitted against (silhouette IoU 0.87). The original kitchen photo was shared in chat; drop it here as `ski-dog-photo.jpg` if you want it in the repo too. |
| `punch-fighters-2.webp` | Punch Game | The tall purple wavy emperor with blue zigzag bug arms and a brown base; the king (round tan head, yellow crown, blue crescent body, no arms); the queen (a blue curled shape with a crown and a winking eye, no arms); the creature with the green mohawk (solid blue, spiky aura, stick arms, three-toed feet). |

Dino Maze was described out loud (speeds 5 and 4 out of ten, a fire dragon, an endless
maze) and has no drawing. Kelpie Downhill (`ski.html`) was asked for in chat; its "drawing" is
the photo of the dog that became `src/assets/dog.glb` (see `design/ski.md`).

## Adding a new game

1. Photograph the drawing and drop it here with a descriptive name.
2. Write the verb sheet in `design/<game>.md` and link the drawing from it.
3. Reference the file from the top of the game's source so the next reader finds it.
