# Predetermined logbook photos

Every discoverable entry has a fixed environmental photograph. The 52-entry inventory includes Shrine Street, Temple Hill and Flooded Arcade. Images appear after the first scan, stay the same through later research steps, and also appear for entries discovered in earlier saves.

The game uses optimized 960 × 640 WebP assets in `public/logbook`, selected by `src/discovery/photos.ts`. The logbook detail panel keeps their 3:2 framing. Undiscovered entries do not show photos. Scanning never captures or resizes the gameplay renderer. Loading an older save removes its captured image data while keeping discovery and research progress.

Full-resolution PNG masters are in `masters`. Exact prompts are in `prompts.json`, and `manifest.json` maps entry IDs to the game assets and masters. Generated with the built-in image generation tool; all selected images were visually reviewed.

Validation: production build/typecheck, browser checks for first scan and location discovery, continuing render frames and unchanged renderer size, legacy-save migration, concealment of undiscovered images, and switching both regions. All 52 photo mappings and assets are checked before delivery.

## Flooded Arcade

All 16 Flooded Arcade entries (37–52 in `prompts.json`) have generated and reviewed photographs. The three location refinements are saved as `-v2.png` masters; their final prompts include the added composition requirements. Optimized WebPs keep stable entry-ID filenames.
