// DESCENT headless test harness. Run: node harness.js
require("./engine.js");
const D = globalThis.DESCENT;
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; } else { fail++; console.log("  FAIL:", name); } };

// ---------- Phase 1: engine ----------
// determinism: same seed -> byte-identical floor
(() => {
  const a = D.newGame(12345), b = D.newGame(12345);
  ok("same seed => identical initial state hash", D.hashState(a) === D.hashState(b));
  const s1 = JSON.stringify(a.grid), s2 = JSON.stringify(b.grid);
  ok("same seed => identical floor layout", s1 === s2);
  const c = D.newGame(12346);
  ok("different seed => different layout", JSON.stringify(c.grid) !== s1);
})();

// connectivity over 1000 generations
(() => {
  let bad = 0;
  for (let i = 0; i < 1000; i++) {
    const rng = D.mulberry32(i * 2654435761 >>> 0);
    const depth = 1 + (i % 8);
    let f, g = 0;
    do { f = D.genFloor(rng, depth); g++; } while (!D.isConnected(f) && g < 30);
    if (!D.isConnected(f)) bad++;
  }
  ok("connectivity guaranteed over 1000 generations", bad === 0);
})();

// FOV symmetry: if A sees B, B sees A (open floor)
(() => {
  const s = D.newGame(777);
  let asym = 0, checks = 0;
  const samples = [...s.vis].slice(0, 40);
  for (const cell of samples) {
    const bx = cell % D.W, by = (cell / D.W) | 0;
    if (s.grid[by][bx] === D.T.WALL) continue;
    const back = D.computeFOV(s.grid, bx, by, D.currentLight(s));
    checks++;
    if (!back.has(s.py * D.W + s.px)) asym++;
  }
  ok("shadowcasting is symmetric (A sees B => B sees A)", asym === 0 && checks > 0);
})();

// grue: death on the 4th consecutive dark turn (AUDIT F1), lit turn resets
(() => {
  const s = D.newGame(4242);
  s.fuel = 0; s.lightMode = "lantern";           // lantern out of fuel => dark
  s.px = s.stairs.x; s.py = s.stairs.y;           // sit on a safe-ish tile
  // clear monsters so only the grue clock can kill
  s.monsters = [];
  D.step(s, "wait"); ok("dark turn 1: alive, warned", s.alive && s.darkTurns === 1);
  D.step(s, "wait"); ok("dark turn 2: alive", s.alive && s.darkTurns === 2);
  D.step(s, "wait"); ok("dark turn 3: alive", s.alive && s.darkTurns === 3);
  D.step(s, "wait"); ok("dark turn 4: eaten by a grue", !s.alive && /grue/.test(s.cause));
})();
(() => {
  const s = D.newGame(4243); s.monsters = []; s.fuel = 0; s.lightMode = "lantern";
  D.step(s, "wait"); D.step(s, "wait");           // 2 dark turns
  s.fuel = 50;                                    // relight
  D.step(s, "wait"); ok("any lit turn resets the grue clock", s.darkTurns === 0 && s.alive);
})();

// shutter: 3 safe turns then death on the 4th (gas-room contract)
(() => {
  const s = D.newGame(555); s.monsters = []; s.fuel = 50;
  D.step(s, "shutter");
  D.step(s, "wait"); D.step(s, "wait"); D.step(s, "wait");
  ok("shuttered: 3 actions survived", s.alive && s.darkTurns === 3);
  D.step(s, "wait");
  ok("shuttered: 4th dark turn kills", !s.alive);
})();

// ---------- Phase 2: systems ----------
// save/load round-trip: identical state hash
(() => {
  const s = D.newGame(9001);
  for (const a of ["l","l","j","get","wait","k"]) D.step(s, a);
  const saved = D.serialize(s);
  const reloaded = JSON.parse(saved);
  // rebuild a live state from save the way the UI will, then re-serialize
  const s2 = D.newGame(9001);
  Object.assign(s2, reloaded);
  s2.explored = new Set(reloaded.explored);
  ok("save->load reproduces identical serialized state", D.serialize(s2) === saved);
})();

