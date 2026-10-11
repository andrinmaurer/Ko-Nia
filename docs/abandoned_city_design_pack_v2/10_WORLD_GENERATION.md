# World Generation

## Resolved Technical Direction

The world is **effectively unbounded**, not literally infinite.

Recommended model:

- one deterministic world seed
- generated in chunks / sectors
- only nearby areas exist at full detail
- far-away areas exist as lightweight procedural data
- unloaded areas can be regenerated identically from the seed
- important player changes are stored separately as persistent state

The MVP does not use this yet.

## World Identity

What should the city feel like?

Answer: Lost and abandoned, yet full of life with all the plants, fungi and animals.

## Shared or Personal World

Recommended default:
- same base world seed for all players
- same major districts / landmarks / baseline habitats
- personal progress and discoveries are stored per player

Keep / change: keep

## Architectural Inspiration

Choose / mix:

- Tokyo
- Hong Kong
- Seoul
- Shanghai
- Singapore
- fictional East Asian megacity
- other

Answer: Tokyo, Hong Kong, fictional

## District Types

Suggested:

- Financial
- Residential towers
- Industrial
- Old town / temple district
- University
- Research campus
- Transit hub
- Flooded district
- Botanical district
- Crater zone
- Suburbs
- Forest edge
- Underground metro

Add / remove: keep

## Generation Hierarchy

Recommended architecture:

World Seed  
→ Macro regions  
→ Districts  
→ Road network  
→ City blocks  
→ Buildings  
→ Ruin pass  
→ Vegetation pass  
→ Habitat pass  
→ Discovery pass

Keep / change: keep

## Roads

Should roads feel:
- realistic mixed network
- strict grid
- organic
- terrain-driven
- futuristic megacity

Answer: mixed, dense city grids but also the occasional park as well as organic suburbs

## Buildings

Recommended:
- modular building kits
- procedural façades
- handcrafted landmark structures
- only selected interiors enterable
- interiors generated / loaded only when needed

Keep / change: keep

## Enterable Buildings

Rough target percentage:

Answer: 10%

## Interiors

Should interiors be:
- modular procedural
- mostly authored
- hybrid

Answer: hybrid

## Verticality

Which layers are playable?

Recommended:

1. Deep infrastructure
2. Metro / underground
3. Street
4. Lower interiors
5. Mid-rise
6. Vegetation canopy
7. Rooftops
8. Tower ruins

Keep / change: keep

## Destruction

How ruined should the city be after 2,000 years?

Answer: very ruined.

## Vegetation Takeover

Describe how aggressively plants reclaim structures:

Answer: very aggressive

## Water

Include:
- flooded streets
- rivers
- wetlands
- reservoirs
- underground water
- coastal areas

Answer: 
- flooded streets
- rivers
- wetlands
- reservoirs
- underground water

## Procedural Ruin Rules

Examples:
- collapsed floors
- leaning towers
- exposed interiors
- root damage
- flooded basements
- buried roads
- bridges overtaken by vegetation

Your rules:
- collapsed floors
- leaning towers
- exposed interiors
- root damage
- flooded basements
- buried roads
- bridges overtaken by vegetation

## Navigation Guarantees

Recommended generator rules:
- every major district remains reachable
- every generated block has at least one valid traversal path
- vertical shortcuts are optional
- dangerous shortcuts may exist
- hidden routes reward observation
- generation must never trap the player

Keep / change: keep

## Streaming

Resolved goal:

Loading should be mostly invisible. Tunnels, elevators, ruined interiors and long traversal moments may hide heavier streaming when needed.

Keep / change: keep

## Persistent World Changes

Which must be saved?

Recommended:
- activated Relay Stations
- discovered locations
- Logbook progress
- opened special access points
- custom map markers
- major one-time discoveries

Add / remove: keep

## World Evolution

Should these change over time?

- vegetation growth
- nests
- migration
- flooding
- weather routes
- seasonal access

Answer: yes

## Procedural Repetition

What repetitions are acceptable?

Answer: not answer yer

## Hard No

What procedural failures would immediately break immersion?

- not answer yet
