/**
 * Les joueurs d'une partie, retenus d'une soirée à l'autre.
 *
 * LE DÉFAUT QUE CELA CORRIGE : la scène 3D démarrait sur trois joueurs
 * écrits en dur — Alice, Bastien, Chloé. Impossible de jouer à quatre, de se
 * nommer, de choisir sa couleur. Sur un jeu à boire qui se joue en soirée,
 * c'est bloquant : personne ne veut s'appeler Chloé toute la partie.
 *
 * LA LOGIQUE N'EST PAS RÉÉCRITE. Le rendu CSS la tient depuis longtemps dans
 * `main-camera.ts`, avec ses garde-fous durement acquis — la validation de ce
 * qui sort du stockage, le repli en navigation privée, le plafond sur la
 * longueur des noms. Elle est SORTIE ici pour que les deux rendus la
 * partagent : deux copies finiraient par diverger, et c'est la duplication
 * que toute la refonte supprime.
 *
 * Module PUR : il ne touche ni au DOM ni à la scène, et se vérifie sans rien
 * afficher.
 */

/** Un joueur en cours de saisie, avant que la partie commence. */
export interface PlayerDraft {
  name: string;
  color: string;
}

/** Où les brouillons sont rangés d'une partie à l'autre. */
export const PLAYER_DRAFTS_KEY = 'schmitt-player-drafts';

/**
 * Bornes du nombre de joueurs.
 *
 * Deux au minimum : le jeu fait boire les autres, il lui faut un autre. Dix
 * au maximum, comme sur le rendu CSS — au-delà, un tour de table dure plus
 * longtemps que l'attention des joueurs.
 */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

/** Longueur d'un nom, au-delà de laquelle il déborde du pion et du journal. */
export const MAX_NAME_LENGTH = 20;

/**
 * Les couleurs proposées, dans l'ordre.
 *
 * Reprises du rendu CSS pour qu'un joueur retrouve SA couleur en passant
 * d'un rendu à l'autre : c'est à elle qu'on reconnaît son pion.
 */
export const PLAYER_COLORS = [
  '#e2483d',
  '#3d7fc4',
  '#2f8f4e',
  '#c9a227',
  '#8e5bbd',
  '#d97f2b',
  '#43a5a5',
  '#c4477f',
  '#6b7f3a',
  '#7a6a5d',
] as const;

/** Les joueurs par défaut, quand rien n'a jamais été rangé. */
export function defaultDrafts(): PlayerDraft[] {
  return Array.from({ length: MIN_PLAYERS }, (_, index) => ({
    name: `Joueur ${index + 1}`,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
  }));
}

/**
 * Relit les joueurs rangés par une partie précédente.
 *
 * TOUT CE QUI SORT DU STOCKAGE EST SUSPECT : il est partagé avec le reste du
 * site, il survit aux versions, et une valeur écrite par un autre code — ou
 * par une version antérieure du jeu — ne doit pas faire planter le
 * démarrage. Chaque entrée est donc validée, et on retombe sur les joueurs
 * par défaut au moindre doute.
 */
export function readDrafts(store?: Storage): PlayerDraft[] {
  const storage = store ?? safeStorage();
  if (!storage) return defaultDrafts();

  try {
    const raw = storage.getItem(PLAYER_DRAFTS_KEY);
    if (!raw) return defaultDrafts();

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultDrafts();

    const drafts = parsed
      .filter(
        (draft): draft is PlayerDraft =>
          typeof draft?.name === 'string' && typeof draft?.color === 'string'
      )
      .slice(0, MAX_PLAYERS)
      .map(draft => ({
        name: draft.name.slice(0, MAX_NAME_LENGTH),
        color: draft.color,
      }));

    return drafts.length >= MIN_PLAYERS ? drafts : defaultDrafts();
  } catch {
    // Stockage illisible, ou JSON abîmé : on joue quand même.
    return defaultDrafts();
  }
}

/**
 * Range les joueurs pour la prochaine partie.
 *
 * Au mieux : une sauvegarde qui échoue ne doit JAMAIS empêcher de jouer. En
 * navigation privée, le joueur perdra ses noms à la fermeture — c'est un
 * désagrément, pas une panne.
 */
export function saveDrafts(drafts: PlayerDraft[], store?: Storage): void {
  const storage = store ?? safeStorage();

  try {
    storage?.setItem(PLAYER_DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // Quota plein, ou stockage interdit : sans effet sur la partie en cours.
  }
}

/**
 * Prépare les joueurs pour `GameLogic`.
 *
 * Deux corrections y sont faites, et elles ne sont pas cosmétiques :
 *
 *   - un nom VIDE devient « Joueur N ». Le nom sert à désigner qui boit :
 *     « distribue 3 🍺 » sans nom ne dit rien à personne.
 *   - deux joueurs de la MÊME COULEUR sont départagés. C'est à la couleur
 *     qu'on reconnaît son pion sur le plateau ; deux pions identiques
 *     rendraient la partie injouable.
 */
export function toPlayers(drafts: PlayerDraft[]): PlayerDraft[] {
  const used = new Set<string>();

  return drafts.map((draft, index) => {
    const name = draft.name.trim() || `Joueur ${index + 1}`;

    let color = draft.color;
    if (used.has(color)) {
      color =
        PLAYER_COLORS.find(candidate => !used.has(candidate)) ??
        PLAYER_COLORS[index % PLAYER_COLORS.length];
    }
    used.add(color);

    return { name: name.slice(0, MAX_NAME_LENGTH), color };
  });
}

/** Peut-on encore ajouter un joueur ? */
export function canAdd(drafts: PlayerDraft[]): boolean {
  return drafts.length < MAX_PLAYERS;
}

/** Peut-on encore en retirer un ? */
export function canRemove(drafts: PlayerDraft[]): boolean {
  return drafts.length > MIN_PLAYERS;
}

/** Ajoute un joueur, avec la première couleur encore libre. */
export function addDraft(drafts: PlayerDraft[]): PlayerDraft[] {
  if (!canAdd(drafts)) return drafts;

  const used = new Set(drafts.map(draft => draft.color));
  const color =
    PLAYER_COLORS.find(candidate => !used.has(candidate)) ??
    PLAYER_COLORS[drafts.length % PLAYER_COLORS.length];

  return [...drafts, { name: `Joueur ${drafts.length + 1}`, color }];
}

/** Retire le joueur du rang donné. */
export function removeDraft(drafts: PlayerDraft[], index: number): PlayerDraft[] {
  if (!canRemove(drafts)) return drafts;

  return drafts.filter((_, rank) => rank !== index);
}

/**
 * L'accès au stockage, ou `null` s'il n'y en a pas.
 *
 * Son simple ACCÈS jette dans certains navigateurs quand les données du site
 * sont bloquées — d'où le try/catch autour de la lecture de la propriété
 * elle-même, et pas seulement autour de `getItem`.
 */
function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;

    return window.localStorage ?? null;
  } catch {
    return null;
  }
}
