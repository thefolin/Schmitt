import { describe, it, expect } from 'vitest';
import { readFavorRoll, isGodFavorTile } from '@/features/board/scene3d/god-favor-roll';
import { GOD_FAVORS } from '@/features/game/god-favors';
import type { TileConfig } from '@/core/models/Tile';

/**
 * 3D-58 — la case du temple appelle les deux dés.
 *
 * Quentin : « FAVEUR DES DIEUX — les 2 dés n'apparaissent pas quand on tombe
 * dessus. À corriger. »
 *
 * Dans la scène 3D, la case du temple avait une COULEUR et rien d'autre : le
 * joueur s'y posait et le tour passait au suivant. Elle tombait dans le cas
 * « aucun effet » de `applyDrinking`, silencieusement.
 *
 * Ce module ne décide d'aucune règle : la table des faveurs vient du plateau
 * physique (#34) et le double vient du jeu qui tourne. Il traduit un tirage,
 * et se vérifie donc sans afficher un seul dé.
 */

describe('3D-58 — reconnaître la case qui appelle la faveur', () => {
  it('reconnaît la case POWER du plateau officiel', () => {
    // C'EST ICI QUE TENAIT LE DÉFAUT. La case « FAVEUR DES DIEUX » du
    // plateau officiel est de type `power` — pas `temple`. La scène 3D la
    // rangeait parmi les cases qui se jouent à la table : le joueur s'y
    // posait, l'écran disait « à jouer à la table », et aucun dé
    // n'apparaissait.
    expect(isGodFavorTile({ type: 'power' } as TileConfig)).toBe(true);
  });

  it('reconnaît aussi le temple, que l\'éditeur permet de poser', () => {
    expect(isGodFavorTile({ type: 'temple' } as TileConfig)).toBe(true);
  });

  it('ne confond pas la faveur avec une autre case', () => {
    expect(isGodFavorTile({ type: 'drink_2' } as TileConfig)).toBe(false);
    expect(isGodFavorTile({ type: 'rule' } as TileConfig)).toBe(false);
    expect(isGodFavorTile(undefined)).toBe(false);
  });
});

describe('3D-58 — la somme des deux dés désigne la faveur', () => {
  it('donne la faveur de la somme', () => {
    // 5 + 6 = 11 : POSÉIDON, d'après la table du plateau physique.
    const roll = readFavorRoll(5, 6);

    expect(roll.sum).toBe(11);
    expect(roll.favor).toBe(GOD_FAVORS[11]);
    expect(roll.favor?.name).toBe('POSÉIDON');
  });

  it('conserve les deux faces, qu\'Artémis et Apollon utilisent', () => {
    // Ces deux faveurs demandent de garder un dé et de relancer l'autre : la
    // somme seule ne suffit donc pas, il faut savoir ce qui est sorti.
    const roll = readFavorRoll(2, 5);

    expect(roll.a).toBe(2);
    expect(roll.b).toBe(5);
  });

  it('couvre toutes les sommes possibles', () => {
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        expect(readFavorRoll(a, b).favor).not.toBeNull();
      }
    }
  });
});

describe('3D-58 — le double est la colère des dieux', () => {
  it('punit le double, quelle que soit sa valeur', () => {
    // C'EST LE PIÈGE. Un double 4 fait 8, qui est normalement ARÈS — mais le
    // jeu qui tourne teste le double AVANT la somme, et donne la colère. La
    // scène 3D doit dire la même chose que le jeu auquel Bastien joue.
    const roll = readFavorRoll(4, 4);

    expect(roll.double).toBe(true);
    expect(roll.favor?.name).toBe('COLÈRE DES DIEUX');
    expect(roll.favor).not.toBe(GOD_FAVORS[8]);
  });

  it('punit tous les doubles', () => {
    for (let face = 1; face <= 6; face++) {
      const roll = readFavorRoll(face, face);

      expect(roll.double).toBe(true);
      expect(roll.favor?.name).toBe('COLÈRE DES DIEUX');
    }
  });

  it('ne déclare pas double un tirage qui n\'en est pas un', () => {
    expect(readFavorRoll(3, 4).double).toBe(false);
    expect(readFavorRoll(3, 4).favor?.name).toBe('ARTÉMIS');
  });

  it('laisse ZEUS au double 6 seulement par la colère, pas par la somme', () => {
    // 6 + 6 = 12 donnerait ZEUS par la somme. C'est un double : la colère
    // l'emporte, comme dans le jeu qui tourne.
    expect(readFavorRoll(6, 6).favor?.name).toBe('COLÈRE DES DIEUX');
  });
});

describe('3D-58 — un tirage impossible n\'invente pas de faveur', () => {
  it('ne renvoie rien pour une somme hors des faces', () => {
    expect(readFavorRoll(0, 0).favor).toBeNull();
    expect(readFavorRoll(9, 9).favor).toBeNull();
  });
});
