# Ko-Nia

A browser exploration game: a newly booted robot explores the overgrown ruins of an abandoned East Asian megacity, scanning plants and animals into its Logbook.

The design documents live in [`docs/`](docs/). The current goal is the MVP described in [`docs/abandoned_city_design_pack_v2/17_MVP_SPECIFICATION.md`](docs/abandoned_city_design_pack_v2/17_MVP_SPECIFICATION.md): one authored city block ("Shrine Street") where you can move around, discover something, scan it and see it in the Logbook.

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

## What's in the MVP block

Every species, artifact and location from the MVP spec is in the block and can be completed in the Logbook. Organisms take three steps: a first scan, a Biological scan from close by, and one behavior you have to witness (some only happen at night, in the wind, or when you keep still). A full day lasts 60 real minutes; resting at the Relay Station skips to night or morning.

Progress is saved in the browser (localStorage) after every discovery and at the Relay Station. "New game" on the title screen clears it.

## Tech

- [Babylon.js](https://www.babylonjs.com) for rendering and collisions
- TypeScript, built with [Vite](https://vite.dev)

UI styling comes from the Ko-Nia design system (Terminal theme), copied into `src/ui/ds/`.

| Folder | What's in it |
| --- | --- |
| `src/main.ts` | Engine, lighting, game loop, Relay Station and save wiring |
| `src/world/` | The Shrine Street greybox block, Relay Station, wind |
| `src/world/life/` | Plants and animals with their behaviors |
| `src/discovery/` | Logbook entries, progress/saving, scanner |
| `src/player/` | Robot controller (incl. ledge climbing), camera, energy and damage |
| `src/game/` | Day/night cycle and shared game context |
| `src/ui/` | HUD, Logbook screen, icons, design-system CSS |
