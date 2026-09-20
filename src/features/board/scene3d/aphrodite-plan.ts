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
 * UN JOUEUR PART EN AVANT, L'AUTRE EN ARRIÈRE. Quentin l'a tranché en
 * lisant son propre sketch : ce sont les colonnes « + » et « − » qui
 * portent la direction, et chacune reçoit un dé. La règle écrite disait
 * seulement « déplacez-les en avant ou arrière », et `main` laissait les
 * deux aller du même côté — c'est donc un CHANGEMENT de règle, décidé par
 * lui et non déduit du dessin.
 *
 * La contrainte ne s'applique QUE lorsque deux adversaires sont déplacés :
 * à deux joueurs il n'y en a qu'un, et lui imposer deux directions à la
 * fois n'aurait aucun sens.
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
  if (slots.size !== choices.length) return false;

  // Les deux sens sont pris, un par colonne.
  if (choices.length === 2) {
    const directions = new Set(choices.map(choice => choice.direction));
    if (directions.size !== 2) return false;
  }

  return true;
}
