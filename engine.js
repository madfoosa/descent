// ============================================================
//  DESCENT — engine (pure, DOM-free, headless-testable)
//  Exposes globalThis.DESCENT. All randomness flows from the run PRNG.
// ============================================================
(function (root) {
"use strict";

// ---- PRNG: mulberry32 (kinship with Wake) ----
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rint = (rng, n) => Math.floor(rng() * n);              // 0..n-1
const rrange = (rng, lo, hi) => lo + rint(rng, hi - lo + 1); // inclusive
const choice = (rng, arr) => arr[rint(rng, arr.length)];

// ---- dimensions ----
const W = 48, H = 26;                 // map grid
const LIGHT = { lantern: 4, torch: 6, dark: 0 };
const GRUE_DEATH_TURN = 4;            // AUDIT F1: warnings on dark turns 1-3, death at start of turn 4
const INV_CAP = 8;
const FLOORS = 8;

// ---- tiles ----
const T = { WALL: 0, FLOOR: 1, STAIRS: 2, FUNGUS: 3 };

// ---- floor flavor / strata ----
const STRATA = [
  { name: "The Cellar",          entry: "Damp stone and the smell of forgotten wine. The dark waits below." },
  { name: "The Mine",            entry: "Coal dust films everything. Something skitters where your light does not reach." },
  { name: "Lower Mine",          entry: "The shafts go deeper than any ledger recorded. The timbers complain." },
  { name: "The Crypt",           entry: "The dead of the Empire are stacked like cordwood. Most of them stay put." },
  { name: "Deep Crypt",          entry: "The moss glows here, faintly, as if apologizing. It is the only kindness on this floor." },
  { name: "The Gates",           entry: "Bronze gates, torn from their hinges. Beyond, the air is very cold and very interested in you." },
  { name: "The Deeps",           entry: "There are shapes here with too many eyes and too few opinions about your survival." },
  { name: "The First Chamber",   entry: "The dark is total but for one waiting light. This is what ate the Empire's dawn. Or what could give it back." },
];

// ---- monsters (~10 across 8 floors) ----
const MONSTERS = {
  grue:      { g: "&", name: "grue",           hp: 6, dmg: 3, darkOnly: true,  speed: 1, flavor: "It is made of appetite and shadow." },
  coalbat:   { g: "w", name: "coal bat",       hp: 2, dmg: 1, floors: [2,3],   speed: 1, erratic: true },
  gaswisp:   { g: "*", name: "gas wisp",       hp: 1, dmg: 1, floors: [2,3],   speed: 1, flavor: "It drifts toward flame." },
  ratking:   { g: "r", name: "rat-king",       hp: 4, dmg: 1, floors: [1,2],   speed: 1 },
  restless:  { g: "z", name: "restless dead",  hp: 5, dmg: 2, floors: [4,5],   speed: 1, slow: true },
  wight:     { g: "W", name: "barrow-wight",   hp: 6, dmg: 2, floors: [5,6],   speed: 1 },
  shade:     { g: "S", name: "gate-shade",     hp: 5, dmg: 2, floors: [6,7],   speed: 1, drainsLight: true },
  manyeyes:  { g: "Y", name: "the many-eyed",  hp: 9, dmg: 3, floors: [7],     speed: 1 },
  crawler:   { g: "c", name: "pale crawler",   hp: 3, dmg: 1, floors: [3,4,5], speed: 1 },
};

// ---- items (~15) ----
const ITEMS = {
  fuel_small:  { g: "!", name: "fuel flask",        kind: "fuel",   amt: 45,  flavor: "Whale oil, probably. Best not to ask." },
  fuel_big:    { g: "!", name: "brimming flask",    kind: "fuel",   amt: 90,  flavor: "Heavy and sloshing. A good find." },
  torch:       { g: "/", name: "pitch torch",       kind: "torch",  amt: 35,  flavor: "Burns bright and brief — light 6, but it won't last." },
  fungus:      { g: "%", name: "glowcap",           kind: "heal",   amt: 4,   flavor: "Bitter. Mends what the dark tore." },
  crown_shard: { g: "$", name: "crown-shard",       kind: "treasure", flavor: "A splinter of the old king's crown. It hums." },
  coin:        { g: "$", name: "handful of zorkmids",kind: "treasure",flavor: "Currency of a dead empire. Still shiny." },
  goblet:      { g: "$", name: "jeweled goblet",    kind: "treasure", flavor: "Heavy, ornate, and no help against a grue." },
  dagger:      { g: "|", name: "elvish dagger",     kind: "weapon", dmg: 2,   flavor: "It glows blue near the hungry dark." },
  mace:        { g: "|", name: "iron mace",         kind: "weapon", dmg: 3,   flavor: "Simple. Persuasive." },
  armor:       { g: "[", name: "rusted mail",       kind: "armor",  def: 1,   flavor: "Dented, but it has opinions about being stabbed." },
  lockpick:    { g: "-", name: "thief's lockpick",  kind: "key",    flavor: "Still warm from a dead hand. Opens what should stay shut." },
  repellent:   { g: "?", name: "grue-be-gone",      kind: "repel",  amt: 8,   flavor: "\"Effects temporary. Grues hold grudges.\"" },
  ration:      { g: "*", name: "waybread",          kind: "heal",   amt: 2,   flavor: "Stale. Filling. Technically food." },
  oil_lamp:    { g: "(", name: "spare wick",        kind: "fuelmax",amt: 20,  flavor: "Raises your lantern's capacity a little." },
};

// ---- map generation: rooms + corridors, guaranteed connectivity ----
function genFloor(rng, depth) {
  const grid = Array.from({ length: H }, () => new Array(W).fill(T.WALL));
  const rooms = [];
  const nRooms = rrange(rng, 4, 7);
  let tries = 0;
  while (rooms.length < nRooms && tries < 200) {
    tries++;
    const rw = rrange(rng, 5, 10), rh = rrange(rng, 3, 6);
    const rx = rrange(rng, 1, W - rw - 2), ry = rrange(rng, 1, H - rh - 2);
    const nr = { x: rx, y: ry, w: rw, h: rh, cx: (rx + (rw >> 1)) | 0, cy: (ry + (rh >> 1)) | 0 };
    if (rooms.some(o => rx < o.x + o.w + 1 && rx + rw + 1 > o.x && ry < o.y + o.h + 1 && ry + rh + 1 > o.y)) continue;
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) grid[y][x] = T.FLOOR;
    rooms.push(nr);
  }
  // connect each room to the previous (L-corridors) — guarantees a spanning path
  const carveH = (x1, x2, y) => { for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) if (grid[y][x] === T.WALL) grid[y][x] = T.FLOOR; };
  const carveV = (y1, y2, x) => { for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) if (grid[y][x] === T.WALL) grid[y][x] = T.FLOOR; };
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    if (rint(rng, 2)) { carveH(a.cx, b.cx, a.cy); carveV(a.cy, b.cy, b.cx); }
    else { carveV(a.cy, b.cy, a.cx); carveH(a.cx, b.cx, b.cy); }
  }
  // entry = first room center; stairs = the room center farthest from entry
  const entry = { x: rooms[0].cx, y: rooms[0].cy };
  let far = rooms[0], fd = -1;
  for (const r of rooms) { const d = Math.abs(r.cx - entry.x) + Math.abs(r.cy - entry.y); if (d > fd) { fd = d; far = r; } }
  const stairs = { x: far.cx, y: far.cy };
  if (depth < FLOORS) grid[stairs.y][stairs.x] = T.STAIRS;
  // fungus safe-pocket on the moss floors (deterministic)
  if (depth === 5) { const r = rooms[rooms.length - 1]; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[y][x] = T.FUNGUS; }
  return { grid, rooms, entry, stairs };
}

