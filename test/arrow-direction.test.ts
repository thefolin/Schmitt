import { describe, it, expect } from 'vitest';
import { GameLogic } from '@/features/game/game.logic';

/**
 * SCH-02 — une case flèche déplace dans SON sens, pas dans celui de marche.
 *
 * Retour de Bastien (18/09/2026, capture 00000041) : « Le joueur vert est
 * tombé sur la case flèche +2. Il aurait dû arriver sur la case schmitt. A la
 * place il a continué d'avancer jusqu'à la case X2 rouge. »
 *
 * Sur le plateau officiel, la flèche de la position 9 envoie vers la case
 * SCHMITT (position 11). Le déplacement passait par `movePlayer`, qui lit le
 * sens de marche du joueur : en phase de retour la flèche envoyait donc à
 * l'opposé de ce qu'elle dessine.
 */

const players = [
  { name: 'Alice', color: '#f00' },
  { name: 'Bob', color: '#0f0' },
];

describe('SCH-02 — sens imposé des cases flèche', () => {
  it("envoie vers l'avant en phase aller", () => {
    const g = new GameLogic();
    g.startGame(players);
    g.movePlayer(0, 9); // Alice arrive sur la flèche (position 9)

    expect(g.movePlayerInDirection(0, 2, 'forward')).toBe(11);
  });

  it("envoie vers l'avant AUSSI en phase de retour — c'est le cas de Bastien", () => {
    const g = new GameLogic();
    g.startGame(players);

    // Alice avance jusqu'à la flèche (position 9) avant le demi-tour
    g.movePlayer(0, 9);

    // Bob prend le pouvoir du Schmitt : tout le monde fait demi-tour
    g.movePlayer(1, g.getLastPosition());
    g.claimSchmittPower(1);

    expect(g.getPlayers()[0].isReturning).toBe(true);
    expect(g.getPlayers()[0].position).toBe(9);

    // La flèche pointe vers FINISH : elle envoie en 11 (case SCHMITT),
    // même si Alice marche dans l'autre sens. Avant le correctif, elle
    // reculait en 7 — exactement l'écart constaté par Bastien.
    expect(g.movePlayerInDirection(0, 2, 'forward')).toBe(11);
  });

  it('une flèche de recul envoie vers START, quel que soit le sens de marche', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.movePlayer(0, 9);

    expect(g.movePlayerInDirection(0, 2, 'backward')).toBe(7);
  });

  it("ne fait pas rebondir sur FINISH : une flèche pousse jusqu'au bord", () => {
    const g = new GameLogic();
    g.startGame(players);
    const last = g.getLastPosition();
    g.movePlayer(0, last - 1);

    // Un jet de dé rebondirait ; la flèche, elle, s'arrête sur la case.
    expect(g.movePlayerInDirection(0, 2, 'forward')).toBe(last);
  });

  it('ne sort jamais du plateau par START', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.movePlayer(0, 1);

    expect(g.movePlayerInDirection(0, 2, 'backward')).toBe(0);
  });

  it("marque le retour comme entamé quand la flèche éloigne de START", () => {
    const g = new GameLogic();
    g.startGame(players);
    g.movePlayer(1, g.getLastPosition());
    g.claimSchmittPower(1);

    // Alice est restée sur START : le retour n'a pas encore commencé
    expect(g.getPlayers()[0].position).toBe(0);
    expect(g.getPlayers()[0].hasLeftStartOnReturn).toBe(false);

    g.movePlayerInDirection(0, 2, 'forward');

    // Sans cela, un joueur poussé hors de START puis revenu gagnerait
    // sans avoir jamais parcouru le retour.
    expect(g.getPlayers()[0].hasLeftStartOnReturn).toBe(true);
  });
});

describe('SCH-02 — les données du plateau portent le sens', () => {
  it('chaque case flèche du plateau officiel déclare sa direction', async () => {
    const board = await import('../public/data/board-tiles.json');
    const arrows = (board.tiles as { type: string; direction?: string }[]).filter(
      t => t.type === 'forward_2'
    );

    expect(arrows.length).toBeGreaterThan(0);
    arrows.forEach(a => {
      expect(['forward', 'backward']).toContain(a.direction);
    });
  });
});
