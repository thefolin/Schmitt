/**
 * La modale qui ARRÊTE le jeu le temps que la table s'exécute.
 *
 * LE DÉFAUT QU'ELLE CORRIGE : `#actions-panel` énonce bien « Alice distribue
 * 3 🍺 », mais rien n'attend. Le joueur suivant peut relancer aussitôt, et
 * l'énoncé disparaît sous le tour d'après — bu ou pas bu. Sur un jeu de
 * soirée, une règle qu'on peut rater en regardant ailleurs n'est pas
 * appliquée.
 *
 * ELLE NE DÉCIDE RIEN, et c'est la contrainte qui la tient. Quentin
 * (19/09/2026) : « énoncé + à la table. Pas de sélection dans l'app, pas de
 * choix à arbitrer. » La modale AFFICHE la phrase et attend qu'on lui dise
 * que c'est fait. « Valider » ne choisit pas de cible, ne compte pas de
 * gorgée, n'applique aucune règle : il rend la main.
 *
 * DEUX SORTIES, parce que le plateau reste consultable. « Voir le plateau »
 * l'escamote sans la solder — le tour reste suspendu, un bouton discret la
 * rappelle. Seul « Valider » la termine.
 *
 * Le module est séparé en deux : `modalContent` DIT ce qu'il faut afficher,
 * sans DOM, et se vérifie sans rien construire ; `showActionModal` l'affiche.
 */

import type { TileConfig } from '@/core/models/Tile';
import type { TurnOutcome } from './turn-runner';
import { tableAnnouncement } from './table-announcements';
import { buildActionText, buildSubtitle, withGulpSymbol } from '@/features/game/action-text';

/** Ce que la modale a à dire, ou rien du tout. */
export interface ModalContent {
  /** Le titre, court : ce qui vient d'arriver. */
  title: string;
  /** Les phrases à lire à la table, dans l'ordre où elles s'appliquent. */
  lines: string[];
}

/** Une sanction soldée par la scène, à annoncer avec le reste. */
export interface SettledShield {
  playerName: string;
  amount: number;
}

/**
 * Ce qu'il y a à énoncer après un tour — ou `null` s'il n'y a rien.
 *
 * UN TOUR ORDINAIRE N'OUVRE PAS DE MODALE. Avancer de quatre cases et tomber
 * sur une case vide ne demande rien à personne : interrompre le jeu pour le
 * dire ferait fermer une modale à chaque tour, et on finirait par la fermer
 * sans la lire — ce qui vaut pour les tours qui comptent aussi.
 */
export function modalContent(
  outcome: TurnOutcome,
  tile: TileConfig | null = null,
  shield: SettledShield | null = null
): ModalContent | null {
  const lines: string[] = [];

  // LE BOUCLIER D'ABORD : il a intercepté une sanction, et ce qui suit se lit
  // en sachant qu'elle est retombée sur son porteur.
  if (shield) {
    lines.push(
      `\u{1F6E1}\u{FE0F} ${shield.playerName} garde son bouclier et boit ${shield.amount} \u{1F37A}`
    );
  }

  // CE QUI SE JOUE À LA TABLE, énoncé par le module qui en a la charge. On
  // ne réécrit pas ces phrases ici : deux rédactions de la même règle
  // finiraient par diverger.
  const announcement = tableAnnouncement(outcome);
  if (announcement) lines.push(announcement.text);

  // LA PHRASE DE LA CASE, dans les termes que Bastien a fixés (SCH-11/12/13)
  // et que `action-text` tient déjà pour le rendu CSS. On la réemploie au
  // lieu d'en rédiger une seconde : deux formulations de la même case
  // finiraient par diverger, et c'est la duplication que la refonte supprime.
  //
  // `tableAnnouncement` couvre la distribution : on ne la redit pas.
  if (tile && !announcement) {
    const action = buildActionText(tile, outcome.playerName);
    if (action) lines.push(action);
  }

  // UNE CASE QUI SE JOUE À LA TABLE n'a ni chiffre ni verbe standard — c'est
  // sa description qui porte la règle. Sans elle, la modale s'ouvrirait sur
  // un titre et rien d'autre, et le joueur ne saurait pas ce qu'on attend.
  if (tile && outcome.tableRule) {
    const subtitle = buildSubtitle(tile, null);
    lines.push(subtitle || withGulpSymbol(tile.name));
  }

  // LE STATUT DE POULET, posé en tombant sur la case.
  //
  // IL N'EST ANNONCÉ NULLE PART AILLEURS : `tableAnnouncement` ne traite que
  // la SENTENCE (« à chaque 3 ou 6 »), pas la prise du titre. Or c'est ce
  // titre qui déclenche la sentence à tous les tours suivants, et personne
  // ne peut l'appliquer s'il ne l'a pas entendu poser.
  if (outcome.chicken) {
    lines.push(
      outcome.chicken.rank === 2
        ? `\u{1F414} ${outcome.playerName} devient GROS POULET : il distribuera 1 \u{1F37A} à chaque 3 ou 6`
        : `\u{1F414} ${outcome.playerName} est le Poulet : il boira 1 \u{1F37A} à chaque 3 ou 6`
    );
  }

  // LES GORGÉES SERVIES PAR LA CASE, quand aucune phrase ne les a déjà
  // dites. C'est la sanction la plus directe du jeu : la taire laisserait la
  // modale muette sur ce qui vient d'arriver.
  if (outcome.drinks && lines.length === 0) {
    lines.push(`${outcome.playerName} boit ${outcome.drinks.amount} \u{1F37A}`);
  }

  if (outcome.everyone && lines.length === 0) {
    lines.push(`Tout le monde boit \u{1F37A}`);
  }

  // LA VICTOIRE CLÔT LA PARTIE : elle mérite l'arrêt, même si aucune gorgée
  // n'est en jeu.
  if (outcome.winner) {
    lines.push(`\u{1F3C6} ${outcome.winner} arrive au bout de l'Odyssée !`);
  }

  if (lines.length === 0) return null;

  return { title: modalTitle(outcome), lines };
}

