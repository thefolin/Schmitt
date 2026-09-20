import {
  aphroditePlan,
  aphroditeReady,
  aphroditeTargets,
  type AphroditeChoice,
  type AphroditeDirection,
  type AphroditeMove,
} from './aphrodite-plan';

/**
 * L'écran d'Aphrodite : qui part, avec quel dé, dans quel sens.
 *
 * C'EST LA SEULE MODALE QUI DEMANDE UN CHOIX. Quentin avait tranché le
 * 19/09 que les interactions s'énoncent et se jouent à la table — « pas de
 * sélection dans l'app » — et cette ligne tient toujours pour Hermès,
 * Poséidon, Artémis et le bouclier d'Athéna. Il a fait une exception pour
 * Aphrodite seule : elle déplace DEUX pions sur le plateau, et un
 * déplacement ne se joue pas à la table — il faut bien que l'application
 * bouge les pions.
 *
 * LA MISE EN SCÈNE SUIT SON CROQUIS : une liste déroulante par adversaire,
 * deux colonnes « + » et « − », et chaque dé présent dans LES DEUX colonnes.
 * Le dé pris sur une ligne se barre sur l'autre : la contrainte « un dé une
 * seule fois » devient visible au lieu d'être un refus après coup.
 *
 * LES COLONNES SONT PROPRES À CHAQUE LIGNE, et non globales : chacun avance
 * ou recule indépendamment de l'autre. Le croquis, avec une seule colonne de
 * chaque signe, se lisait comme « un en avant, un en arrière » — Quentin a
 * tranché dans l'autre sens, conformément au texte de la règle.
 *
 * LES DÉS SONT DÉJÀ LANCÉS quand cet écran s'ouvre. Le joueur les a jetés
 * lui-même sur le plateau — « les 2 dés ne doivent pas se lancer
 * automatiquement » — et l'écran ne fait qu'en reprendre les faces. C'est
 * l'ordre que Quentin a confirmé, et il préserve les deux décisions.
 *
 * Le module ne touche NI aux règles NI à la scène : il rend les
 * déplacements décidés, et c'est l'appelant qui les applique.
 */

/** Un adversaire qu'Aphrodite peut déplacer. */
export interface AphroditeTarget {
  /** Son rang dans la partie. */
  index: number;
  name: string;
  color: string;
  position: number;
}

/** Ce que l'écran rend une fois « Valider » pressé. */
export type AphroditeResult = AphroditeMove[];

/** Les deux sens, dans l'ordre des colonnes du croquis. */
const COLUMNS: { direction: AphroditeDirection; sign: string; label: string }[] = [
  { direction: 'forward', sign: '+', label: 'Avancer' },
  { direction: 'backward', sign: '−', label: 'Reculer' },
];

/**
 * Affiche l'écran et attend la décision.
 *
 * `onDone` reçoit les déplacements à appliquer, dans l'ordre où les effets
 * des cases d'arrivée devront se jouer. Il n'est appelé qu'à la validation :
 * « Voir le plateau » escamote sans rien décider, comme sur les autres
 * modales.
 */
