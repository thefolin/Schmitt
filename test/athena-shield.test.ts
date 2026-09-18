import { describe, it, expect } from 'vitest';
import { GameLogic } from '@/features/game/game.logic';
import { getPawnBadges } from '@/features/board/camera/pawn-badges';

/**
 * SCH-25 — la faveur d'Athéna.
 *
 * Règle, telle qu'écrite dans god-favors.ts (faveur 4) :
 * « Choisissez un objet bouclier. Ce bouclier renvoie 1 seule fois toutes les
 * gorgées/cul-sec sur le joueur de votre choix. Tant que vous possédez le
 * bouclier, vous ne pouvez pas gagner. »
 *
 * `hasAthenaShield` existait dans le modèle depuis l'origine mais rien ne le
 * mettait jamais à vrai : la faveur portait un `// TODO`. Le badge livré par
 * SCH-18 était donc dormant.
 */

const players = [
  { name: 'Alice', color: '#f00' },
  { name: 'Bob', color: '#0f0' },
  { name: 'Chloé', color: '#00f' },
];

function startedGame(): GameLogic {
  const g = new GameLogic();
  g.startGame(players);
  return g;
}

describe('SCH-25 — obtenir le bouclier', () => {
  it('la faveur attribue le bouclier à son porteur', () => {
    const g = startedGame();

    expect(g.grantAthenaShield(0)).toBe(true);
    expect(g.getPlayers()[0].hasAthenaShield).toBe(true);
  });

  it('ne le donne pas deux fois au même joueur', () => {
    const g = startedGame();
    g.grantAthenaShield(0);

    expect(g.grantAthenaShield(0)).toBe(false);
  });

  it('rend le badge 🛡️ visible — le critère de recette de SCH-18', () => {
    const g = startedGame();
    g.grantAthenaShield(0);

    expect(getPawnBadges(g.getPlayers()[0]).map(b => b.icon)).toContain('🛡️');
  });

  it('une nouvelle partie efface le bouclier', () => {
    const g = startedGame();
    g.grantAthenaShield(0);

    g.startGame(players);

    expect(g.getPlayers().every(p => !p.hasAthenaShield)).toBe(true);
    expect(g.getPendingShield()).toBeNull();
  });
});

describe('SCH-25 — le bouclier renvoie la sanction', () => {
  it('retient les gorgées au lieu de les faire boire', () => {
    const g = startedGame();
    g.grantAthenaShield(0);

    g.addDrinks(0, 3);

    expect(g.getPlayers()[0].drinks).toBe(0);
    expect(g.getPendingShield()).toEqual({ playerIndex: 0, amount: 3 });
  });

  it('les renvoie sur la cible choisie', () => {
    const g = startedGame();
    g.grantAthenaShield(0);
    g.addDrinks(0, 3);

    expect(g.useAthenaShield(2)).toBe(true);

    expect(g.getPlayers()[0].drinks).toBe(0);
    expect(g.getPlayers()[2].drinks).toBe(3);
  });

  it('couvre le cul-sec autant que les gorgées', () => {
    // « toutes les gorgées/cul-sec » : le cul-sec de la Colère des dieux
    // passe par le même compteur, il est donc renvoyé lui aussi.
    const g = startedGame();
    g.grantAthenaShield(1);

    g.addDrinks(1, 1); // faveur 2 — colère des dieux
    g.useAthenaShield(0);

    expect(g.getPlayers()[1].drinks).toBe(0);
    expect(g.getPlayers()[0].drinks).toBe(1);
  });

  it('ne sert QU\'UNE seule fois', () => {
    const g = startedGame();
    g.grantAthenaShield(0);

    g.addDrinks(0, 2);
    g.useAthenaShield(1);
    expect(g.getPlayers()[0].hasAthenaShield).toBe(false);

    // La sanction suivante est bue normalement
    g.addDrinks(0, 4);

    expect(g.getPlayers()[0].drinks).toBe(4);
    expect(g.getPendingShield()).toBeNull();
  });

  it('ne déclenche pas de réaction en chaîne entre deux boucliers', () => {
    // La cible porte elle aussi un bouclier : elle boit, et garde le sien
    // pour plus tard. Un renvoi est un renvoi, pas une cascade.
    const g = startedGame();
    g.grantAthenaShield(0);
    g.grantAthenaShield(1);

    g.addDrinks(0, 5);
    g.useAthenaShield(1);

    expect(g.getPlayers()[1].drinks).toBe(5);
    expect(g.getPlayers()[1].hasAthenaShield).toBe(true);
    expect(g.getPendingShield()).toBeNull();
  });

  it('ne retient rien quand le joueur n\'a pas de bouclier', () => {
    const g = startedGame();

    g.addDrinks(0, 2);

    expect(g.getPlayers()[0].drinks).toBe(2);
    expect(g.getPendingShield()).toBeNull();
  });

  it('ignore une demande de renvoi sans sanction en attente', () => {
    const g = startedGame();
    g.grantAthenaShield(0);

    expect(g.useAthenaShield(1)).toBe(false);
    expect(g.getPlayers()[0].hasAthenaShield).toBe(true);
  });

  it('fait retomber la sanction sur le porteur si le renvoi est abandonné', () => {
    // La sanction ne doit jamais s'évaporer parce qu'une fenêtre s'est fermée.
    const g = startedGame();
    g.grantAthenaShield(0);
    g.addDrinks(0, 3);

    g.cancelPendingShield();

    expect(g.getPlayers()[0].drinks).toBe(3);
    expect(g.getPlayers()[0].hasAthenaShield).toBe(true);
    expect(g.getPendingShield()).toBeNull();
  });
});

