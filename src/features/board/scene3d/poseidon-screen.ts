/**
 * L'écran de POSÉIDON : un RAPPEL, pas un arbitrage.
 *
 * « Ciblez un joueur et lancez 2 dés. Il reçoit autant de gorgées que le dé
 * le plus élevé. Ses 2 voisins reçoivent chacun le score du dé le plus
 * faible. » — la faveur de somme 11.
 *
 * IL NE DEMANDE AUCUNE SÉLECTION, et c'est une décision de Quentin :
 * « pas besoin de sélectionner les joueurs, c'est un rappel ». L'écran
 * énonce la règle et montre les dés ; la table désigne la cible et compte
 * les gorgées. C'est la ligne du 19/09 — « énoncé + à la table » — dont
 * Aphrodite était l'exception, parce qu'elle DÉPLACE des pions et qu'un
 * déplacement ne se joue pas à la table.
 *
 * L'APPLICATION NE COMPTE DONC RIEN ICI. Aucune gorgée n'est servie à
 * personne dans `GameLogic` : ce serait choisir la cible à la place des
 * joueurs, exactement ce qu'on retire.
 *
 * LA DISPOSITION EN TRIDENT vient du croquis de Quentin : le dé le plus
 * FORT au sommet — celui que la cible reçoit — et le plus FAIBLE de part et
 * d'autre, pour les deux voisins. Trois branches, comme l'arme du dieu : la
 * règle se lit d'un coup d'œil au lieu de se déchiffrer dans une phrase.
 */

import { GOD_FAVORS } from '@/features/game/god-favors';
import { withGulpSymbol } from '@/features/game/action-text';

/** La somme qui désigne POSÉIDON sur la table des faveurs. */
export const POSEIDON_SUM = 11;

/**
 * Le dé fort et le dé faible, dans cet ordre.
 *
 * C'est le SEUL calcul de cet écran, et il décide de la disposition : le
 * fort au sommet du trident, le faible sur les deux branches. Se tromper de
 * sens montrerait la règle à l'envers.
 */
export function poseidonDice(a: number, b: number): { high: number; low: number } {
  return { high: Math.max(a, b), low: Math.min(a, b) };
}

/**
 * Affiche le rappel, et attend que la table ait fini.
 *
 * `onDone` n'est appelé qu'à la validation : « Voir le plateau » escamote
 * sans solder, comme sur les autres modales. Le tour reste suspendu tant
 * que les gorgées ne sont pas bues.
 */
export function showPoseidonScreen(
  dice: [number, number],
  onDone: () => void,
  host: HTMLElement = document.body
): void {
  const { high, low } = poseidonDice(dice[0], dice[1]);

  const screen = document.createElement('div');
  screen.className = 'setup-screen action-modal poseidon-screen';
  screen.id = 'poseidon-screen';

  const panel = document.createElement('div');
  panel.className = 'setup-panel action-modal-panel poseidon-panel';

  const title = document.createElement('h2');
  title.textContent = `\u{1F531} ${GOD_FAVORS[POSEIDON_SUM].name}`;
  panel.appendChild(title);

  // LA RÈGLE, dans les termes de `god-favors` — partagés avec le rendu de
  // `main`, pour que les deux jeux disent la même chose. Les gorgées y sont
  // écrites 🍺 à l'affichage (SCH-12), sans réécrire le texte de référence.
  const rule = document.createElement('p');
  rule.className = 'action-modal-line';
  rule.textContent = withGulpSymbol(GOD_FAVORS[POSEIDON_SUM].description);
  panel.appendChild(rule);

  // LE TRIDENT. Le dé fort au sommet, le faible sur les deux branches.
  const trident = document.createElement('div');
  trident.className = 'poseidon-trident';

  /** Une branche du trident : un dé, et qui le reçoit. */
  const branch = (
    face: number,
    role: 'target' | 'neighbor',
    label: string
  ): HTMLElement => {
    const box = document.createElement('div');
    box.className = `poseidon-branch poseidon-${role}`;

    const die = document.createElement('div');
    die.className = 'poseidon-die';
    die.textContent = String(face);
    die.dataset.role = role;

    const who = document.createElement('div');
    who.className = 'poseidon-who';
    who.textContent = label;

    box.append(die, who);

    return box;
  };

  // LE SOMMET D'ABORD dans le DOM, pour que la lecture à voix haute suive
  // la règle : la cible, puis ses voisins.
  trident.append(
    branch(high, 'target', 'La cible'),
    branch(low, 'neighbor', 'Voisin de gauche'),
    branch(low, 'neighbor', 'Voisin de droite')
  );

  panel.appendChild(trident);

  const buttons = document.createElement('div');
  buttons.className = 'action-modal-buttons';

  const peekButton = document.createElement('button');
  peekButton.type = 'button';
  peekButton.className = 'btn btn-secondary';
  peekButton.id = 'poseidon-peek';
  peekButton.textContent = 'Voir le plateau';

  const validateButton = document.createElement('button');
  validateButton.type = 'button';
  validateButton.className = 'btn btn-primary';
  validateButton.id = 'poseidon-validate';
  validateButton.textContent = 'Valider';

  buttons.append(peekButton, validateButton);
  panel.appendChild(buttons);
  screen.appendChild(panel);

  const recall = document.createElement('button');
  recall.type = 'button';
  recall.className = 'action-modal-recall';
  recall.id = 'poseidon-recall';
  recall.textContent = '\u{1F531} Revenir à Poséidon';

  /**
   * Montre ou escamote l'écran.
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

    done = true;
    screen.remove();
    recall.remove();
    onDone();
  });

  host.append(screen, recall);
}