export function showAphroditeScreen(
  dice: [number, number],
  targets: AphroditeTarget[],
  lastPosition: number,
  onDone: (moves: AphroditeResult) => void,
  host: HTMLElement = document.body
): void {
  // COMBIEN DE PIONS PARTENT. À deux joueurs il n'y a qu'un adversaire, et
  // c'est lui qui reçoit les deux dés : sans cette borne, l'écran attendrait
  // deux adversaires là où il n'en existe qu'un et « Valider » resterait
  // refusé à jamais.
  const slots = aphroditeTargets(targets.length + 1);

  /** Ce qui est décidé pour chaque ligne, au fur et à mesure. */
  const choices: (AphroditeChoice | null)[] = Array.from({ length: slots }, () => null);

  /**
   * Quel adversaire chaque ligne désigne.
   *
   * Les premiers de la liste, et donc DISTINCTS d'emblée : ouvrir l'écran
   * sur deux fois le même adversaire laisserait « Valider » grisé sans que
   * le joueur ait rien fait de mal.
   */
  const picks: number[] = targets.slice(0, slots).map(target => target.index);

  /** Quel dé chaque ligne a pris, par son rang dans le jet. */
  const dicePicks: (number | null)[] = Array.from({ length: slots }, () => null);

  /** Quel sens chaque ligne a pris. */
  const directions: (AphroditeDirection | null)[] = Array.from({ length: slots }, () => null);

  const screen = document.createElement('div');
  screen.className = 'setup-screen action-modal aphrodite-screen';
  screen.id = 'aphrodite-screen';

  const panel = document.createElement('div');
  panel.className = 'setup-panel action-modal-panel aphrodite-panel';

  const title = document.createElement('h2');
  title.textContent = 'Aphrodite';
  panel.appendChild(title);

  const rule = document.createElement('p');
  rule.className = 'action-modal-line';
  // LA RÈGLE, dans les termes de `god-favors` — partagés avec le rendu de
  // `main`, pour que les deux disent la même chose. Le rappel de l'écran
  // s'y ajoute sans le contredire : il dit ce qu'on attend ICI, maintenant.
  rule.textContent =
    slots === 1
      ? `Un seul adversaire : associez-lui les deux dés.`
      : `Associez un dé à chacun \u2014 chacun avance ou recule, librement.`;
  panel.appendChild(rule);

  const grid = document.createElement('div');
  grid.className = 'aphrodite-grid';
  panel.appendChild(grid);

  const buttons = document.createElement('div');
  buttons.className = 'action-modal-buttons';

  const peekButton = document.createElement('button');
  peekButton.type = 'button';
  peekButton.className = 'btn btn-secondary';
  peekButton.id = 'aphrodite-peek';
  peekButton.textContent = 'Voir le plateau';

  const validateButton = document.createElement('button');
  validateButton.type = 'button';
  validateButton.className = 'btn btn-primary';
  validateButton.id = 'aphrodite-validate';
  validateButton.textContent = 'Valider';

  buttons.append(peekButton, validateButton);
  panel.appendChild(buttons);
  screen.appendChild(panel);

  const recall = document.createElement('button');
  recall.type = 'button';
  recall.className = 'action-modal-recall';
  recall.id = 'aphrodite-recall';
  recall.textContent = '\u{1F4DC} Revenir à Aphrodite';

  /**
   * Montre ou escamote l'écran.
   *
   * `hidden` seul NE SUFFIT PAS : `.setup-screen` pose `display: flex`, qui
   * l'emporte sur la feuille par défaut du navigateur. C'est le défaut que
   * Quentin avait vu sur l'APK, et il se reproduirait ici à l'identique.
   */
  const reveal = (element: HTMLElement, shown: boolean): void => {
    element.hidden = !shown;
    element.style.display = shown ? '' : 'none';
  };

  reveal(recall, false);

  /** Les choix arrêtés, sous la forme que le calcul attend. */
  const settled = (): AphroditeChoice[] => {
    const made: AphroditeChoice[] = [];

    for (let row = 0; row < slots; row += 1) {
      const slot = dicePicks[row];
      const direction = directions[row];
      if (slot === null || direction === null) continue;

      made.push({ player: picks[row], diceSlot: slot, dice: dice[slot], direction });
    }

    return made;
  };

  /** Redessine, et dit si « Valider » est à portée. */
  const render = (): void => {
    grid.replaceChildren();

    for (let row = 0; row < slots; row += 1) {
      const line = document.createElement('div');
      line.className = 'aphrodite-row';

      // QUI PART. Une liste déroulante par ligne, comme sur le croquis.
      const who = document.createElement('select');
      who.className = 'aphrodite-who';
      who.setAttribute('aria-label', `Adversaire ${row + 1}`);

      for (const target of targets) {
        const option = document.createElement('option');
        option.value = String(target.index);
        option.textContent = `${target.name} — case ${target.position + 1}`;
        option.selected = target.index === picks[row];

        // ON NE DÉPLACE PAS DEUX FOIS LE MÊME PION : un adversaire pris sur
        // une autre ligne n'est plus proposé ici. La règle était déjà
        // appliquée — « Valider » restait grisé — mais rien ne disait
        // POURQUOI, et le joueur cherchait ce qui n'allait pas.
        //
        // SA PROPRE SÉLECTION RESTE TOUJOURS ACTIVE : à deux adversaires et
        // deux lignes, il ne reste qu'une option libre par ligne. La griser
        // aussi viderait la liste, qui n'afficherait plus rien du tout.
        option.disabled =
          target.index !== picks[row] &&
          picks.some((pick, other) => other !== row && pick === target.index);

        who.appendChild(option);
      }

      who.addEventListener('change', () => {
        picks[row] = Number(who.value);
        render();
      });

      line.appendChild(who);

      // LES DEUX COLONNES, chacune portant les deux dés. Le dé pris ailleurs
      // s'y montre barré : la contrainte se voit au lieu de se subir.
      const columns = document.createElement('div');
      columns.className = 'aphrodite-columns';

      for (const column of COLUMNS) {
        const box = document.createElement('div');
        box.className = 'aphrodite-column';

        const head = document.createElement('div');
        head.className = 'aphrodite-sign';
        head.textContent = column.sign;
        head.title = column.label;
        box.appendChild(head);

        dice.forEach((face, slot) => {
          // UN DÉ NE SERT QU'UNE FOIS : pris sur une ligne, il se barre sur
          // l'autre. C'est la seule contrainte que la règle pose.
          //
          // LA DIRECTION, ELLE, EST LIBRE. Les deux adversaires peuvent
          // avancer, ou reculer ensemble : « déplacez-les en avant ou
          // arrière » ne demande pas un de chaque. Le croquis, avec sa
          // colonne unique de chaque signe, se lisait comme une contrainte —
          // Quentin a tranché dans l'autre sens, et c'est ce que fait `main`
          // depuis toujours.
          const takenElsewhere = dicePicks.some(
            (pick, other) => other !== row && pick === slot
          );

          const chosen = dicePicks[row] === slot && directions[row] === column.direction;
          const blocked = takenElsewhere;

          const face3 = document.createElement('button');
          face3.type = 'button';
          face3.className = 'aphrodite-die';
          face3.dataset.row = String(row);
          face3.dataset.slot = String(slot);
          face3.dataset.direction = column.direction;
          face3.textContent = String(face);
          face3.setAttribute(
            'aria-label',
            `Dé ${face}, ${column.label.toLowerCase()}`
          );

          if (chosen) face3.classList.add('is-chosen');
          if (blocked && !chosen) face3.classList.add('is-blocked');
          face3.disabled = blocked && !chosen;
          face3.setAttribute('aria-pressed', chosen ? 'true' : 'false');

          face3.addEventListener('click', () => {
            // Retoucher son propre choix le REPREND, plutôt que de le figer :
            // un joueur qui s'est trompé de colonne doit pouvoir se reprendre
            // sans rouvrir l'écran.
            if (chosen) {
              dicePicks[row] = null;
              directions[row] = null;
            } else {
              dicePicks[row] = slot;
              directions[row] = column.direction;
            }

            render();
          });

          box.appendChild(face3);
        });

        columns.appendChild(box);
      }

      line.appendChild(columns);
      grid.appendChild(line);
    }

    // « VALIDER » RESTE HORS D'ATTEINTE tant que les choix ne tiennent pas
    // debout : c'est plus clair qu'un message d'erreur après coup, et c'est
    // ce que le croquis suggère en barrant les dés déjà pris.
    validateButton.disabled = !aphroditeReady(settled(), slots);
  };

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

    const made = settled();
    if (!aphroditeReady(made, slots)) return;

    done = true;
    screen.remove();
    recall.remove();

    onDone(
      aphroditePlan(
        made,
        positionsOf(targets),
        lastPosition
      )
    );
  });

  render();
  host.append(screen, recall);
}

/**
 * Les positions des joueurs, rangées par leur rang dans la partie.
 *
 * `aphroditePlan` lit `positions[player]` : une liste dans l'ordre des
 * adversaires donnerait la position du mauvais pion dès que le joueur
 * courant n'est pas le dernier.
 */
function positionsOf(targets: AphroditeTarget[]): number[] {
  const positions: number[] = [];

  for (const target of targets) positions[target.index] = target.position;

  return positions;
}
