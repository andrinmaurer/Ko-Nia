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
| Jump | Space |
| Switch first / third person | V |
| Release the mouse | Esc |

## Tech

- [Babylon.js](https://www.babylonjs.com) for rendering and collisions
- TypeScript, built with [Vite](https://vite.dev)

| Folder | What's in it |
| --- | --- |
| `src/main.ts` | Engine, lighting, game loop |
| `src/world/` | The Shrine Street greybox block |
| `src/player/` | Robot controller and camera |
| `src/input.ts` | Keyboard and mouse handling |
