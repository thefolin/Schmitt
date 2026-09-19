import { describe, it, expect, beforeEach } from 'vitest';
import { GameLogic } from '@/features/game/game.logic';
import { TurnRunner } from '@/features/board/scene3d/turn-runner';
import { pendingActions } from '@/features/board/scene3d/pending-actions';
import type { TileConfig } from '@/core/models/Tile';

/**
 * 3D-52 — les décisions que le jeu attend du joueur.
 *
 * Troisième étape du HUD. Certaines règles ne se résolvent pas toutes seules :
 * elles attendent un CHOIX. Distribuer des gorgées demande de désigner qui
 * boit ; le bouclier d'Athéna demande sur qui renvoyer.
 *
 * Tant que ce choix n'est pas posé à l'écran, la partie reste bloquée sans
 * que rien ne l'explique — le joueur voit un tour qui ne se termine pas.
 *
 * `pendingActions` REGARDE l'état de la partie et dit ce qu'on attend. Il ne
 * décide rien, n'applique rien : c'est `GameLogic` qui tranche quand le
 * joueur a choisi. Fonction pure, vérifiable sans rien afficher.
 */

const LAST = 22;

let logic: GameLogic;
let runner: TurnRunner;

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

describe('3D-52 — rien à décider, rien à afficher', () => {
  it('ne demande rien après un tour ordinaire', () => {
    runner.setBoard(boardWith({}));
    logic.setPlayerPosition(0, 1);

    const actions = pendingActions(logic, (runner.playTurn(2), runner));

    expect(actions).toEqual([]);
  });
});

describe('3D-52 — choisir qui boit', () => {
  it('demande une cible après une case distribuer', () => {
    runner.setBoard(boardWith({ 3: { type: 'distribute_3' } }));
    logic.setPlayerPosition(0, 1);

    const actions = pendingActions(logic, (runner.playTurn(2), runner));

    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe('distribute');
    expect(actions[0].amount).toBe(3);
  });

  it('propose tout le monde sauf celui qui distribue', () => {
    // On ne se distribue pas des gorgées à soi-même.
    runner.setBoard(boardWith({ 3: { type: 'distribute_2' } }));
    logic.setPlayerPosition(0, 1);

    const actions = pendingActions(logic, (runner.playTurn(2), runner));

    expect(actions[0].choices.map(c => c.name)).toEqual(['Bastien', 'Chloé']);
  });

  it('nomme le joueur qui distribue', () => {
    runner.setBoard(boardWith({ 3: { type: 'distribute_2' } }));
    logic.setPlayerPosition(0, 1);

    const actions = pendingActions(logic, (runner.playTurn(2), runner));

    expect(actions[0].playerName).toBe('Alice');
  });
});

describe('3D-52 — le bouclier d\'Athéna', () => {
  it('demande sur qui renvoyer, quand il a intercepté', () => {
    runner.setBoard(boardWith({ 3: { type: 'drink_4' } }));
    logic.grantAthenaShield(0);
    logic.setPlayerPosition(0, 1);

    const actions = pendingActions(logic, (runner.playTurn(2), runner));

    const shield = actions.find(a => a.kind === 'shield');
    expect(shield).toBeDefined();
    expect(shield?.amount).toBe(4);
  });

  it('propose de renoncer au renvoi', () => {
    // Le porteur peut préférer boire : tant qu'il garde le bouclier il ne
    // peut pas gagner, mais il choisit son moment. La règle existe déjà dans
    // GameLogic (`cancelPendingShield`) — l'écran doit l'offrir.
    runner.setBoard(boardWith({ 3: { type: 'drink_4' } }));
    logic.grantAthenaShield(0);
    logic.setPlayerPosition(0, 1);

    const actions = pendingActions(logic, (runner.playTurn(2), runner));
    const shield = actions.find(a => a.kind === 'shield');

    expect(shield?.canDecline).toBe(true);
  });

  it('ne propose pas le bouclier quand il n\'a rien intercepté', () => {
    runner.setBoard(boardWith({}));
    logic.grantAthenaShield(0);
    logic.setPlayerPosition(0, 1);

    const actions = pendingActions(logic, (runner.playTurn(2), runner));

    expect(actions.find(a => a.kind === 'shield')).toBeUndefined();
  });

  it('exclut le porteur des cibles du renvoi', () => {
    // Se renvoyer la sanction à soi-même n'aurait aucun sens.
    runner.setBoard(boardWith({ 3: { type: 'drink_4' } }));
    logic.grantAthenaShield(0);
    logic.setPlayerPosition(0, 1);

    const actions = pendingActions(logic, (runner.playTurn(2), runner));
    const shield = actions.find(a => a.kind === 'shield');

    expect(shield?.choices.map(c => c.name)).not.toContain('Alice');
  });
});

describe('3D-52 — le module ne décide de rien', () => {
  it('ne sert aucune gorgée en regardant l\'état', () => {
    runner.setBoard(boardWith({ 3: { type: 'distribute_3' } }));
    logic.setPlayerPosition(0, 1);

    const before = logic.getPlayers().map(p => p.drinks);
    pendingActions(logic, (runner.playTurn(2), runner));
    pendingActions(logic, (runner.playTurn(1), runner));

    // Regarder ne change rien : c'est GameLogic qui tranchera quand le
    // joueur aura choisi.
    expect(logic.getPlayers().map(p => p.drinks)).toEqual(before);
  });

  it('peut être appelé plusieurs fois sans effet', () => {
    runner.setBoard(boardWith({ 3: { type: 'drink_4' } }));
    logic.grantAthenaShield(0);
    logic.setPlayerPosition(0, 1);

    const outcome = runner.playTurn(2);

    expect(pendingActions(logic, runner)).toEqual(pendingActions(logic, runner));
  });
});

describe('3D-52 — une décision résolue disparaît', () => {
  it('ne redemande plus la cible une fois les gorgées servies', () => {
    // LE PIÈGE : `outcome` est un compte rendu FIGÉ du tour. Y lire la
    // distribution en attente la fait réapparaître indéfiniment, même après
    // résolution — le panneau resterait à l'écran et le joueur croirait que
    // son clic n'a rien fait.
    //
    // L'état d'une décision doit vivre là où elle peut être résolue, comme
    // le bouclier vit dans `GameLogic`.
    runner.setBoard(boardWith({ 3: { type: 'distribute_3' } }));
    logic.setPlayerPosition(0, 1);

    const outcome = runner.playTurn(2);
    expect(pendingActions(logic, runner)).toHaveLength(1);

    runner.resolveDistribute(1, 3);

    expect(pendingActions(logic, runner)).toHaveLength(0);
    expect(logic.getPlayers()[1].drinks).toBe(3);
  });

  it('ne redemande plus le renvoi une fois le bouclier utilisé', () => {
    runner.setBoard(boardWith({ 3: { type: 'drink_4' } }));
    logic.grantAthenaShield(0);
    logic.setPlayerPosition(0, 1);

    const outcome = runner.playTurn(2);
    expect(pendingActions(logic, runner)).toHaveLength(1);

    runner.resolveShield(1);

    expect(pendingActions(logic, runner)).toHaveLength(0);
  });

  it('ne redemande plus rien quand le porteur renonce', () => {
    runner.setBoard(boardWith({ 3: { type: 'drink_4' } }));
    logic.grantAthenaShield(0);
    logic.setPlayerPosition(0, 1);

    const outcome = runner.playTurn(2);
    runner.declineShield();

    expect(pendingActions(logic, runner)).toHaveLength(0);
    expect(logic.getPlayers()[0].drinks).toBe(4);
  });
});