// shortest path entry->stairs (for placing fuel where the player will actually walk)
function pathTiles(grid, sx, sy, tx, ty) {
  const q = [[sx, sy]], prev = new Map(); prev.set(sy*W+sx, null);
  const walk = t => t===T.FLOOR||t===T.STAIRS||t===T.FUNGUS;
  while (q.length) {
    const [x, y] = q.shift();
    if (x===tx && y===ty) { const p=[]; let c=y*W+x; while(c!==null){p.push([c%W,(c/W)|0]);c=prev.get(c);} return p.reverse(); }
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx,ny=y+dy,k=ny*W+nx;
      if(nx>=0&&ny>=0&&nx<W&&ny<H&&walk(grid[ny][nx])&&!prev.has(k)){prev.set(k,y*W+x);q.push([nx,ny]);}
    }
  }
  return [];
}

// connectivity check (flood fill from entry reaches every floor tile)
function isConnected(floor) {
  const { grid, entry } = floor;
  const seen = Array.from({ length: H }, () => new Array(W).fill(false));
  const stack = [[entry.x, entry.y]]; seen[entry.y][entry.x] = true; let count = 0;
  const walk = t => t === T.FLOOR || t === T.STAIRS || t === T.FUNGUS;
  while (stack.length) {
    const [x, y] = stack.pop(); count++;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx>=0&&ny>=0&&nx<W&&ny<H&&!seen[ny][nx]&&walk(grid[ny][nx])) { seen[ny][nx] = true; stack.push([nx, ny]); }
    }
  }
  let total = 0;
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) if (walk(grid[y][x])) total++;
  return count === total;
}

