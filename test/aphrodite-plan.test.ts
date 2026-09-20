import { describe, it, expect } from 'vitest';
import {
  aphroditeLanding,
  aphroditePlan,
  aphroditeReady,
  type AphroditeChoice,
} from '@/features/board/scene3d/aphrodite-plan';

/**
 * Où Aphrodite envoie les pions.
 *
 * CE QUI SE VÉRIFIE ICI NE DÉPEND D'AUCUNE DES TROIS QUESTIONS encore
 * ouvertes chez Quentin — la contrainte de direction, l'étendue de la
 * sélection dans l'application, le cas à deux joueurs. Quel que soit l'écran
 * qu'il choisira, un dé de 4 vers l'avant depuis la case 7 mène à la case 11.
 *
 * Le reste de la faveur — l'écran, l'enchaînement des effets — attend ses
 * réponses.
 */

const LAST = 22;

function choice(over: Partial<AphroditeChoice> = {}): AphroditeChoice {
  return { player: 1, diceSlot: 0, dice: 3, direction: 'forward', ...over };
}

describe('Aphrodite — où le pion atterrit', () => {
  it('avance de la valeur du dé', () => {
    expect(aphroditeLanding(7, 4, 'forward', LAST)).toBe(11);
  });

  it('recule de la valeur du dé', () => {
    expect(aphroditeLanding(7, 4, 'backward', LAST)).toBe(3);
  });
});

describe('Aphrodite — le plateau a des bords', () => {
  it('ne recule pas avant START', () => {
    // SANS CETTE BORNE le pion irait sur une case négative, qui n'existe
    // pas. `GameLogic.setPlayerPosition` borne de son côté : on calcule ici
    // la MÊME valeur, sinon la modale promettrait un déplacement que les
    // règles refuseraient ensuite.
    expect(aphroditeLanding(2, 5, 'backward', LAST)).toBe(0);
  });

  it('ne dépasse pas la dernière case', () => {
    expect(aphroditeLanding(20, 6, 'forward', LAST)).toBe(LAST);
  });

  it('reste sur place quand il est déjà au bord', () => {
    expect(aphroditeLanding(0, 4, 'backward', LAST)).toBe(0);
    expect(aphroditeLanding(LAST, 4, 'forward', LAST)).toBe(LAST);
  });
});

describe('Aphrodite — le plan des deux déplacements', () => {
  it('dit d\'où chacun part et où il arrive', () => {
    const moves = aphroditePlan(
      [
        choice({ player: 1, dice: 4, direction: 'forward' }),
        choice({ player: 2, diceSlot: 1, dice: 2, direction: 'backward' }),
      ],
      [0, 7, 9],
      LAST
    );

    expect(moves).toEqual([
      { player: 1, from: 7, to: 11, dice: 4, direction: 'forward' },
      { player: 2, from: 9, to: 7, dice: 2, direction: 'backward' },
    ]);
  });

  it('garde l\'ORDRE des choix', () => {
    // C'est l'ordre dans lequel les effets des cases d'arrivée s'appliqueront
    // ensuite : l'inverser changerait qui boit en premier.
    const moves = aphroditePlan(
      [choice({ player: 2 }), choice({ player: 1, diceSlot: 1 })],
      [0, 5, 5],
      LAST
    );

    expect(moves.map(move => move.player)).toEqual([2, 1]);
  });

  it('ne fait pas tomber un joueur dont la position manque', () => {
    // Une partie peut compter moins de joueurs que l'écran n'en propose :
    // mieux vaut le ramener à START que de produire un `NaN` qui se
    // propagerait jusque dans les règles.
    const moves = aphroditePlan([choice({ player: 9, dice: 3 })], [0, 5], LAST);

    expect(moves[0].to).toBe(3);
  });
});

describe('Aphrodite — un dé ne sert qu\'une fois', () => {
  it('accepte deux joueurs et deux dés distincts', () => {
    expect(
      aphroditeReady(
        [choice({ player: 1, diceSlot: 0 }), choice({ player: 2, diceSlot: 1 })],
        2
      )
    ).toBe(true);
  });

  it('refuse le MÊME dé pour les deux', () => {
    // « Associez 1 dé à chacun » : c'est la seule contrainte que la règle
    // pose explicitement, et celle que le sketch rend visible en barrant le
    // dé déjà pris dans l'autre colonne.
    expect(
      aphroditeReady(
        [choice({ player: 1, diceSlot: 0 }), choice({ player: 2, diceSlot: 0 })],
        2
      )
    ).toBe(false);
  });

  it('distingue DEUX DÉS QUI MONTRENT LA MÊME FACE', () => {
    // C'EST LE PIÈGE : un jet de 3 et 3 donne deux dés distincts. Les
    // identifier par leur face ferait croire qu'un seul a été utilisé, et
    // « Valider » resterait refusé sans que le joueur comprenne pourquoi.
    expect(
      aphroditeReady(
        [
          choice({ player: 1, diceSlot: 0, dice: 3 }),
          choice({ player: 2, diceSlot: 1, dice: 3 }),
        ],
        2
      )
    ).toBe(true);
  });

  it('refuse de déplacer deux fois le même joueur', () => {
    expect(
      aphroditeReady(
        [choice({ player: 1, diceSlot: 0 }), choice({ player: 1, diceSlot: 1 })],
        2
      )
    ).toBe(false);
  });

  it('refuse tant que les choix sont incomplets', () => {
    // « Valider » doit rester hors d'atteinte : c'est plus clair qu'un
    // message d'erreur après coup.
    expect(aphroditeReady([choice()], 2)).toBe(false);
    expect(aphroditeReady([], 2)).toBe(false);
  });

  it('accepte un seul choix quand un seul est attendu', () => {
    // À deux joueurs il n'y a qu'un adversaire. Ce que l'on FAIT dans ce cas
    // n'est pas tranché — `main` propose de lui donner les deux dés — mais
    // compter jusqu'à un plutôt que deux ne préjuge de rien.
    expect(aphroditeReady([choice()], 1)).toBe(true);
  });
});
