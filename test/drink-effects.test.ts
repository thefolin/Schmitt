import { describe, it, expect, beforeEach } from 'vitest';
import { GameLogic } from '@/features/game/game.logic';
import { TurnRunner } from '@/features/board/scene3d/turn-runner';
import type { TileConfig } from '@/core/models/Tile';

/**
 * 3D-51 — les effets de case qui FONT BOIRE.
 *
 * Deuxième étape du HUD, et le prérequis que la demande initiale supposait
 * sans le dire : « déclencher les pouvoirs après le lancer » ne peut pas
 * exister tant que les cases n'ont aucun effet. Jusqu'ici seuls ceux qui
 * DÉPLACENT étaient branchés (#47).
 *
 * LE GARDE-FOU NE BOUGE PAS : la scène demande à `GameLogic`, elle n'écrit
 * aucune règle. `addDrinks` est le passage OBLIGÉ de toutes les gorgées du
 * jeu — c'est là que le bouclier d'Athéna intercepte. Compter les gorgées
 * ailleurs laisserait passer le bouclier, et c'est précisément pour ça que ce
 * point de passage existe.
 *
 * CE QUI NE SE CALCULE PAS ICI : Arès, Dionysos et Héphaïstos se jouent À LA
 * TABLE. Quentin l'a tranché : « On laisse les joueurs le faire, on affiche
 * les règles, ils le font dans la vraie vie, puis quand ils sont finis on
 * reprend le tour. » L'application énonce et attend.
 */

const LAST = 22;

let logic: GameLogic;
let runner: TurnRunner;

/** Un plateau dont on choisit les cases. */
function boardWith(overrides: Record<number, Partial<TileConfig>>): TileConfig[] {
  return Array.from({ length: LAST + 1 }, (_, index) => ({
    type: 'start',
    ...(overrides[index] ?? {}),
  })) as TileConfig[];
}

beforeEach(() => {
  logic = new GameLogic();
  logic.setBoardSize(LAST + 1);
  logic.startGame([
    { name: 'Alice', color: '#e2483d' },
    { name: 'Bastien', color: '#3d7fc4' },
    { name: 'Chloé', color: '#2f8f4e' },
  ]);
  runner = new TurnRunner(logic);
});

describe('3D-51 — les cases qui font boire le joueur', () => {
  it('sert les gorgées annoncées par la case', () => {
    runner.setBoard(boardWith({ 3: { type: 'drink_2' } }));
    logic.setPlayerPosition(0, 1);

    const outcome = runner.playTurn(2);

    expect(outcome.drinks?.player).toBe(0);
    expect(outcome.drinks?.amount).toBe(2);
    expect(logic.getPlayers()[0].drinks).toBe(2);
  });

  it('lit la quantité dans le type de la case', () => {
    // drink_2, drink_3, drink_4 : le nombre est dans le nom, et c'est la
    // seule source. L'écrire une seconde fois dans la scène créerait deux
    // vérités à accorder.
    for (const [type, expected] of [['drink_2', 2], ['drink_3', 3], ['drink_4', 4]] as const) {
      logic.startGame([{ name: 'Alice', color: '#a' }, { name: 'Bob', color: '#b' }]);
      runner.setBoard(boardWith({ 2: { type } }));
      logic.setPlayerPosition(0, 0);

      const outcome = runner.playTurn(2);

      expect(outcome.drinks?.amount).toBe(expected);
    }
  });

  it('ne fait pas boire sur une case ordinaire', () => {
    runner.setBoard(boardWith({}));
    logic.setPlayerPosition(0, 1);

    const outcome = runner.playTurn(2);

    expect(outcome.drinks).toBeNull();
    expect(logic.getPlayers()[0].drinks).toBe(0);
  });
});

describe('3D-51 — les cases qui font distribuer', () => {
  it('annonce une distribution, sans désigner la cible', () => {
    // C'est le joueur qui choisit à qui il distribue : la scène ne peut pas
    // trancher à sa place, et inventer une cible serait inventer une règle.
    runner.setBoard(boardWith({ 3: { type: 'distribute_3' } }));
    logic.setPlayerPosition(0, 1);

    const outcome = runner.playTurn(2);

    expect(outcome.distribute?.amount).toBe(3);
    expect(outcome.distribute?.by).toBe(0);
  });

  it('ne sert aucune gorgée tant que la cible n\'est pas choisie', () => {
    runner.setBoard(boardWith({ 3: { type: 'distribute_3' } }));
    logic.setPlayerPosition(0, 1);

    runner.playTurn(2);

    for (const player of logic.getPlayers()) {
      expect(player.drinks).toBe(0);
    }
  });
});

describe('3D-51 — la tournée générale', () => {
  it('fait boire tout le monde', () => {
    runner.setBoard(boardWith({ 3: { type: 'everyone_drinks' } }));
    logic.setPlayerPosition(0, 1);

    const outcome = runner.playTurn(2);

    expect(outcome.everyone).toBe(true);

    for (const player of logic.getPlayers()) {
      expect(player.drinks).toBeGreaterThan(0);
    }
  });
});

describe('3D-51 — les cases qui se jouent à la table', () => {
  it('énonce la règle sans rien calculer', () => {
    // Quentin : « on affiche les règles, ils le font dans la vraie vie, puis
    // quand ils sont finis on reprend le tour ». L'application n'arbitre pas.
    runner.setBoard(boardWith({ 3: { type: 'rule' } }));
    logic.setPlayerPosition(0, 1);

    const outcome = runner.playTurn(2);

    expect(outcome.tableRule).toBe(true);
    expect(outcome.drinks).toBeNull();
  });
});

describe('3D-51 — le bouclier d\'Athéna intercepte', () => {
  it('retient les gorgées au lieu de les servir', () => {
    // `addDrinks` est le passage obligé de TOUTES les gorgées : c'est ce qui
    // garantit que le bouclier ne peut pas être contourné. Compter les
    // gorgées dans la scène le court-circuiterait.
    runner.setBoard(boardWith({ 3: { type: 'drink_4' } }));
    logic.grantAthenaShield(0);
    logic.setPlayerPosition(0, 1);

    runner.playTurn(2);

    expect(logic.getPlayers()[0].drinks).toBe(0);
    expect(logic.getPendingShield()).not.toBeNull();
  });
});

describe('3D-51 — la scène n\'écrit aucune règle', () => {
  it('laisse GameLogic tenir le compte des gorgées', () => {
    runner.setBoard(boardWith({ 3: { type: 'drink_2' }, 5: { type: 'drink_3' } }));
    logic.setPlayerPosition(0, 1);

    runner.playTurn(2);
    logic.setPlayerPosition(0, 3);
    logic.nextPlayer();
    logic.nextPlayer();
    runner.playTurn(2);

    // Le total vient de la partie, jamais d'un compteur tenu par la scène.
    expect(logic.getPlayers()[0].drinks).toBe(5);
  });

  it('fonctionne sans plateau déclaré', () => {
    logic.setPlayerPosition(0, 1);

    const outcome = runner.playTurn(2);

    expect(outcome.drinks).toBeNull();
    expect(outcome.to).toBe(3);
  });
});
