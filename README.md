# DESCENT

A single-file ASCII roguelike beneath the Great Underground Empire. Ten-to-twenty
minute permadeath runs, eight floors down, where **light is the clock** and the dark
is full of grues. Companion to *Grues & Glory*. No dependencies, no install, no
network — open `descent.html` in any browser (works from `file://`).

## Play
**Anywhere:** <https://madfoosa.github.io/descent/> — works on phones. On iOS/Android,
"Add to Home Screen" for a fullscreen app. Progress saves per-device.

**Desktop:** double-click `descent.html`. Move with arrows / `hjkl` / numpad / `yubn`
(diagonals); walk into a monster to attack. `g` get, `>` descend, `1`–`8` use an
inventory item, `s` shutter the lantern, `.` wait, `?` help. Click a map tile to step
toward it. Everything you need is on screen.

**Touch:** on-screen d-pad (hold to repeat), or swipe the map in eight directions, or
tap a tile to step toward it; tap your own tile to grab what's under you. Tap a pack
item to use it. Shutter/descend are buttons; the floor-8 choice appears as buttons.
The map auto-scales to the screen.

Your lantern burns fuel each turn. In true darkness you get three warnings, then a
grue takes you (canon: *"It is pitch black. You are likely to be eaten by a grue."*).
A **shuttered** lantern buys exactly three dark turns — enough to cross a gas pocket
without igniting it. Rest in the light and wounds close, slowly. Reach floor 8 and
raise the First Lantern to win; there is also a quieter, darker way to end it.

- **Seeded & shareable.** Each run's seed shows top-right and lives in the URL
  (`#seed=12345`). Same seed → identical descent. Kinship with *Wake*.
- **Interruptible permadeath.** Progress auto-saves every turn; close the tab and
  come back mid-run. Death clears the save. (Under `file://`, if a browser blocks
  storage, it degrades to in-memory play and says so — nothing fails silently.)
- **Steady mode.** Top-right toggle kills the flicker/scanline animation for days
  when motion is hostile. The setting persists.
- **Morgue.** The death screen remembers your last five descents. *"You have been
  eaten by a grue 3 times. The grues remember."*

## Build & tests
`engine.js` is the pure, DOM-free game logic (exposed as `globalThis.DESCENT`);
`descent.html` inlines it verbatim under a thin UI. To regenerate the single file
after editing the engine, re-inline `engine.js` into the `<script>` block.
(`index.html` on GitHub Pages is the same file, renamed so the URL serves it.)

`node harness.js` — 29 checks, all green:
- **Phase 1 (engine):** seed determinism (identical layouts), connectivity over
  1,000 generations, symmetric shadowcasting FOV, the grue clock (death on the 4th
  consecutive dark turn; any lit turn resets it), the shutter's exact 3-turn budget.
- **Phase 2 (systems):** save/load round-trips to an identical state, death clears
  the save, items/fuel/weapon/armor/inventory-cap, set pieces on the right floors,
  win + secret ending, gas-room ignition vs. shuttered crossing.
- **Fuel/difficulty simulation:** an audit-defined "careful bot" (beeline to stairs,
  fight only when adjacent, refuel <25%, heal <50%, retreat when overwhelmed) reaches
  floor 8 in **~60% of 500 seeded runs** — inside the 40–70% design band. This is how
  the fuel and monster economy is tuned: by simulation, not by feel.
- **Phase 3:** three scripted walkthroughs (a real winning run, a grue death, the
  snuff ending). The final acceptance is a human playtest — that part is yours.

<!-- SPOILERS below -->
## Spoilers (floor set pieces)
Floor 2 gas pocket (shutter through it for a big fuel flask). Floor 4 the hermit's
ghost brother — give him a treasure, get 70 fuel. Floor 6 the thief's skeleton drops
a lockpick. Floor 8 the First Lantern: **raise** it to win, or **snuff** it (stand on
it, press `X` or tap SNUFF IT) for the secret ending — the screen goes dark, and the
grues come.
