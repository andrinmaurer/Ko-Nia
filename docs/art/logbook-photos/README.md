# Predetermined logbook photos

Every discoverable entry has a fixed environmental photograph. The 69-entry inventory includes Shrine Street, Temple Hill, Flooded Arcade and Sunken Station. Images appear after the first scan, stay the same through later research steps, and also appear for entries discovered in earlier saves.

The game uses optimized 960 × 640 WebP assets in `public/logbook`, selected by `src/discovery/photos.ts`. The logbook detail panel keeps their 3:2 framing. Undiscovered entries do not show photos. Scanning never captures or resizes the gameplay renderer. Loading an older save removes its captured image data while keeping discovery and research progress.

Full-resolution PNG masters are in `masters`. Exact prompts are in `prompts.json`, and `manifest.json` maps entry IDs to the game assets and masters. Generated with the built-in image generation tool; all selected images were visually reviewed.

Validation: production build/typecheck, browser checks for first scan and location discovery, continuing render frames and unchanged renderer size, legacy-save migration, concealment of undiscovered images, and switching both regions. All 69 photo mappings and assets are checked before delivery.

## Flooded Arcade

All 16 Flooded Arcade entries (37–52 in `prompts.json`) have generated and reviewed photographs. The three location refinements are saved as `-v2.png` masters; their final prompts include the added composition requirements. Optimized WebPs keep stable entry-ID filenames.

## Sunken Station

The 17 Sunken Station photographs (53–69) were generated from the supplied `sunken-station-photo-prompts.md` and visually reviewed. PNG masters, 960 × 640 WebPs, prompt records and all 17 ID mappings are included. This brings the asset inventory to 69 photos.

Sunken Station is now present in the playable repository. All 69 discoverable entries have fixed photographs, including its 17 newly connected entries.

## Tower Foot

The 17 Tower Foot photographs (70–86) are generated and visually reviewed, bringing the asset inventory to 86. PNG masters, optimized WebPs, exact prompts and stable entry-ID mappings are included. The elevator master is a refined `-v2.png` showing the car stranded below the landing.

Tower Foot entry definitions and district code are not on main at the time of this addition. Its 17 photo mappings are ready for the IDs supplied in `tower-foot-photo-prompts.md`; the existing 69 playable logbook entries retain their photos.
