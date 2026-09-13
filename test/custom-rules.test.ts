import { describe, it, expect } from 'vitest';
import { GameLogic } from '@/features/game/game.logic';

const players = [
  { name: 'Alice', color: '#f00' },
  { name: 'Bob', color: '#00f' }
];

describe('règles inventées (case CRÉEZ UNE RÈGLE)', () => {
  it('retient une règle avec son auteur', () => {
    const g = new GameLogic();
    g.startGame(players);

    g.addCustomRule('Alice', 'Interdit de dire « oui »');

    expect(g.getCustomRules()).toEqual([
      { author: 'Alice', text: 'Interdit de dire « oui »' }
    ]);
  });

  it('accumule les règles dans leur ordre de création', () => {
    const g = new GameLogic();
    g.startGame(players);

    g.addCustomRule('Alice', 'Première');
    g.addCustomRule('Bob', 'Seconde');

    expect(g.getCustomRules().map(r => r.text)).toEqual(['Première', 'Seconde']);
  });

  it('ignore une règle vide ou faite d\'espaces', () => {
    const g = new GameLogic();
    g.startGame(players);

    g.addCustomRule('Alice', '   ');
    g.addCustomRule('Alice', '');

    expect(g.getCustomRules()).toHaveLength(0);
  });

  it('tronque une règle trop longue pour rester affichable', () => {
    const g = new GameLogic();
    g.startGame(players);

    g.addCustomRule('Alice', 'x'.repeat(300));

    expect(g.getCustomRules()[0].text).toHaveLength(140);
  });

  it('laisse une trace dans l\'historique', () => {
    const g = new GameLogic();
    g.startGame(players);

    g.addCustomRule('Alice', 'Interdit de rire');

    expect(g.getHistory().some(h => h.includes('Interdit de rire'))).toBe(true);
  });

  it('ne renvoie pas la liste interne : la modifier ne change rien', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.addCustomRule('Alice', 'Une règle');

    g.getCustomRules().push({ author: 'Pirate', text: 'Injectée' });

    expect(g.getCustomRules()).toHaveLength(1);
  });

  it('oublie les règles quand une nouvelle partie commence', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.addCustomRule('Alice', 'Ancienne règle');

    g.startGame(players);

    expect(g.getCustomRules()).toHaveLength(0);
  });

  it('oublie les règles après un reset', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.addCustomRule('Alice', 'Ancienne règle');

    g.reset();

    expect(g.getCustomRules()).toHaveLength(0);
  });
});

describe('journal des évènements de case', () => {
  it('logEvent ajoute une entrée lisible dans l\'historique', () => {
    const g = new GameLogic();
    g.startGame(players);
    const before = g.getHistory().length;

    g.logEvent('Alice suit Bob case 7');

    expect(g.getHistory()).toHaveLength(before + 1);
    expect(g.getHistory().at(-1)).toBe('Alice suit Bob case 7');
  });
});