// ---- FOV: recursive shadowcasting (symmetric) ----
const MULT = [
  [1,0,0,-1,-1,0,0,1],[0,1,-1,0,0,-1,1,0],[0,1,1,0,0,-1,-1,0],[1,0,0,1,-1,0,0,-1],
];
function computeFOV(grid, ox, oy, radius) {
  const vis = new Set();
  vis.add(oy * W + ox);
  if (radius <= 0) return vis;
  const blocked = (x, y) => x<0||y<0||x>=W||y>=H||grid[y][x]===T.WALL;
  function cast(cx, cy, row, startSlope, endSlope, r, xx, xy, yx, yy) {
    if (startSlope < endSlope) return;
    let nextStart = startSlope;
    for (let i = row; i <= r; i++) {
      let dx = -i - 1, dy = -i, blockedPrev = false;
      while (dx <= 0) {
        dx++;
        const mx = cx + dx * xx + dy * xy, my = cy + dx * yx + dy * yy;
        const lSlope = (dx - 0.5) / (dy + 0.5), rSlope = (dx + 0.5) / (dy - 0.5);
        if (rSlope > startSlope) continue;
        if (lSlope < endSlope) break;
        if (dx*dx + dy*dy <= r*r && mx>=0&&my>=0&&mx<W&&my<H) vis.add(my * W + mx);
        if (blockedPrev) {
          if (blocked(mx, my)) { nextStart = rSlope; continue; }
          else { blockedPrev = false; startSlope = nextStart; }
        } else if (blocked(mx, my) && i < r) {
          blockedPrev = true;
          cast(cx, cy, i + 1, startSlope, lSlope, r, xx, xy, yx, yy);
          nextStart = rSlope;
        }
      }
      if (blockedPrev) break;
    }
  }
  for (let oct = 0; oct < 8; oct++) cast(ox, oy, 1, 1.0, 0.0, radius, MULT[0][oct], MULT[1][oct], MULT[2][oct], MULT[3][oct]);
  return vis;
}

