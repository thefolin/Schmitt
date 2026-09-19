import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { GOD_FAVORS } from '@/features/game/god-favors';

/**
 * #34 — la table des faveurs et l'aiguillage doivent dire la même chose.
 *
 * Le danger propre à ce correctif : `main-camera.ts` aiguille sur des NUMÉROS
 * DE SOMME écrits en dur (`case 3`, `case 4`…), tandis que `GOD_FAVORS`
 * associe ces sommes à des divinités. Décaler la table sans décaler
 * l'aiguillage câblerait chaque faveur sur le comportement de sa voisine —
 * silencieusement, puisque rien ne relie les deux.
 *
 * Et ce code-là fait tourner le JEU ACTUEL, pas la refonte : une erreur ici se
 * verrait en partie réelle.
 *
 * Le test lit la source parce que c'est le seul moyen de confronter deux
 * représentations qui n'ont aucun lien de type entre elles.
 */

const source = readFileSync('src/camera/main-camera.ts', 'utf8');

/** Le bloc d'aiguillage des faveurs. */
function dispatchBlock(): string {
  const start = source.indexOf('switch (sum) {');
  const end = source.indexOf('default:', start);

  return source.slice(start, end);
}

/** Enlève les accents, pour comparer des noms écrits diversement. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

describe('#34 — l\'aiguillage suit la table des faveurs', () => {
  it('traite chaque somme de 2 à 12', () => {
    const block = dispatchBlock();

    for (let sum = 2; sum <= 12; sum++) {
      expect(block).toContain(`case ${sum}:`);
    }
  });

  it('nomme la bonne divinité à chaque somme', () => {
    const block = dispatchBlock();

    for (let sum = 2; sum <= 12; sum++) {
      const line = new RegExp(`case ${sum}:[^\\n]*`).exec(block)?.[0] ?? '';
      // Le premier mot du nom suffit : « ZEUS - FAVEUR SUPRÊME » s'écrit
      // « ZEUS » dans le commentaire, et « COLÈRE DES DIEUX » y devient
      // « Colère des dieux ».
      const expected = fold(GOD_FAVORS[sum].name.split(' ')[0]);

      expect(fold(line)).toContain(expected);
    }
  });

  it('n\'aiguille plus vers « Jugement dernier »', () => {
    expect(fold(dispatchBlock())).not.toContain('JUGEMENT');
  });

  it('aiguille Artémis sur la somme 7', () => {
    // La faveur nouvelle : c'est elle qui risquait le plus d'être posée au
    // mauvais endroit, puisqu'elle n'existait pas avant.
    const line = new RegExp(`case 7:[^\\n]*`).exec(dispatchBlock())?.[0] ?? '';

    expect(fold(line)).toContain('ARTEMIS');
  });
});
