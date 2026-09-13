import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 915, height: 412 } });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:5179/',{waitUntil:'networkidle'});
await p.waitForTimeout(1200);
await p.click('#addPlayerBtn'); await p.waitForTimeout(200);
await p.click('#startGameBtn'); await p.waitForTimeout(1500);
const st=()=>p.evaluate(()=>({
  selOpen:document.getElementById('playerSelectorModal')?.style.display==='flex',
  effOpen:['flex','block'].includes(getComputedStyle(document.getElementById('effectModal')).display),
  roll:document.getElementById('rollDiceBtn')?.disabled,
  turn:document.getElementById('currentPlayerName')?.textContent}));
let tested=false, result=null;
for(let i=0;i<50 && !tested;i++){
  const s=await st();
  if(s.selOpen){
    const before=s.turn;
    // FERMER a la croix, sans choisir : le tour doit reprendre
    await p.click('.close-player-selector'); await p.waitForTimeout(3500);
    const after=await st();
    result={before, afterTurn:after.turn, selOpen:after.selOpen, rollDisabled:after.roll};
    tested=true; break;
  }
  if(s.effOpen){await p.click('#effectOkBtn',{force:true}).catch(()=>{});await p.waitForTimeout(800);continue;}
  await p.click('#rollDiceBtn',{force:true}).catch(()=>{});await p.waitForTimeout(2400);
}
await b.close();
console.log(JSON.stringify({tested,result,errs},null,2));