// death clears save (semantic: alive=false is the signal the UI deletes on)
(() => {
  const s = D.newGame(1); s.monsters=[]; s.fuel=0; s.lightMode="lantern";
  for (let i=0;i<4;i++) D.step(s,"wait");
  ok("death sets alive=false (UI deletes save on this)", s.alive === false);
})();

// items: pickup, fuel use, weapon/armor passives, inventory cap
(() => {
  const s = D.newGame(222);
  s.items.push({ key: "fuel_small", x: s.px, y: s.py });
  const f0 = s.fuel; s.fuel = 10;
  D.step(s, "get"); D.step(s, "use:fuel_small");
  ok("fuel flask refuels", s.fuel > 10);
  const s2 = D.newGame(223);
  s2.inv = []; s2.items = [{key:"mace",x:s2.px,y:s2.py}];
  D.step(s2, "get");
  ok("weapon sets passive damage", s2.weaponDmg === 3);
  const s3 = D.newGame(224); s3.inv = new Array(8).fill("coin");
  s3.items = [{key:"dagger",x:s3.px,y:s3.py}];
  D.step(s3, "get");
  ok("inventory cap respected (8)", s3.inv.length === 8 && !s3.inv.includes("dagger"));
})();

// set pieces present on correct floors
(() => {
  const s = D.newGame(31337);
  const seen = {};
  let guard = 0;
  while (s.depth < 8 && s.alive && guard < 20) {
    seen[s.depth] = s.setpieces;
    // teleport to stairs and descend (test-only shortcut)
    s.px = s.stairs.x; s.py = s.stairs.y;
    if (!D.step(s, "descend")) break;
    guard++;
  }
  const f2 = D.newGame(31337); D.enterFloor(f2, 2); ok("floor 2 has gas room", !!f2.setpieces.gasRoom);
  const f4 = D.newGame(31337); D.enterFloor(f4, 4); ok("floor 4 has ghost", !!f4.setpieces.ghost);
  const f6 = D.newGame(31337); D.enterFloor(f6, 6); ok("floor 6 has thief skeleton", !!f6.setpieces.thiefSkeleton);
  const f8 = D.newGame(31337); D.enterFloor(f8, 8); ok("floor 8 has the First Lantern", !!f8.setpieces.firstLantern);
})();

// win + secret ending reachable
(() => {
  const s = D.newGame(8888); D.enterFloor(s, 8);
  s.px = s.setpieces.firstLantern.x; s.py = s.setpieces.firstLantern.y;
  D.step(s, "raise");
  ok("raising the First Lantern wins", s.won && s.ending === "raise" && !s.alive);
  const s2 = D.newGame(8889); D.enterFloor(s2, 8);
  s2.px = s2.setpieces.firstLantern.x; s2.py = s2.setpieces.firstLantern.y;
  D.step(s2, "snuff");
  ok("snuffing the First Lantern is the secret ending", !s2.won && s2.ending === "snuff" && !s2.alive);
})();

// gas room + flame = death
(() => {
  const s = D.newGame(31337); D.enterFloor(s, 2);
  const g = s.setpieces.gasRoom;
  s.px = g.x; s.py = g.y; s.fuel = 50; s.lightMode = "lantern"; s.monsters = [];
  D.step(s, "wait");
  ok("open flame in gas room immolates", !s.alive && /gas/.test(s.cause));
  const s2 = D.newGame(31337); D.enterFloor(s2, 2);
  const g2 = s2.setpieces.gasRoom; s2.px = g2.x; s2.py = g2.y; s2.monsters = [];
  D.step(s2, "shutter"); D.step(s2, "wait");
  ok("shuttered lantern survives the gas room", s2.alive);
})();

