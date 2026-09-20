/**
 * Le MODE CINÉMA : regarder le dé, puis revenir au plateau.
 *
 * Deux façons de lancer, au choix du joueur :
 *
 *   - MODE PLATEAU (défaut) — le dé roule au milieu du jeu, on voit les cases
 *     et les pions autour. C'est ce que fait la scène aujourd'hui.
 *   - MODE CINÉMA — la vue se resserre sur le dé seul, le HUD s'efface, le
 *     résultat reste lisible un instant, puis la vue s'élargit jusqu'au
 *     plateau.
 *
 * CE N'EST PAS UNE SECONDE SCÈNE. Le dé, la physique et la caméra sont les
 * mêmes : seuls le CADRE et ce qu'on affiche par-dessus changent. Monter un
 * rendu parallèle pour l'occasion doublerait tout ce que la refonte vient de
 * réunir, et les deux finiraient par diverger — c'est déjà l'histoire du
 * rendu CSS et du rendu 3D.
 *
 * Quentin a tranché pour un MVP AU BOUTON (via PO, 20/09/2026) : pas de
 * détection de secousse. Deux raisons tenaient à la technique — certains
 * Android demandent une permission explicite pour les capteurs, donc il faut
 * de toute façon un chemin qui marche sans — et une au jeu : c'est un jeu à
 * boire, et un téléphone qu'on secoue en soirée demande son avis avant
 * d'être codé.
 *
 * Module PUR : il décide, il n'affiche rien et ne touche pas à la scène.
 */

/** Où le choix du joueur est rangé d'une partie à l'autre. */
export const CINEMA_KEY = 'schmitt-cinema-mode';

/**
 * Le mode par défaut.
 *
 * PLATEAU, et non cinéma : c'est le jeu tel que Quentin l'a validé jusqu'ici,
 * et un joueur qui n'a rien demandé ne doit pas voir son plateau disparaître
 * au premier lancer.
 */
export const CINEMA_DEFAULT = false;

/**
 * Le cadre du lancer en mode cinéma, en cases.
 *
 * Trois cases plutôt que les onze du mode plateau : c'est ce resserrement qui
 * FAIT le mode cinéma — le dé occupe l'écran au lieu d'être un objet parmi
 * les cases. En dessous, le dé sortirait du cadre en roulant.
 */
export const CINEMA_SPAN_TILES = 3;

/**
 * Combien de temps le résultat reste à l'écran avant que la vue s'élargisse.
 *
 * Assez pour lire la face et la reconnaître, pas assez pour que le tour
 * traîne. C'est le même ordre de grandeur que les quatre secondes pendant
 * lesquelles les deux dés du temple restent posés — mais plus court, parce
 * qu'il n'y a qu'une face à lire et pas de somme à recompter.
 */
export const CINEMA_HOLD_MS = 2200;

/**
 * Lit le choix rangé par une partie précédente.
 *
 * Tout accès au stockage est gardé : en navigation privée, ou quand le site
 * a ses données bloquées, la lecture JETTE au lieu de renvoyer vide. Un
 * réglage d'affichage ne doit jamais empêcher le jeu de démarrer.
 */
export function readCinemaMode(store?: Storage): boolean {
  const storage = store ?? safeStorage();
  if (!storage) return CINEMA_DEFAULT;

  try {
    const value = storage.getItem(CINEMA_KEY);
    if (value === null) return CINEMA_DEFAULT;

    return value === 'true';
  } catch {
    return CINEMA_DEFAULT;
  }
}

/**
 * Range le choix du joueur.
 *
 * Renvoie ce qui a été demandé même si l'écriture échoue : le mode s'applique
 * alors pour la partie en cours, et sera simplement oublié à la suivante.
 * Refuser le changement parce qu'on ne peut pas le mémoriser serait punir le
 * joueur pour un réglage de son navigateur.
 */
export function writeCinemaMode(on: boolean, store?: Storage): boolean {
  const storage = store ?? safeStorage();

  try {
    storage?.setItem(CINEMA_KEY, String(on));
  } catch {
    // Quota plein, ou stockage interdit : sans effet sur la partie en cours.
  }

  return on;
}

/** Bascule le réglage et renvoie sa nouvelle valeur. */
export function toggleCinemaMode(store?: Storage): boolean {
  return writeCinemaMode(!readCinemaMode(store), store);
}

/**
 * Le cadre à donner au lancer, en unités du monde.
 *
 * Une seule fonction pour les deux modes : c'est la seule chose qui les
 * sépare côté caméra, et la garder ici évite qu'un `if` se promène dans le
 * code de lancer.
 */
export function rollSpan(cinema: boolean, tileSize: number, boardTiles: number): number {
  return (cinema ? CINEMA_SPAN_TILES : boardTiles) * tileSize;
}

/**
 * L'accès au stockage, ou `null` s'il n'y en a pas.
 *
 * `localStorage` n'existe pas côté serveur, et son simple ACCÈS jette dans
 * certains navigateurs quand les données du site sont bloquées — d'où le
 * try/catch autour de la lecture de la propriété elle-même, et pas seulement
 * autour de `getItem`.
 */
function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;

    return window.localStorage ?? null;
  } catch {
    return null;
  }
}
