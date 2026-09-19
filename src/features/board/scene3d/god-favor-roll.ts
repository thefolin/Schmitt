/**
 * Ce que la case TEMPLE demande, et ce que les deux dés veulent dire.
 *
 * Quentin : « FAVEUR DES DIEUX — les 2 dés n'apparaissent pas quand on tombe
 * dessus ».
 *
 * La case du temple était la seule à ne rien déclencher dans la scène 3D :
 * elle avait une couleur et rien d'autre. Le joueur s'y posait, et le tour
 * passait au suivant comme si la case était vide.
 *
 * Ce module ne rend rien et ne lance rien : il dit seulement QUELLE faveur
 * correspond à un tirage. La règle vient de `GOD_FAVORS`, qui suit le plateau
 * physique (#34) — on ne la redécide pas ici. Séparer cette lecture du rendu
 * permet de la vérifier sans afficher un seul dé, comme pour le cadrage et la
 * marche des pions.
 */

import { GOD_FAVORS, type GodFavor } from '@/features/game/god-favors';
import type { TileConfig } from '@/core/models/Tile';

/** Le résultat d'un tirage à deux dés sur la case du temple. */
export interface FavorRoll {
  /** Les deux faces, dans l'ordre où elles ont été lues. */
  a: number;
  b: number;
  /** La somme, qui désigne la faveur. */
  sum: number;
  /** Un double, qui est la COLÈRE DES DIEUX quelle que soit sa valeur. */
  double: boolean;
  /** La faveur obtenue, telle que la table du plateau la décrit. */
  favor: GodFavor | null;
}

/** La somme minimale et maximale de deux dés à six faces. */
const MIN_SUM = 2;
const MAX_SUM = 12;

/** La COLÈRE DES DIEUX, qui punit le double. */
const WRATH_SUM = 2;

/**
 * La case qui appelle la faveur des dieux.
 *
 * C'est le type `power`, et c'est là que tenait le défaut : la case s'appelle
 * « FAVEUR DES DIEUX » sur le plateau officiel, avec son illustration
 * `powerG.png`, et le jeu qui tourne la branche bien sur le lancer de deux
 * dés. La scène 3D, elle, rangeait `power` parmi les cases qui se jouent à la
 * table : le joueur s'y posait, l'écran affichait « à jouer à la table », et
 * aucun dé n'apparaissait.
 *
 * `temple` est accepté aussi : le type existe dans le modèle et l'éditeur
 * permet de le poser, même si le plateau officiel ne l'emploie pas.
 */
export function isGodFavorTile(tile: Pick<TileConfig, 'type'> | undefined): boolean {
  return tile?.type === 'power' || tile?.type === 'temple';
}

/**
 * Ce que valent deux faces tirées sur le temple.
 *
 * LE DOUBLE EST LA COLÈRE DES DIEUX, et pas seulement le double 1. C'est ce
 * que fait le jeu qui tourne : `isDouble` y est testé avant la somme, donc un
 * double 4 — somme 8, normalement ARÈS — donne la colère. La scène 3D doit
 * dire la même chose que le jeu auquel Bastien joue, sinon deux versions du
 * même tirage coexistent.
 */
export function readFavorRoll(a: number, b: number): FavorRoll {
  const sum = a + b;
  const double = a === b;

  // Une somme hors des douze faces possibles ne désigne aucune faveur : mieux
  // vaut ne rien annoncer qu'annoncer une faveur inventée.
  const valid = Number.isFinite(sum) && sum >= MIN_SUM && sum <= MAX_SUM;

  const key = double ? WRATH_SUM : sum;

  return {
    a,
    b,
    sum,
    double,
    favor: valid ? GOD_FAVORS[key] ?? null : null,
  };
}