// ---- spawn population per floor ----
function populate(state, floor, depth) {
  const rng = state.rng;
  const openTiles = [];
  for (const r of floor.rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++)
    if (!(x === floor.entry.x && y === floor.entry.y) && floor.grid[y][x] !== T.STAIRS) openTiles.push({ x, y });
  const takeTile = () => openTiles.length ? openTiles.splice(rint(rng, openTiles.length), 1)[0] : null;

  const monsters = [];
  const pool = Object.entries(MONSTERS).filter(([k, m]) => m.floors && m.floors.includes(depth));
  const nMon = depth === FLOORS ? 0 : rrange(rng, 1, 1 + Math.floor((depth+1)/3));
  for (let i = 0; i < nMon && pool.length; i++) {
    const [key, def] = choice(rng, pool);
    let t = null;
    for (let tryN = 0; tryN < 6; tryN++) { const c = takeTile(); if (!c) break;
      if (!monsters.some(m => Math.abs(m.x-c.x)<=1 && Math.abs(m.y-c.y)<=1)) { t = c; break; } }
    if (!t) break;
    monsters.push({ key, x: t.x, y: t.y, hp: def.hp });
  }
  // items — fuel: most seeded ALONG the entry->stairs path so travel and refueling coincide
  const items = [];
  const occupied = new Set();
  const place = (key, x, y) => { const k = y*W+x; if (occupied.has(k)) return false; occupied.add(k); items.push({ key, x, y }); return true; };
  const path = pathTiles(floor.grid, floor.entry.x, floor.entry.y, floor.stairs.x, floor.stairs.y);
  const nFuel = Math.max(1, Math.round(state.fuelRate));
  if (path.length > 4) {
    const spacing = Math.max(5, Math.floor(path.length / nFuel));
    for (let d = spacing; d < path.length - 1; d += spacing) {
      const [px, py] = path[d];
      if (floor.grid[py][px] === T.FLOOR) place(rng() < 0.5 ? "fuel_big" : "fuel_small", px, py);
    }
    for (const frac of [0.34, 0.67]) { const [px,py] = path[Math.floor(path.length*frac)]; if (floor.grid[py][px]===T.FLOOR) place("fuel_big", px, py); }
  }
  // a couple of extra flasks scattered in rooms (reward for exploring)
  for (let i = 0; i < 2; i++) { const t = takeTile(); if (t) place(rng() < 0.3 ? "fuel_big" : "fuel_small", t.x, t.y); }
  // seed a heal item mid-path on the deeper, deadlier floors
  if (depth >= 3 && path.length > 6) { const [hx, hy] = path[Math.floor(path.length/2)]; if (floor.grid[hy][hx]===T.FLOOR) place(depth>=5?"fungus":"ration", hx, hy); }
  if (rng() < 0.5) { const t = takeTile(); if (t) items.push({ key: "torch", x: t.x, y: t.y }); }
  const loot = ["dagger","mace","armor","repellent","ration","fungus","coin","goblet","crown_shard","oil_lamp"];
  const nLoot = rrange(rng, 1, 3);
  for (let i = 0; i < nLoot; i++) { const t = takeTile(); if (!t) break; items.push({ key: choice(rng, loot), x: t.x, y: t.y }); }
  if (depth === 2) { const t = takeTile(); if (t) items.push({ key: "dagger", x: t.x, y: t.y }); }    // a fighting chance
  if (depth === 3) { const t = takeTile(); if (t) items.push({ key: "mace", x: t.x, y: t.y }); }
  if (depth >= 4 && rng() < 0.5) { const t = takeTile(); if (t) items.push({ key: "fungus", x: t.x, y: t.y }); }  // healing in the deeps

  // ---- deterministic set pieces ----
  const setpieces = {};
  if (depth === 2) { // gas room: an OPTIONAL side room (never entry, never the stairs room)
    const cand = floor.rooms.filter(r =>
      !(r.cx === floor.entry.x && r.cy === floor.entry.y) &&
      !(r.cx === floor.stairs.x && r.cy === floor.stairs.y));
    if (cand.length) {
      const gr = choice(rng, cand);
      const gx = Math.max(gr.x, gr.cx - 1), gy = gr.y;
      setpieces.gasRoom = { x: gx, y: gy, w: Math.min(3, gr.w), h: gr.h }; // <=3 wide: fits the 3-turn shutter
      items.push({ key: "fuel_big", x: gr.cx, y: gr.cy });
    }
  }
  if (depth === 4) { const t = takeTile(); if (t) setpieces.ghost = { x: t.x, y: t.y, traded: false }; }
  if (depth === 6) { const t = takeTile(); if (t) { setpieces.thiefSkeleton = { x: t.x, y: t.y, looted: false }; } }
  if (depth === FLOORS) setpieces.firstLantern = { x: floor.stairs.x, y: floor.stairs.y };
  return { monsters, items, setpieces };
}

