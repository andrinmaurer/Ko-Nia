# MVP Specification

## Resolved MVP Goal

> The first prototype succeeds if the player can move around one city block, discover something, scan it, and see that discovery recorded in the Logbook.

The MVP should prove the **feeling of the game**, not the procedural city technology.

## Explicitly NOT in MVP

Do not build yet:

- procedural megacity
- infinite streaming world
- multiplayer
- full Supabase feature set
- seasons
- full weather simulation
- 50 species
- complex animal reproduction
- full story
- all movement abilities
- final art quality

Also not in MVP:
- accounts / login (progress is saved locally in the browser; the save format is Supabase-compatible so it can sync later)
- the map (it unlocks at 5% and the MVP has too few entries to matter)
- transmissions
- upgrades
- Audio, Thermal and Night Vision scan modes
- controller and touch input (keyboard + mouse only)

## MVP World

One authored ruined city block.

Include:
- one street
- one alley
- one small enterable interior
- one elevated route
- visible vegetation takeover
- one quiet landmark
- one Relay Station

Describe the block:

**Shrine Street**, a single block on the edge of Ko-Nia's Old Town, roughly 120 m × 60 m.

- **The street:** a narrow two-lane shopping street between ruined 4–6 storey buildings. The asphalt is split by roots and puddles; a collapsed tram wire lies across it. Shop signs in a fictional script are bleached but readable as signs.
- **The alley:** a tight back alley behind the shops, full of rusted AC units, drainpipes and storm drains. Dark, damp, mossy. Home of the Drainback.
- **The interior:** a small ground-floor noodle shop. Counter, stools, a toppled vending machine, a menu board, a collapsed back room. Light comes through holes in the ceiling. Territory of the Vault Mantis.
- **The elevated route:** a broken concrete pedestrian overpass that once crossed the street. One end has fallen and forms a ramp of rubble; the other connects to a rooftop. Lantern Wisteria hangs from its underside. The Predecessor Unit (major discovery) rests at its highest point.
- **Vegetation takeover:** Rebar Ivy covers the façades, ferns fill the gutters, a large tree has burst through the noodle shop roof.
- **The quiet landmark:** a small neighborhood shrine at the end of the street, with a leaning torii gate, two moss-covered guardian statues and an offering box. Hookbills nest on the torii.
- **The Relay Station:** a tall, slim alien structure planted in the middle of the street, clearly not human-made. The robot boots up here at the start of the game.

The block is closed off by collapsed buildings and impassable rubble on all sides, so no invisible walls are needed.

## MVP Visual Target

Use simplified stylized realism.

The point is:
- readable ruins
- strong vegetation contrast
- correct atmosphere
- acceptable browser performance

Describe desired mood:

Early morning after rain. Low warm sun cuts between the buildings, the concrete is wet and dark, the green is saturated, and a light mist hangs at street level. Quiet: wind, dripping water, insects, a distant call now and then. Peaceful and slightly melancholy, never threatening except inside the noodle shop.

A simple day/night cycle runs (one full day = 60 real minutes, per `11_ECOSYSTEM_SYSTEM.md`) so the night-only discoveries work. At night the Lantern Wisteria glows and the Lantern Moths swarm. No weather in the MVP.

## MVP Robot Abilities

Recommended:
- walk
- sprint
- jump
- basic climb / mantle
- scanner

Do NOT add grapple / hover / glide until the core loop works.

Keep / change: keep

Note: `08_ROBOT_DESIGN.md` says the full game starts with only walk + jump, with sprint and climb unlocked later. The MVP gives sprint and mantle from the start to test how movement feels; unlock timing is a post-MVP question.

## MVP Controls

Keyboard + mouse, following `09_SCANNING_AND_LOGBOOK.md`:

| Action | Input |
| --- | --- |
| Move | W A S D |
| Look | Mouse |
| Jump / mantle | Space |
| Sprint | Shift (hold) |
| Scanner lens on / off | Right mouse button (toggle) |
| Cycle scan mode | ← / → arrow keys |
| Scan / take photo | Left mouse button (while lens is on) |
| Interact (Relay Station) | E |
| Logbook | Tab |
| Switch camera (1st / 3rd person) | V |
| Pause / settings | Esc |

## MVP Camera

Choose:
- third person
- first person
- switchable

Answer: switchable

## MVP Scanner

Recommended starting modes:
- Visual
- Biological

Optional:
- Audio

Answer: go with your recommendation

