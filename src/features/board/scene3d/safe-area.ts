/**
 * Les encoches et barres système, lues depuis le CSS.
 *
 * Avec `viewport-fit=cover`, la page occupe TOUT l'écran : encoche du haut et
 * barre de gestes du bas comprises. Le canvas s'étend donc sous des zones que
 * le système masque, et un plateau centré sur le canvas se retrouve décalé de
 * ce que l'encoche occupe. Le défaut ne se voit pas sur un navigateur de
 * bureau, où ces valeurs sont nulles — d'où un cadrage qui paraît correct en
 * développement et décalé sur un Pixel.
 *
 * Le navigateur n'expose ces valeurs qu'au CSS, via `env()`. On les fait donc
 * descendre par une variable, puis on les relit en pixels.
 */

export interface SafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const SIDES = ['top', 'bottom', 'left', 'right'] as const;

/** Élément sonde, créé une seule fois : le mesurer force un calcul de style. */
let probe: HTMLElement | null = null;

function ensureProbe(): HTMLElement {
  if (probe?.isConnected) return probe;

  probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  // Hors flux et invisible : la sonde ne doit rien changer à la mise en page.
  probe.style.cssText = [
    'position:fixed',
    'visibility:hidden',
    'pointer-events:none',
    'top:0',
    'left:0',
    'width:0',
    'height:0',
    // Les quatre encoches, reportées sur des propriétés qu'on sait relire.
    'padding-top:env(safe-area-inset-top, 0px)',
    'padding-bottom:env(safe-area-inset-bottom, 0px)',
    'padding-left:env(safe-area-inset-left, 0px)',
    'padding-right:env(safe-area-inset-right, 0px)',
  ].join(';');

  document.body.appendChild(probe);

  return probe;
}

/**
 * Mesure les encoches système, en pixels CSS.
 *
 * Renvoie des zéros quand le navigateur ne connaît pas `env()` — le cas d'un
 * navigateur de bureau, et celui des WebViews anciennes de la cible Android
 * 5.1, où l'absence d'encoche rend la question sans objet.
 */
export function readSafeArea(): SafeArea {
  const empty: SafeArea = { top: 0, bottom: 0, left: 0, right: 0 };

  if (typeof document === 'undefined' || !document.body) return empty;

  try {
    const style = getComputedStyle(ensureProbe());
    const read = (side: (typeof SIDES)[number]): number => {
      const value = parseFloat(style.getPropertyValue(`padding-${side}`));
      return Number.isFinite(value) && value > 0 ? value : 0;
    };

    return { top: read('top'), bottom: read('bottom'), left: read('left'), right: read('right') };
  } catch {
    // jsdom et les WebViews bridées : l'absence de mesure ne doit pas
    // empêcher le plateau de s'afficher.
    return empty;
  }
}

/** Libère la sonde. */
export function disposeSafeAreaProbe(): void {
  probe?.remove();
  probe = null;
}
