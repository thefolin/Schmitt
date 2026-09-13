import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 412, height: 915 } });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));

// Pré-remplir un layout sauvegardé, puis le supprimer après coup
await p.addInitScript(()=>{
  localStorage.setItem('schmitt-board-layouts', JSON.stringify([
    {name:'Mon plateau', timestamp:Date.now(),
     config:{placements:[{tileId:0,x:0,y:0},{tileId:1,x:1,y:0}]}}
  ]));
});
await p.goto('http://localhost:5179/',{waitUntil:'networkidle'});
await p.waitForTimeout(1200);

await p.evaluate(()=>document.getElementById('toolsPanel')?.setAttribute('open',''));
await p.waitForTimeout(300);

const opts = await p.evaluate(()=>[...document.querySelectorAll('#mapSelect option')]
  .map(o=>({v:o.value,t:o.textContent})));

// Sélectionner le plateau sauvegardé
await p.selectOption('#mapSelect','saved-0'); await p.waitForTimeout(400);
const afterSaved = await p.evaluate(()=>document.getElementById('currentBoardLabel')?.textContent);

// Simuler la disparition de l'entrée : vider savedLayouts puis re-sélectionner
const res = await p.evaluate(()=>{
  const sel=document.getElementById('mapSelect');
  // forcer une valeur qui n'existe plus dans savedLayouts
  const o=document.createElement('option'); o.value='saved-99'; o.textContent='Fantôme';
  sel.appendChild(o); sel.value='saved-99';
  sel.dispatchEvent(new Event('change'));
  return document.getElementById('currentBoardLabel')?.textContent;
});
await b.close();
console.log(JSON.stringify({opts, afterSaved, labelApresFantome:res, errs},null,2));
