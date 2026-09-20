/**
 * Ce qu'Aphrodite fait aux pions, avant qu'on l'affiche.
 *
 * « Lancez 2 dés, choisissez 2 adversaires et associez 1 dé à chacun.
 * Déplacez-les en avant ou arrière. Ils appliquent l'effet de leur nouvel
 * emplacement. » — la faveur de somme 4.
 *
 * CE MODULE NE DÉCIDE D'AUCUNE RÈGLE et n'affiche rien. Il prend les choix
 * déjà faits — qui, quel dé, quel sens — et dit où les pions atterrissent.
 * C'est la partie qui ne dépend NI du dessin de la modale NI des trois points
 * restés en suspens chez Quentin :
 *
 *   - faut-il forcer un joueur en avant et l'autre en arrière (le sketch) ou
 *     laisser chacun sa direction (la règle officielle, et `main`) ?
 *   - la sélection dans l'application revient-elle pour les autres faveurs ?
 *   - que fait-on à deux joueurs, où il n'y a qu'un seul adversaire ?
 *
 * Aucune de ces réponses ne change ce qui est écrit ici : quel que soit
 * l'écran, un dé de 4 vers l'avant depuis la case 7 mène à la case 11. Écrire
 * cette partie maintenant ne préjuge donc de rien.
 *
 * Module PUR : il se vérifie sans DOM, sans WebGL et sans partie en cours.
 */

/**
 * La somme qui désigne APHRODITE sur la table des faveurs.
 *
 * Un DOUBLE de 2 est la Colère des dieux, pas Aphrodite : `readFavorRoll`
 * fait déjà cette distinction, et on la lui laisse plutôt que de comparer la
 * somme ici.
 */
export const APHRODITE_SUM = 4;

/** Le sens dans lequel Aphrodite pousse un pion. */
export type AphroditeDirection = 'forward' | 'backward';

/** Ce que le joueur a décidé pour UN adversaire. */
export interface AphroditeChoice {
  /** Le rang de l'adversaire dans la partie. */
  player: number;
  /**
   * LEQUEL des deux dés lui est attribué — 0 ou 1, son rang dans le jet.
   *
   * Les dés sont identifiés par leur RANG et non par leur face : un jet de
   * 3 et 3 montre deux fois le même nombre, et ce sont pourtant deux dés
   * distincts. Les distinguer par la face ferait croire qu'un seul a été
   * utilisé, et « Valider » resterait refusé sans que le joueur comprenne.
   */
  diceSlot: number;
  /** La face de ce dé, celle que le joueur voit. */
  dice: number;
  direction: AphroditeDirection;
}

/** Où un pion se retrouve, et d'où il vient. */
export interface AphroditeMove {
  player: number;
  from: number;
  to: number;
  dice: number;
  direction: AphroditeDirection;
}

/**
 * Où le pion atterrit, bornes du plateau comprises.
 *
 * LES BORNES NE SONT PAS UN DÉTAIL : reculer de 5 depuis la case 2 sortirait
 * du plateau, et une case négative n'existe pas. `GameLogic.setPlayerPosition`
 * borne déjà de son côté — on calcule ici la MÊME valeur pour pouvoir
 * l'annoncer avant de l'appliquer, sans quoi la modale promettrait un
 * déplacement que les règles refuseraient ensuite.
 */
export function aphroditeLanding(
  from: number,
  dice: number,
  direction: AphroditeDirection,
  lastPosition: number
): number {
  const step = direction === 'forward' ? dice : -dice;

  return Math.max(0, Math.min(lastPosition, from + step));
}

/**
 * Le plan complet : où chaque pion désigné va se retrouver.
 *
 * L'ordre des mouvements est celui des choix, et il compte : c'est celui dans
 * lequel les effets des cases d'arrivée s'appliqueront ensuite.
 */
export function aphroditePlan(
  choices: AphroditeChoice[],
  positions: number[],
  lastPosition: number
): AphroditeMove[] {
  return choices.map(choice => {
    const from = positions[choice.player] ?? 0;

    return {
      player: choice.player,
      from,
      to: aphroditeLanding(from, choice.dice, choice.direction, lastPosition),
      dice: choice.dice,
      direction: choice.direction,
    };
  });
}

/**
 * Les choix sont-ils complets et recevables ?
 *
 * UN DÉ NE SERT QU'UNE FOIS. C'est la seule contrainte que la règle écrite
 * pose explicitement — « associez 1 dé à chacun » — et c'est celle que le
 * sketch de Quentin rend visible en barrant le dé déjà pris dans l'autre
 * colonne. La vérifier ici permet à l'écran de refuser « Valider » plutôt
 * que d'afficher une erreur après coup.
 *
 * CHACUN CHOISIT SA DIRECTION, librement. Les deux peuvent avancer, ou
 * reculer ensemble.
 *
 * Ce point a fait l'aller-retour, et c'est le texte de la règle qui
 * l'emporte : « associez 1 dé à chacun. Déplacez-les en avant ou arrière »
 * ne demande pas un de chaque. Le croquis de Quentin ne montrait qu'une
 * colonne « + » et une « − », ce qui se lisait comme une contrainte ; il
 * l'avait d'abord confirmée, puis tranché dans l'autre sens. C'est aussi ce
 * que fait `main` depuis toujours — les deux rendus disent donc la même
 * chose.
 */
export function aphroditeReady(choices: AphroditeChoice[], expected: number): boolean {
  if (choices.length !== expected) return false;

  // Deux joueurs distincts : on ne déplace pas deux fois le même pion.
  const players = new Set(choices.map(choice => choice.player));
  if (players.size !== choices.length) return false;

  // Chaque dé est attribué à UN SEUL adversaire. Les dés sont identifiés par
  // leur rang dans le jet et non par leur face : deux dés peuvent montrer le
  // même nombre, et ce sont bien deux dés différents.
  const slots = new Set(choices.map(choice => choice.diceSlot));

  return slots.size === choices.length;
}

/**
 * Combien d'adversaires Aphrodite déplace, dans cette partie-ci.
 *
 * LA FAVEUR EN DEMANDE DEUX, et le jeu se joue à partir de deux joueurs : il
 * n'y a alors qu'un seul adversaire. Quentin a tranché — l'unique adversaire
 * reçoit LES DEUX DÉS. C'est la branche `both-dice` du rendu CSS, retenue
 * sans la question posée au joueur : `main` demandait par une boîte de
 * dialogue s'il préférait retirer une autre faveur, et ce choix est
 * désormais fait une fois pour toutes.
 *
 * Sans cette borne, l'écran demanderait deux adversaires là où il n'en
 * existe qu'un : « Valider » resterait refusé à jamais et la partie se
 * bloquerait sur la faveur.
 */
export function aphroditeTargets(playerCount: number): number {
  // Le joueur qui déclenche la faveur ne se déplace pas lui-même.
  const opponents = Math.max(0, playerCount - 1);

  return Math.min(2, opponents);
}
