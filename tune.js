require("./engine.js");
const D = globalThis.DESCENT;
const fs = require("fs");
// pull bot + helpers out of harness.js (region between the marker comments)
const H = fs.readFileSync("harness.js", "utf8");
const a = H.indexOf("function bfsPath");
const b = H.indexOf("// ---------- careful-bot fuel simulation");
const c = H.indexOf("console.log(`\\n${pass}");
eval(H.slice(a, b) + H.slice(b, c).replace(/\(\(\) => \{[\s\S]*$/, ""));  // helpers + carefulBot defs
const rate = parseFloat(process.argv[2] || "3.0");
const _ng = D.newGame; D.newGame = s => { const g = _ng(s); g.fuelRate = rate; return g; };
let r8=0, wins=0, N=500;
for (let i=0;i<N;i++){ const r=carefulBot(1000+i); if(r.depth>=8)r8++; if(r.won)wins++; }
console.log(`fuelRate=${rate}  floor8: ${r8}/${N} (${(r8/N*100).toFixed(0)}%)  wins:${wins} (${(wins/N*100).toFixed(0)}%)`);