// ---- new game / floor entry ----
function enterFloor(state, depth) {
  let floor, guard = 0;
  do { floor = genFloor(state.rng, depth); guard++; } while (!isConnected(floor) && guard < 30);
  const pop = populate(state, floor, depth);
  state.depth = depth;
  state.grid = floor.grid;
  state.rooms = floor.rooms;
  state.stairs = floor.stairs;
  state.px = floor.entry.x; state.py = floor.entry.y;
  state.monsters = pop.monsters;
  state.items = pop.items;
  state.setpieces = pop.setpieces;
  state.explored = new Set();
  state.log.push({ t: "floor", m: `Floor ${depth}: ${STRATA[depth-1].name}. ${STRATA[depth-1].entry}` });
  recomputeVis(state);
}

function newGame(seed) {
  const state = {
    seed: seed >>> 0,
    rng: mulberry32(seed),
    depth: 0, turn: 0,
    px: 0, py: 0,
    hp: 18, maxhp: 18,
    fuel: 160, maxfuel: 160,
    lightMode: "lantern",   // lantern | torch | shuttered | dark
    torchTurns: 0,
    darkTurns: 0,
    repelTurns: 0,
    inv: [],
    weaponDmg: 1, armorDef: 0,
    fuelRate: 3.0,          // items per floor; simulation-tuned default
    alive: true, won: false, ending: null,
    log: [], vis: new Set(),
  };
  enterFloor(state, 1);
  return state;
}

// ---- light / visibility ----
function currentLight(state) {
  if (state.lightMode === "shuttered" || state.lightMode === "dark") return 0;
  if (state.lightMode === "torch") return LIGHT.torch;
  // standing in a fungus pocket gives ambient light even if lantern is out of fuel
  if (state.grid[state.py][state.px] === T.FUNGUS) return Math.max(2, state.fuel > 0 ? LIGHT.lantern : 2);
  return state.fuel > 0 ? LIGHT.lantern : 0;
}
function recomputeVis(state) {
  const r = currentLight(state);
  state.vis = computeFOV(state.grid, state.px, state.py, r);
  for (const k of state.vis) state.explored.add(k);
}
function inDarkness(state) { return currentLight(state) <= 0; }

// ---- helpers ----
const key = (x, y) => y * W + x;
const walkable = t => t === T.FLOOR || t === T.STAIRS || t === T.FUNGUS;
function monsterAt(state, x, y) { return state.monsters.find(m => m.x === x && m.y === y); }
function itemsAt(state, x, y) { return state.items.filter(it => it.x === x && it.y === y); }
function invCount(state, key) { return state.inv.filter(i => i === key).length; }

// ---- combat ----
function attack(state, mon) {
  const def = MONSTERS[mon.key];
  const dmg = 3 + state.weaponDmg + rint(state.rng, 2);       // base 2 + weapon + 0/1
  mon.hp -= dmg;
  const blue = (invCount(state, "dagger") && def.darkOnly) ? " The dagger flares blue." : "";
  if (mon.hp <= 0) {
    state.monsters = state.monsters.filter(m => m !== mon);
    state.log.push({ t: "hit", m: `You strike the ${def.name} down.${blue}` });
  } else {
    state.log.push({ t: "hit", m: `You hit the ${def.name}.${blue}` });
  }
}
function monsterTurn(state) {
  for (const mon of [...state.monsters]) {
    const def = MONSTERS[mon.key];
    if (def.slow && state.turn % 2) continue;
    const adj = Math.abs(mon.x - state.px) <= 1 && Math.abs(mon.y - state.py) <= 1 && !(mon.x===state.px&&mon.y===state.py);
    if (adj) {
      let dmg = Math.max(0, def.dmg - state.armorDef);
      state.hp -= dmg;
      if (def.drainsLight && state.fuel > 0) { state.fuel = Math.max(0, state.fuel - 10); }
      state.log.push({ t: "dmg", m: `The ${def.name} hits you${dmg?` for ${dmg}`:" — your mail holds"}.` });
      if (state.hp <= 0) { die(state, `slain by a ${def.name}`); return; }
    } else if ((state.vis.has(key(mon.x, mon.y)) || def.darkOnly) &&
               (Math.abs(mon.x-state.px)+Math.abs(mon.y-state.py)) <= 4) {
      // step toward player only within aggro range (grues hunt in dark)
      const dx = Math.sign(state.px - mon.x), dy = Math.sign(state.py - mon.y);
      const opts = def.erratic ? [[dx,dy],[dx,0],[0,dy],[rint(state.rng,3)-1,rint(state.rng,3)-1]] : [[dx,dy],[dx,0],[0,dy]];
      for (const [mx, my] of opts) {
        const nx = mon.x + mx, ny = mon.y + my;
        if (nx>=0&&ny>=0&&nx<W&&ny<H&&walkable(state.grid[ny][nx])&&!monsterAt(state,nx,ny)&&!(nx===state.px&&ny===state.py)) { mon.x = nx; mon.y = ny; break; }
      }
    }
  }
}

