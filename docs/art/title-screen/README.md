# Title-screen artwork

Five generated background plates follow `KO-NIA_Title-Screen.png`: city sunrise, misty Temple Hill, Flooded Arcade, Sunken Station, and city blue hour. The sunrise plate removes the reference's baked-in UI; the four variants use it as a style and robot reference. Real menu controls, the wordmark, tagline and footer are rendered separately above the art.

Full-resolution masters are in `masters/`; optimized WebPs are in `public/title/`; final prompts are in `prompts.json`. All five were generated with the built-in image tool and visually reviewed.

`TitleBackdrops` advances every 20 seconds with a six-second opacity blend. It waits for image readiness and stops rotating while playing, paused, in the Logbook, while the tab is hidden, or when either in-game or system reduced-motion mode is active. Pause menus retain the gameplay scene behind them.

The title menu supports pointer selection, native Tab/Enter activation, and arrow navigation. Title-screen Logbook browsing returns to the title without starting gameplay. Settings and the expandable controls guide remain available at narrow widths and large text sizes.
