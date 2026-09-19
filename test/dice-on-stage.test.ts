import { describe, it, expect } from 'vitest';
import {
  duringFavor,
  betweenFavors,
  diceOnStage,
} from '@/features/board/scene3d/dice-on-stage';

/**
 * 3D-60 — jamais trois dés sur le plateau.
 *
 * Quentin (20/09/2026) : « il en sort 3, tu dois en avoir 2 ».
 *
 * LE DÉFAUT : le dé du tour et les deux dés de la faveur sont trois objets
 * distincts dans la même scène. J'ai fait apparaître les deux dés de la
 * faveur sans retirer celui du tour — il en restait donc trois, et la somme
 * annoncée ne correspondait plus à une paire lisible. Dans un jeu à boire, le
 * joueur RECOMPTE : un troisième dé posé là rend le résultat indéfendable.
 *
 * Le comptage est vérifiable sans rendu, et c'est justement ce que le défaut
 * a mis en défaut : `visible` est un booléen, pas un pixel. Un test qui aurait
 * demandé un canevas serait passé avec le défaut présent — on en a déjà eu
 * sept de cette sorte.
 */

describe('3D-60 — le plateau ne porte jamais trois dés', () => {
  it('en montre deux pendant la faveur', () => {
    expect(diceOnStage(duringFavor())).toBe(2);
  });

  it('en montre un le reste du temps', () => {
    expect(diceOnStage(betweenFavors())).toBe(1);
  });

  it('n\'en montre jamais trois, à aucun moment', () => {
    for (const moment of [duringFavor(), betweenFavors()]) {
      expect(diceOnStage(moment)).toBeLessThan(3);
    }
  });
});

describe('3D-60 — le dé du tour s\'efface pendant la faveur', () => {
  it('disparaît le temps du tirage', () => {
    // C'EST LE CORRECTIF. Sans cela, le dé qui vient de faire avancer le pion
    // reste posé à côté des deux dés de la faveur.
    expect(duringFavor().turn).toBe(false);
  });

  it('revient une fois la faveur annoncée', () => {
    // Et il doit REVENIR : c'est lui qu'on attrape au doigt pour jouer le
    // tour suivant. Le laisser caché rendrait la partie injouable.
    expect(betweenFavors().turn).toBe(true);
  });
});

describe('3D-60 — les dés de la faveur ne restent pas posés', () => {
  it('sont visibles pendant le tirage', () => {
    expect(duringFavor().favor).toBe(true);
  });

  it('s\'effacent ensuite', () => {
    // Deux dés oubliés sur le plateau se confondraient avec le dé du tour
    // suivant — la même confusion, à l'envers.
    expect(betweenFavors().favor).toBe(false);
  });

  it('ne sont jamais posés en même temps que le dé du tour', () => {
    // L'invariant, dit autrement : les deux groupes s'excluent.
    for (const moment of [duringFavor(), betweenFavors()]) {
      expect(moment.turn && moment.favor).toBe(false);
    }
  });
});
