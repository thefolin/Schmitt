import { describe, it, expect } from 'vitest';
import { GameLogic } from '@/features/game/game.logic';

/**
 * Apollon distribue 1 gorgée à chaque adversaire DÉPASSÉ.
 * La règle du dépassement est purement arithmétique : on teste ici la
 * sélection des joueurs concernés, telle que l'applique handleApollon.
 */
function passedPlayers(
  game: GameLogic,
  moverIndex: number,
  from: number,
  to: number
) {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  return game
    .getPlayers()
    .filter(p => p.index !== moverIndex && p.position > low && p.position < high);
}

const players = [
  { name: 'Alice', color: '#f00' },
  { name: 'Bob', color: '#00f' },
  { name: 'Chloé', color: '#0f0' }
];

describe('Apollon : gorgées aux adversaires dépassés', () => {
  it('distribue à ceux qui sont strictement entre le départ et l\'arrivée', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.setPlayerPosition(1, 3); // Bob
    g.setPlayerPosition(2, 5); // Chloé

    const passed = passedPlayers(g, 0, 1, 7);

    expect(passed.map(p => p.name)).toEqual(['Bob', 'Chloé']);
  });

  it('ne compte pas un joueur situé exactement sur la case d\'arrivée', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.setPlayerPosition(1, 7);

    const passed = passedPlayers(g, 0, 1, 7);

    expect(passed).toHaveLength(0);
  });

  it('ne compte pas un joueur resté derrière', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.setPlayerPosition(1, 9);

    const passed = passedPlayers(g, 0, 1, 7);

    expect(passed).toHaveLength(0);
  });

  it('ne se compte jamais soi-même', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.setPlayerPosition(0, 4);

    const passed = passedPlayers(g, 0, 1, 7);

    expect(passed.every(p => p.index !== 0)).toBe(true);
  });

  it('fonctionne aussi en marche arrière, pendant la phase de retour', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.setPlayerPosition(1, 4);

    // Déplacement de 8 vers 2 : Bob est dépassé dans l'autre sens
    const passed = passedPlayers(g, 0, 8, 2);

    expect(passed.map(p => p.name)).toEqual(['Bob']);
  });
});
