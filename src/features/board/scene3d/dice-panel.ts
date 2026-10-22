/**
 * LE PANNEAU DES DÉS — il coulisse depuis la droite, le plateau reste à gauche.
 *
 * Demande de Quentin, arbitrée le 22/10/2026 : « on lance l'implémentation du
 * layout gauche/droite maintenant, on verra comment ça rend sur Android en
 * portrait ». J'avais signalé que la largeur est la denrée rare en portrait
 * (TODO.md §2 : « 8 cases visibles sur 23 ») ; il a tranché d'essayer et
 * d'itérer sur le rendu réel. Ce module est donc écrit pour être AJUSTABLE :
 * la largeur tient dans une variable CSS, et le panneau est fermé par défaut.
 *
 * IL NE LANCE RIEN LUI-MÊME. Le lancer appartient à la scène — c'est elle qui
 * tient la physique du dé. Le panneau lui passe la main par `onRoll`, et se
 * contente d'AFFICHER la dernière face lue. Dupliquer le lancer ici ferait
 * deux dés et deux vérités.
 *
 * PAS DE SECONDE SCÈNE 3D. La maquette montrait les dés roulant dans le
 * panneau ; deux contextes WebGL sur `minSdk 22` (Android 5.1) risquent
 * l'échec d'allocation sur l'entrée de gamme. Le dé roule donc sur le plateau,
 * à gauche, et le panneau en affiche le résultat — ce que le mode cinéma fait
 * déjà pour le plein écran.
 *
 * LA LARGEUR CÉDÉE AU PANNEAU est publiée dans `--dice-panel`, que `#scene`
 * consomme. La scène se mesure sur son conteneur : elle recadre donc toute
 * seule sur la place qui lui reste.
 */

/** Ce que le panneau a besoin de savoir faire. */
export interface DicePanelHooks {
  /** Rendre la main pour un lancer. Le panneau ne lance jamais lui-même. */
  onRoll(): void;
  /** Prévenir que la largeur du plateau a changé, pour recadrer. */
  onResize?(): void;
}

/** Les éléments que le panneau pilote. */
export interface DicePanelElements {
  panel: HTMLElement | null;
  openButton: HTMLElement | null;
  closeButton: HTMLElement | null;
  rollButton: HTMLButtonElement | null;
  value: HTMLElement | null;
  caption: HTMLElement | null;
}

/** Ce que l'appelant garde en main. */
export interface DicePanel {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  /** La face lue, une fois le dé arrêté. */
  showFace(face: number): void;
  /** Griser le bouton pendant qu'un lancer est en cours. */
  setRollEnabled(enabled: boolean): void;
}

/** Va chercher les éléments dans la page. */
export function dicePanelElements(doc: Document = document): DicePanelElements {
  return {
    panel: doc.getElementById('dice-panel'),
    openButton: doc.getElementById('dice-open'),
    closeButton: doc.getElementById('dice-panel-close'),
    rollButton: doc.getElementById('dice-panel-roll') as HTMLButtonElement | null,
    value: doc.getElementById('dice-panel-value'),
    caption: doc.getElementById('dice-panel-caption'),
  };
}

/**
 * Branche le panneau, et rend de quoi le piloter.
 *
 * Tolère l'absence de chaque élément : la page du rendu CSS n'en porte aucun,
 * et le module ne doit pas faire tomber le jeu si un identifiant change.
 */
export function attachDicePanel(
  elements: DicePanelElements,
  hooks: DicePanelHooks,
  doc: Document = document
): DicePanel {
  let open = false;

  /** La dernière face lue, ou `null` tant qu'on n'a pas lancé. */
  let lastFace: number | null = null;

  /**
   * Publie l'état : la largeur cédée au plateau, et l'attribut qui anime.
   *
   * LA VARIABLE CSS EST LA SEULE SOURCE DE VÉRITÉ de la largeur. `#scene`
   * la consomme dans son `right`, et la scène, qui se mesure sur son
   * conteneur, recadre en conséquence. Poser une largeur en dur ici la
   * mettrait en concurrence avec la feuille de style.
   */
  const publish = (): void => {
    elements.panel?.setAttribute('data-open', String(open));
    doc.body.setAttribute('data-dice-panel', open ? 'open' : 'closed');

    // `--dice-panel-width` porte la largeur voulue, bornée par la feuille de
    // style ; on ne fait que l'appliquer ou la rendre.
    doc.documentElement.style.setProperty(
      '--dice-panel',
      open ? 'var(--dice-panel-width)' : '0px'
    );

    // LE RECADRAGE ATTEND LA FIN DE L'ANIMATION. Recadrer tout de suite
    // mesurerait la largeur de départ : `#scene` met 300 ms à céder la
    // place, et la scène lirait l'ancienne valeur.
    hooks.onResize?.();
  };

  /** Montre la face, ou l'absence de lancer. */
  const render = (): void => {
    if (elements.value) {
      elements.value.textContent = lastFace === null ? '—' : String(lastFace);
    }

    if (elements.caption) {
      elements.caption.textContent =
        lastFace === null ? 'Aucun lancer' : 'Dernier lancer';
    }
  };

  const panel: DicePanel = {
    open(): void {
      if (open) return;

      open = true;
      publish();
    },

    close(): void {
      if (!open) return;

      open = false;
      publish();
    },

    toggle(): void {
      open ? panel.close() : panel.open();
    },

    isOpen: () => open,

    showFace(face: number): void {
      lastFace = face;
      render();
    },

    setRollEnabled(enabled: boolean): void {
      if (elements.rollButton) elements.rollButton.disabled = !enabled;
    },
  };

  elements.openButton?.addEventListener('click', () => panel.open());
  elements.closeButton?.addEventListener('click', () => panel.close());

  // LE LANCER REVIENT À LA SCÈNE. Le panneau ne fait que transmettre : c'est
  // la scène qui tient la physique, et deux chemins de lancer donneraient
  // deux résultats concurrents.
  elements.rollButton?.addEventListener('click', () => hooks.onRoll());

  render();
  publish();

  return panel;
}
