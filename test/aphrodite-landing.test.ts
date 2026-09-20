import { describe, it, expect, beforeEach } from 'vitest';
import { GameLogic } from '@/features/game/game.logic';
import { TurnRunner } from '@/features/board/scene3d/turn-runner';
import type { TileConfig } from '@/core/models/Tile';

/**
 * Ce qui arrive aux pions qu'APHRODITE a déposés ailleurs.
 *
 * « Ils appliquent alors l'effet de leur nouvel emplacement. » Sans cela, les
 * pions changeaient de case et il ne se passait rien : le déplacement restait
 * sans conséquence, et la faveur perdait la moitié de son intérêt.
 *
 * CE N'EST PAS UN TOUR. Le pion n'a pas lancé de dé, ne se déplace plus, et
 * la main ne change pas — c'est le joueur d'Aphrodite qui joue toujours.
 * C'est ce qui distingue `applyLanding` de `playTurn`, et le confondre
 * ferait avancer un adversaire puis passer la main au mauvais joueur.
 */

const LAST = 22;

let logic: GameLogic;
let runner: TurnRunner;

/** Un plateau dont on choisit les cases. */
function boardWith(overrides: Record<number, Partial<TileConfig>>): TileConfig[] {
  return Array.from({ length: LAST + 1 }, (_, index) => ({
    type: 'normal',
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

describe('Aphrodite — la case d\'arrivée joue', () => {
  it('fait boire celui qu\'on a posé sur une case « boire »', () => {
    runner.setBoard(boardWith({ 8: { type: 'drink_3' } }));

    const outcome = runner.applyLanding(1, 8);

    expect(outcome.drinks).toEqual({ player: 1, amount: 3 });
    expect(logic.getPlayers()[1].drinks).toBe(3);
  });

  it('énonce la distribution sans la compter', () => {
    // La distribution se joue À LA TABLE : l'application énonce, les joueurs
    // appliquent. C'est la ligne tranchée par Quentin, et elle vaut ici
    // comme sur un tour ordinaire.
    runner.setBoard(boardWith({ 6: { type: 'distribute_2' } }));

    const outcome = runner.applyLanding(2, 6);

    expect(outcome.distribute).toEqual({ by: 2, amount: 2 });
  });

  it('fait boire TOUT LE MONDE sur une tournée générale', () => {
    runner.setBoard(boardWith({ 4: { type: 'everyone_drinks' } }));

    const outcome = runner.applyLanding(1, 4);

    expect(outcome.everyone).toBe(true);
    expect(logic.getPlayers().every(player => player.drinks > 0)).toBe(true);
  });

  it('pose le statut de Poulet', () => {
    // C'EST CE QUI DÉCLENCHE LA SENTENCE à tous les tours suivants : un
    // adversaire déposé sur le Poulet le devient pour de bon.
    runner.setBoard(boardWith({ 5: { type: 'chicken' } }));

    const outcome = runner.applyLanding(1, 5);

    expect(outcome.chicken).not.toBeNull();
  });

  it('ouvre la faveur des dieux sur un temple', () => {
    runner.setBoard(boardWith({ 9: { type: 'power' } }));

    expect(runner.applyLanding(1, 9).godFavor).toBe(true);
  });

  it('annonce une règle à jouer à la table', () => {
    runner.setBoard(boardWith({ 7: { type: 'rule' } }));

    expect(runner.applyLanding(1, 7).tableRule).toBe(true);
  });

  it('ne dit rien sur une case sans effet', () => {
    // Un pion déposé sur une case vide ne doit PAS ouvrir de modale : on
    // validerait un écran qui n'annonce rien.
    runner.setBoard(boardWith({}));

    const outcome = runner.applyLanding(1, 10);

    expect(outcome.drinks).toBeNull();
    expect(outcome.distribute).toBeNull();
    expect(outcome.everyone).toBe(false);
    expect(outcome.tableRule).toBe(false);
    expect(outcome.chicken).toBeNull();
  });
});

describe('Aphrodite — ce n\'est pas un tour', () => {
  it('ne passe PAS la main au joueur suivant', () => {
    // C'EST LE PIÈGE : `playTurn` passe la main. L'employer ici ferait jouer
    // l'adversaire suivant alors que le tour appartient toujours à celui qui
    // a tiré Aphrodite.
    runner.setBoard(boardWith({ 8: { type: 'drink_3' } }));

    const before = logic.getCurrentPlayerIndex();
    runner.applyLanding(1, 8);

    expect(logic.getCurrentPlayerIndex()).toBe(before);
  });

  it('ne déplace PAS le pion une seconde fois', () => {
    // Le pion a déjà été posé par Aphrodite : `playTurn` le ferait avancer
    // encore, du nombre de la face.
    runner.setBoard(boardWith({ 8: { type: 'drink_3' } }));
    logic.setPlayerPosition(1, 8);

    runner.applyLanding(1, 8);

    expect(logic.getPlayers()[1].position).toBe(8);
  });

  it('n\'annonce aucune face de dé', () => {
    // Aucun dé n'a été lancé pour arriver là : donner une face ferait croire
    // à un déplacement qui n'a pas eu lieu.
    runner.setBoard(boardWith({ 8: { type: 'drink_3' } }));

    const outcome = runner.applyLanding(1, 8);

    expect(outcome.dice).toBe(0);
    expect(outcome.steps).toBe(0);
    expect(outcome.from).toBe(outcome.to);
  });

  it('ne fait tomber aucune sentence du Poulet', () => {
    // La sentence tombe sur un JET — « à chaque 3 ou 6 de n'importe quel
    // joueur ». Il n'y a pas eu de jet ici.
    runner.setBoard(boardWith({ 5: { type: 'chicken' }, 8: { type: 'drink_3' } }));

    runner.applyLanding(1, 5);

    expect(runner.applyLanding(2, 8).chickenPenalty).toBeNull();
  });

  it('nomme le joueur déplacé, et non celui qui joue', () => {
    runner.setBoard(boardWith({ 8: { type: 'drink_3' } }));

    expect(runner.applyLanding(1, 8).playerName).toBe('Bastien');
  });
});
