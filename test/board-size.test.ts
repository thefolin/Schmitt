import { describe, it, expect } from 'vitest';
import { GameLogic } from '../src/features/game/game.logic';

const twoPlayers = [
  { name: 'A', color: '#f00' },
  { name: 'B', color: '#00f' }
];

describe('taille de plateau configurable', () => {
  it('la dernière case est atteignable sur un plateau de 22 cases', () => {
    const g = new GameLogic();
    g.setBoardSize(22); // positions 0 à 21
    g.startGame(twoPlayers);

    g.setPlayerPosition(0, 18);
    g.movePlayer(0, 3); // valeur exacte

    expect(g.getPlayers()[0].position).toBe(21);
  });

  it('respecte un plateau personnalisé plus court', () => {
    const g = new GameLogic();
    g.setBoardSize(8); // positions 0 à 7
    g.startGame(twoPlayers);

    g.setPlayerPosition(0, 5);
    g.movePlayer(0, 2);

    expect(g.getPlayers()[0].position).toBe(7);
  });

  it('garde le plateau officiel par défaut', () => {
    const g = new GameLogic();
    g.startGame(twoPlayers);

    expect(g.getLastPosition()).toBe(22);
  });

  it('ne laisse jamais un pion sortir du plateau, quelle que soit sa taille', () => {
    for (const size of [8, 22, 23]) {
      const g = new GameLogic();
      g.setBoardSize(size);
      g.startGame(twoPlayers);

      g.movePlayer(0, 99);
      const pos = g.getPlayers()[0].position;

      expect(pos).toBeGreaterThanOrEqual(0);
      expect(pos).toBeLessThanOrEqual(size - 1);
    }
  });

  it('la victoire reste liée au retour sur START, pas à la taille du plateau', () => {
    const g = new GameLogic();
    g.setBoardSize(8);
    g.startGame(twoPlayers);

    g.setPlayerPosition(0, 7);
    expect(g.checkVictory()).toBeNull(); // dernière case atteinte, mais pas gagné

    g.claimSchmittPower(0);
    g.setPlayerPosition(0, 2);
    g.movePlayer(0, 2); // retour exact sur START

    expect(g.checkVictory()?.name).toBe('A');
  });
});
