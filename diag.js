require("./engine.js"); const D = globalThis.DESCENT;
const fs=require("fs"); const H=fs.readFileSync("harness.js","utf8");
eval(H.slice(H.indexOf("function bfsPath"), H.indexOf("// ---------- the fuel/difficulty simulation")));
const rate=parseFloat(process.argv[2]||"3.5"); const fuel0=parseInt(process.argv[3]||"120");
const _ng=D.newGame; D.newGame=s=>{const g=_ng(s);g.fuelRate=rate;g.fuel=fuel0;g.maxfuel=Math.max(g.maxfuel,fuel0);return g;};
const causes={},dep={}; let N=300;
for(let i=0;i<N;i++){const r=carefulBot(2000+i);const c=r.won?'WON':(r.cause||'timeout');causes[c]=(causes[c]||0)+1;dep[r.depth]=(dep[r.depth]||0)+1;}
const w=causes.WON||0, r8=dep[8]||0;
console.log(`rate=${rate} fuel0=${fuel0} -> floor8 ${r8}/${N} (${(r8/N*100).toFixed(0)}%), WON ${w} (${(w/N*100).toFixed(0)}%)`);
console.log("  causes:",causes);