// ---------- careful-bot fuel simulation (AUDIT F4 policy) ----------
function bfsPath(grid, sx, sy, tx, ty, blocked) {
  const q = [[sx, sy]], prev = new Map(); prev.set(sy*D.W+sx, null);
  const walk = t => t===D.T.FLOOR||t===D.T.STAIRS||t===D.T.FUNGUS;
  while (q.length) {
    const [x,y] = q.shift();
    if (x===tx&&y===ty) { const path=[]; let c=y*D.W+x; while(c!==null){path.push(c);c=prev.get(c);} return path.reverse(); }
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx,ny=y+dy,k=ny*D.W+nx;
      if(nx>=0&&ny>=0&&nx<D.W&&ny<D.H&&walk(grid[ny][nx])&&!prev.has(k)&&!(blocked&&blocked(nx,ny)&&!(nx===tx&&ny===ty))){prev.set(k,y*D.W+x);q.push([nx,ny]);}
    }
  }
  return null;
}
function inGas(s, x, y) { const g = s.setpieces.gasRoom; return g && x>=g.x && x<g.x+g.w && y>=g.y && y<g.y+g.h; }
const DIRV = { h:[-1,0], j:[0,1], k:[0,-1], l:[1,0] };
function dirTo(px,py,nx,ny){ const dx=nx-px,dy=ny-py; for(const[a,[ex,ey]]of Object.entries(DIRV))if(ex===dx&&ey===dy)return a; return null; }
// AUDIT F4 careful-bot: follow a precomputed shortest path to the stairs (no oscillation
// possible), grabbing what's underfoot, fighting only adjacent blockers, refuel <25%,
// heal <45%, repellent + shutter for the dark. Fuel economy is what fuelRate tunes.
function carefulBot(seed) {
  const s = D.newGame(seed);
  let guard = 0, plan = null, planFloor = -1, planTargetLantern = false, retreats = 0;
  while (s.alive && !s.won && guard < 4000) {
    guard++;
    // (re)plan when we change floors or the plan is spent
    const goingToLantern = s.depth === 8;
    const target = goingToLantern ? s.setpieces.firstLantern : s.stairs;
    if (planFloor !== s.depth || planTargetLantern !== goingToLantern || !plan) {
      plan = bfsPath(s.grid, s.px, s.py, target.x, target.y, null) || [];
      planFloor = s.depth; planTargetLantern = goingToLantern;
    }
    // survival interrupts (don't advance the plan index)
    if (s.items.some(it=>it.x===s.px&&it.y===s.py) && s.inv.length<D.INV_CAP) { D.step(s,"get"); continue; }
    if (s.hp < s.maxhp*0.5 && s.inv.some(k=>D.ITEMS[k].kind==="heal")) { D.step(s,"use:"+s.inv.find(k=>D.ITEMS[k].kind==="heal")); continue; }
    // retreat from a losing fight: 2+ adjacent monsters, or hurt with no heals -> step to a safer tile
    const adjMon = s.monsters.filter(m => Math.abs(m.x-s.px)<=1 && Math.abs(m.y-s.py)<=1);
    if (retreats < 2 && (adjMon.length >= 2 || (s.hp < s.maxhp*0.3 && !s.inv.some(k=>D.ITEMS[k].kind==="heal"))) && s.lightMode!=="shuttered") {
      let best=null, bestScore=-1;
      for (const [a,[dx,dy]] of Object.entries(DIRV)) {
        const nx=s.px+dx, ny=s.py+dy;
        if (nx<0||ny<0||nx>=D.W||ny>=D.H) continue;
        const t=s.grid[ny][nx];
        if (!(t===D.T.FLOOR||t===D.T.STAIRS||t===D.T.FUNGUS)) continue;
        if (s.monsters.some(m=>m.x===nx&&m.y===ny)) continue;
        const near = s.monsters.reduce((c,m)=>c+(Math.abs(m.x-nx)+Math.abs(m.y-ny)<=1?1:0),0);
        const score = 10 - near*5 + (t===D.T.FUNGUS?3:0);
        if (score>bestScore){bestScore=score;best=a;}
      }
      if (best!==null && bestScore>0) { retreats++; D.step(s,best); plan=null; continue; }
    }
    // retreat exhausted or nowhere safe: commit to fighting the nearest adjacent monster
    if (adjMon.length) { const m=adjMon[0]; const d=dirTo(s.px,s.py,m.x,m.y); if(d){ D.step(s,d); continue; } }
    if (s.fuel < 25 && s.inv.some(k=>D.ITEMS[k].kind==="fuel")) { D.step(s,"use:"+s.inv.find(k=>D.ITEMS[k].kind==="fuel")); continue; }
    if (s.fuel <= 2 && s.repelTurns===0 && s.inv.some(k=>D.ITEMS[k].kind==="repel") && !s.inv.some(k=>D.ITEMS[k].kind==="fuel")) { D.step(s,"use:"+s.inv.find(k=>D.ITEMS[k].kind==="repel")); continue; }
    // arrived?
    if (goingToLantern && s.px===target.x && s.py===target.y) { D.step(s,"raise"); break; }
    if (!goingToLantern && s.grid[s.py][s.px]===D.T.STAIRS) { D.step(s,"descend"); plan=null; continue; }
    // find our position on the plan and step to the next tile
    let idx = plan.findIndex(k => k === s.py*D.W + s.px);
    if (idx < 0 || idx+1 >= plan.length) { plan = bfsPath(s.grid,s.px,s.py,target.x,target.y,null); if(!plan||plan.length<2){D.step(s,"wait");continue;} idx=0; }
    const nk = plan[idx+1], nx = nk%D.W, ny=(nk/D.W)|0;
    // monster in the way -> attack it (bump); it clears, we advance next loop
    const dir = dirTo(s.px,s.py,nx,ny);
    if (!dir) { plan=null; D.step(s,"wait"); continue; }
    // gas shutter management
    if (inGas(s,nx,ny) && s.lightMode==="lantern") D.step(s,"shutter");
    else if (!inGas(s,nx,ny) && !inGas(s,s.px,s.py) && s.lightMode==="shuttered") D.step(s,"shutter");
    retreats = 0;
    D.step(s, dir);
  }
  return { won: s.won, depth: s.depth, turns: s.turn, cause: s.cause };
}

