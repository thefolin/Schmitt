import { describe, it, expect } from 'vitest';
import { GOD_FAVORS, getGodFavor, findNeighbors } from '@/features/game/god-favors';

describe('GOD_FAVORS mapping', () => {
  it('couvre exactement les sommes possibles de 2 dés (2 à 12)', () => {
    const sums = Object.keys(GOD_FAVORS).map(Number).sort((a, b) => a - b);
    expect(sums).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('chaque faveur a un nom, une icône et une description non vides', () => {
    for (const sum of Object.keys(GOD_FAVORS).map(Number)) {
      const favor = GOD_FAVORS[sum];
      expect(favor.name.length).toBeGreaterThan(0);
      expect(favor.icon.length).toBeGreaterThan(0);
      expect(favor.description.length).toBeGreaterThan(0);
    }
  });

  it('associe la bonne divinité à chaque somme (règles du jeu)', () => {
    // La table du PLATEAU PHYSIQUE, arbitrée par Quentin (#34). Elle était
    // décalée d'un cran sur les sommes 3 à 7 : ATHÉNA en 4 au lieu de 3, et
    // chaque faveur suivante héritait de la place de la précédente.
    expect(getGodFavor(2)?.name).toBe('COLÈRE DES DIEUX');
    expect(getGodFavor(3)?.name).toBe('ATHÉNA');
    expect(getGodFavor(4)?.name).toBe('APHRODITE');
    expect(getGodFavor(5)?.name).toBe('HERMÈS');
    expect(getGodFavor(6)?.name).toBe('APOLLON');
    expect(getGodFavor(7)?.name).toBe('ARTÉMIS');
    expect(getGodFavor(8)?.name).toBe('ARÈS');
    expect(getGodFavor(9)?.name).toBe('DIONYSOS');
    expect(getGodFavor(10)?.name).toBe('HÉPHAÏSTOS');
    expect(getGodFavor(11)?.name).toBe('POSÉIDON');
    expect(getGodFavor(12)?.name).toBe('ZEUS - FAVEUR SUPRÊME');
  });

  it('ne contient plus « Jugement dernier »', () => {
    // Implémentée mais absente du plateau physique : Quentin l'a supprimée.
    const names = Object.values(GOD_FAVORS).map(f => f.name);

    expect(names).not.toContain('JUGEMENT DERNIER');
  });

  it('donne à chaque somme une divinité distincte', () => {
    // Un décalage de table laisse facilement deux sommes sur la même faveur,
    // et le défaut passe inaperçu tant qu'on ne les compare pas toutes.
    const names = Object.values(GOD_FAVORS).map(f => f.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it('retourne undefined pour une somme hors plage (1 dé seul, ou valeur impossible)', () => {
    expect(getGodFavor(1)).toBeUndefined();
    expect(getGodFavor(13)).toBeUndefined();
    expect(getGodFavor(0)).toBeUndefined();
  });
});

describe('findNeighbors', () => {
  it('retourne null/null quand il n\'y a qu\'un seul joueur', () => {
    expect(findNeighbors(0, 1)).toEqual({ left: null, right: null });
  });

  it('retourne null/null quand il n\'y a aucun joueur', () => {
    expect(findNeighbors(0, 0)).toEqual({ left: null, right: null });
  });

  it('calcule les voisins gauche/droite pour un joueur au milieu', () => {
    // 4 joueurs [0,1,2,3], joueur 1 -> gauche=0, droite=2
    expect(findNeighbors(1, 4)).toEqual({ left: 0, right: 2 });
  });

  it('boucle correctement pour le premier joueur (voisin gauche = dernier)', () => {
    expect(findNeighbors(0, 4)).toEqual({ left: 3, right: 1 });
  });

  it('boucle correctement pour le dernier joueur (voisin droite = premier)', () => {
    expect(findNeighbors(3, 4)).toEqual({ left: 2, right: 0 });
  });

  it('avec 2 joueurs, gauche et droite pointent vers le même adversaire', () => {
    // Cas dégénéré mais valide : (0-1+2)%2=1 et (0+1)%2=1
    expect(findNeighbors(0, 2)).toEqual({ left: 1, right: 1 });
  });
});