Details:
- **Visual:** captures silhouette, image, location and time. Works on everything (organisms, artifacts, landmarks).
- **Biological:** reveals ancestry hints and biology fields. Only works on organisms, at closer range (≤ 8 m vs 25 m for Visual).
- Scanning costs energy (see Energy below).

## MVP Logbook

Minimum fields:

- temporary / final name
- image
- category
- discovery location
- short description
- observation progress

Keep / change: keep

Progress model: each MVP entry has 3 observation steps:
1. **First scan (Visual):** page created as `UNKNOWN ORGANISM ####` with silhouette, location and time.
2. **Biological scan:** reveals ancestry hint and one biology field.
3. **Behavior observation:** a specific condition (listed per species below). Completing it reveals the final name, given by the colony with a short whimsical comment, and marks the entry 100%.

## MVP Energy

`08_ROBOT_DESIGN.md` lists 500 W capacity and 10 W per metre, which would empty the battery after 50 m. For the MVP:
- capacity: 500 units
- walking: 1 unit per 10 m, sprinting: 1 unit per 5 m
- scan: 15 units
- solar recharge in daylight: +1 unit/s while standing still, +0.3 unit/s while moving; none at night
- Relay Station: full recharge
- at 0 energy the robot slows to a crawl (no sprint, no scan) rather than shutting down

This keeps the meter relevant at night without forcing the player to wait.

## MVP Plant Species

### Plant 1
Name: Lantern Wisteria
Appearance: huge wisteria descendant hanging in curtains from the overpass. Pale violet flowers, seed pods like paper lanterns.
Behavior: pods glow soft blue-green at night to attract Lantern Moths, which pollinate it.
What first scan reveals: silhouette, location, time; "climbing woody plant".
What second observation reveals: Biological scan shows wisteria ancestry. Night observation (pods glowing with moths present) completes the entry and links it to Lantern Moth.

### Plant 2
Name: Rebar Ivy
Appearance: dense ivy with rust-red, iron-rich leaves. Thick stems follow exposed metal.
Behavior: grows along rebar and pipes, slowly cracking concrete. Thick patches form climbable surfaces (mantle points).
What first scan reveals: silhouette, location, time; "climbing plant on metal".
What second observation reveals: Biological scan shows ivy ancestry and iron uptake. Scanning a spot where it has split a wall completes the entry.

### Plant 3
Name: Shutter Fern
Appearance: knee-high fern clusters in gutters and cracks, fronds with a darker underside.
Behavior: fronds snap shut when something approaches. Sprinting makes them close from further away; walking slowly lets you get close while open.
What first scan reveals: silhouette (closed), location, time.
What second observation reveals: Biological scan shows fern ancestry. Scanning it while open (approach slowly) completes the entry and reveals the bright pattern on the inside.

### Plant 4
Name: Sun Lotus
Appearance: broad lotus pads and a single tall bloom in a flooded pothole in the street.
Behavior: pads and flower slowly turn to follow the sun across the day and fold at night.
What first scan reveals: silhouette, location, time; "aquatic plant".
What second observation reveals: Biological scan shows lotus ancestry. Scanning it at two clearly different times of day completes the entry ("it moves").

### Plant 5
Name: Choir Moss
Appearance: carpets of moss on the shrine statues with tiny hollow upright stalks.
Behavior: when the wind gusts, the stalks produce a soft whistling chord. This is the "quiet landmark" sound.
What first scan reveals: silhouette, location, time; "moss / bryophyte".
What second observation reveals: Biological scan shows moss ancestry. Scanning it during a wind gust (gusts happen every 1–2 minutes) completes the entry.

## MVP Animals

### Animal 1
Name: Hookbill
Appearance: crow descendant the size of a goose, glossy black with copper sheen, long hooked beak, four-toed grasping feet.
Behavior: small flock (3–4) nesting on the torii. Hops along the street collecting shiny objects (bottle caps, glass) and carries them back to the nest. Flies off if the robot sprints toward it.
Threat: none.
Observation condition: watch a Hookbill carry an object to its nest (happens every few minutes, in daylight).

### Animal 2
Name: Lantern Moth
Appearance: hand-sized moth with translucent wings and faintly glowing body markings.
Behavior: rests hidden under the overpass during the day (scannable but hard to spot), swarms around the Lantern Wisteria at night.
Threat: none.
Observation condition: observe the swarm feeding at the Lantern Wisteria at night.

