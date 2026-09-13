import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 915, height: 412 } });
await p.goto('http://localhost:5179/',{waitUntil:'networkidle'});
await p.waitForTimeout(1200);
// 6 joueurs sur la meme case de depart
for(let i=0;i<4;i++){ await p.click('#addPlayerBtn'); await p.waitForTimeout(150); }
await p.click('#startGameBtn'); await p.waitForTimeout(2000);
const r = await p.evaluate(()=>{
  const pawns=[...document.querySelectorAll('.board-pawn')];
  const tile=document.querySelector('.board-tile').getBoundingClientRect();
  return {count:pawns.length, tileW:Math.round(tile.width),
    sizes:pawns.map(el=>el.style.width),
    boxes:pawns.map(el=>{const b=el.getBoundingClientRect();
      return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width)};})};});
await p.screenshot({path:'./out/crowd.png'});
await b.close();
console.log(JSON.stringify(r,null,2));
