# Runtime visual language

The discoverable turnaround sheets now guide the browser game's procedural models. The robot and city retain their existing rendering system; new species and artifact geometry uses muted foliage, weathered ivory, graphite, stone, copper and rust. Biological glow remains tied to the existing day cycle.

## Implemented forms

- Hookbill: hooked beak, eyes, grasping feet, tail feathers, copper wing details, twig nests and articulated flight wings.
- Lantern Moth: paired forewings and hindwings, six legs and antennae; existing light attraction and night markings.
- Drainback: fur grain, overlapping armor plates, ears, paws, whiskers and a curved tail; existing hiding and foraging states.
- Vault Mantis: four walking legs and two folded raptorial forelegs, antennae, segmented abdomen, warning wings and a ribbed egg case.
- Lantern Wisteria: hanging racemes, woody stems, leaves and night-lit pods.
- Rebar Ivy: cutout foliage tinted rust red instead of solid rectangular panels.
- Shutter Fern: smaller, muted fronds with the existing open and closed states.
- Sun Lotus: veined pads, a curved stem, layered petals and a pollen cup; existing daylight orientation.
- Choir Moss: textured cushions and hollow stalk openings; existing wind response.
- Predecessor Unit: seated ivory shell, dark joints, twin lenses, solar panels and encroaching ivy.
- Vending Machine: toppled open cabinet, shelves, dispensing coils, coin slot and remaining window fragments.
- Menu Board: wooden frame and eroded fictional writing.
- Shrine: carved guardian silhouettes and raised torii beam tips, preserving the street layout and traversal routes.

## Rendering and discovery

`src/world/life/visuals.ts` supplies shared small painted textures and merges static detail by material. Wings and forelegs remain separate for animation. `src/world/artifacts.ts` dresses the existing artifact anchors. All visible replacement parts are registered with their existing discovery entries; collision anchors remain in place where needed.

These are stylized procedural game models informed by the sheets, rather than imported production meshes. Transparent seed-pod membranes, sculpted stone recesses, exact feather anatomy and the full environment sheets remain art-production refinements. The existing player robot, relay, atmosphere and UI already provide the surrounding visual treatment.

## Validation

- TypeScript and production build pass.
- Browser scene loads without runtime errors or disposed discovery meshes.
- Close-up scanner checks cover species and artifacts, including Drainback emerging after a calm approach.
- The complete scene has 388 meshes and approximately 174,000 vertices in the validation snapshot. This is a geometry count, not a device performance certification.

Target-device performance still needs a normal interactive playtest; headless Chromium checks do not establish the project's Safari/M1 frame-rate target.