/** Le titre, tiré de ce qui domine le tour. */
function modalTitle(outcome: TurnOutcome): string {
  if (outcome.winner) return 'Victoire';
  if (outcome.chickenPenalty || outcome.chicken) return 'Le Poulet';
  if (outcome.schmittPower) return 'Le pouvoir du Schmitt';

  return `Au tour de ${outcome.playerName}`;
}

/** Ce que la scène doit faire pendant que la modale est ouverte. */
export interface ActionModalHandles {
  /** Ferme et solde : le tour reprend. */
  validate: () => void;
  /** Escamote sans solder : le tour reste suspendu. */
  peek: () => void;
  /** Ramène la modale escamotée. */
  restore: () => void;
  /** La modale attend-elle encore une validation ? */
  isPending: () => boolean;
}

/**
 * Affiche la modale et rend de quoi la piloter.
 *
 * ELLE N'EST PAS BLOQUANTE AU SENS D'UNE PROMESSE. Une promesse imposerait
 * d'attendre sa résolution pour rendre la main, alors que tout l'intérêt est
 * justement de pouvoir l'escamoter et revenir : c'est `onValidate` qui
 * signale la fin, et l'appelant décide quoi en faire.
 *
 * Le style vient de `setup-screen.css` — or et marbre, comme l'écran qui
 * ouvre la partie. Rien n'est réécrit ici : la modale emprunte les classes
 * existantes (`.setup-screen`, `.setup-panel`, `.btn`) et n'ajoute que ce qui
 * lui est propre.
 */
export function showActionModal(
  content: ModalContent,
  onValidate: () => void,
  host: HTMLElement = document.body
): ActionModalHandles {
  let pending = true;

  const screen = document.createElement('div');
  screen.className = 'setup-screen action-modal';
  screen.id = 'action-modal';

  const panel = document.createElement('div');
  panel.className = 'setup-panel action-modal-panel';

  const title = document.createElement('h2');
  title.textContent = content.title;
  panel.appendChild(title);

  for (const text of content.lines) {
    const line = document.createElement('p');
    line.className = 'action-modal-line';
    line.textContent = text;
    panel.appendChild(line);
  }

  const buttons = document.createElement('div');
  buttons.className = 'action-modal-buttons';

  // « VOIR LE PLATEAU » escamote sans solder. Le tour reste suspendu :
  // c'est ce qui distingue ce bouton de « Valider », et c'est pourquoi il
  // ne ressemble pas à l'action principale.
  const peekButton = document.createElement('button');
  peekButton.type = 'button';
  peekButton.className = 'btn btn-secondary';
  peekButton.id = 'action-peek';
  peekButton.textContent = 'Voir le plateau';

  const validateButton = document.createElement('button');
  validateButton.type = 'button';
  validateButton.className = 'btn btn-primary';
  validateButton.id = 'action-validate';
  validateButton.textContent = 'Valider';

  buttons.append(peekButton, validateButton);
  panel.appendChild(buttons);
  screen.appendChild(panel);

  // LE RAPPEL, posé hors de la modale puisqu'il ne vit que quand elle est
  // escamotée. Sans lui, « Voir le plateau » serait un aller sans retour et
  // la partie resterait suspendue sans que rien ne l'explique — exactement
  // le défaut que la modale corrige.
  const recall = document.createElement('button');
  recall.type = 'button';
  recall.className = 'action-modal-recall';
  recall.id = 'action-recall';
  recall.textContent = '\u{1F4DC} Revenir à l’action';
  recall.hidden = true;

  const peek = (): void => {
    if (!pending) return;

    screen.hidden = true;
    recall.hidden = false;
  };

  const restore = (): void => {
    if (!pending) return;

    screen.hidden = false;
    recall.hidden = true;
  };

  const validate = (): void => {
    if (!pending) return;

    pending = false;
    screen.remove();
    recall.remove();
    onValidate();
  };

  peekButton.addEventListener('click', peek);
  recall.addEventListener('click', restore);
  validateButton.addEventListener('click', validate);

  host.append(screen, recall);

  return { validate, peek, restore, isPending: () => pending };
}
