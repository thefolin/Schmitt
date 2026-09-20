import {
  readDrafts,
  saveDrafts,
  toPlayers,
  addDraft,
  removeDraft,
  canAdd,
  canRemove,
  PLAYER_COLORS,
  MAX_PLAYERS,
  MAX_NAME_LENGTH,
  type PlayerDraft,
} from '@/features/game/player-drafts';

/**
 * L'écran qui demande QUI JOUE, avant que le plateau apparaisse.
 *
 * LE DÉFAUT QUE CELA CORRIGE : la scène 3D démarrait sur trois joueurs
 * écrits en dur — Alice, Bastien, Chloé. Impossible de jouer à quatre, de se
 * nommer, de choisir sa couleur. Sur un jeu à boire qui se joue en soirée,
 * c'est bloquant.
 *
 * NI LE STYLE NI LA LOGIQUE NE SONT RÉÉCRITS. `setup-screen.css` existe
 * depuis longtemps — 608 lignes réglées au pixel, colonnes grecques
 * comprises — et `player-drafts.ts` tient la persistance, partagée avec le
 * rendu CSS. Ce module ne fait que les brancher sur la scène 3D : il
 * construit le markup que la feuille attend, et rend la main quand le joueur
 * a décidé.
 *
 * Il ne connaît NI la scène NI les règles : il pose une question et renvoie
 * la réponse. C'est ce qui permet de le vérifier sans WebGL.
 */

/** Ce que l'écran renvoie quand le joueur lance la partie. */
export type SetupResult = PlayerDraft[];

/**
 * Affiche l'écran et attend la décision du joueur.
 *
 * La promesse n'est tenue QU'AU CLIC sur « Jouer » : tant que le joueur
 * n'a pas choisi, la scène ne démarre pas. Elle se résout avec les joueurs
 * corrigés — noms vides remplacés, couleurs en double départagées — prêts
 * pour `GameLogic`.
 */
export function askForPlayers(host: HTMLElement = document.body): Promise<SetupResult> {
  let drafts = readDrafts();

  return new Promise<SetupResult>(resolve => {
    const screen = document.createElement('div');
    screen.className = 'setup-screen';
    screen.id = 'setup-screen';

    screen.innerHTML = `
      <div class="setup-panel">
        <h2>Schmitt Odyssée</h2>

        <div class="players-section">
          <div class="players-head">
            <span class="players-legend">Joueurs</span>
            <span class="players-count" id="setup-count"></span>
          </div>

          <div class="player-inputs" id="setup-players"></div>

          <button type="button" class="add-player-btn" id="setup-add">
            <span class="add-player-plus">+</span> Ajouter un joueur
          </button>
        </div>

        <button class="btn btn-primary" id="setup-start">Jouer</button>
      </div>
    `;

    const list = screen.querySelector<HTMLElement>('#setup-players')!;
    const count = screen.querySelector<HTMLElement>('#setup-count')!;
    const add = screen.querySelector<HTMLButtonElement>('#setup-add')!;
    const start = screen.querySelector<HTMLButtonElement>('#setup-start')!;

    /** Redessine la liste depuis les brouillons, seule source de vérité. */
    const render = (): void => {
      list.innerHTML = '';

      drafts.forEach((draft, index) => {
        const row = document.createElement('div');
        row.className = 'player-input-item';

        const swatch = document.createElement('input');
        swatch.type = 'color';
        swatch.className = 'color-picker';
        swatch.value = draft.color;
        swatch.title = 'Couleur du pion';
        swatch.addEventListener('input', () => {
          drafts[index].color = swatch.value;
        });

        const name = document.createElement('input');
        name.type = 'text';

        name.value = draft.name;
        name.maxLength = MAX_NAME_LENGTH;
        name.placeholder = `Joueur ${index + 1}`;
        name.addEventListener('input', () => {
          drafts[index].name = name.value;
        });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'remove-player-btn';
        remove.textContent = '×';
        remove.title = 'Retirer ce joueur';
        remove.disabled = !canRemove(drafts);
        remove.addEventListener('click', () => {
          drafts = removeDraft(drafts, index);
          render();
        });

        row.append(swatch, name, remove);
        list.appendChild(row);
      });

      count.textContent = `${drafts.length} / ${MAX_PLAYERS}`;
      add.disabled = !canAdd(drafts);
    };

    add.addEventListener('click', () => {
      drafts = addDraft(drafts);
      render();
    });

    start.addEventListener('click', () => {
      // LES NOMS SONT RANGÉS TELS QUE SAISIS, et non corrigés : le joueur
      // qui a laissé un champ vide le retrouvera vide la prochaine fois,
      // plutôt que rebaptisé « Joueur 3 » sans l'avoir demandé.
      saveDrafts(drafts);

      screen.remove();
      resolve(toPlayers(drafts));
    });

    render();
    host.appendChild(screen);

    // Le premier champ prend le focus : sur téléphone, le clavier s'ouvre
    // sans un geste de plus, et la première chose à faire est de se nommer.
    list.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
  });
}

/** Les couleurs proposées, réexportées pour qui construit un autre écran. */
export { PLAYER_COLORS };
