# Ko-Nia

A browser exploration game: a newly booted robot explores the overgrown ruins of an abandoned East Asian megacity, scanning plants and animals into its Logbook.

The design documents live in [`docs/`](docs/). The game now includes Shrine Street, Temple Hill, and a saved relay-based progression system. The original MVP is described in [`docs/abandoned_city_design_pack_v2/17_MVP_SPECIFICATION.md`](docs/abandoned_city_design_pack_v2/17_MVP_SPECIFICATION.md): one authored city block ("Shrine Street") where you can move around, discover something, scan it and see it in the Logbook.

## Play it

Every push to `main` publishes the game to https://andrinmaurer.github.io/Ko-Nia/ via [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

To run a playtest, follow [`docs/PLAYTEST.md`](docs/PLAYTEST.md). The pause menu (Esc) has a "Copy playtest report" button that gives you first-entry time, observations, frame rate and a timeline of the session.

## Running it locally

You need [Node.js](https://nodejs.org) 20 or newer.

```sh
npm install
npm run dev
```

Then open the address it prints (usually http://localhost:5173) and click to start.

## Controls

| Action | Input |
| --- | --- |
| Move | W A S D |
| Look | Mouse |
| Sprint (installed at a relay) | Shift |
| Jump / climb (unlocked) / hover (unlocked) | Space; hold in air to hover |
| Glide / grapple (unlocked) | Hold F while falling / G aimed at an exposed ledge |
| Upgrades / map (unlocked) | U / M |
| Scanner lens on / off | Right click |
| Scan | Left click (lens on) |
| Change scan mode (available sensors) | ← → |
| Logbook | Tab (Q / E switch sections) |
| Use the Relay Station | E (upload, save and recharge), R (rest until night or morning) |
| Switch first / third person | V |
| Pause | Esc |

Where the browser refuses to capture the mouse (some embedded previews), the game falls back to turning the view while the cursor is near a screen edge.

## What's in the MVP block

Every species, artifact and location from the MVP spec is in the block and can be completed in the Logbook. Organisms take three steps: a first scan, a Biological scan from close by, and one behavior you have to witness (some only happen at night, in the wind, or when you keep still). A full day lasts 60 real minutes; resting at the Relay Station skips to night or morning.

Progress is saved in the browser (localStorage) after every discovery and at the Relay Station. "New game" on the title screen clears it.

## Blocks after the MVP

The city continues past Shrine Street, one block at a time. Only one block is drawn at once; they swap inside covered passages where neither end is in view (`src/world/regions.ts`).

- **Temple Hill** ([proposal](docs/blocks/02_TEMPLE_HILL_PROPOSAL.md)): up the stair lane behind the Neighborhood Shrine.
- **Flooded Arcade** ([proposal](docs/blocks/03_NEXT_BLOCKS_PROPOSAL.md)): through the gap in the temple's east wall and down the stairwell of the old west building. The street is flooded knee-deep: wading is slow and costs energy, deep water sends the robot back, and the shop roofs and roof girders are the dry route.
- **Sunken Station** ([proposal](docs/blocks/03_NEXT_BLOCKS_PROPOSAL.md)): down the station stairs at the arcade's east end, behind the flood barrier. The first underground block: a ticket hall, stopped escalators, a platform with a stopped train (walk through the carriages or over the roofs) and a maintenance tunnel. Daylight only comes down three shafts. The Tunnel Hound hears running and hard landings; walk, or keep to the train roofs.

## Performance

The target is 30 FPS on a MacBook Air M1 (Chrome and Safari). `src/game/quality.ts` watches the frame rate and steps down render resolution, shadow map size and glow when it drops under 30, then steps back up when there is headroom. The current quality level shows next to the FPS counter in the top-left corner (Q5 is the highest).

All placeholder textures are painted onto canvases at load time (`src/world/textures.ts`), while Logbook photographs ship as optimized WebP assets. Set dressing is merged into one mesh per material, and grass is drawn with thin instances.

## Tech

- [Babylon.js](https://www.babylonjs.com) for rendering and collisions, imported through `src/babylon.ts` with deep paths to keep the bundle small
- TypeScript, built with [Vite](https://vite.dev)

UI styling comes from the Ko-Nia design system (Terminal theme), copied into `src/ui/ds/`.

| Folder | What's in it |
| --- | --- |
| `src/main.ts` | Engine, lighting, game loop, Relay Station and save wiring |
| `src/world/` | The Shrine Street block, set dressing, placeholder textures, sky, Relay Station, wind |
| `src/world/life/` | Plants and animals with their behaviors |
| `src/discovery/` | Logbook entries, progress/saving, scanner |
| `src/player/` | Robot controller (incl. ledge climbing), camera, energy and damage |
| `src/game/` | Day/night cycle, adaptive quality and shared game context |
| `src/ui/` | HUD, Logbook screen, icons, design-system CSS |

## Discoverable asset references

The [discoverable asset blockout and visual inventory](docs/art/discoverables/discoverable-assets.md) covers all 18 MVP entries, with individual species/object turnarounds, location sheets, generation prompts and modeling notes. These are first-pass concept references.

## Logbook photographs

The [69 predetermined logbook photographs](docs/art/logbook-photos/README.md) cover Shrine Street, Temple Hill, Flooded Arcade and Sunken Station. Scanning reveals fixed photos and preserves research progress from existing saves. The game uses optimized WebP assets; PNG masters, prompts, and the entry mapping are included in the art package.

## Upgrade progression

See [upgrade rules and controls](docs/UPGRADES.md). Upload research at a relay, then press U to install eligible upgrades. Existing saves keep sprint and climbing; fresh units begin with walking and jumping. Mission transmissions arrive every 5% uploaded research and can be replayed in the upgrade panel.

The browser regression suite in `tests/upgrades.cjs` runs against the local development server with Playwright installed: `node tests/upgrades.cjs`.
