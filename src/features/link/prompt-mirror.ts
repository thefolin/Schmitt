/**
 * LES FENÊTRES DU PLATEAU, VUES ET VALIDÉES DEPUIS LE TÉLÉPHONE.
 *
 * Quentin (27/10/2026) : le téléphone doit pouvoir « valider / confirmer
 * les notifications, pas juste les recevoir ».
 *
 * Ce module REGARDE le plateau sans rien changer à ses fenêtres : toutes
 * suivent la même convention — un élément `.action-modal`, un bouton dont
 * l'identifiant finit par `-validate`. Valider depuis le téléphone, c'est
 * appuyer sur CE bouton-là, avec le même effet qu'un doigt sur le plateau.
 * Aucune seconde logique de validation à tenir à jour.
 *
 * SEULES LES FENÊTRES SANS CHOIX se valident à distance : le rappel de la
 * règle d'une case, celui de Poséidon. Hermès demande un sens et un
 * adversaire, Aphrodite une répartition — les valider de loin appliquerait
 * la sélection par défaut sans que personne ait choisi. Le téléphone les
 * montre, et dit que le choix se fait sur le plateau.
 */

/** Une fenêtre ouverte sur le plateau, telle que le téléphone l'affiche. */
export interface Prompt {
  /** Propre à CETTE fenêtre : une validation tardive ne vise pas la suivante. */
  id: number;
  title: string;
  lines: string[];
  /** Le libellé du bouton (« Valider », « Suivant »), ou `null` si le choix se fait sur le plateau. */
  action: string | null;
}

/** Les fenêtres qui se valident sans rien choisir. */
const VALIDATABLE = new Set(['action-modal', 'poseidon-screen']);

/** Ce qui ressemble à une fenêtre de jeu mais n'en est pas une. */
const IGNORED = new Set(['link-screen']);

export interface PromptWatch {
  current(): Prompt | null;
  /** Valide la fenêtre `id` si elle est encore ouverte et sans choix. */
  validate(id: number): boolean;
  stop(): void;
}

/**
 * Surveille les fenêtres posées dans `root`, et prévient à chaque fenêtre
 * qui s'ouvre ou se ferme.
 */
export function watchPrompts(root: HTMLElement, onChange: (prompt: Prompt | null) => void): PromptWatch {
  const ids = new WeakMap<Element, number>();
  let nextId = 1;
  let shown: number | null = null;

  /** La fenêtre du dessus : la dernière posée. */
  const topmost = (): HTMLElement | null => {
    const candidates = [...root.querySelectorAll<HTMLElement>(':scope > .action-modal')]
      .filter((element) => !IGNORED.has(element.id));

    return candidates[candidates.length - 1] ?? null;
  };

  const validateButton = (element: HTMLElement): HTMLButtonElement | null =>
    VALIDATABLE.has(element.id) ? element.querySelector<HTMLButtonElement>('button[id$="-validate"]') : null;

  const describe = (element: HTMLElement): Prompt => {
    if (!ids.has(element)) ids.set(element, nextId++);

    const button = validateButton(element);

    return {
      id: ids.get(element)!,
      title: element.querySelector('h2')?.textContent?.trim() ?? '',
      lines: [...element.querySelectorAll('.action-modal-line')]
        .map((line) => line.textContent?.trim() ?? '')
        .filter((text) => text !== ''),
      action: button ? (button.textContent?.trim() || 'Valider') : null,
    };
  };

  const current = (): Prompt | null => {
    const element = topmost();
    return element ? describe(element) : null;
  };

  const check = () => {
    const prompt = current();
    const id = prompt?.id ?? null;

    if (id === shown) return;
    shown = id;
    onChange(prompt);
  };

  const observer = new MutationObserver(check);
  observer.observe(root, { childList: true });
  check();

  return {
    current,
    validate(id: number): boolean {
      const element = topmost();
      if (element === null || ids.get(element) !== id) return false;

      const button = validateButton(element);
      if (button === null || button.disabled) return false;

      button.click();
      return true;
    },
    stop: () => observer.disconnect(),
  };
}
