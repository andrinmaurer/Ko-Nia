# Abandoned City — Design Pack v2

This pack continues from the first design questionnaire.

## Decisions already resolved

These are now treated as current design defaults unless you explicitly override them later:

1. **No combat.** The robot survives by fleeing, hiding, climbing, hovering, grappling, or otherwise escaping.
2. **Knowledge is the main reward.** No traditional XP popups or level grind.
3. **The Logbook is the heart of the game.** First scan creates an entry; repeated observation completes it.
4. **Map is not available at the beginning.** The robot receives / unlocks the mapping subsystem at 5% total Logbook completion.
5. **Energy is an exploration constraint, not a hunger bar.** It should create interesting decisions, especially underground or during bad weather, without forcing the player to wait around constantly.
6. **Relay Stations are save / respawn / recharge / upload hubs.**
7. **The city is effectively unbounded rather than literally infinite.** It is generated deterministically from a world seed and streamed around the player.
8. **The MVP is NOT procedural yet.** First prove movement → discovery → Logbook in one authored city block.
9. **Procedural generation comes later in layers:** block → blocks → district → streamed city.
10. **Stylized realism remains the visual target, but quality scales by device.** Desktop gets denser vegetation, longer draw distance, better shadows and more active wildlife; mobile uses reduced density and simpler effects.
11. **30 FPS is the minimum target.** 60 FPS can be a higher-end option.
12. **Single-player first.** Future co-op / shared research should be considered in data design, but not allowed to complicate the MVP.
13. **Supabase is the planned backend** for accounts, cloud saves, catalogue sync, achievements, screenshots / metadata, global discovery statistics and later multiplayer services.
14. **The same world seed should be deterministic.** The same coordinates generate the same city structure and baseline habitats.
15. **Species simulation is medium-depth.** Individuals near the player get richer behavior; distant populations are represented more cheaply.

## Fill order

1. `08_ROBOT_DESIGN.md`
2. `09_SCANNING_AND_LOGBOOK.md`
3. `10_WORLD_GENERATION.md`
4. `11_ECOSYSTEM_SYSTEM.md`
5. `12_SPECIES_DESIGN_RULES.md`
6. `13_CITY_AND_DISTRICTS.md`
7. `14_PROGRESSION_AND_TRANSMISSIONS.md`
8. `15_UI_UX.md`
9. `16_TECHNICAL_ARCHITECTURE.md`
10. `17_MVP_SPECIFICATION.md`

Mark anything unknown as `TBD`. Short answers are fine.