describe('SCH-25 — le bouclier interdit de gagner', () => {
  /** Amène un joueur sur START en phase de retour : la position gagnante. */
  function atVictoryPoint(g: GameLogic, index: number): void {
    g.setPlayerPosition(index, g.getLastPosition());
    g.claimSchmittPower(index);
    g.setPlayerPosition(index, 5);
    g.movePlayer(index, 5); // quitte START puis y revient
    g.setPlayerPosition(index, 0);
  }

  it('sans bouclier, le retour sur START fait gagner', () => {
    const g = startedGame();
    atVictoryPoint(g, 0);

    expect(g.checkVictory()?.name).toBe('Alice');
  });

  it('avec le bouclier, la victoire est refusée', () => {
    const g = startedGame();
    atVictoryPoint(g, 0);
    g.grantAthenaShield(0);

    expect(g.checkVictory()).toBeNull();
  });

  it('la victoire revient dès que le bouclier est consommé', () => {
    const g = startedGame();
    atVictoryPoint(g, 0);
    g.grantAthenaShield(0);
    expect(g.checkVictory()).toBeNull();

    g.addDrinks(0, 1);
    g.useAthenaShield(1);

    expect(g.checkVictory()?.name).toBe('Alice');
  });

  it('ne bloque que le porteur, pas les autres', () => {
    const g = startedGame();
    g.grantAthenaShield(0);
    atVictoryPoint(g, 1);

    expect(g.checkVictory()?.name).toBe('Bob');
  });

  it('signale le joueur retenu sur START par son bouclier', () => {
    // Sans ce signal, le joueur verrait la partie continuer sans comprendre.
    const g = startedGame();
    atVictoryPoint(g, 0);
    g.grantAthenaShield(0);

    expect(g.isBlockedByShield(0)).toBe(true);
    expect(g.isBlockedByShield(1)).toBe(false);
  });

  it('ne signale rien tant que le joueur n\'est pas revenu sur START', () => {
    const g = startedGame();
    g.setPlayerPosition(2, g.getLastPosition());
    g.claimSchmittPower(2);
    g.grantAthenaShield(0);
    g.setPlayerPosition(0, 4);

    expect(g.isBlockedByShield(0)).toBe(false);
  });
});
