# Technical Architecture

This document includes recommended defaults so you do not need to choose technologies blindly.

## Recommended Browser Stack

Current recommendation:

- **TypeScript**
- **Babylon.js**
- **WebGPU when available**
- **WebGL fallback**
- **Supabase backend**
- **Vite** for development / builds

Why this direction:
- strong fit for a browser-first 3D game
- direct access to modern web graphics
- easier browser deployment than Unity WebGL
- avoids proprietary engine lock-in
- works well with procedural / streaming architecture
- TypeScript gives stronger structure than plain JavaScript

Keep / change / TBD: keep

## Why Not Unity WebGL as Default?

Current decision:
Do not use Unity WebGL as the default architecture.

Reasons:
- heavier browser builds
- memory constraints
- slower iteration for web-native systems
- less control over streaming / web integration
- proprietary engine constraint conflicts with your stated preference

Override if desired:

## Why Not Godot Web as Default?

Godot remains viable, especially for prototypes, but current recommendation is web-native because the long-term game depends heavily on:
- streaming
- procedural generation
- device-specific scaling
- browser integration
- future backend features

Override if desired:

## Rendering

Recommended:
- WebGPU first where supported
- WebGL fallback
- forward / clustered rendering approach
- aggressive instancing
- LODs
- impostors / billboards for distant vegetation
- baked + dynamic lighting hybrid

Keep / change: keep

## World Streaming Model

Recommended:

`World Seed → Region → District → Chunk → Active Cells`

Near player:
- full geometry
- physics
- detailed AI
- audio

Mid distance:
- simplified geometry
- low-frequency simulation

Far distance:
- procedural state only

Keep / change: keep

## World Generation

Recommended:
Client generates deterministic baseline world from seed.

Server stores:
- account
- progress
- special discoveries
- persistent player changes
- shared/global statistics

This avoids storing an entire gigantic world in the database.

Keep / change: keep

## Determinism

Same seed + same coordinates should generate the same:
- road layout
- district type
- buildings
- baseline vegetation
- baseline habitat definitions

Rare dynamic events may differ.

Keep / change: keep

## Backend — Supabase

Recommended use:

- Auth
- player profile
- cloud saves
- Logbook progress
- achievements
- uploaded screenshots / metadata
- global discovery statistics
- future social features
- future multiplayer coordination

Do NOT store:
- every tree
- every common animal
- every generated building

Those should regenerate from seed.

Keep / change: keep

## Saving

Recommended:

Immediate local save:
- every discovery
- important progression event

Cloud sync:
- shortly after discoveries
- at Relay Stations
- periodically

If connection drops:
- allow temporary continuation
- queue sync
- warn only if cloud sync remains unavailable

This is better UX than instantly stopping the game despite the game being online-first.

Keep / change: keep

## Accounts

Current requirement:
Account required.

Keep / change: keep

## Multiplayer Future-Proofing

Do now:
- stable player IDs
- deterministic world coordinates
- unique discovery IDs
- server-compatible save schema

Do NOT build now:
- networking
- replicated physics
- real-time co-op
- shared NPC simulation

Keep / change: keep

## Asset Streaming

Recommended:

Initial download:
- core engine
- robot
- common materials
- common vegetation
- UI
- basic audio

Stream later:
- district-specific assets
- rare species
- landmark assets
- high-resolution textures

Keep / change: keep

## Graphics Quality Tiers

### Low
- reduced vegetation
- shorter draw distance
- lower shadows
- fewer active animals
- reduced post effects

### Medium
Target for MacBook Air M1.

### High
Target for gaming desktops / stronger Macs.

### Mobile
Separate aggressive profile.

Keep / change: keep

## Performance Target

- Minimum: 30 FPS
- Preferred higher-end: 60 FPS

Keep / change: keep

## Minimum Hardware

Current target examples:
- MacBook Air M1
- iPad Pro M4
- iPhone 15 Pro and later

Keep / change: keep

## Mobile Strategy

Recommended:
Same world and gameplay, lower visual density.

Reduce:
- foliage
- active creatures
- shadow distance
- volumetrics
- texture resolution
- post-processing
- simulation radius

Keep / change: keep

## Analytics

Optional anonymous analytics:
- crashes
- FPS / frame time
- memory use
- device / browser class
- where players get stuck
- discovery completion rates

Enable?
Yes

## Privacy

Any requirements beyond normal account / analytics consent?

Answer: not yet
