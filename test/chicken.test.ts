import { describe, it, expect } from 'vitest';
import { GameLogic } from '@/features/game/game.logic';

const players = [
  { name: 'Alice', color: '#f00' },
  { name: 'Bob', color: '#00f' },
  { name: 'Chloé', color: '#0f0' }
];

describe('règle du Poulet', () => {
  it('le premier joueur à tomber sur la case devient Petit Poulet', () => {
    const g = new GameLogic();
    g.startGame(players);

    expect(g.setChicken(0)).toBe(1);
    expect(g.getChickenPlayerIndex()).toBe(0);
  });

  it('le même joueur qui retombe dessus devient Grand Poulet', () => {
    const g = new GameLogic();
    g.startGame(players);

    g.setChicken(0);
    expect(g.setChicken(0)).toBe(2);
    expect(g.getChickenRank()).toBe(2);
  });

  it("un autre joueur reprend la place et remet le rang à Petit Poulet", () => {
    const g = new GameLogic();
    g.startGame(players);

    g.setChicken(0);
    g.setChicken(0);            // Alice est Grand Poulet
    expect(g.setChicken(1)).toBe(1); // Bob prend la place, rang réinitialisé
    expect(g.getChickenPlayerIndex()).toBe(1);
  });

  it("après interruption, l'ancien poulet repart de Petit Poulet", () => {
    const g = new GameLogic();
    g.startGame(players);

    g.setChicken(0);
    g.setChicken(0);   // Alice : Grand Poulet
    g.setChicken(1);   // Bob l'interrompt
    // Alice doit repasser par Petit Poulet, la montée n'est pas conservée
    expect(g.setChicken(0)).toBe(1);
  });

  it('ne dépasse jamais le rang de Grand Poulet', () => {
    const g = new GameLogic();
    g.startGame(players);

    g.setChicken(0);
    g.setChicken(0);
    g.setChicken(0);
    g.setChicken(0);
    expect(g.getChickenRank()).toBe(2);
  });

  /**
   * SCH-16 — verrouillage d'un comportement déclaré correct.
   *
   * Bastien a signalé le 18/09 qu'un Petit Poulet retombant sur la case ne
   * devenait jamais Gros Poulet (capture 00000039). Vérification faite, la
   * règle était bien appliquée : c'est l'ABSENCE de marque sur le pion qui
   * rendait la promotion invisible (corrigé par SCH-17). L'issue a été fermée
   * en « not planned », et ce test empêche une régression silencieuse.
   */
  it('le cas signalé par Bastien : promotion sur la seconde case Poulet', () => {
    const g = new GameLogic();
    g.startGame(players);

    // Le plateau officiel porte deux cases Poulet, en positions 5 et 17 :
    // un même joueur peut donc y passer deux fois dans une partie.
    expect(g.setChicken(0)).toBe(1);
    expect(g.getPlayers()[0].chickenRank).toBe(1);

    expect(g.setChicken(0)).toBe(2);
    expect(g.getPlayers()[0].chickenRank).toBe(2);

    // Et la promotion change bien la sentence : il distribue au lieu de boire.
    expect(g.applyChickenPenalty(6)?.distributes).toBe(true);
    expect(g.getPlayers()[0].drinks).toBe(0);
  });

  it('une nouvelle partie remet le poulet à zéro', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.setChicken(2);

    g.startGame(players);
    expect(g.getChickenPlayerIndex()).toBeNull();
    expect(g.getChickenRank()).toBe(0);
  });
});

describe('sentence du Poulet sur les 3 et 6', () => {
  it('le Petit Poulet boit 1 gorgée sur un 3', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.setChicken(0);

    const verdict = g.applyChickenPenalty(3);

    expect(verdict?.distributes).toBe(false);
    expect(g.getPlayers()[0].drinks).toBe(1);
  });

  it('le Petit Poulet boit aussi sur un 6', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.setChicken(0);

    g.applyChickenPenalty(6);

    expect(g.getPlayers()[0].drinks).toBe(1);
  });

  it('ne se déclenche sur aucune autre valeur', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.setChicken(0);

    [1, 2, 4, 5].forEach(v => expect(g.applyChickenPenalty(v)).toBeNull());
    expect(g.getPlayers()[0].drinks).toBe(0);
  });

  it('ne fait rien tant que personne n\'est Poulet', () => {
    const g = new GameLogic();
    g.startGame(players);

    expect(g.applyChickenPenalty(3)).toBeNull();
  });

  it('le GROS POULET distribue au lieu de boire', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.setChicken(0);
    g.setChicken(0); // promotion

    const verdict = g.applyChickenPenalty(3);

    expect(verdict?.distributes).toBe(true);
    expect(g.getPlayers()[0].drinks).toBe(0); // il ne boit pas
  });

  it('suit le changement de Poulet', () => {
    const g = new GameLogic();
    g.startGame(players);
    g.setChicken(0);
    g.setChicken(1); // Bob prend la place

    g.applyChickenPenalty(3);

    expect(g.getPlayers()[0].drinks).toBe(0);
    expect(g.getPlayers()[1].drinks).toBe(1);
  });
});