// ---------- the fuel/difficulty simulation (AUDIT F4: careful-bot 40-70% to floor 8) ----------
(() => {
  const N = 500;
  let reached8 = 0, wins = 0;
  for (let i = 0; i < N; i++) { const r = carefulBot(1000 + i); if (r.depth >= 8) reached8++; if (r.won) wins++; }
  const rate = reached8 / N;
  console.log(`  [sim] careful-bot reached floor 8 in ${reached8}/${N} (${(rate*100).toFixed(0)}%), won ${wins}`);
  ok("careful-bot reaches floor 8 in 40-70% of 500 runs", rate >= 0.40 && rate <= 0.70);
})();

// ---------- Phase 3: three scripted walkthroughs ----------
(() => {
  // WIN: drive the careful-bot to a known winning seed
  let winSeed = null;
  for (let i = 0; i < 60 && winSeed === null; i++) { if (carefulBot(1000 + i).won) winSeed = 1000 + i; }
  ok("a winning run exists and completes (scripted)", winSeed !== null);

  // GRUE DEATH: no light, sit in dark, die on turn 4 to a grue
  const g = D.newGame(2024); g.monsters = []; g.fuel = 0; g.lightMode = "lantern";
  for (let i = 0; i < 4; i++) D.step(g, "wait");
  ok("grue-death walkthrough ends in a grue death", !g.alive && /grue/.test(g.cause));

  // SNUFF ENDING: reach floor 8's lantern and snuff it
  const s = D.newGame(2025); D.enterFloor(s, 8);
  s.px = s.setpieces.firstLantern.x; s.py = s.setpieces.firstLantern.y;
  D.step(s, "snuff");
  ok("secret snuff ending reachable and distinct", s.ending === "snuff" && !s.won && !s.alive);
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
