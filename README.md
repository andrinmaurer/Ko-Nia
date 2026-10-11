# Ko-Nia

A browser exploration game: a newly booted robot explores the overgrown ruins of an abandoned East Asian megacity, scanning plants and animals into its Logbook.

The design documents live in [`docs/`](docs/). The current goal is the MVP described in [`docs/abandoned_city_design_pack_v2/17_MVP_SPECIFICATION.md`](docs/abandoned_city_design_pack_v2/17_MVP_SPECIFICATION.md): one authored city block ("Shrine Street") where you can move around, discover something, scan it and see it in the Logbook.

## Play it

Once GitHub Pages is switched on for this repository (Settings > Pages > Source: GitHub Actions), every push to `main` publishes the game to https://andrinmaurer.github.io/Ko-Nia/ via [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

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
| Sprint | Shift |
| Jump / climb onto a ledge | Space |
| Scanner lens on / off | Right click |
| Scan | Left click (lens on) |
| Change scan mode (Visual / Biological) | ← → |
| Logbook | Tab (Q / E switch sections) |
| Use the Relay Station | E (save and recharge), R (rest until night or morning) |
| Switch first / third person | V |
| Pause | Esc |

Where the browser refuses to capture the mouse (some embedded previews), the game falls back to turning the view while the cursor is near a screen edge.

## What's in the MVP block

Every species, artifact and location from the MVP spec is in the block and can be completed in the Logbook. Organisms take three steps: a first scan, a Biological scan from close by, and one behavior you have to witness (some only happen at night, in the wind, or when you keep still). A full day lasts 60 real minutes; resting at the Relay Station skips to night or morning.

Progress is saved in the browser (localStorage) after every discovery and at the Relay Station. "New game" on the title screen clears it.

## Performance

The target is 30 FPS on a MacBook Air M1 (Chrome and Safari). `src/game/quality.ts` watches the frame rate and steps down render resolution, shadow map size and glow when it drops under 30, then steps back up when there is headroom. The current quality level shows next to the FPS counter in the top-left corner (Q5 is the highest).

All placeholder textures are painted onto canvases at load time (`src/world/textures.ts`), so the build ships no image files besides the logo. Set dressing is merged into one mesh per material, and grass is drawn with thin instances.

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
