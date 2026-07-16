# Descent — An ASCII Roguelike Beneath the Great Underground Empire
**Handoff doc for Claude Opus. Designed by Claude Fable 5, 2026-07-11.**
Cold-start doc. Companion piece to Chris's existing game *Grues & Glory* (a 79-room parser text adventure, single HTML file, CRT aesthetic). Ask Chris to upload `gruesandgloryv2.html` if you need exact styling/lore text; this doc carries what you need to start.

## Who this is for
Chris lives with POTS and SLE — energy varies day to day, so a play session must fit whatever the day gives. He loves the CRT/phosphor retro aesthetic (his personal search engine CONSTRUCT and G&G both use it), keyboard-only interfaces, seeded generative systems (his art piece *Wake* names each run by its seed), and honest, tested single-file builds. This is a **great-day axis** project: it exists purely because it's worth enjoying. Private/personal use, kept low-visibility like his other deployments.

## The product in one sentence
A single-file HTML ASCII roguelike: 10–20 minute permadeath runs descending eight floors below the Great Underground Empire, where **light is the clock** and the dark is full of grues.

## Canon to honor (from Grues & Glory)
The Great Underground Empire; grues ("It is pitch black. You are likely to be eaten by a grue." / three warnings in darkness then death); the thief; the cyclops; the hermit; strata that G&G established: cellar → mine (gas room, coal seam) → crypt → Temple of Flame → Gates of Hades / Land of the Dead → magma. G&G's four endings involve the crown and the dead king. **Descent's premise:** the trophy case is full and the throne decided — but something under the Land of the Dead has started eating the Empire's light. You descend to find the **First Lantern**. Floor 8 holds it. Getting back up is not required: raising it IS the win (keeps runs short).

## Locked design decisions (do not undo)
1. **Single HTML file, zero dependencies, works from file://.** DOM monospace text grid (not canvas) — crisper glyphs, easier CRT styling. Target grid ~60×30 plus sidebar.
2. **Seeded and deterministic.** mulberry32 PRNG, one seed drawn per run (crypto.getRandomValues), seed displayed in the death/win screen and settable via URL hash (`#seed=...`) for replay/sharing. ALL generation and combat rolls flow from the run PRNG. (Kinship with Wake.)
3. **Light is the core resource.** Brass lantern burns fuel per turn; darkness beyond your light radius is genuinely unrendered (not just dimmed). In darkness: grue warning escalation, 3 turns → death, exactly like G&G. Fuel flasks, torches (bright but fixed duration), glowing fungus rooms (safe pockets). Difficulty = light economy, not stat inflation.
4. **Runs are 10–20 minutes.** Eight floors, each small (fits one screen, no scrolling map). No grinding, no shops, no XP curve — power comes from found items and fuel decisions.
5. **Interruptible permadeath.** Auto-save to localStorage every turn; closing the tab mid-run and reopening resumes exactly. Death deletes the save. Permadeath with pause = variable-energy-compatible.
6. **Fog-friendly controls.** Arrow keys OR hjkl OR numpad; bump-to-attack; `g` get, `>` descend, `i` inventory, `?` help. A persistent one-line key legend always on screen — nothing to memorize. Mouse optional: click adjacent tile to move.
7. **Small, legible systems.** ~10 monster types across 8 floors (grue variants only in darkness; mine: coal bats, gas wisps; crypt: the restless dead; deeps: things with too many eyes). ~15 items, no identification minigame, no hunger clock — the lantern IS the clock. Inventory cap 8.
8. **CRT aesthetic matching G&G/CONSTRUCT**: phosphor green on near-black, subtle scanlines, occasional flicker, amber for warnings, red only for death. Include a "steady" toggle that kills flicker/animation (some days flicker is hostile).
9. **Morgue log.** localStorage graveyard: seed, floor reached, cause of death, turns, date. Death screen shows last 5. "You have been eaten by a grue 3 times. The grues remember."
10. **Flavor text does the world-building.** Floor entry lines, item descriptions, and deaths carry the G&G voice — dry, slightly menacing, affectionate toward the player ("Built with spite and nostalgia" energy).

## Generation (per floor)
Rooms-and-corridors (4–7 rooms), guaranteed connectivity (flood-fill check), stairs down placed at distance from entry. Field of view: recursive shadowcasting, radius = current light level (lantern 4, torch 6, fungus room ambient). Explored-but-unlit tiles render as dim memory. Fuel spawn tuned so a careful run reaches floor 8 with ~10% margin — tune via simulation (see tests), not feel.

## Special floors (fixed set pieces, placed deterministically from seed)
- Floor 2 (Mine): a gas pocket room — carrying an open flame in it is a bad idea; the lantern can be shuttered (light 0, grue timer runs) for 3 safe turns.
- Floor 4 (Crypt): the hermit's brother, a friendly ghost; trades fuel for a treasure if you carry one.
- Floor 6 (Gates): the thief's skeleton, lockpick still in hand (item: opens the floor-7 vault shortcut).
- Floor 8: the First Lantern chamber — no monsters, one choice: raise it (win) or snuff it (secret ending, screen goes dark, one final line before the grues arrive).

## Build phases + acceptance tests
Test harness: headless Node — the game logic must be a pure module inside the file (engine functions exposed on a `DESCENT` object) so tests can `require`/eval it without a DOM. Precedent: G&G Release 3 shipped with a headless regression harness; do the same.
**Phase 1 — engine.** Mapgen + FOV + movement + PRNG. Tests: same seed → byte-identical floor layouts; connectivity guaranteed over 1,000 seeded generations; shadowcasting symmetric (if A sees B, B sees A); grue timer kills on turn 3 of darkness.
**Phase 2 — systems.** Combat, items, fuel, saves. Tests: save→load mid-run resumes identical state (serialize, reload, compare full state hash); death clears save; fuel simulation over 500 seeded auto-runs: careful-bot reaches floor 8 in 40–70% of runs (tune spawn rates until true).
**Phase 3 — UI + aesthetic + set pieces + morgue.** Manual playtest by Chris is the acceptance test here, plus: steady-mode toggle persists; all controls reachable; three scripted walkthroughs (win, grue death, secret ending) pass in the harness.

## Definition of done
All harness tests green, three walkthroughs pass, single file `descent.html` delivered + presented, seed shown on end screens, README with a spoiler-marked section. Notion Projects DB entry (`collection://ffc150e5-e9fd-45f7-b23a-2465db8b6109`) created with Last State + Next Action. Candidate future releases noted, not built: more strata, daily seed, achievements.

## Open questions for Chris (ask only these)
1. Upload `gruesandgloryv2.html` for exact palette/CSS values and voice calibration? (Recommended but not blocking.)
2. Any monster or set piece from G&G he specifically wants to meet again down there?