// ---- grue logic (AUDIT F1) ----
function grueTick(state) {
  if (state.repelTurns > 0) { state.repelTurns--; if (inDarkness(state)) { state.darkTurns = 0; } return; }
  if (inDarkness(state)) {
    state.darkTurns++;
    if (state.darkTurns >= GRUE_DEATH_TURN) {
      // spawn the killing grue in the log-canon way
      die(state, "eaten by a grue");
      return;
    }
    const warns = ["It is pitch black. You are likely to be eaten by a grue.",
                   "You hear a low gurgling, very close.",
                   "Something brushes your sleeve. The grue is upon you."];
    state.log.push({ t: "grue", m: warns[Math.min(state.darkTurns - 1, 2)] });
  } else {
    state.darkTurns = 0;   // ANY lit turn fully resets (load-bearing for gas room)
  }
}

function die(state, cause) {
  state.alive = false; state.cause = cause;
  state.log.push({ t: "death", m: `*** ${cause}. You reached floor ${state.depth}. ***` });
}

// ---- fuel per turn ----
function burnFuel(state) {
  if (state.lightMode === "torch") {
    state.torchTurns--;
    if (state.torchTurns <= 0) { state.lightMode = "lantern"; state.log.push({ t: "sys", m: "The torch gutters out. Back to the lantern." }); }
  } else if (state.lightMode === "lantern") {
    if (state.fuel > 0) {
      state.fuel--;
      if (state.fuel === 25) state.log.push({ t: "warn", m: "Your lantern is getting low." });
      if (state.fuel === 8) state.log.push({ t: "warn", m: "The flame flickers. Find fuel." });
      if (state.fuel === 0) state.log.push({ t: "warn", m: "Your lantern dies. The dark leans in." });
    }
  }
  // shuttered/dark: no burn
}

// ---- pick up / use ----
function pickup(state) {
  const here = itemsAt(state, state.px, state.py);
  if (!here.length) { state.log.push({ t: "sys", m: "Nothing here to take." }); return false; }
  const it = here[0];
  if (state.inv.length >= INV_CAP) { state.log.push({ t: "sys", m: "Your pack is full (8)." }); return false; }
  state.items = state.items.filter(x => x !== it);
  state.inv.push(it.key);
  applyPassive(state, it.key);
  state.log.push({ t: "get", m: `Taken: ${ITEMS[it.key].name}.` });
  return true;
}
function applyPassive(state, k) {
  const it = ITEMS[k];
  if (it.kind === "weapon" && it.dmg > state.weaponDmg) state.weaponDmg = it.dmg;
  if (it.kind === "armor") state.armorDef = Math.max(state.armorDef, it.def);
}
function useItem(state, k) {
  if (!invCount(state, k)) return false;
  const it = ITEMS[k];
  const consume = () => { const i = state.inv.indexOf(k); state.inv.splice(i, 1); };
  if (it.kind === "fuel") { state.fuel = Math.min(state.maxfuel, state.fuel + it.amt); consume(); state.log.push({t:"use",m:`You refuel (+${it.amt}).`}); }
  else if (it.kind === "fuelmax") { state.maxfuel += it.amt; state.fuel += it.amt; consume(); state.log.push({t:"use",m:`Lantern capacity up (+${it.amt}).`}); }
  else if (it.kind === "torch") { state.lightMode = "torch"; state.torchTurns = it.amt; consume(); state.log.push({t:"use",m:"You light a torch. Bright, but brief."}); }
  else if (it.kind === "heal") { state.hp = Math.min(state.maxhp, state.hp + it.amt); consume(); state.log.push({t:"use",m:`You recover ${it.amt} HP.`}); }
  else if (it.kind === "repel") { state.repelTurns = it.amt; consume(); state.log.push({t:"use",m:"You reek of grue-be-gone. The dark recoils, for now."}); }
  else { state.log.push({ t: "sys", m: `You can't use the ${it.name} directly.` }); return false; }
  return true;
}

