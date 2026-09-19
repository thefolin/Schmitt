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

describe('3D-59 — la distribution ne se choisit plus dans l\'application', () => {
  /**
   * CE GROUPE A ÉTÉ RENVERSÉ, et il est gardé plutôt que supprimé pour que
   * la raison reste lisible.
   *
   * Il vérifiait que l'écran DEMANDE une cible après une case « distribuer »,
   * avec un bouton par joueur. Quentin a tranché l'inverse le 19/09/2026 :
   * « Interactions = énoncé + à la table. Pas de sélection dans l'app, pas de
   * choix à arbitrer — juste “Alice distribue 3 gorgées”. »
   *
   * Le bouclier, lui, continue d'être suivi par `pendingActions` : sa
   * sanction est RETENUE par les règles, et quelque chose doit la solder.
   */
  it('ne demande plus de cible après une case distribuer', () => {
    runner.setBoard(boardWith({ 3: { type: 'distribute_3' } }));
    logic.setPlayerPosition(0, 1);

    const actions = pendingActions(logic, (runner.playTurn(2), runner));

    expect(actions).toHaveLength(0);
  });

  it('ne retient aucune distribution en attente', () => {
    runner.setBoard(boardWith({ 3: { type: 'distribute_2' } }));
    logic.setPlayerPosition(0, 1);
    runner.playTurn(2);

    expect(runner.getAwaitingDistribution()).toBeNull();
  });

  it('laisse le tour se terminer sans décision', () => {
    // L'ancienne version bloquait la partie tant que personne n'avait
    // cliqué. Plus rien ne doit l'attendre.
    runner.setBoard(boardWith({ 3: { type: 'distribute_2' } }));
    logic.setPlayerPosition(0, 1);
    runner.playTurn(2);

    expect(pendingActions(logic, runner)).toHaveLength(0);
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
  it('n\'a plus de distribution à faire disparaître', () => {
    // L'ancien test vérifiait qu'une distribution résolue cessait d'être
    // demandée — le défaut du `TurnOutcome` figé, qui la faisait réapparaître
    // à chaque image. La distribution ne passe plus par l'application du
    // tout : il n'y a plus rien à résoudre ni à effacer.
    runner.setBoard(boardWith({ 3: { type: 'distribute_3' } }));
    logic.setPlayerPosition(0, 1);

    runner.playTurn(2);

    expect(pendingActions(logic, runner)).toHaveLength(0);
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
