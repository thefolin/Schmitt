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

  // LA RÈGLE, RESSERRÉE. Le texte de référence fait 148 caractères et
  // nomme trois fois qui reçoit quoi — or le trident le montre déjà, chaque
  // dé portant son étiquette. Le répéter en toutes lettres fait lire deux
  // fois la même chose, ce qui est le défaut SCH-11 relevé par Bastien.
  //
  // LE TEXTE DE RÉFÉRENCE N'EST PAS TOUCHÉ : il vit dans `god-favors.ts`,
  // partagé avec le rendu de `main`, et sert partout ailleurs. On en pose
  // une version courte POUR CET ÉCRAN, qui s'appuie sur le dessin.
  const rule = document.createElement('p');
  rule.className = 'action-modal-line';
  //
  // LE SYMBOLE 🍺 EST ÉCRIT DIRECTEMENT : le texte court ne contient plus
  // le mot « gorgée », donc `withGulpSymbol` n'aurait rien à substituer. Le
  // garder quand même appliquerait une transformation vide — autant dire
  // ce qu'on veut afficher.
  rule.textContent =
    'Ciblez un joueur : il boit le d\u00e9 fort en \u{1F37A}, ses voisins le faible.';
  panel.appendChild(rule);

  // LE TRIDENT, dessiné sous les dés.
  //
  // MA PREMIÈRE VERSION N'EN MONTRAIT AUCUN : deux traits de douze pixels
  // au-dessus des dés voisins, sans hampe ni pointe. Quentin : « je ne vois
  // pas de trident ». Un trait sans forme ne dessine rien.
  //
  // Il est tracé en SVG plutôt qu'en bordures CSS : les trois dents
  // partent d'une hampe commune, et c'est cette convergence qui fait
  // l'arme. Des bordures ne savent pas dessiner une jonction.
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

  // LES DÉS, en trois colonnes : le faible à gauche, le fort au milieu, le
  // faible à droite. C'est la disposition du croquis, et elle place le
  // sommet du trident sous la cible.
  const heads = document.createElement('div');
  heads.className = 'poseidon-heads';
  heads.append(
    branch(low, 'neighbor', 'Voisin'),
    branch(high, 'target', 'La cible'),
    branch(low, 'neighbor', 'Voisin')
  );
  trident.appendChild(heads);

  // LA FOURCHE, sous les dés : trois dents qui remontent vers eux depuis
  // une hampe commune. `preserveAspectRatio="none"` la laisse s'étirer sur
  // la largeur des trois colonnes, quelle que soit la taille de l'écran.
  const fork = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  fork.setAttribute('class', 'poseidon-fork');
  fork.setAttribute('viewBox', '0 0 120 52');
  fork.setAttribute('preserveAspectRatio', 'none');
  fork.setAttribute('aria-hidden', 'true');

  // LES HAMPES, qui se rejoignent sur la barre puis descendent au centre.
  const stems = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  stems.setAttribute('d', 'M14 6 V34 M60 2 V50 M106 6 V34 M14 34 H106');
  fork.appendChild(stems);

  // LES POINTES, tracées à part.
  //
  // C'EST CE QUI MANQUAIT À MA DEUXIÈME VERSION : sans elles, les dents
  // ressemblaient à un crochet, et Quentin ne reconnaissait toujours pas
  // l'arme. Vérifié en rendant le dessin en image plutôt qu'en relisant les
  // coordonnées — trois flèches montant vers leur dé, comme sur le croquis.
  //
  // Elles ne peuvent PAS rejoindre le tracé des hampes : `vector-effect`
  // fige l'épaisseur, mais l'étirement horizontal déforme les angles, et
  // une pointe dessinée dans le même chemin partirait de travers.
  const tips = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  tips.setAttribute(
    'd',
    'M9 12 L14 2 L19 12 M55 8 L60 -2 L65 8 M101 12 L106 2 L111 12'
  );
  fork.appendChild(tips);
  trident.appendChild(fork);

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