// ---- set-piece interactions ----
function checkSetpieces(state) {
  const sp = state.setpieces;
  if (sp.ghost && !sp.ghost.traded && state.px === sp.ghost.x && state.py === sp.ghost.y) {
    const treasureIdx = state.inv.findIndex(k => ITEMS[k].kind === "treasure");
    if (treasureIdx >= 0) {
      state.inv.splice(treasureIdx, 1);
      state.fuel = Math.min(state.maxfuel, state.fuel + 70);
      sp.ghost.traded = true;
      state.log.push({ t: "npc", m: "A pale ghost — the hermit's brother — takes your trinket and breathes 70 fuel into your lantern. \"Go on, then. Mind the dark.\"" });
    } else {
      state.log.push({ t: "npc", m: "A pale ghost eyes your empty hands. \"Bring me treasure and I'll trade you light.\"" });
    }
  }
  if (sp.thiefSkeleton && !sp.thiefSkeleton.looted && state.px === sp.thiefSkeleton.x && state.py === sp.thiefSkeleton.y) {
    sp.thiefSkeleton.looted = true;
    if (state.inv.length < INV_CAP) { state.inv.push("lockpick"); state.log.push({ t: "get", m: "The thief's skeleton yields a lockpick, still warm. It opens the vault shortcut below." }); }
    else state.log.push({ t: "sys", m: "A lockpick glints in a dead hand, but your pack is full." });
  }
}
function inGasRoom(state) {
  const g = state.setpieces.gasRoom;
  return g && state.px >= g.x && state.px < g.x + g.w && state.py >= g.y && state.py < g.y + g.h;
}

// ---- descend ----
function descend(state) {
  if (state.grid[state.py][state.px] !== T.STAIRS) { state.log.push({ t: "sys", m: "No stairs down here." }); return false; }
  if (state.depth >= FLOORS) return false;
  // floor-6 lockpick shortcut: skip straight past a chunk of floor 7's danger
  enterFloor(state, state.depth + 1);
  return true;
}

// ---- the First Lantern (floor 8) ----
function raiseLantern(state) {
  if (state.depth !== FLOORS) return false;
  const fl = state.setpieces.firstLantern;
  if (!(state.px === fl.x && state.py === fl.y)) { state.log.push({ t: "sys", m: "The First Lantern waits at the chamber's heart." }); return false; }
  state.won = true; state.alive = false; state.ending = "raise";
  state.log.push({ t: "win", m: "You raise the First Lantern. Light climbs the shaft floor by floor, and far above, an Empire remembers what morning was. YOU WIN." });
  return true;
}
function snuffLantern(state) {
  if (state.depth !== FLOORS) return false;
  const fl = state.setpieces.firstLantern;
  if (!(state.px === fl.x && state.py === fl.y)) return false;
  state.won = false; state.alive = false; state.ending = "snuff";
  state.log.push({ t: "death", m: "You close your hand over the First Lantern and snuff it. The dark exhales, grateful. It was so tired of being kept out. The last thing you see is nothing at all." });
  return true;
}

