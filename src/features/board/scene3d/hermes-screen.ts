/**
 * L'écran d'HERMÈS : quel sens, et sur qui.
 *
 * IL DEMANDE UN CHOIX, comme Aphrodite et pour la même raison : la faveur
 * DÉPLACE un pion, et un déplacement ne se joue pas à la table — il faut
 * bien que l'application bouge le pion. La ligne du 19/09 — « énoncé + à la
 * table » — vaut pour ce qui se boit, pas pour ce qui se déplace. Poséidon
 * reste un simple rappel parce qu'il ne fait que servir des gorgées.
 *
 * LA MISE EN SCÈNE SUIT LE CROQUIS DE QUENTIN : le nom du dieu, la règle,
 * puis deux boutons — « Me déplacer » ou « Ramener » — et la liste des
 * adversaires en dessous. Les deux flèches du croquis disent le sens :
 * « Me déplacer » pointe VERS la liste, « Ramener » en part.
 *
 * LA LISTE NE S'OUVRE QU'UNE FOIS LE SENS CHOISI, comme le croquis la place
 * sous les deux boutons : sans sens, elle ne veut rien dire — « déplacer sur
 * qui » et « ramener qui » ne demandent pas la même chose.
 *
 * AUCUN DÉ. Hermès n'a pas de second jet, tranché par Quentin : sa règle n'en
 * parle pas, contrairement à Aphrodite et à Poséidon.
 *
 * Le module ne touche NI aux règles NI à la scène : il rend le déplacement
 * décidé, et c'est l'appelant qui l'applique.
 */

import { GOD_FAVORS } from '@/features/game/god-favors';
import {
  hermesPlan,
  HERMES_SUM,
  type HermesDirection,
  type HermesMove,
} from './hermes-plan';

/** Un adversaire qu'Hermès peut viser. */
export interface HermesTarget {
  /** Son rang dans la partie. */
  index: number;
  name: string;
  position: number;
}

/** Les deux sens, dans l'ordre du croquis. */
const DIRECTIONS: {
  direction: HermesDirection;
  id: string;
  label: string;
  /** Ce que la liste demande UNE FOIS ce sens choisi. */
  prompt: string;
}[] = [
  {
    direction: 'move',
    id: 'hermes-move',
    label: 'Me déplacer',
    prompt: 'Sur la case de :',
  },
  {
    direction: 'bring',
    id: 'hermes-bring',
    label: 'Ramener',
    prompt: 'Sur ma case :',
  },
];

/**
 * Affiche l'écran et attend la décision.
 *
 * `onDone` reçoit le déplacement à appliquer — UN SEUL PION, celui qui bouge,
 * et c'est lui seul qui appliquera l'effet de sa case d'arrivée. Il n'est
 * appelé qu'à la validation : « Voir le plateau » escamote sans rien décider,
 * comme sur les autres modales.
 */
