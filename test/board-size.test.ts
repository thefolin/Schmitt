import { describe, it, expect } from 'vitest';
import { GameLogic } from '../src/features/game/game.logic';

describe('taille de plateau configurable', () => {
  it('la victoire est atteignable sur un plateau de 22 cases', () => {
    const g = new GameLogic();
    g.setBoardSize(22);              // positions 0 à 21
    g.startGame([{ name: 'A', color: '#f00' }, { name: 'B', color: '#00f' }]);
    g.movePlayer(0, 30);             // largement au-delà
    expect(g.getPlayers()[0].position).toBe(21);
    expect(g.checkVictory()?.name).toBe('A');
  });

  it('respecte un plateau personnalisé plus court', () => {
    const g = new GameLogic();
    g.setBoardSize(8);
    g.startGame([{ name: 'A', color: '#f00' }, { name: 'B', color: '#00f' }]);
    g.movePlayer(0, 50);
    expect(g.getPlayers()[0].position).toBe(7);
    expect(g.checkVictory()?.name).toBe('A');
  });

  it('garde le plateau officiel par défaut', () => {
    const g = new GameLogic();
    g.startGame([{ name: 'A', color: '#f00' }, { name: 'B', color: '#00f' }]);
    g.movePlayer(0, 99);
    expect(g.getPlayers()[0].position).toBe(22);
  });
});
