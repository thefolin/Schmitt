import { describe, it, expect, beforeEach } from 'vitest';
import { GameLogic } from '@/features/game/game.logic';
import { TurnRunner } from '@/features/board/scene3d/turn-runner';
import { tableAnnouncement } from '@/features/board/scene3d/table-announcements';
import type { TileConfig } from '@/core/models/Tile';

/**
 * 3D-59 — les interactions s'énoncent, elles ne s'arbitrent pas.
 *
 * Quentin (19/09/2026) : « Interactions = énoncé + à la table. Pas de
 * sélection dans l'app, pas de choix à arbitrer — juste “Alice distribue 3
 * gorgées”. Les joueurs appliquent, on reprend. »
 *
 * C'est la ligne déjà tranchée pour Arès et Dionysos, étendue à toutes les
 * interactions. L'écran posait auparavant la question « distribuer à qui ? »
 * avec un bouton par joueur.
 *
 * CE QUE ÇA CHANGE AU COMPTE, et qu'il faut regarder en face : plus personne
 * ne reçoit ces gorgées DANS L'APPLICATION. C'est voulu — les attribuer
 * demanderait de choisir qui boit, exactement ce qu'on retire. Le compte ne
 * prétend plus suivre ce qui se boit autour de la table.
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

describe('3D-59 — la distribution s\'annonce', () => {
  it('nomme le joueur et son action', () => {
    runner.setBoard(boardWith({ 3: { type: 'distribute_3' } }));

    const outcome = runner.playTurn(3);
    const said = tableAnnouncement(outcome);

    expect(said?.text).toContain('Alice');
    expect(said?.text).toContain('distribue');
    expect(said?.text).toContain('3');
  });

  it('ne demande plus de choisir une cible', () => {
    // L'ANCIEN COMPORTEMENT : une décision restait en attente et l'écran
    // affichait un bouton par joueur. Elle ne doit plus exister.
    runner.setBoard(boardWith({ 3: { type: 'distribute_3' } }));
    runner.playTurn(3);

    expect(runner.getAwaitingDistribution()).toBeNull();
  });

  it('passe la main tout de suite', () => {
    // La partie ne doit plus attendre une décision qui ne viendra pas.
    runner.setBoard(boardWith({ 3: { type: 'distribute_3' } }));
    runner.playTurn(3);

    expect(runner.currentPlayerName()).toBe('Bastien');
  });

  it('ne compte les gorgées sur PERSONNE dans l\'application', () => {
    // Conséquence assumée : les attribuer demanderait de choisir qui boit,
    // ce qu'on retire justement. Ce test existe pour que le jour où
    // quelqu'un s'étonnera du compte, la raison soit écrite.
    runner.setBoard(boardWith({ 3: { type: 'distribute_3' } }));
    const before = logic.getPlayers().map(p => p.drinks);

    runner.playTurn(3);

    expect(logic.getPlayers().map(p => p.drinks)).toEqual(before);
  });

  it('n\'annonce rien après un tour ordinaire', () => {
    runner.setBoard(boardWith({}));

    expect(tableAnnouncement(runner.playTurn(2))).toBeNull();
  });

  it('n\'annonce rien pour une case qui fait boire le joueur lui-même', () => {
    // « Buvez 2 gorgées » ne demande aucune interaction : le joueur boit, et
    // l'application le compte comme avant.
    runner.setBoard(boardWith({ 3: { type: 'drink_2' } }));

    const outcome = runner.playTurn(3);

    expect(tableAnnouncement(outcome)).toBeNull();
    expect(logic.getPlayers()[0].drinks).toBe(2);
  });
});

describe('3D-59 — le bouclier ne fait pas disparaître de gorgées', () => {
  it('fait retomber la sanction retenue sur le porteur', () => {
    // LE PIÈGE. `GameLogic` RETIENT les gorgées d'un porteur de bouclier tant
    // qu'aucune cible n'est désignée. Si l'écran cesse simplement de poser la
    // question, elles ne retombent sur personne : elles s'évaporent, et le
    // compte devient faux sans que rien ne le signale.
    logic.grantAthenaShield(0);
    logic.addDrinks(0, 4);

    // Rien n'a encore été bu : la sanction est retenue.
    expect(logic.getPlayers()[0].drinks).toBe(0);
    expect(logic.getPendingShield()).not.toBeNull();

    const settled = runner.settlePendingShield();

    expect(settled).toEqual({ player: 0, amount: 4 });
    expect(logic.getPlayers()[0].drinks).toBe(4);
    expect(logic.getPendingShield()).toBeNull();
  });

  it('laisse le bouclier à son porteur', () => {
    // `cancelPendingShield` ne consomme PAS le bouclier : le porteur le garde
    // pour plus tard, et reste incapable de gagner tant qu'il l'a.
    logic.grantAthenaShield(0);
    logic.addDrinks(0, 2);
    runner.settlePendingShield();

    expect(logic.getPlayers()[0].hasAthenaShield).toBe(true);
  });

  it('ne fait rien quand aucun bouclier ne retient rien', () => {
    expect(runner.settlePendingShield()).toBeNull();
  });
});
