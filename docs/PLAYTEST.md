# Ko-Nia playtest

This sheet checks the MVP against the success and kill criteria in [`17_MVP_SPECIFICATION.md`](abandoned_city_design_pack_v2/17_MVP_SPECIFICATION.md). One session takes about 20 minutes.

## For the person running the test

- Pick testers who haven't seen the game. Tell them only: "You're a robot that just woke up in an abandoned city. Play however you like."
- Don't explain the controls, the scanner or the Logbook. Whether they work it out alone is one of the things being tested. The controls list on the title screen is fine.
- Watch if you can, and note where they get stuck or say something out loud.
- At least one tester should play on a MacBook Air M1, once in Chrome and once in Safari.

## For the tester

1. Open https://andrinmaurer.github.io/Ko-Nia/ in a desktop browser (Chrome or Safari) and choose **New game**.
2. Play for 10 to 15 minutes. There's no wrong way to play.
3. Press **Esc** and click **Copy playtest report**. If the browser doesn't allow copying, a text box with the report appears; select it and copy it.
4. Paste the report into a message together with your answers to the questions below.

The report contains play time, when you found your first Logbook entry and your first behavior observation, how often you scanned, the Logbook completion, the frame rate, your browser and screen size. Nothing is sent anywhere automatically.

## Questions

Answer each one with a word or two, and add a sentence if something stood out.

1. How did moving around feel? (good / okay / frustrating)
2. Did anything in the city make you curious? What?
3. Did spotting a plant or animal feel rewarding?
4. Did scanning feel satisfying, or like ticking boxes?
5. Did the Logbook make you want to complete entries?
6. Did you work out what to do without help? Where were you stuck, if anywhere?
7. When an entry asked you to observe a behavior, could you tell what to do next?
8. How did the big mantis feel? (something to avoid and watch / something to fight / didn't meet it)
9. Did the city feel peaceful or empty?
10. Could you tell plants, ruins and paths apart, or did things blend together?
11. Did the game ever stutter or slow down?
12. What would make you play another 15 minutes?

## Reading the results

| MVP criterion | Where to look |
| --- | --- |
| First Logbook entry within 2 minutes, no instructions | Report: "First Logbook entry" |
| At least one entry completed through a behavior observation | Report: "First behavior observation" and "Completed:" lines in the timeline |
| 30 FPS on a MacBook Air M1, Chrome and Safari | Report: "lowest 5 s average" (should be 30 or more) and "Lowest quality level used" |
| Moving feels good / movement isn't frustrating | Question 1 |
| The world makes the player curious / exploration isn't empty | Questions 2 and 9 |
| Spotting is rewarding, scanning is satisfying, not a checklist | Questions 3 and 4, plus "Scans" in the report |
| The Logbook makes the player want to complete entries | Question 5, plus "Logbook opens" |
| The loop is understood without a long tutorial | Question 6, plus "First time opening the Logbook" |
| Players can tell what to do for observations | Question 7 |
| The Vault Mantis is avoid-and-observe, not combat | Question 8, plus "Disabled" in the report |
| Vegetation and ruins are readable | Question 10 |
| Browser performance is stable | Question 11 and the FPS line |

If a kill criterion shows up for two or more testers, fix it before building the next block.
