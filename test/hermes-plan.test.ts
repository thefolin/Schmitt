import { describe, it, expect } from 'vitest';
import {
  hermesPlan,
  HERMES_SUM,
  type HermesChoice,
} from '@/features/board/scene3d/hermes-plan';
import { GOD_FAVORS } from '@/features/game/god-favors';

/**
 * Le calcul d'HERMÈS : un seul pion bouge, et c'est le sens qui dit lequel.
 *
 * Les deux flèches du croquis de Quentin : « Me déplacer » pointe VERS la
 * liste — je vais sur sa case — et « Ramener » part de la liste vers moi.
 * Les confondre déplacerait le mauvais pion ET ferait appliquer la case
 * d'arrivée au mauvais joueur.
 */

/** Un choix, avec le joueur 0 aux commandes sauf mention contraire. */
function choice(over: Partial<HermesChoice> = {}): HermesChoice {
  return { player: 0, target: 2, direction: 'move', ...over };
}

describe('Hermès — la faveur de somme 5', () => {
  it('désigne bien HERMÈS sur la table du plateau', () => {
    expect(GOD_FAVORS[HERMES_SUM].name).toBe('HERMÈS');
  });
});

describe('Hermès — « Me déplacer »', () => {
  it('emmène MON pion sur SA case', () => {
    const move = hermesPlan(choice({ direction: 'move' }), [3, 9, 14]);

    expect(move).toEqual({ player: 0, from: 3, to: 14 });
  });

  it('ne touche pas au pion de l\'adversaire', () => {
    // C'EST LE PIÈGE DU SENS : les deux pions finissent sur la même case,
    // mais un seul a bougé — et c'est lui seul qui appliquera l'effet.
    const move = hermesPlan(choice({ direction: 'move' }), [3, 9, 14]);

    expect(move.player).not.toBe(2);
  });
});

describe('Hermès — « Ramener »', () => {
  it('tire SON pion sur MA case', () => {
    const move = hermesPlan(choice({ direction: 'bring' }), [3, 9, 14]);

    expect(move).toEqual({ player: 2, from: 14, to: 3 });
  });

  it('inverse exactement le sens de « Me déplacer »', () => {
    // Le même couple de joueurs, les deux sens : ce sont les mêmes deux
    // cases, échangées. Une erreur de sens se verrait ici.
    const positions = [3, 9, 14];

    const mine = hermesPlan(choice({ direction: 'move' }), positions);
    const theirs = hermesPlan(choice({ direction: 'bring' }), positions);

    expect(mine.from).toBe(theirs.to);
    expect(mine.to).toBe(theirs.from);
  });
});

describe('Hermès — lit les positions par le RANG du joueur', () => {
  it('ne se trompe pas de pion quand le joueur courant n\'est pas le premier', () => {
    // `positions` est indexé par le rang dans la partie, pas par le rang
    // dans la liste déroulante. Lire la mauvaise entrée poserait le pion sur
    // la case d'un tiers — défaut déjà rencontré sur Aphrodite.
    const move = hermesPlan(
      choice({ player: 3, target: 1, direction: 'move' }),
      [0, 5, 11, 20]
    );

    expect(move).toEqual({ player: 3, from: 20, to: 5 });
  });
});

describe('Hermès — les deux pions déjà sur la même case', () => {
  it('produit quand même un déplacement', () => {
    // DÉCISION DE QUENTIN : « même s'il se trouve sur la même case
    // d'origine, il est déplacé comme déplacé, et du coup il applique sa
    // case ». Sans cela, Hermès ne produirait RIEN dans ce cas de figure.
    const move = hermesPlan(choice({ direction: 'move' }), [7, 0, 7]);

    expect(move).toEqual({ player: 0, from: 7, to: 7 });
  });

  it('nomme le bon pion des deux côtés', () => {
    const positions = [7, 0, 7];

    expect(hermesPlan(choice({ direction: 'move' }), positions).player).toBe(0);
    expect(hermesPlan(choice({ direction: 'bring' }), positions).player).toBe(2);
  });
});
