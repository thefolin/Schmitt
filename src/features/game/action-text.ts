import type { TileConfig } from '@/core/models/Tile';

/**
 * Le symbole qui remplace le mot « gorgée » dans toute l'interface (SCH-12).
 *
 * Demande de Bastien : « Remplacez de manière générale tous les mots
 * [gorgées] par le logo [🍺] ». Le nombre reste écrit : « 4 🍺 ».
 */
export const GULP = '\u{1F37A}';

/**
 * Remplace le mot « gorgée(s) » par 🍺 dans un texte libre.
 *
 * Les descriptions des faveurs des dieux sont des phrases rédigées, écrites à
 * la main et parfois reprises des règles officielles : les réécrire une à une
 * les ferait diverger du texte de référence. On substitue donc à l'affichage.
 *
 * Le nombre qui précède est conservé — « 2 gorgées » devient « 2 🍺 ».
 */
export function withGulpSymbol(text: string): string {
  return text.replace(/\bgorgées?\b/gi, GULP);
}

/**
 * Quantité de gorgées portée par une case, et sens de l'action.
 *
 * `amount` n'est renseigné que sur les cases chiffrées ; le type porte le
 * reste. Une case « TOURNÉE GÉNÉRALE » vaut 1 gorgée pour tout le monde sans
 * l'écrire nulle part, d'où le repli sur 1.
 */
function readGulps(tile: TileConfig): number {
  if (typeof tile.amount === 'number') return tile.amount;

  const fromType = /_(\d+)$/.exec(tile.type);
  if (fromType) return parseInt(fromType[1], 10);

  return 1;
}

/**
 * Le texte principal d'un écran d'action : qui fait quoi, en une ligne.
 *
 * Trois demandes de Bastien convergent ici :
 *  - SCH-13 : le nom du joueur doit figurer dans le texte en gros ;
 *  - SCH-12 : « gorgées » s'écrit 🍺 ;
 *  - SCH-11 : ce texte est le SEUL affiché, le sous-titre ne le répète pas.
 *
 * Le verbe suit le sens réel de l'action : un joueur qui distribue ne
 * « reçoit » pas. Bastien a donné « JOUEUR X Reçoit N 🍺 » à partir du cas du
 * Petit Poulet, qui subit — le motif se décline, il ne se recopie pas.
 *
 * Renvoie `null` quand la case n'est pas une action chiffrée (START, MOUTON,
 * FAVEUR DES DIEUX…) : ces écrans gardent leur propre libellé.
 */
export function buildActionText(tile: TileConfig, playerName: string): string | null {
  const gulps = readGulps(tile);

  switch (tile.type) {
    case 'drink_2':
    case 'drink_3':
    case 'drink_4':
    case 'drink_5':
      return `${playerName} reçoit ${gulps} ${GULP}`;

    case 'distribute_2':
    case 'distribute_3':
    case 'distribute_4':
      return `${playerName} distribue ${gulps} ${GULP}`;

    case 'give_2':
    case 'give_3':
    case 'give_4':
      return `${playerName} donne ${gulps} ${GULP}`;

    case 'everyone_drinks':
      // Personne n'est nommé : l'action vise tout le monde, y compris celui
      // qui vient de jouer. Le nommer laisserait croire qu'il est seul visé.
      return `Tout le monde reçoit ${gulps} ${GULP}`;

    default:
      return null;
  }
}

/**
 * Le sous-titre d'un écran d'action.
 *
 * SCH-11 : « Le texte est répété 2 fois. » Le titre et la description des
 * cases chiffrées disent littéralement la même chose (« BUVEZ 4 GORGÉES » /
 * « Buvez 4 gorgées »). Un sous-titre qui n'apporte rien est donc supprimé,
 * plutôt que corrigé case par case dans les données — la règle vaut aussi
 * pour les plateaux que les joueurs composeront.
 *
 * La comparaison ignore casse, accents et ponctuation : c'est la même phrase
 * qui compte, pas son orthographe exacte.
 */
export function buildSubtitle(tile: TileConfig, mainText: string | null): string {
  const description = tile.description?.trim();
  if (!description) return '';

  // Quand le texte principal énonce déjà l'action chiffrée, la description ne
  // peut que la redire autrement — « Tout le monde reçoit 1 🍺 » suivi de
  // « Tous les joueurs boivent 1 🍺 ». Une reformulation reste une répétition.
  if (mainText) return '';

  if (saysTheSame(tile.name, description)) return '';

  return withGulpSymbol(description);
}

/** Deux textes disent-ils la même chose, à la forme près ? */
function saysTheSame(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

function normalize(text: string): string {
  return withGulpSymbol(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents
    .toLowerCase()
    .replace(/[^a-z0-9\u{1F37A}]/gu, '');
}
