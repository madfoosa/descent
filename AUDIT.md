# Pre-build audit — Descent
*Audited 2026-07-14 in Claude Code before any code was written. HANDOFF.md is kept verbatim; where this audit conflicts with it, the audit wins.*

## Context change since the handoff was written
Written for a cold-start Cowork session. This build happens in Claude Code with direct file access: **this git repo is the canonical deliverable** (`descent.html` lives here), and `gruesandgloryv2.html` can likely be read from disk rather than uploaded — search before asking (Open question 1 may answer itself).

## Findings

### F1 — CONTRADICTION: the grue timer disagrees with itself
Three statements conflict:
- Canon section: "three warnings in darkness then death" → death on the **4th** consecutive dark turn.
- Phase 1 test: "grue timer kills on turn 3 of darkness."
- Gas-room set piece: shutter the lantern "for 3 safe turns."
**Resolution:** canon wins (it's quoted G&G behavior). Warnings on dark turns 1, 2, 3; death at the start of dark turn 4. This makes the shutter's "3 safe turns" exactly true — shutter, take three actions, unshutter alive. Phase 1 test amended to "kills on the 4th consecutive turn of darkness"; any lit turn fully resets the counter (state the reset explicitly in the engine spec — it's load-bearing for the gas room).

### F2 — ENVIRONMENT: headless Node harness assumed, not verified
**Resolution:** check `node --version` before Phase 1. If absent, install or fall back to extracting the `DESCENT` module script block and running it under any available JS runtime; the engine-as-pure-module requirement doesn't change either way.

### F3 — RISK: localStorage under file:// varies by browser
Auto-save every turn and the morgue both depend on it; some browsers scope or restrict file:// storage.
**Resolution:** wrap storage in one adapter; if localStorage is unavailable, degrade to in-memory play plus an exportable save string, and say so on screen rather than failing silently. Verify once in Chris's actual browser at Phase 3.

### F4 — GAP: "careful-bot" is undefined but is the tuning instrument
Phase 2 tunes fuel spawns until the bot reaches floor 8 in 40–70% of 500 seeded runs, but the bot's policy isn't specified — an aggressive bot and a timid bot would tune the game very differently.
**Resolution:** define the policy in the harness before tuning: always move toward stairs via shortest known path, pick up all fuel/torches on the way, fight only when adjacent (bump), refuel when lantern < 25%, never explore side rooms once stairs are known. Document it next to the test so the 40–70% target is reproducible.

### F5 — CONFIRMED GOOD (no change)
Seeded determinism (mulberry32, seed in URL hash, kinship with Wake), light-as-clock, interruptible permadeath, steady-mode toggle, and the morgue log all hang together with no internal conflicts. No port or Sentinel obligations — nothing scheduled, nothing served.

## Git hygiene
Single-file build; nothing generated to ignore except packaging leftovers.