// ---- the main step ----
const DIRS = { h:[-1,0], j:[0,1], k:[0,-1], l:[1,0], y:[-1,-1], u:[1,-1], b:[-1,1], n:[1,1] };
function step(state, action) {
  if (!state.alive) return state;
  let acted = false;
  if (DIRS[action]) {
    const [dx, dy] = DIRS[action];
    const nx = state.px + dx, ny = state.py + dy;
    if (nx>=0&&ny>=0&&nx<W&&ny<H) {
      const mon = monsterAt(state, nx, ny);
      if (mon) { attack(state, mon); acted = true; }         // bump to attack
      else if (walkable(state.grid[ny][nx])) { state.px = nx; state.py = ny; acted = true; }
      else { state.log.push({ t: "sys", m: "A wall." }); }
    }
  } else if (action === "get") { acted = pickup(state); }
  else if (action === "descend") { acted = descend(state); }
  else if (action === "wait") { acted = true; }
  else if (action === "shutter") {
    // free action: toggling the shutter does not advance the world turn.
    // (so "shutter, take 3 actions, unshutter" = exactly 3 dark turns — gas-room contract)
    if (state.lightMode === "shuttered") { state.lightMode = "lantern"; state.log.push({t:"sys",m:"You open the lantern's shutter. Light returns."}); recomputeVis(state); }
    else if (state.lightMode === "lantern") { state.lightMode = "shuttered"; state.log.push({t:"sys",m:"You shutter the lantern. Darkness — and the grue-clock starts."}); recomputeVis(state); }
    return state;
  }
  else if (action === "raise") { return raiseLantern(state), state; }
  else if (action === "snuff") { return snuffLantern(state), state; }
  else if (action && action.startsWith("use:")) { acted = useItem(state, action.slice(4)); }
  else if (action && action.startsWith("drop:")) {
    const k = action.slice(5), i = state.inv.indexOf(k);
    if (i>=0) { state.inv.splice(i,1); state.items.push({key:k,x:state.px,y:state.py}); state.log.push({t:"sys",m:`Dropped ${ITEMS[k].name}.`}); acted = true; }
  }
  if (!acted) return state;

  // world advances one turn
  state.turn++;
  // gas room + open flame = ignition (torch, or lantern that is lit)
  if (inGasRoom(state) && (state.lightMode === "torch" || (state.lightMode === "lantern" && state.fuel > 0))) {
    state.log.push({ t: "death", m: "You carry an open flame into the gas. The room becomes a brief, brilliant sun." });
    die(state, "immolated in the gas room");
    return state;
  }
  checkSetpieces(state);
  burnFuel(state);
  recomputeVis(state);
  monsterTurn(state);
  if (!state.alive) return state;
  grueTick(state);
  // rest-in-the-light regen: the dark takes, the light gives back, slowly
  if (state.alive && !inDarkness(state) && state.hp < state.maxhp) {
    const adjacent = state.monsters.some(m => Math.abs(m.x-state.px)<=1 && Math.abs(m.y-state.py)<=1);
    if (!adjacent && state.turn % 4 === 0) state.hp = Math.min(state.maxhp, state.hp + 1);
  }
  recomputeVis(state);
  return state;
}

// ---- serialization (save/load/hash) ----
function serialize(state) {
  return JSON.stringify({
    seed: state.seed, depth: state.depth, turn: state.turn,
    px: state.px, py: state.py, hp: state.hp, maxhp: state.maxhp,
    fuel: state.fuel, maxfuel: state.maxfuel, lightMode: state.lightMode,
    torchTurns: state.torchTurns, darkTurns: state.darkTurns, repelTurns: state.repelTurns,
    inv: state.inv, weaponDmg: state.weaponDmg, armorDef: state.armorDef, fuelRate: state.fuelRate,
    alive: state.alive, won: state.won, ending: state.ending, cause: state.cause,
    grid: state.grid, rooms: state.rooms, stairs: state.stairs,
    monsters: state.monsters, items: state.items, setpieces: state.setpieces,
    explored: [...state.explored], rngState: state._rngState || null,
  });
}
// Because mulberry32 closes over its counter, we snapshot by re-seeding + replaying is impractical;
// instead we expose the raw counter. Reimplement rng with an inspectable state:
function makeRng(seed) {
  const o = { a: seed >>> 0 };
  o.next = function () {
    o.a |= 0; o.a = (o.a + 0x6D2B79F5) | 0;
    let t = Math.imul(o.a ^ (o.a >>> 15), 1 | o.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return o;
}

// hash for state-identity tests
function hashState(state) {
  const s = serialize(state);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

root.DESCENT = {
  W, H, T, FLOORS, LIGHT, GRUE_DEATH_TURN, INV_CAP, STRATA, MONSTERS, ITEMS,
  mulberry32, newGame, step, enterFloor, genFloor, isConnected, computeFOV,
  currentLight, inDarkness, recomputeVis, serialize, hashState,
  _internals: { populate, monsterTurn, grueTick, key },
};
})(typeof globalThis !== "undefined" ? globalThis : this);
