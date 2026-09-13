import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 915, height: 412 } });
await p.goto('http://localhost:5179/',{waitUntil:'networkidle'});
await p.waitForTimeout(1200);
await p.click('#startGameBtn'); await p.waitForTimeout(1800);
const r = await p.evaluate(()=>{
  const out={};
  document.querySelectorAll('[class*="dice"], [class*="cube"], [class*="face"]').forEach(el=>{
    const b=el.getBoundingClientRect();
    const k=el.className.toString().slice(0,30);
    if(!out[k]) out[k]={cssW:getComputedStyle(el).width, screenW:Math.round(b.width)};});
  const t=document.querySelector('.board-tile').getBoundingClientRect();
  return {dice:out, tileScreenW:Math.round(t.width)};});
await b.close();
console.log(JSON.stringify(r,null,2));