### Animal 3
Name: Drainback
Appearance: rat descendant the size of a small dog, with overlapping armored plates on its back and long whiskers.
Behavior: lives in the alley storm drains. Flees into the drain if the robot moves quickly nearby. Emerges to forage if the robot stays still for about 5 seconds.
Threat: none.
Observation condition: stand still nearby until it comes out and watch it forage.

## Dangerous Organism

Name: Vault Mantis
Type: ambush predator / territorial, mantis descendant the size of a large dog. Grey-green and almost invisible against the noodle shop's mossy tiles.
Why dangerous: it guards an egg case in the noodle shop's back room. If the robot enters its territory it first rattles its wings (warning), and after 2 seconds it strikes. Each strike causes damage; three strikes disable the robot.
How player escapes / avoids it: back out on the warning, or run outside; it does not leave the shop. The shop is also visible from the overpass through a collapsed ceiling, giving a safe observation spot.
What can be learned by observing it: first scan from a distance creates the page. Observing it from the overpass while it tends its egg case completes the entry and reveals "nesting defense".

## Major Discovery

`07_SCOPE_AND_ROADMAP.md` asks for one major discovery.

**The Predecessor Unit:** at the highest point of the overpass, half-buried in Rebar Ivy, is a deactivated robot that looks like an older model of the player's own robot. Scanning it creates the first entry in the **Origin** section of the Logbook. It reveals nothing else. It only raises the question "Who sent me?" and hints that the player isn't the first one.

Alternative if this gives away too much of the story: an intact shrine offering box containing a human object (e.g. a child's drawing of the city), as the first **Human Artifacts** entry.

## Human Artifacts and Locations

Small extra entries to make the block feel full:
- Locations: Shrine Street, Noodle Shop, Overpass, Neighborhood Shrine (each revealed on first scan)
- Human Artifacts: vending machine, menu board, torii gate, guardian statue

The MVP Logbook therefore holds 18 entries: 5 plants, 4 animals, 1 Origin entry, 4 locations and 4 artifacts.

## MVP Relay Station

Minimum functionality:
- activate
- set respawn point
- save
- recharge
- open Logbook

Keep / change: keep

## MVP Discovery Flow

1. Player notices: something moving or reacting (Shutter Fern snapping shut, a Hookbill hopping past) or a subtle audio cue.
2. Player approaches: carefully, because some organisms react to speed.
3. Scanner displays: with the lens on, scannable things get a soft outline. Unknown ones show `UNKNOWN ORGANISM`, known ones show their name and progress (e.g. 1/3).
4. Scan action: left click. A short shutter-like effect (like taking a screenshot) while the outline resolves.
5. Immediate feedback: subtle sound plus a small `LOGBOOK ENTRY CREATED` notice that names the newly learned field. No XP numbers.
6. Logbook entry: new page `UNKNOWN ORGANISM ####` with the scan image, location, time and the remaining fields shown as locked.
7. Additional observation: a Biological scan or watching the species' specific behavior. The page shows a hint for the next step (e.g. "Seems active at night").
8. Page update: the field fills in with a short highlight. At 3/3 the final name appears with the colony's comment.

## MVP Failure State

Recommended:
If disabled, respawn at Relay Station with discoveries preserved.

Keep / change: keep

## MVP Success Criteria

The MVP succeeds if:

- moving around feels good
- the world makes the player curious
- spotting an organism feels rewarding
- scanning is satisfying
- the Logbook makes the player want to complete the entry
- browser performance remains stable
- the player understands the loop without a long tutorial

Add criteria:
- a new player creates their first Logbook entry within 2 minutes without instructions
- a player completes at least one entry using a behavior observation, not just scans
- holds 30 FPS on a MacBook Air M1 in Chrome and Safari

## MVP Kill Criteria

If any of these are true, redesign before scaling:

- exploration feels empty instead of peaceful
- scanning feels like clicking a checklist
- Logbook pages feel disposable
- movement is frustrating
- vegetation / ruins are visually unreadable
- browser performance is already poor on one small block

Add:
- the Vault Mantis feels like a combat encounter instead of something to avoid and observe
- players ignore the observation conditions because they can't tell what to do next

## Deferred Past the MVP

These blanks in the design packs don't block the MVP and stay open for now:

- `01`: working title
- `05`: robot visual design (waiting for your stylesheet)
- `07`: ultimate vision, nice-to-haves
- `08`: upgrade categories, unlock timing for sprint / climb, energy numbers for the full game
- `10`: acceptable procedural repetition, procedural "hard no" list
- `12`: species beyond the MVP set
- `13`: districts other than Old Town
- `14`: transmission story beats 5%–95%, upgrade categories
