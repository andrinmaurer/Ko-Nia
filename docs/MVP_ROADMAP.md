# Ko-Nia: from today's game to the MVP

Status: proposal, waiting for Andrin's OK. Nothing here is being built yet.

## Where we are

The MVP in `17_MVP_SPECIFICATION.md` was one block: walk, scan, log. That was reached this morning, and the game has grown well past it:

- Three blocks: Shrine Street, Temple Hill and the Flooded Arcade, swapping in passages so only one is drawn at a time.
- 52 Logbook entries with fixed photos, search and sorting.
- Relay Stations, saving, respawn, energy, the day/night cycle.
- Andrin's upgrade path (sprint to reinforced chassis), the map, and all 20 transmissions up to direct contact at 100%.
- About 58 FPS in Safari on Andrin's Mac at top quality.

So the written MVP is not what "finished" means any more. What's missing is a **complete first chapter**: a game a stranger can start, understand on their own, play to a real ending, and want to keep playing.

## The finish line (proposed)

The MVP is done when:

1. **A whole chapter.** The robot wakes on Shrine Street, follows the Predecessor Unit's trail through Old Town, the Flooded Arcade and the Sunken Station, and finds it shut down at Tower Foot, looking at the skyline. That's the chapter's ending.
2. **100% is reachable.** Every upgrade threshold and all 20 transmissions can be earned within these five blocks, so the direct-contact message is a real ending, not a number nobody reaches.
3. **It sounds alive.** Wind, water, servos, animal calls and the scan shutter. Today the game is silent, although the spec relies on sound (the Choir Moss chord, the Mantis's wing rattle) and the Audio lens is already in the game.
4. **New players find their way.** A fresh tester opens the Logbook, completes an entry by watching a behaviour, and knows what to try next, all without being told.
5. **Basic settings.** Volume, mouse sensitivity, invert look, field of view, quality, subtitles for sound cues, reduced motion and text size.
6. **It holds up.** 30 FPS or better on a MacBook Air M1 in Chrome and Safari in every block, saves survive updates, and no known bugs that block progress.
7. **Three blind testers** play it against the success and kill criteria and nothing on the kill list comes up.

Still not in the MVP: accounts and cloud saves, controller and touch, weather and seasons, the procedural city, districts beyond Tower Foot.

## The steps

There are two tracks that run side by side, then a shared finish.

### Track A: the last two blocks (thread "Second city block")

Already approved in `03_NEXT_BLOCKS_PROPOSAL.md`. Nothing new here, just the order.

| Step | What | Andrin's part |
|---|---|---|
| A1 | **Sunken Station**: the first underground block, Tunnel Hound, the Last Departure board | Give the OK to start (that thread is waiting on it); approve the build; make the ~15 Logbook photos |
| A2 | **Tower Foot**: the first vertical block, Ledge Kite, the Board Room, the Predecessor found. Ends the chapter | Approve the build; make the ~15 photos |

### Track B: everything around the blocks (this thread)

One pull request and one playable link per step, each one approved by Andrin before the next starts.

| Step | What | Andrin's part |
|---|---|---|
| B1 | **Guidance.** Move the "what to observe next" hints into the Logbook (the fix proposed after the first playtests), add a short boot sequence at the first Relay that points at the lens and the Logbook once, and optional research leads in the Logbook (e.g. "Something in the alley reacts to stillness"). No arrows, no quest markers. | Try it; say whether it's too much or too little |
| B2 | **Settings menu** with the settings listed above, saved in the browser. | Quick check |
| B3 | **Sound pass.** Ambient layers per block (wind, water, the underground hum), robot servos and footsteps, scan shutter and discovery chime, a call or sound for each animal, the Choir Moss chord, warning sounds for each danger, and sparse ambient music. Sounds are made in the browser where possible; anything else comes from free (CC0) sound libraries, credited in the repo. Track A adds sounds for its new species with the same system. | Listen and give notes; the mix is a taste call |

B1 and B2 don't touch the same code as the blocks, so they can start right away. B3 starts once Sunken Station is merged, so both tracks don't edit the same species files at once.

### The finish (after both tracks)

| Step | What | Andrin's part |
|---|---|---|
| C1 | **Progression and ending.** Re-balance the upgrade thresholds across ~81 entries so 100% is reachable, check the transmissions line up with what the player has seen by then, and make the Predecessor at Tower Foot land as the chapter's ending (a short closing moment, then free exploring). | Approve the threshold table and any rewritten transmission lines |
| C2 | **Polish and stability.** FPS check in all five blocks on Chrome and Safari, old saves load cleanly, a bug sweep through a full playthrough, a loading screen if block swaps hitch. | Run the FPS check on your Mac |
| C3 | **Blind playtest round.** Three fresh testers with the playtest kit. Fix what comes up, then call it MVP 1.0 on the Pages link. | Find three testers |

## Order at a glance

1. Now: OK Sunken Station (A1) and this plan; B1 starts here.
2. B2 while A1 is being built.
3. A2 and B3 once Sunken Station is merged.
4. C1, C2, C3 once Tower Foot and the sound pass are in.

## What I need from Andrin

- Is "the first chapter, Shrine Street to Tower Foot" the MVP you mean? If the finish line is somewhere else (fewer blocks, more blocks, something like accounts), I'll redraw the plan.
- An OK to start B1 here. A1 is your OK in the "Second city block" thread.