export function showHermesScreen(
  player: number,
  myPosition: number,
  targets: HermesTarget[],
  onDone: (move: HermesMove) => void,
  host: HTMLElement = document.body
): void {
  /** Le sens arrêté, tant qu'il ne l'est pas. */
  let direction: HermesDirection | null = null;

  /** L'adversaire visé — le premier de la liste par défaut. */
  let pick = targets[0]?.index ?? null;

  const screen = document.createElement('div');
  screen.className = 'setup-screen action-modal hermes-screen';
  screen.id = 'hermes-screen';

  const panel = document.createElement('div');
  panel.className = 'setup-panel action-modal-panel hermes-panel';

  const title = document.createElement('h2');
  title.textContent = `\u{1F45F} ${GOD_FAVORS[HERMES_SUM].name}`;
  panel.appendChild(title);

  // LA RÈGLE, RESSERRÉE. Le texte de référence dit le choix ET l'effet de la
  // case ; les deux boutons montrent déjà le choix, chacun portant son sens.
  // Le répéter en toutes lettres fait lire deux fois la même chose, ce qui
  // est le défaut SCH-11 relevé par Bastien.
  //
  // LE TEXTE DE RÉFÉRENCE N'EST PAS TOUCHÉ : il vit dans `god-favors.ts`,
  // partagé avec le rendu de `main`. On en pose une version courte POUR CET
  // ÉCRAN, qui s'appuie sur les boutons.
  const rule = document.createElement('p');
  rule.className = 'action-modal-line';
  rule.textContent =
    'Rejoignez un adversaire, ou tirez-le à vous. Le pion déplacé applique sa case.';
  panel.appendChild(rule);

  // LES DEUX SENS, côte à côte comme sur le croquis.
  const choices = document.createElement('div');
  choices.className = 'hermes-choices';

  const directionButtons = DIRECTIONS.map(entry => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-secondary hermes-direction';
    button.id = entry.id;
    button.dataset.direction = entry.direction;
    button.textContent = entry.label;

    button.addEventListener('click', () => {
      // Recliquer le sens déjà pris le REPREND : un joueur qui s'est trompé
      // de bouton doit pouvoir se reprendre sans rouvrir l'écran, comme sur
      // l'écran d'Aphrodite.
      direction = direction === entry.direction ? null : entry.direction;
      render();
    });

    choices.appendChild(button);

    return { entry, button };
  });

  panel.appendChild(choices);

  // LA LISTE, sous les deux boutons comme sur le croquis. Elle reste
  // ESCAMOTÉE tant qu'aucun sens n'est choisi : « déplacer sur qui » et
  // « ramener qui » ne demandent pas la même chose, et une liste sans sens
  // ne veut rien dire.
  const pickBox = document.createElement('div');
  pickBox.className = 'hermes-pick';

  const prompt = document.createElement('p');
  prompt.className = 'hermes-prompt';
  pickBox.appendChild(prompt);

  const who = document.createElement('select');
  who.className = 'hermes-who';
  who.id = 'hermes-who';
  who.setAttribute('aria-label', 'Adversaire');

  for (const target of targets) {
    const option = document.createElement('option');
    option.value = String(target.index);
    option.textContent = `${target.name} — case ${target.position + 1}`;
    option.selected = target.index === pick;
    who.appendChild(option);
  }

  who.addEventListener('change', () => {
    pick = Number(who.value);
  });

  pickBox.appendChild(who);
  panel.appendChild(pickBox);

  const buttons = document.createElement('div');
  buttons.className = 'action-modal-buttons';

  const peekButton = document.createElement('button');
  peekButton.type = 'button';
  peekButton.className = 'btn btn-secondary';
  peekButton.id = 'hermes-peek';
  peekButton.textContent = 'Voir le plateau';

  const validateButton = document.createElement('button');
  validateButton.type = 'button';
  validateButton.className = 'btn btn-primary';
  validateButton.id = 'hermes-validate';
  validateButton.textContent = 'Valider';

  buttons.append(peekButton, validateButton);
  panel.appendChild(buttons);
  screen.appendChild(panel);

  const recall = document.createElement('button');
  recall.type = 'button';
  recall.className = 'action-modal-recall';
  recall.id = 'hermes-recall';
  recall.textContent = '\u{1F45F} Revenir à Hermès';

  /**
   * Montre ou escamote un élément.
   *
   * `hidden` SEUL NE SUFFIT PAS : `.setup-screen` pose `display: flex`, qui
   * l'emporte sur la feuille par défaut du navigateur. C'est le défaut que
   * Quentin a vu deux fois sur l'APK — la modale d'action, puis le bandeau
   * de diagnostic.
   */
  const reveal = (element: HTMLElement, shown: boolean): void => {
    element.hidden = !shown;
    element.style.display = shown ? '' : 'none';
  };

  reveal(recall, false);

  /** Redessine l'état du choix. */
  function render(): void {
    for (const { entry, button } of directionButtons) {
      const chosen = direction === entry.direction;

      button.classList.toggle('is-chosen', chosen);
      button.setAttribute('aria-pressed', chosen ? 'true' : 'false');

      if (chosen) prompt.textContent = entry.prompt;
    }

    // LA LISTE N'APPARAÎT QU'AVEC UN SENS, et « Valider » avec elle : sans
    // sens choisi, il n'y a rien à valider.
    reveal(pickBox, direction !== null);
    validateButton.disabled = direction === null || pick === null;
  }

  peekButton.addEventListener('click', () => {
    reveal(screen, false);
    reveal(recall, true);
  });

  recall.addEventListener('click', () => {
    reveal(screen, true);
    reveal(recall, false);
  });

  let done = false;
  validateButton.addEventListener('click', () => {
    if (done) return;
    if (direction === null || pick === null) return;

    done = true;
    screen.remove();
    recall.remove();

    onDone(
      hermesPlan(
        { player, target: pick, direction },
        positionsOf(player, myPosition, targets)
      )
    );
  });

  render();
  host.append(screen, recall);
}

/**
 * Les positions de tout le monde, rangées par leur RANG dans la partie.
 *
 * `hermesPlan` lit `positions[player]` : une liste dans l'ordre des
 * adversaires donnerait la position du mauvais pion dès que le joueur
 * courant n'est pas le dernier.
 */
function positionsOf(
  player: number,
  myPosition: number,
  targets: HermesTarget[]
): number[] {
  const positions: number[] = [];

  positions[player] = myPosition;
  for (const target of targets) positions[target.index] = target.position;

  return positions;
}
