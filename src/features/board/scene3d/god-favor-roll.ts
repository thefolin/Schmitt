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
 * ATHÉNA, la seule faveur qui LAISSE QUELQUE CHOSE derrière elle.
 *
 * Les autres se résolvent dans le tour où elles tombent. Le bouclier se
 * garde jusqu'à ce qu'une sanction arrive, et il interdit de gagner tant
 * qu'on le porte : c'est un état du joueur, pas une annonce.
 *
 * Nommé ici plutôt qu'écrit en clair dans le moteur de tour : la somme vient
 * de `GOD_FAVORS`, et un 3 perdu au milieu d'une condition ne dit pas de
 * quelle faveur il parle.
 */
export const ATHENA_SUM = 3;

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

/**
 * Ce tirage donne-t-il le bouclier d'Athéna ?
 *
 * La question posée est « quelle FAVEUR a été obtenue », pas « quelle somme
 * est sortie ». Les deux ne coïncident pas : un double est la colère quelle
 * que soit sa valeur, et c'est déjà ce que `readFavorRoll` tranche.
 *
 * Aucun double ne peut faire 3, qui est impair — le garde-fou ne sert donc
 * pas à écarter un cas connu. Il est là pour que la règle reste juste si
 * `ATHENA_SUM` changeait un jour : la lecture du tirage resterait alors la
 * seule autorité, au lieu que deux fichiers décident séparément.
 */
export function grantsAthenaShield(roll: FavorRoll): boolean {
  return !roll.double && roll.sum === ATHENA_SUM;
}

/**
 * Deux faces qui donnent la somme demandée — pour la recette seulement.
 *
 * POURQUOI ÇA EXISTE : Aphrodite sort sur 1+3 ou 3+1, soit deux jets sur
 * trente-six, et encore faut-il être tombé sur un temple. Une faveur sur
 * dix-huit : la tester en jouant est impraticable.
 *
 * UN DOUBLE EST LA COLÈRE DES DIEUX, quelle que soit sa valeur. Les faces
 * rendues ne sont donc JAMAIS égales, sauf pour la somme 2, qui n'existe
 * qu'en double (1+1) — demander la Colère donne bien un double, et demander
 * Aphrodite ne peut pas tomber par accident sur elle.
 *
 * Renvoie `null` pour une somme qu'aucun couple de dés ne peut produire, ou
 * quand rien n'est demandé.
 */
export function forcedFaces(sum: number | null): [number, number] | null {
  if (sum === null) return null;
  if (!Number.isInteger(sum) || sum < MIN_SUM || sum > MAX_SUM) return null;

  // La somme 2 n'existe qu'en 1+1, et c'est justement la Colère des dieux.
  if (sum === 2) return [1, 1];

  // La somme 12 n'existe qu'en 6+6 : elle EST un double, donc la Colère.
  // ZEUS (12) est inatteignable autrement — c'est la table du plateau qui
  // le veut, pas une limite d'ici.
  if (sum === 12) return [6, 6];

  // Ailleurs, on écarte les deux faces pour ne pas produire un double : le
  // premier dé prend la plus petite valeur possible qui laisse un écart.
  const a = Math.max(1, sum - 6);
  const b = sum - a;

  // Un couple égal ne peut survenir que sur une somme paire : on décale.
  if (a === b) return [a - 1, b + 1];

  return [a, b];
}
