# Technical Direction

This file helps determine the correct browser-game technology stack.

## Target Platforms

Select:
- Desktop browser
- Mobile browser
- Tablet browser
- Installable PWA
- Desktop wrapper later
- Native release later

Priority order: Desktop then Mobile and Tablet.

## Browser Targets

Which are required?
- Chrome
- Safari
- Firefox
- Edge

All of them.

## Visual Ambition

Choose:

### A — Lightweight
Low-poly / simple environments, broad device support.

### B — Moderate
Detailed 3D environments with modern shaders.

### C — High
Large environments, advanced lighting, dense vegetation, strong desktop GPU expected.

Desired level: B

## World Size

Approximate intended playable area:

- < 1 km²
- 1–5 km²
- 5–20 km²
- 20+ km²
- effectively unlimited / procedural

Answer: Unlimited

## Seamless World?

Should the player be able to move through the entire city without loading screens?

Yes / No / Ideally

Answer: Ideally

## Procedural vs Handcrafted

Estimate the balance:

- 100% handcrafted
- mostly handcrafted
- 50/50
- mostly procedural
- heavily procedural

Describe what should be procedural: heavily procedural, the city scape and vegetation should be created procedurally, animals spawn in certain biomes or zones.

## Multiplayer

Choose:
- Single-player only
- Asynchronous social features
- Co-op
- Multiplayer exploration
- TBD

Answer: Single Player first, later multiplayer with combined quests.

## Accounts

Do players need:
- no account
- optional account
- mandatory account

Answer: They need an account

## Cloud Features

Potential features:
- cloud save
- global discovery statistics
- achievements
- shared species catalogue
- screenshots
- community discoveries
- multiplayer

Choose: all of the above.

## Performance Target

Minimum target:
- 30 FPS
- 60 FPS

Answer: 30FPS

Desired hardware tier:
- low-end laptop
- average modern laptop
- gaming desktop
- Apple Silicon Mac
- high-end desktop only

- Low-End Laptop (Macbook Air M1), Tablet (iPad Pro M4), iPhone 15 Pro and later

## Offline Support

Should the game work offline after first load?

Yes / No / Partial

Answer: No its an online game.

## Content Download Strategy

Would you accept:
- initial large download
- streaming assets as player explores
- downloadable district packs

Preference: all of them are acceptable.

## Engine Preference

If you already have one:
- Babylon.js
- Three.js
- PlayCanvas
- Godot Web export
- Unity WebGL
- custom WebGPU
- no preference

Answer: no preference

## Coding Preference

Languages you are comfortable using:
- TypeScript
- JavaScript
- C#
- C++
- Rust
- other

Answer: none of them.
