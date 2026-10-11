# Robot progression

Research becomes eligibility when uploaded at either relay with E or the upgrade panel's upload button. U opens upgrades anywhere, but installations and uploads require an activated relay within interaction range. Panels pause gameplay. Discovery progress never disappears on respawn.

| Uploaded research | Upgrade | Additional requirement / control |
| --- | --- | --- |
| 0% | Sprint | Install at a relay; hold Shift |
| 5% | Mapping | M; visited 5-metre ground cells, discovered landmarks, activated relays; click explored ground for up to 20 saved markers |
| 10% | Hover | Hold Space airborne, three seconds per landing, 4 energy/second |
| 15% | Battery | 750 capacity instead of 500 |
| 20% | Night vision | Scanner mode; amplified light, 2 energy/second |
| 25% | Climbing | Space at ledges, or move into them airborne; maximum 2.1 metres |
| 25% | Glide | Scan and upload the overpass's deactivated unit; hold F while falling, descent capped at 1.8 m/s, 1.5 energy/second |
| 30% | Thermal | Scanner mode; visible animal heat within 35 metres, 2 energy/second |
| 35% | Spore filter | Downtime 20 → 5 seconds; energy loss 40 → 10 |
| 40% | Solar efficiency | Daylight charging multiplied by 1.75, including while moving |
| 50% | Grapple | Scan and upload the pagoda survey mark; G aimed at an exposed horizontal ledge within 35 metres; 10 energy launch plus 6/second, 12 m/s pull; Space cancels |
| 60% | Genetic analysis | Ancestry at 15 metres rather than the biological lens's 8; 25 energy/scan, lineage readout |
| 65% | Radiation survey | Scanner mode, 25 energy/survey; background-level report (no active radiation sources in the two authored districts) |
| 75% | Advanced mapping | Recorded sighting positions and known high-danger organisms; no live animal tracking |
| 80% | Reinforced chassis | Five integrity points instead of three |

The design pack supplies the 5%, 10%, 25%, and 50% milestones and the quest requirement for glide/grapple. The remaining thresholds and the use of existing origin discoveries as quest rewards are implementation choices for these two districts. No new quest NPCs or unimplemented regions are implied.

Visual, biological and audio lenses are available initially. Arrows cycle only installed sensor modes. Audio scans capture behavior only when its existing observation condition is happening; genetic analysis identifies ancestry without fabricating a behavior observation. Thermal respects occlusion and animal availability. Powered movement stops when energy cannot cover the next frame. Grappling uses collision movement and aborts when blocked. Night optics restore normal lighting when the lens closes or changes modes.

Uploads issue one transmission at each 5% milestone, up to direct contact at 100%. Messages are retained for replay and never issued twice after reloading. Exploration continues at 100%.

Save format remains compatible with v1 discovery saves. New progression, map cells, markers, quest findings and transmission history are stored in an optional `upgrades` section. Older saves preserve their already-available sprint and climbing; new games start with walking and jumping. New game clears all local progression.
